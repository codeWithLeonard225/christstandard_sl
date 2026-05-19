import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const STAFF_COLLECTION = "Teachers";
const ATT_COLLECTION = "StaffAttendancePro";

const CLOCK_IN_HOUR = 7;
const CLOCK_IN_MINUTE = 45;

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function StaffAttendanceProfessional() {
  const { user } = useAuth();

  const schoolId = user?.schoolId || "N/A";

  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  // Search state for filtering names
  const [searchQuery, setSearchQuery] = useState("");

  // ==========================================
  // VIEW-ONLY CHECK FOR HISTORICAL RECORDS
  // ==========================================
  const isToday = useMemo(() => {
    return attendanceDate === getTodayDate();
  }, [attendanceDate]);

  // =========================
  // LOAD STAFF
  // =========================
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;

    const q = query(
      collection(db, STAFF_COLLECTION),
      where("schoolId", "==", schoolId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setStaffList(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Failed to load staff");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [schoolId]);

  // =========================
  // LOAD ATTENDANCE
  // =========================
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;

    loadAttendance();
  }, [attendanceDate, schoolId]);

  const loadAttendance = async () => {
    try {
      const q = query(
        collection(schoollpq, ATT_COLLECTION),
        where("schoolId", "==", schoolId),
        where("date", "==", attendanceDate)
      );

      const snap = await getDocs(q);

      const map = {};

      snap.docs.forEach((d) => {
        const data = d.data();

        map[data.teacherID] = {
          ...data,
          docId: d.id,
        };
      });

      setAttendanceRecords(map);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load attendance");
    }
  };

  // ==========================================
  // SORT & FILTER STAFF (As-you-type filter)
  // ==========================================
  const filteredAndSortedStaff = useMemo(() => {
    let list = [...staffList];

    // Filter by name match if search text exists
    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter((teacher) =>
        (teacher.teacherName || "").toLowerCase().includes(lowerQuery)
      );
    }

    // Sort alphabetically by name
    return list.sort((a, b) =>
      (a.teacherName || "").localeCompare(b.teacherName || "")
    );
  }, [staffList, searchQuery]);

  // =========================
  // CALCULATE LATE STATUS
  // =========================
  const getAttendanceStatus = () => {
    const now = new Date();
    const cutoff = new Date();

    cutoff.setHours(CLOCK_IN_HOUR);
    cutoff.setMinutes(CLOCK_IN_MINUTE);
    cutoff.setSeconds(0);

    if (now > cutoff) {
      return "Late";
    }

    return "Present";
  };

  // =========================
  // CLOCK IN
  // =========================
  const handleClockIn = async (teacher) => {
    if (!isToday) return;
    try {
      const existing = attendanceRecords[teacher.teacherID];

      if (existing) {
        toast.info("Attendance entry already exists for today");
        return;
      }

      const now = new Date();
      const status = getAttendanceStatus();

      await addDoc(collection(schoollpq, ATT_COLLECTION), {
        schoolId,
        teacherID: teacher.teacherID,
        teacherName: teacher.teacherName,
        date: attendanceDate,
        status,
        clockIn: now,
        clockOut: null,
        workingHours: 0,
        attendanceType: "ClockIn",
        registeredBy:
          user?.data?.adminID ||
          user?.data?.teacherID ||
          "System",
        createdAt: serverTimestamp(),
      });

      toast.success(`${teacher.teacherName} clocked in`);
      loadAttendance();
    } catch (err) {
      console.error(err);
      toast.error("Clock in failed");
    }
  };

  // =========================
  // CLOCK OUT
  // =========================
  const handleClockOut = async (teacherID) => {
    if (!isToday) return;
    try {
      const record = attendanceRecords[teacherID];

      if (!record) {
        toast.error("No attendance record found");
        return;
      }

      if (record.clockOut) {
        toast.info("Already clocked out");
        return;
      }

      const now = new Date();
      const clockIn = record.clockIn?.toDate
        ? record.clockIn.toDate()
        : new Date(record.clockIn);

      let workingHours = 0;

      if (clockIn) {
        workingHours =
          (now.getTime() - clockIn.getTime()) /
          (1000 * 60 * 60);
      }

      const ref = doc(
        schoollpq,
        ATT_COLLECTION,
        record.docId
      );

      await updateDoc(ref, {
        clockOut: now,
        workingHours: Number(workingHours.toFixed(2)),
      });

      toast.success("Clocked out successfully");
      loadAttendance();
    } catch (err) {
      console.error(err);
      toast.error("Clock out failed");
    }
  };

  // =========================
  // DID NOT CLOCK OUT
  // =========================
  const handleDidNotClockOut = async (teacherID) => {
    if (!isToday) return;
    try {
      const record = attendanceRecords[teacherID];

      if (!record) {
        toast.error("No attendance record found");
        return;
      }

      if (record.clockOut) {
        toast.info("Clock out status already logged");
        return;
      }

      const ref = doc(schoollpq, ATT_COLLECTION, record.docId);

      await updateDoc(ref, {
        clockOut: "Did Not Clock Out",
        workingHours: 0,
      });

      toast.warning("Flagged as: Did Not Clock Out");
      loadAttendance();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  // =========================
  // SPECIAL STATUS
  // =========================
  const handleSpecialStatus = async (teacher, status) => {
    if (!isToday) return;
    try {
      const existing = attendanceRecords[teacher.teacherID];

      if (existing) {
        toast.info("Attendance already recorded");
        return;
      }

      await addDoc(collection(schoollpq, ATT_COLLECTION), {
        schoolId,
        teacherID: teacher.teacherID,
        teacherName: teacher.teacherName,
        teacherCategory: teacher.teacherCategory,
        salary: Number(teacher.salary),
        formMasterClass: teacher.formMasterClass,
        date: attendanceDate,
        status,
        clockIn: null,
        clockOut: null,
        workingHours: 0,
        attendanceType: status,
        registeredBy:
          user?.data?.adminID ||
          user?.data?.teacherID ||
          "System",
        createdAt: serverTimestamp(),
      });

      toast.success(`${status} recorded`);
      loadAttendance();
    } catch (err) {
      console.error(err);
      toast.error("Failed");
    }
  };

  // =========================
  // STATUS DISPLAY
  // =========================
  const getStatusBadge = (record) => {
    if (!record) return <span className="px-3 py-1 rounded-full text-xs font-bold inline-block bg-gray-100 text-gray-700">Unmarked</span>;

    if (record.clockOut === "Did Not Clock Out") {
      return <span className="px-3 py-1 rounded-full text-xs font-bold inline-block bg-orange-100 text-orange-700">Missed Out</span>;
    }

    const baseClasses = "px-3 py-1 rounded-full text-xs font-bold inline-block";
    switch (record.status) {
      case "Present":
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Present</span>;
      case "Late":
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Late</span>;
      case "Absent":
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Absent</span>;
      case "Sick":
        return <span className={`${baseClasses} bg-purple-100 text-purple-700`}>Sick</span>;
      case "Leave":
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Leave</span>;
      case "Excuse":
        return <span className={`${baseClasses} bg-cyan-100 text-cyan-700`}>Excuse</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>Unmarked</span>;
    }
  };

  // =========================
  // SUMMARY
  // =========================
  const summary = useMemo(() => {
    const records = Object.values(attendanceRecords);

    return {
      present: records.filter((r) => r.status === "Present" && r.clockOut !== "Did Not Clock Out").length,
      late: records.filter((r) => r.status === "Late" && r.clockOut !== "Did Not Clock Out").length,
      absent: records.filter((r) => r.status === "Absent").length,
      sick: records.filter((r) => r.status === "Sick").length,
      leave: records.filter((r) => r.status === "Leave").length,
      missedOut: records.filter((r) => r.clockOut === "Did Not Clock Out").length,
    };
  }, [attendanceRecords]);

  const formatTime = (clockOutValue) => {
    if (!clockOutValue) return "--";
    if (clockOutValue === "Did Not Clock Out") return "No Show";

    const dateObj = clockOutValue?.seconds ? new Date(clockOutValue.seconds * 1000) : new Date(clockOutValue);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (schoolId === "N/A") {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-red-500 font-semibold">No School ID Found</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-3 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white shadow-md sm:shadow-xl rounded-xl sm:rounded-2xl p-4 sm:p-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">
                Staff Attendance System
              </h1>
              {!isToday && (
                <span className="bg-gray-100 text-gray-600 border border-gray-300 text-xs font-semibold px-2.5 py-1 rounded-md tracking-wide uppercase">
                  View Only Mode
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Professional Clock In / Clock Out Dashboard
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <input
              type="date"
              value={attendanceDate}
              max={getTodayDate()}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-green-700">Present</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-green-800 mt-1">{summary.present}</h2>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-yellow-700">Late</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-yellow-800 mt-1">{summary.late}</h2>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-red-700">Absent</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-red-800 mt-1">{summary.absent}</h2>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-purple-700">Sick</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-purple-800 mt-1">{summary.sick}</h2>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-blue-700">Leave</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-800 mt-1">{summary.leave}</h2>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
            <p className="text-xs sm:text-sm font-medium text-orange-700">No Clock Out</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-orange-800 mt-1">{summary.missedOut}</h2>
          </div>
        </div>

        {/* AS-YOU-TYPE FILTER ELEMENT */}
        <div className="mb-5 flex items-center max-w-md relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search teacher by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* MAIN DATA INTERFACE */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 font-medium">Loading records...</div>
        ) : (
          <>
            {/* 1. MOBILE RESPONSIVE CARDS */}
            <div className="block md:hidden space-y-4">
              {filteredAndSortedStaff.length === 0 ? (
                <p className="text-center text-gray-500 py-8 bg-gray-50 rounded-xl border border-dashed">No staff profiles match your search.</p>
              ) : (
                filteredAndSortedStaff.map((teacher) => {
                  const record = attendanceRecords[teacher.teacherID];
                  return (
                    <div key={teacher.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-gray-800 text-base">{teacher.teacherName}</h3>
                          <p className="text-xs text-gray-500">ID: {teacher.teacherID}</p>
                        </div>
                        <div>{getStatusBadge(record)}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center text-xs text-gray-600">
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-semibold">In</p>
                          <p className="font-medium mt-0.5">{formatTime(record?.clockIn)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-semibold">Out</p>
                          <p className={`font-medium mt-0.5 ${record?.clockOut === "Did Not Clock Out" ? "text-orange-600 font-bold" : ""}`}>
                            {formatTime(record?.clockOut)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-semibold">Hours</p>
                          <p className="font-medium mt-0.5">{record?.workingHours || 0}h</p>
                        </div>
                      </div>

                      {/* MOBILE CARD ACTIONS */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          onClick={() => handleClockIn(teacher)}
                          disabled={!isToday || !!record}
                          className="flex-1 min-w-[75px] bg-green-600 text-white py-1.5 px-2 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          Clock In
                        </button>
                        <button
                          onClick={() => handleClockOut(teacher.teacherID)}
                          disabled={!isToday || !record?.clockIn || !!record?.clockOut}
                          className="flex-1 min-w-[75px] bg-indigo-600 text-white py-1.5 px-2 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          Clock Out
                        </button>
                        <button
                          onClick={() => handleDidNotClockOut(teacher.teacherID)}
                          disabled={!isToday || !record?.clockIn || !!record?.clockOut}
                          className="flex-1 min-w-[100px] bg-orange-500 text-white py-1.5 px-2 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          No Clock Out
                        </button>
                        <button
                          onClick={() => handleSpecialStatus(teacher, "Sick")}
                          disabled={!isToday || !!record}
                          className="flex-1 min-w-[55px] bg-purple-600 text-white py-1.5 px-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          Sick
                        </button>
                        <button
                          onClick={() => handleSpecialStatus(teacher, "Leave")}
                          disabled={!isToday || !!record}
                          className="flex-1 min-w-[55px] bg-blue-600 text-white py-1.5 px-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          Leave
                        </button>
                        <button
                          onClick={() => handleSpecialStatus(teacher, "Absent")}
                          disabled={!isToday || !!record}
                          className="flex-1 min-w-[60px] bg-red-600 text-white py-1.5 px-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. TABLE INTERFACE */}
            <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl shadow-inner bg-white">
              {filteredAndSortedStaff.length === 0 ? (
                <p className="text-center text-gray-500 py-12 font-medium">No records match your search phrase.</p>
              ) : (
                <table className="min-w-[1200px] w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-[18%] px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Teacher</th>
                     
                      <th className="w-[10%] px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Clock In</th>
                      <th className="w-[10%] px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Clock Out</th>
                      <th className="w-[10%] px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="w-[10%] px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="w-[32%] px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedStaff.map((teacher) => {
                      const record = attendanceRecords[teacher.teacherID];
                      return (
                        <tr key={teacher.id} className="hover:bg-gray-50 transition">
                          {/* Profile Combo Column (Saves Massive Width) */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-gray-900">{teacher.teacherName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-gray-400">
                              <span>ID: {teacher.teacherID}</span>
                              <span>•</span>
                              <span className="text-indigo-600 font-sans font-semibold">{teacher.teacherCategory}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">{formatTime(record?.clockIn)}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-center text-sm ${record?.clockOut === "Did Not Clock Out" ? "text-orange-600 font-bold font-mono" : "text-gray-600"}`}>
                            {formatTime(record?.clockOut)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-700">{record?.workingHours || 0} hrs</td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">{getStatusBadge(record)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleClockIn(teacher)}
                                disabled={!isToday || !!record}
                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Clock In
                              </button>
                              <button
                                onClick={() => handleClockOut(teacher.teacherID)}
                                disabled={!isToday || !record?.clockIn || !!record?.clockOut}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Clock Out
                              </button>
                              <button
                                onClick={() => handleDidNotClockOut(teacher.teacherID)}
                                disabled={!isToday || !record?.clockIn || !!record?.clockOut}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                No Clock Out
                              </button>
                              <button
                                onClick={() => handleSpecialStatus(teacher, "Sick")}
                                disabled={!isToday || !!record}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Sick
                              </button>
                              <button
                                onClick={() => handleSpecialStatus(teacher, "Leave")}
                                disabled={!isToday || !!record}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Leave
                              </button>
                              <button
                                onClick={() => handleSpecialStatus(teacher, "Excuse")}
                                disabled={!isToday || !!record}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Excuse
                              </button>
                              <button
                                onClick={() => handleSpecialStatus(teacher, "Absent")}
                                disabled={!isToday || !!record}
                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium disabled:bg-gray-200 disabled:text-gray-400 transition"
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}