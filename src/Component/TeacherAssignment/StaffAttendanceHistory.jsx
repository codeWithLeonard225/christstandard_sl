import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const ATT_COLLECTION = "StaffAttendancePro";

export default function StaffAttendanceRecords() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  // =========================================
  // FETCH ALL RECORDS FOR THE SCHOOL
  // =========================================
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    fetchAttendanceRecords();
  }, [schoolId]);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(schoollpq, ATT_COLLECTION),
        where("schoolId", "==", schoolId)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort chronological: Latest logs show first
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to retrieve professional attendance logs.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // FILTER RECORDS BY DATE & SEARCH QUERY
  // =========================================
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        (record.teacherName || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (record.teacherID || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesDate = selectedDate ? record.date === selectedDate : true;
      return matchesSearch && matchesDate;
    });
  }, [records, searchQuery, selectedDate]);

  // =========================================
  // DELETE SINGLE RECORD
  // =========================================
  const handleDeleteSingle = async (id, name) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the attendance log for ${name}?`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      await deleteDoc(doc(schoollpq, ATT_COLLECTION, id));
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Log entry deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Could not complete targeted deletion.");
    } finally {
      setDeletingId("");
    }
  };

  // =======================================================
  // BATCH PURGE FILTERED (BY DATE / SEARCH) OR ALL
  // =======================================================
  const handlePurgeRecords = async () => {
    if (filteredRecords.length === 0) {
      toast.info("No logs match the current active view criteria.");
      return;
    }

    // Inform user exactly what subset of data is about to be deleted
    let confirmationMessage = "";
    if (selectedDate && searchQuery) {
      confirmationMessage = `Warning: This will delete ALL ${filteredRecords.length} records matching "${searchQuery}" on the date: ${selectedDate}. Proceed?`;
    } else if (selectedDate) {
      confirmationMessage = `Warning: This will delete ALL ${filteredRecords.length} records on the specific date: ${selectedDate}. Proceed?`;
    } else if (searchQuery) {
      confirmationMessage = `Warning: This will clear all ${filteredRecords.length} historical instances for active filter "${searchQuery}". Proceed?`;
    } else {
      confirmationMessage = `🚨 CRITICAL: You have NO filter selected. This will wipe out the entire master file of ${filteredRecords.length} records for this institution. Proceed?`;
    }

    const doubleCheck = window.confirm(confirmationMessage);
    if (!doubleCheck) return;

    try {
      setIsPurging(true);
      const batch = writeBatch(schoollpq);

      // Add all filtered records to atomic batch array
      filteredRecords.forEach((record) => {
        const docRef = doc(schoollpq, ATT_COLLECTION, record.id);
        batch.delete(docRef);
      });

      await batch.commit();

      // Clear matching records cleanly from local React UI array
      const deletedIds = new Set(filteredRecords.map((r) => r.id));
      setRecords((prev) => prev.filter((record) => !deletedIds.has(record.id)));

      toast.success(`Successfully deleted ${filteredRecords.length} records.`);
    } catch (err) {
      console.error(err);
      toast.error("Batch mutation pipeline failed.");
    } finally {
      setIsPurging(false);
    }
  };

  // =========================================
  // TIME PARSER HELPERS
  // =========================================
  const formatClockTime = (timeField) => {
    if (!timeField) return "--";
    const dateObj = timeField?.seconds ? new Date(timeField.seconds * 1000) : new Date(timeField);
    return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusStyle = (status, clockOut) => {
    const defaultBase = "px-3 py-1 rounded-full text-xs font-bold inline-block ";
    if (clockOut === "Did Not Clock Out") {
      return defaultBase + "bg-orange-100 text-orange-700";
    }
    switch (status) {
      case "Present": return defaultBase + "bg-green-100 text-green-700";
      case "Late": return defaultBase + "bg-yellow-100 text-yellow-700";
      case "Absent": return defaultBase + "bg-red-100 text-red-700";
      case "Sick": return defaultBase + "bg-purple-100 text-purple-700";
      case "Leave": return defaultBase + "bg-blue-100 text-blue-700";
      case "Excuse": return defaultBase + "bg-cyan-100 text-cyan-700";
      default: return defaultBase + "bg-gray-100 text-gray-700";
    }
  };

  if (schoolId === "N/A") {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-red-50 text-red-700 text-center rounded-xl border border-red-200">
        <p className="font-bold">Access Denied: Missing School Identifier Context.</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-3 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white shadow-xl rounded-2xl p-4 sm:p-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-5 mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">
              Attendance Records Archive
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Administrative cleanups, verification logs, and date filtering
            </p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-indigo-600 block uppercase font-bold tracking-wider">Filtered View Count</span>
            <span className="text-xl font-black text-indigo-900">{filteredRecords.length} / {records.length}</span>
          </div>
        </div>

        {/* CONTROLS AREA */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            <input
              type="text"
              placeholder="Filter by teacher name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {(searchQuery || selectedDate) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDate("");
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition p-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* DYNAMIC CLEAR ACTION */}
          <button
            onClick={handlePurgeRecords}
            disabled={isPurging || filteredRecords.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:bg-gray-300 disabled:text-gray-400 flex items-center justify-center gap-2 shadow-sm"
          >
            {isPurging ? (
              <span>Processing Request...</span>
            ) : (
              <>
                <span>🗑️</span>
                <span>
                  {selectedDate || searchQuery 
                    ? `Clear Active Selection (${filteredRecords.length})` 
                    : "Wipe Complete Data Log"}
                </span>
              </>
            )}
          </button>
        </div>

        {/* ARCHIVE INTERFACE GRID / TABLE */}
        {loading ? (
          <div className="text-center py-20 text-indigo-600 font-medium animate-pulse">
            Syncing system database configurations...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 bg-gray-200/20 rounded-xl">
            <p className="text-gray-500 font-medium">No system entries found for the selected view criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="w-full divide-y divide-gray-200 text-left min-w-[900px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase">Teacher</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase">Staff ID</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase text-center">Date</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase text-center">In / Out</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase text-center">Total Time</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase text-center">Status</th>
                  <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                      {record.teacherName || "Unrecorded Profiling"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.teacherID}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-mono text-gray-600">
                      {record.date}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-center font-medium">
                      <span className="text-green-600">{formatClockTime(record.clockIn)}</span>
                      <span className="text-gray-300 mx-1.5">|</span>
                      <span className={record.clockOut === "Did Not Clock Out" ? "text-orange-600 font-bold" : "text-indigo-600"}>
                        {record.clockOut === "Did Not Clock Out" ? "No Show" : formatClockTime(record.clockOut)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-700">
                      {record.workingHours || 0} hrs
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={getStatusStyle(record.status, record.clockOut)}>
                        {record.clockOut === "Did Not Clock Out" ? "Missed Out" : record.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm">
                      <button
                        onClick={() => handleDeleteSingle(record.id, record.teacherName)}
                        disabled={deletingId === record.id}
                        className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 px-3 py-1 rounded-md text-xs font-medium transition disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {deletingId === record.id ? "Wiping..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}