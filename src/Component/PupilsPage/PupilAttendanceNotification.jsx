import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// Localforage instance
const attendanceStore = localforage.createInstance({
  name: "AttendanceCache",
  storeName: "pupil_attendance",
});

// Helper for status styling
const getAttendanceBadge = (status) => {
  switch (status) {
    case "Present":
      return "bg-green-100 border-green-500 text-green-700";
    case "Late":
      return "bg-amber-100 border-amber-500 text-amber-700";
    case "Excuse":
    case "Leave":
      return "bg-blue-100 border-blue-500 text-blue-700";
    case "Absent":
      return "bg-red-100 border-red-500 text-red-700";
    default:
      return "bg-gray-100 border-gray-400 text-gray-700";
  }
};

const PupilAttendanceNotification = () => {
  const { user } = useAuth();
  const authPupilData = user?.role === "pupil" ? user.data : null;
  const location = useLocation();
  const navPupilData = location.state?.user || {};
  const pupilData = authPupilData || navPupilData;

  const schoolId = pupilData?.schoolId || location.state?.schoolId || "N/A";

  const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
  const [loadingReg, setLoadingReg] = useState(true);

  // Attendance states
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [currentDateAttendance, setCurrentDateAttendance] = useState(null);

  const selectedClass = latestInfo.class;
  const selectedPupil = pupilData.studentID;

  // Request browser notification permissions on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Helper function to send push notifications
  const sendParentNotification = (record) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const title = `Attendance Alert: ${record.studentName || "Pupil"}`;
      let body = `Status: ${record.status}.`;

      if (record.clockInTime) {
        body += ` Clock In: ${record.clockInTime}.`;
      }
      if (record.clockOutTime) {
        body += ` Clock Out: ${record.clockOutTime}.`;
      }

      new Notification(title, {
        body,
        icon: record.userPhotoUrl || "/favicon.ico",
      });
    }
  };

  // 1. FETCH PUPIL REGISTRATION
  useEffect(() => {
    if (!selectedPupil || schoolId === "N/A") {
      setLoadingReg(false);
      return;
    }
    const pupilRegRef = query(
      collection(db, "PupilsReg"),
      where("studentID", "==", selectedPupil),
      where("schoolId", "==", schoolId)
    );
    const unsubscribe = onSnapshot(
      pupilRegRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const d = snapshot.docs[0].data();
          setLatestInfo({ class: d.class, academicYear: d.academicYear });
        }
        setLoadingReg(false);
      },
      (error) => {
        console.error("Error fetching pupil registration:", error);
        setLoadingReg(false);
      }
    );
    return () => unsubscribe();
  }, [selectedPupil, schoolId]);

  // 2. LISTEN TO ATTENDANCE LOGS (UPDATED COLLECTION)
  useEffect(() => {
    if (!selectedPupil || schoolId === "N/A") return;
    setLoadingAttendance(true);

    const ATT_CACHE_KEY = `attendance_${schoolId}_${selectedPupil}`;

    // Load cached data first
    const loadCachedData = async () => {
      try {
        const cachedData = await attendanceStore.getItem(ATT_CACHE_KEY);
        if (cachedData?.data) {
          const sorted = [...cachedData.data].sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
          );
          setAttendanceRecords(sorted);
          setCurrentDateAttendance(sorted[0] || null);
        }
      } catch (e) {
        console.error("Failed to load cached attendance:", e);
      }
    };
    loadCachedData();

    // Query AttendanceLogs collection written by AttendanceScanner
    const q = query(
      collection(db, "AttendanceLogs"),
      where("studentID", "==", selectedPupil),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => doc.data());
        const sortedRecords = records.sort((a, b) =>
          (b.date || "").localeCompare(a.date || "")
        );

        // Check if there's a new or updated record for notification
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            sendParentNotification(data);
          }
        });

        setAttendanceRecords(sortedRecords);
        setCurrentDateAttendance(sortedRecords[0] || null);

        attendanceStore
          .setItem(ATT_CACHE_KEY, { timestamp: Date.now(), data: sortedRecords })
          .catch((e) => console.error("Failed to cache attendance:", e));

        setLoadingAttendance(false);
      },
      (error) => {
        console.error("Attendance listener error:", error);
        setLoadingAttendance(false);
      }
    );

    return () => unsubscribe();
  }, [selectedPupil, schoolId]);

  if (loadingReg) {
    return (
      <div className="text-center p-8 text-indigo-600 font-medium">
        Loading pupil registration...
      </div>
    );
  }

  if (!pupilData.studentID) {
    return (
      <div className="text-center p-8 bg-white shadow-xl rounded-2xl max-w-3xl mx-auto">
        <h2 className="text-xl text-red-600 font-bold">Error</h2>
        <p className="text-gray-600 mt-2">
          Pupil ID not found. Please ensure you are logged in or navigated correctly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      {/* Pupil Info Header */}
      <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
        <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold overflow-hidden">
          <img
            src={pupilData.userPhotoUrl || "https://via.placeholder.com/80"}
            alt="Pupil"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/80";
            }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            {pupilData.studentName || "Student Attendance Profile"}
          </h2>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Class:</span> {selectedClass || "N/A"}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Student ID:</span> {selectedPupil}
          </p>
        </div>
      </div>

      {/* Latest Attendance Card */}
      <div className="mb-6 p-5 border rounded-xl shadow-sm bg-white">
        <h3 className="text-lg font-bold text-center text-indigo-600 mb-4 border-b pb-2">
          Latest Attendance Status 🔔
        </h3>

        {loadingAttendance ? (
          <p className="text-center text-indigo-500 text-sm">
            Fetching latest attendance...
          </p>
        ) : currentDateAttendance ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <div>
                <p className="text-sm text-gray-500 font-semibold">
                  Date: {currentDateAttendance.date}
                </p>
                <div className="flex gap-4 mt-1 text-xs text-gray-700">
                  <p>
                    In:{" "}
                    <span className="font-bold text-green-600">
                      {currentDateAttendance.clockInTime || "--"}
                    </span>
                  </p>
                  <p>
                    Out:{" "}
                    <span className="font-bold text-blue-600">
                      {currentDateAttendance.clockOutTime || "--"}
                    </span>
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getAttendanceBadge(
                  currentDateAttendance.status
                )}`}
              >
                {currentDateAttendance.status}
              </span>
            </div>

            {currentDateAttendance.note && (
              <p className="text-xs text-gray-600 italic bg-amber-50 p-2 rounded border border-amber-200">
                Note: {currentDateAttendance.note}
              </p>
            )}

            {currentDateAttendance.status === "Absent" && (
              <p className="text-red-700 text-xs italic text-center font-semibold bg-red-50 p-2 rounded-md">
                ⚠️ The pupil was marked Absent. Please contact the school if this is incorrect.
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 text-sm">
            No attendance records found for this pupil.
          </p>
        )}
      </div>

      {/* Full Attendance History Table */}
      {attendanceRecords.length > 0 && (
        <div className="p-5 border rounded-xl shadow-sm bg-white">
          <h3 className="text-lg font-bold text-center text-indigo-700 mb-4 border-b pb-2">
            Attendance History 📅
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Clock In</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Clock Out</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendanceRecords.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{record.date}</td>
                    <td className="px-4 py-2.5 text-green-700 font-semibold">
                      {record.clockInTime || "--"}
                    </td>
                    <td className="px-4 py-2.5 text-blue-700 font-semibold">
                      {record.clockOutTime || "--"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getAttendanceBadge(
                          record.status
                        )}`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PupilAttendanceNotification;