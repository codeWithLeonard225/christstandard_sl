import React, { useState, useEffect, useMemo } from "react";
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

const STORE_NAME = "PayrollCache";
const PAYROLL_COLLECTION = "StaffPayroll";
const STAFF_COLLECTION = "Teachers";
const ATT_COLLECTION = "StaffAttendanceSimple"; // Source for metric rules

const payrollStore = localforage.createInstance({
  name: STORE_NAME,
  storeName: "payroll_data",
});

const getCurrentMonthYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Helper: Counts exact Monday through Friday days in a given year-month string (YYYY-MM)
const countWorkingDaysInMonth = (monthYearStr) => {
  const [year, month] = monthYearStr.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate(); 
  let workingDaysCount = 0;

  for (let day = 1; day <= totalDays; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
      workingDaysCount++;
    }
  }
  return workingDaysCount || 22; // Safe backup fallback
};

export default function PayrollPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  
  const [staffList, setStaffList] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState({});
  const [attendanceLogs, setAttendanceLogs] = useState([]); // Raw logs for current month aggregation
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Manual text adjustments
  const [adjustments, setAdjustments] = useState({});

  const CACHE_KEY_STAFF = `payroll_staff_${schoolId}`;

  // 1. Fetch Staff List (Cache-First + Sync)
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    setLoading(true);
    let isMounted = true;

    (async () => {
      try {
        const cached = await payrollStore.getItem(CACHE_KEY_STAFF);
        if (cached && cached.length && isMounted) {
          setStaffList(cached);
          setLoading(false);
        }
      } catch (e) {
        console.error("Staff payroll cache failed", e);
      }

      const q = query(collection(db, STAFF_COLLECTION), where("schoolId", "==", schoolId));
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setStaffList(list);
          payrollStore.setItem(CACHE_KEY_STAFF, list).catch(() => {});
          setLoading(false);
        },
        (err) => {
          console.error("Failed to sync staff for payroll", err);
          if (isMounted) setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsub();
      };
    })();
  }, [schoolId, CACHE_KEY_STAFF]);

  // 2. Fetch Payroll Records + Attendance logs for targeted month
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    setLoading(true);
    let isMounted = true;

    (async () => {
      try {
        // Fetch payroll templates 
        const qPayroll = query(
          collection(schoollpq, PAYROLL_COLLECTION),
          where("schoolId", "==", schoolId),
          where("monthYear", "==", selectedMonth)
        );
        const snapPayroll = await getDocs(qPayroll);

        // Fetch monthly attendance metrics via start/end bounds matching string template prefix
        const qAttendance = query(
          collection(schoollpq, ATT_COLLECTION),
          where("schoolId", "==", schoolId),
          where("date", ">=", `${selectedMonth}-01`),
          where("date", "<=", `${selectedMonth}-31`)
        );
        const snapAttendance = await getDocs(qAttendance);

        if (!isMounted) return;

        const pMap = {};
        snapPayroll.docs.forEach((d) => {
          const data = d.data();
          pMap[data.staffID] = { docId: d.id, ...data };
        });

        const attList = snapAttendance.docs.map(d => d.data());

        setPayrollRecords(pMap);
        setAttendanceLogs(attList);
        setAdjustments({});
        setLoading(false);
      } catch (err) {
        console.error("Gathering structural calculation data sheets failed", err);
        toast.error("Failed to compile monthly metrics sheets.");
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [schoolId, selectedMonth]);

  const handleAdjustmentChange = (staffID, field, value) => {
    const numValue = parseFloat(value) || 0;
    setAdjustments((prev) => ({
      ...prev,
      [staffID]: {
        ...(prev[staffID] || {}),
        [field]: numValue,
      },
    }));
  };

  // 3. Dynamic Calculation Processor Pipeline
  const computedPayroll = useMemo(() => {
    const workingDays = countWorkingDaysInMonth(selectedMonth);

    return staffList
      .filter((staff) =>
        (staff.teacherName || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map((staff) => {
        const idKey = staff.teacherID || staff.id;
        const savedRecord = payrollRecords[idKey] || {};
        const adj = adjustments[idKey] || {};

        // Base salary fallback chain mapping your dynamic input registration field
        const baseSalary = parseFloat(staff.salary) || parseFloat(staff.baseSalary) || parseFloat(savedRecord.baseSalary) || 0;
        
        // Calculate daily rate relative to tracking month size
        const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;

        // Extract attendance states matching current staff item
        const staffAtts = attendanceLogs.filter(log => log.staffID === idKey);
        const lateCount = staffAtts.filter(log => log.status === "Late").length;
        const absentCount = staffAtts.filter(log => log.status === "Absent").length;

        // Auto deduction rules calculator logic
        const lateDeduction = lateCount * (dailyRate * 0.10); // 10% fee
        const absentDeduction = absentCount * dailyRate;      // 100% fee
        const autoCalculatedDeduction = lateDeduction + absentDeduction;

        // Unsaved Override inputs vs Saved DB defaults
        const allowance = adj.allowance !== undefined ? adj.allowance : (savedRecord.allowance || 0);
        
        // Combine rule execution totals with manual modifications if present
        const manualDeductionInput = adj.deduction !== undefined ? adj.deduction : (savedRecord.deduction || 0);
        const totalDeduction = autoCalculatedDeduction + manualDeductionInput;

        const netSalary = baseSalary + allowance - totalDeduction;

        return {
          ...staff,
          idKey,
          baseSalary,
          workingDays,
          lateCount,
          absentCount,
          autoDeduction: autoCalculatedDeduction,
          allowance,
          deduction: manualDeductionInput, // tracking base modifications independently
          totalDeduction,
          netSalary,
          status: savedRecord.status || "Draft",
          docId: savedRecord.docId || null,
        };
      })
      .sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || ""));
  }, [staffList, payrollRecords, attendanceLogs, adjustments, searchQuery, selectedMonth]);

  // 4. Record Finalized Sheets Transaction
  const handleSavePayroll = async () => {
    setIsSaving(true);
    try {
      const processedBy = user?.data?.adminID || "System";
      const saves = [];

      for (const item of computedPayroll) {
        const payload = {
          schoolId,
          staffID: item.idKey,
          staffName: item.teacherName || "Unknown",
          monthYear: selectedMonth,
          baseSalary: item.baseSalary,
          allowance: item.allowance,
          deduction: item.totalDeduction, // Save computed sum structure directly
          netSalary: item.netSalary,
          status: "Processed",
          processedBy,
          updatedAt: new Date(),
        };

        if (item.docId) {
          const ref = doc(schoollpq, PAYROLL_COLLECTION, item.docId);
          saves.push(updateDoc(ref, payload));
        } else {
          saves.push(addDoc(collection(schoollpq, PAYROLL_COLLECTION), payload));
        }
      }

      await Promise.all(saves);
      toast.success(`🎉 Payroll for ${selectedMonth} compiled and saved successfully!`);
      
      const q = query(
        collection(schoollpq, PAYROLL_COLLECTION),
        where("schoolId", "==", schoolId),
        where("monthYear", "==", selectedMonth)
      );
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => {
        map[d.data().staffID] = { docId: d.id, ...d.data() };
      });
      setPayrollRecords(map);
      setAdjustments({});
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to process automated salary rules sheet updates.");
    } finally {
      setIsSaving(false);
    }
  };

  if (schoolId === "N/A") {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-red-100 text-red-800 border border-red-300 rounded shadow">
        <p className="font-bold">Access Error:</p>
        <p>School ID Context Missing. Re-authenticate session access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-indigo-700">
          Staff Payroll Summary 💳
        </h2>

        {/* --- Top Control / Action Bar --- */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Select Pay Period:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 bg-white text-sm"
              />
            </div>
            <div className="flex-1 sm:w-64">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Search Staff Name:</label>
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 bg-white text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleSavePayroll}
            disabled={isSaving || loading || staffList.length === 0}
            className="w-full md:w-auto bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            {isSaving ? "Processing Ledger..." : "🔒 Finalize & Save Monthly Payroll"}
          </button>
        </div>

        {/* --- Table Section --- */}
        {loading ? (
          <div className="text-center p-8 text-indigo-600 bg-indigo-50 rounded-lg">
            <p className="font-medium text-lg">Assembling structural financial data sheets...</p>
          </div>
        ) : computedPayroll.length === 0 ? (
          <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg">
            <p className="font-medium text-lg">No staff metrics matching parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Staff Profile</th>
                  <th className="px-4 py-3">Base Salary</th>
                  <th className="px-4 py-3 text-center">Attendance Offsets</th>
                  <th className="px-4 py-3">Auto Deductions</th>
                  <th className="px-4 py-3">Manual Adjustments</th>
                  <th className="px-4 py-3">Net Take Home</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-sm">
                {computedPayroll.map((item) => {
                  const hasLocalChanges = adjustments[item.idKey] !== undefined;

                  return (
                    <tr
                      key={item.idKey}
                      className={`hover:bg-gray-50 transition-colors ${
                        hasLocalChanges ? "bg-amber-50/70" : ""
                      }`}
                    >
                      {/* Name and Meta */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{item.teacherName}</div>
                        <div className="text-xs text-gray-400">{item.teacherID || "No ID Key"}</div>
                      </td>

                      {/* Base Salary */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-600">
                        Le {item.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-gray-400">({item.workingDays} work days)</div>
                      </td>

                      {/* Attendance Tally Visual badges */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex justify-center gap-1.5">
                          <span className="px-2 py-0.5 text-xs rounded bg-red-50 text-red-700 border border-red-200">
                            {item.absentCount} Absent
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {item.lateCount} Late
                          </span>
                        </div>
                      </td>

                      {/* Automated Rule-based Deductions Column */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-red-600 bg-red-50/30">
                        -Le {item.autoDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Manual Custom Adjustments Inputs */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            placeholder="+ Allowance"
                            value={item.allowance || ""}
                            onChange={(e) => handleAdjustmentChange(item.idKey, "allowance", e.target.value)}
                            className="block w-28 text-xs font-mono border-gray-300 rounded p-1"
                          />
                          <input
                            type="number"
                            placeholder="- Deduction"
                            value={item.deduction || ""}
                            onChange={(e) => handleAdjustmentChange(item.idKey, "deduction", e.target.value)}
                            className="block w-28 text-xs font-mono border-gray-300 rounded p-1 text-red-600"
                          />
                        </div>
                      </td>

                      {/* Computed Total Pay */}
                      <td className="px-4 py-3 whitespace-nowrap font-bold font-mono text-indigo-700 text-base">
                        Le {item.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            item.status === "Processed"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {item.status}
                        </span>
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