import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { db } from "../../../firebase"; 
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

const STORE_NAME = "StaffSimpleCache";
const ATT_COLLECTION = "StaffAttendanceSimple";
const STAFF_COLLECTION = "Teachers";
const LOCK_DURATION_HOURS = 2;

const staffStore = localforage.createInstance({
  name: STORE_NAME,
  storeName: "staff_simple",
});

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function StaffAttendanceSimple() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [unsaved, setUnsaved] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState({}); 

  const CACHE_KEY = `staff_list_${schoolId}`;

  // Load staff list (cache-first) and realtime sync
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    setLoading(true);

    let isMounted = true;

    (async () => {
      try {
        const cached = await staffStore.getItem(CACHE_KEY);
        if (cached && cached.length && isMounted) {
          setStaffList(cached);
          setLoading(false);
        }
      } catch (e) {
        console.error("staff cache load failed", e);
      }

      const q = query(collection(db, STAFF_COLLECTION), where("schoolId", "==", schoolId));
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setStaffList(list);
          staffStore.setItem(CACHE_KEY, list).catch(() => {});
          setLoading(false);
        },
        (err) => {
          console.error("Staff list onSnapshot failed", err);
          if (isMounted) {
            setLoading(false);
            toast.error("Failed to load staff list.");
          }
        }
      );

      return () => {
        isMounted = false;
        unsub();
      };
    })();
  }, [schoolId, CACHE_KEY]);

  // Fetch attendance records for the date
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    
    let isMounted = true;
    (async () => {
      try {
        const q = query(
          collection(schoollpq, ATT_COLLECTION), 
          where("schoolId", "==", schoolId),
          where("date", "==", attendanceDate)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[data.staffID] = { 
            status: data.status, 
            docId: d.id,
            time: data.time?.toDate()
          }; 
        });
        setAttendanceRecords(map);
        setUnsaved({});
      } catch (err) {
        console.error("fetch simple attendance failed", err);
        if (isMounted) {
          toast.error("Failed to load attendance records.");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [schoolId, attendanceDate]);

  // Sort staff list by name dynamically
  const filtered = useMemo(() => {
    return [...staffList].sort((a, b) => 
      (a.teacherName || "").localeCompare(b.teacherName || "")
    );
  }, [staffList]);

  // Logic to check if a specific staff member's record should be locked
  const isAttendanceLocked = useCallback((staffID) => { 
    const today = getTodayDate();
    
    if (attendanceDate !== today) {
        return true;
    }

    const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
    const staffIDToUse = staff?.teacherID || staffID;
    const record = attendanceRecords[staffIDToUse];
    
    if (record && record.time instanceof Date) { 
        const recordTime = record.time.getTime(); 
        const currentTime = new Date().getTime();
        
        const timeDifferenceMs = currentTime - recordTime;
        const lockDurationMs = LOCK_DURATION_HOURS * 60 * 60 * 1000;

        return timeDifferenceMs > lockDurationMs;
    }
    
    return false;
  }, [attendanceDate, attendanceRecords, staffList]);

  // New drop-down change handler tracking 7:45 AM threshold rules
  const handleAttendanceChange = (staffID, status) => { 
    if (isAttendanceLocked(staffID)) {
         toast.warn(`Attendance for ${attendanceDate} is locked (${LOCK_DURATION_HOURS}-hour limit passed or old date).`, { autoClose: 2000 });
         return;
    }

    let finalStatus = status;

    // Check if Present needs to drop back to Late status
    if (status === "Present") {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(7, 45, 0, 0); 

      if (now > cutoff) {
        finalStatus = "Late";
        toast.info("Marked as Late (Time past 7:45 AM)", { autoClose: 1500 });
      }
    }
    
    setUnsaved(prev => ({ 
        ...prev,
        [staffID]: finalStatus
    }));
  };

  // Bulk save current dashboard updates to Firestore
  const handleSave = async () => {
    if (Object.keys(unsaved).length === 0) {
      toast.info("No changes to save");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const registeredBy = user?.data?.adminID || user?.data?.teacherID || "System";
      const saves = [];
      const now = new Date(); 
      
      for (const [staffID, status] of Object.entries(unsaved)) {
        const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
        const staffIDToUse = staff?.teacherID || staffID;
        
        const newRec = {
          schoolId,
          staffID: staffIDToUse,
          staffName: staff?.teacherName || "Unknown",
          date: attendanceDate,
          time: now, 
          status,
          registeredBy,
        };

        const existing = attendanceRecords[staffIDToUse];
        if (existing && existing.docId) {
          const ref = doc(schoollpq, ATT_COLLECTION, existing.docId);
          saves.push(updateDoc(ref, { status, time: now }));
        } else {
          saves.push(addDoc(collection(schoollpq, ATT_COLLECTION), newRec));
        }
      }
      await Promise.all(saves);
      toast.success("✅ Attendance saved successfully!");
      
      const q = query(
        collection(schoollpq, ATT_COLLECTION), 
        where("schoolId", "==", schoolId),
        where("date", "==", attendanceDate)
      );
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => {
        map[d.data().staffID] = { 
          status: d.data().status, 
          docId: d.id, 
          time: d.data().time?.toDate()
        };
      });
      setAttendanceRecords(map);
      setUnsaved({});
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to save attendance");
    } finally {
        setIsSaving(false);
    }
  };
  
  // Updated status pill component for broader range mapping
  const getStatusDisplay = (status) => {
    switch (status) {
        case "Present":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">Present</span>;
        case "Late":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Late</span>;
        case "Absent":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">Absent</span>;
        case "Leave":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Leave</span>;
        case "Sick":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-300">Sick</span>;
        case "Excuse":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-300">Excuse</span>;
        case "Unmarked":
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-300">Unmarked</span>;
        default:
            return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">Error</span>;
    }
  };
    
  const hasUnsavedChanges = Object.keys(unsaved).length > 0;
    
  if (schoolId === "N/A") {
    return (
        <div className="max-w-4xl mx-auto p-6 bg-red-100 text-red-800 border border-red-300 rounded shadow">
            <p className="font-bold">Access Error:</p>
            <p>School ID not found. Please log in again or check user context.</p>
        </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-3xl font-extrabold mb-6 text-center text-indigo-700">
                Staff Daily Attendance 🗓️
            </h2>

            {/* --- Filter & Action Bar --- */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="w-full sm:w-auto">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Attendance Date:</label>
                    <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        max={getTodayDate()}
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 bg-white"
                        disabled={loading || isSaving}
                    />
                </div>
                
                <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                    <p className={`text-sm font-medium ${hasUnsavedChanges ? 'text-orange-600' : 'text-gray-500'} mb-2`}>
                        {hasUnsavedChanges ? `${Object.keys(unsaved).length} unsaved change(s)` : "No pending changes"}
                    </p>
                    <button 
                        onClick={handleSave} 
                        disabled={!hasUnsavedChanges || isSaving || loading}
                        className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? "Saving..." : "💾 Save Attendance"}
                    </button>
                </div>
            </div>

            {/* --- Staff List / Loading State --- */}
            {loading ? (
                <div className="text-center p-8 text-indigo-600 bg-indigo-50 rounded-lg shadow-inner">
                    <p className="font-medium text-lg">Loading staff records...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg shadow-inner">
                    <p className="font-medium text-lg">No staff members found in the system for this school.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-4/12">Staff Name</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12 hidden sm:table-cell">Staff ID</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/12">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12">Change Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filtered.map((s) => {
                                const idKey = s.teacherID || s.id;
                                const saved = attendanceRecords[idKey]?.status;
                                const uns = unsaved[idKey];
                                const status = uns || saved || "Unmarked";
                                
                                const rowHasUnsaved = !!uns;
                                const isLocked = isAttendanceLocked(idKey);

                                return (
                                    <tr 
                                        key={s.id} 
                                        className={`hover:bg-gray-50 ${rowHasUnsaved ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''} ${isLocked ? 'bg-gray-100 opacity-60' : ''}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {s.teacherName} {isLocked && '🔒'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                            {s.teacherID || "N/A"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusDisplay(status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="inline-block relative w-40">
                                                <select
                                                    value={status === "Late" ? "Present" : status}
                                                    onChange={(e) => handleAttendanceChange(idKey, e.target.value)}
                                                    disabled={isSaving || isLocked}
                                                    className="block w-full bg-white border border-gray-300 hover:border-gray-400 px-3 py-1.5 pr-8 rounded-lg text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition"
                                                >
                                                    <option value="Unmarked" disabled>Select Status</option>
                                                    <option value="Present">Present</option>
                                                    <option value="Absent">Absent</option>
                                                    <option value="Leave">Leave</option>
                                                    <option value="Sick">Sick</option>
                                                    <option value="Excuse">Excuse</option>
                                                </select>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
}