import React, { useState, useEffect, useMemo } from "react";

import { db } from "../../../firebase";

import { collection, onSnapshot, query, where } from "firebase/firestore";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { toast } from "react-toastify";

// Renamed component
export default function FeesDsahboard() {
  const [pupilsData, setPupilsData] = useState([]); // Used for Pupils Per Class chart
  const [academicYear, setAcademicYear] = useState("");
  const [allYears, setAllYears] = useState([]);
  const [feesOutstanding, setFeesOutstanding] = useState([]); // Holds totalFee, totalPaid, outstanding per studentID
  const [feesCost, setFeesCost] = useState([]); // Holds fee structure per class/year
  const [allPupils, setAllPupils] = useState([]); // New state to hold all pupils for the selected year (from PupilReg)
  const [selectedClass, setSelectedClass] = useState("");

  // Pagination for Fees Outstanding
  const [outstandingLimit, setOutstandingLimit] = useState(7);
  const [outstandingPage, setOutstandingPage] = useState(1);

  // Pagination for Pupils List
  const [pupilsListLimit, setPupilsListLimit] = useState(10);
  const [pupilsPage, setPupilsPage] = useState(1);

  // --- Fetch academic years dynamically & All Pupils for the year ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "PupilsReg"), (snapshot) => {
      const pupils = snapshot.docs.map((doc) => doc.data());
      // Update allPupils from the full snapshot (will be filtered by year in next useEffect)
      // This is a full snapshot, we'll only use it to get all years first
      const years = [...new Set(pupils.map((p) => p.academicYear))].sort().reverse();
      setAllYears(years);
      if (!academicYear && years.length) {
        setAcademicYear(years[0]);
      }
    });
    return () => unsub();
  }, [academicYear]);

  // --- Pupils per Class chart & Full Pupil List for Selected Year ---
  useEffect(() => {
    if (!academicYear) return;
    const pupilsRef = collection(db, "PupilsReg");
    // Assuming 'studentID' or 'doc.id' is the unique identifier used across PupilReg and Receipts
    // We are using doc.id as the student ID key now.
    const q = query(pupilsRef, where("academicYear", "==", academicYear));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pupils = snapshot.docs.map((doc) => ({
        id: doc.id, // CRITICAL: This doc.id is used as the student identifier to match receipts.
        ...doc.data()
      }));
      setAllPupils(pupils); // Set the list of all pupils for the current academic year

      // Logic for the Bar Chart (Pupils Per Class)
      const counts = {};
      pupils.forEach((pupil) => {
        const cls = pupil.class || "Unknown";
        counts[cls] = (counts[cls] || 0) + 1;
      });
      const chartData = Object.keys(counts)
        .sort()
        .map((cls) => ({ class: cls, pupils: counts[cls] }));
      setPupilsData(chartData);
    });

    return () => unsubscribe();
  }, [academicYear]);


  // --- Fetch FeesCost (Retained for Fees Outstanding logic) ---
  useEffect(() => {
    const feesCollectionRef = collection(db, "FeesCost");
    const q = query(feesCollectionRef);

    const unsubscribeFees = onSnapshot(
      q,
      (snapshot) => {
        const feeList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setFeesCost(feeList);
      },
      (error) => {
        console.error("Error fetching fees cost:", error);
        toast.error("Failed to load fee structures.");
      }
    );

    return () => unsubscribeFees();
  }, []);

  // --- Fetch Receipts & Calculate Outstanding (Kept for Fees Outstanding logic) ---
  useEffect(() => {
    if (!academicYear || feesCost.length === 0) return;

    const receiptsRef = collection(db, "Receipts");
    const q = query(receiptsRef, where("academicYear", "==", academicYear));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receipts = snapshot.docs.map((doc) => doc.data());
      const studentMap = {};

      receipts.forEach((r) => {
        // Assuming r.studentID in Receipt matches doc.id in PupilReg
        const studentId = r.studentID; 
        
        if (studentId) { // Only process if studentID exists
            if (!studentMap[studentId]) {
              studentMap[studentId] = {
                studentID: studentId, // This should match pupil.id from PupilReg
                studentName: r.studentName,
                class: r.class,
                academicYear: r.academicYear,
                totalPaid: 0,
              };
            }
            studentMap[studentId].totalPaid += r.amount || 0;
        }
      });

      const result = Object.values(studentMap).map((s) => {
        const classFee = feesCost.find(
          (f) => f.academicYear === s.academicYear && f.className === s.class
        );
        const totalFee = classFee ? classFee.totalAmount : 0;
        return {
          ...s,
          totalFee,
          outstanding: totalFee - s.totalPaid,
        };
      });

      setFeesOutstanding(result);
    });

    return () => unsubscribe();
  }, [academicYear, feesCost]);


  // --- Class options dynamically for both sides ---
  const allClasses = useMemo(() => {
    return [...new Set(allPupils.map((s) => s.class))].filter(Boolean).sort();
  }, [allPupils]);


  // --- Filtered Outstanding List (Left Side) ---
  const filteredOutstanding = feesOutstanding.filter((s) => s.outstanding > 0);

  // --- Pagination for Outstanding List ---
  const totalOutstandingPages = Math.ceil(filteredOutstanding.length / outstandingLimit) || 1;
  const displayedOutstanding = filteredOutstanding.slice(
    (outstandingPage - 1) * outstandingLimit,
    outstandingPage * outstandingLimit
  );

  // ------------------------------------------------------------------
  // --- New Logic for Right Side (Pupil Registration) ---

  /**
   * NEW: Combine Pupil Registration data with calculated financial data.
   * This ensures every pupil from PupilReg has their financial details (even if 0)
   */
  const combinedPupilFeesList = useMemo(() => {
    // 1. Create a map for quick lookup of financial data by student ID (PupilReg doc.id)
    const outstandingMap = new Map(
      feesOutstanding.map((s) => [s.studentID, s])
    );

    // 2. Map over all pupils and merge financial data
    return allPupils.map((pupil) => {
      // Use pupil.id (which is doc.id from PupilReg) to find the match
      const financialData = outstandingMap.get(pupil.id) || {
        totalFee: 0,
        totalPaid: 0,
        outstanding: 0,
      };

      return {
        ...pupil, // All PupilReg fields (id, name, class, gender, etc.)
        totalFee: financialData.totalFee, // Total Fees
        totalPaid: financialData.totalPaid, // Paid
        outstanding: financialData.outstanding, // Balance
      };
    });
  }, [allPupils, feesOutstanding]);


  // Filtered Pupils List (Right Side) - NOW USES THE COMBINED LIST
  const filteredPupilsList = useMemo(() => {
    return selectedClass
      ? combinedPupilFeesList.filter((s) => s.class === selectedClass)
      : combinedPupilFeesList;
  }, [combinedPupilFeesList, selectedClass]);


  // Gender Breakdown for Selected Class
  const genderBreakdown = useMemo(() => {
    const male = filteredPupilsList.filter(p => p.gender && p.gender.toLowerCase() === 'male').length;
    const female = filteredPupilsList.filter(p => p.gender && p.gender.toLowerCase() === 'female').length;
    return { male, female, total: filteredPupilsList.length };
  }, [filteredPupilsList]);

  // Pagination for Pupils List
  const totalPupilsPages = Math.ceil(filteredPupilsList.length / pupilsListLimit) || 1;
  const displayedPupils = filteredPupilsList.slice(
    (pupilsPage - 1) * pupilsListLimit,
    pupilsPage * pupilsListLimit
  );


  // ------------------------------------------------------------------

  return (
    <div className="flex flex-col md:flex-row w-full h-screen">
      {/* LEFT SIDE: Fees Outstanding & Pupils Per Class */}
      <div className="hidden md:flex md:w-[70%] flex-col p-4 space-y-4">
        {/* Pupils per class chart */}
        <div className="flex-1 bg-red-300 p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Pupils Per Class</h1>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="p-1 border rounded"
            >
              {allYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {pupilsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pupilsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pupils" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-700">No pupil data for {academicYear}.</p>
          )}
        </div>

        {/* Fees Outstanding Table */}
        <div className="flex-1 bg-yellow-300 p-4 rounded-lg shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold">Fees Outstanding (Retained)</h1>
            <select
              value={outstandingLimit}
              onChange={(e) => {
                setOutstandingLimit(Number(e.target.value));
                setOutstandingPage(1);
              }}
              className="p-1 border rounded bg-white"
            >
              <option value={5}>5</option>
              <option value={7}>7</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr>
                  <th className="border p-2">Student</th>
                  <th className="border p-2">Class</th>
                  <th className="border p-2">Total Fee</th>
                  <th className="border p-2">Paid</th>
                  <th className="border p-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {displayedOutstanding.map((s) => (
                  <tr key={s.studentID} className="bg-white">
                    <td className="border p-2">{s.studentName}</td>
                    <td className="border p-2">{s.class}</td>
                    <td className="border p-2">{s.totalFee}</td>
                    <td className="border p-2">{s.totalPaid}</td>
                    <td className="border p-2 text-red-600">{s.outstanding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-2">
            <button
              onClick={() => setOutstandingPage((p) => Math.max(p - 1, 1))}
              disabled={outstandingPage === 1}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm font-medium">
              Page {outstandingPage} of {totalOutstandingPages}
            </span>
            <button
              onClick={() => setOutstandingPage((p) => Math.min(p + 1, totalOutstandingPages))}
              disabled={outstandingPage === totalOutstandingPages}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Pupil Registration List & Gender Breakdown (Refactored) */}
      {/* Note: Corrected the redundant classnames on the div below */}
      <div className="md:w-[30%] bg-blue-300 flex flex-col border-l w-full">
        {/* Header & Class Selector */}
        <div className="p-4 border-b border-blue-400 sticky top-0 bg-blue-300 z-10 flex justify-between items-center">
          <h1 className="text-xl font-bold">Pupil Fees List</h1>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setPupilsPage(1); // Reset pagination on class change
            }}
            className="p-1 border rounded bg-white text-black"
          >
            <option value="">All Classes</option>
            {allClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Gender Breakdown Summary */}
        <div className="p-2 border-b border-blue-400 bg-blue-100 sticky top-[64px] z-10 flex justify-between text-sm font-semibold">
          <p>Total Pupils: <span className="text-blue-700">{genderBreakdown.total}</span></p>
          <p>Male: <span className="text-blue-700">{genderBreakdown.male}</span></p>
          <p>Female: <span className="text-pink-700">{genderBreakdown.female}</span></p>
        </div>

        {/* Limit Selector */}
        <div className="p-2 bg-blue-200 sticky top-[100px] z-10 flex items-center gap-2">
          <label className="text-sm">Show:</label>
          <select
            value={pupilsListLimit}
            onChange={(e) => {
              setPupilsListLimit(Number(e.target.value));
              setPupilsPage(1);
            }}
            className="px-2 py-1 rounded border"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
            <option value={60}>60</option>
          </select>
          <span className="text-sm">per page</span>
        </div>

        {/* Pupils Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Pupil Name</th>
                <th className="border p-2">Class</th>
                <th className="border p-2">Total Fee</th>
                <th className="border p-2">Paid</th>
                <th className="border p-2">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {displayedPupils.length > 0 ? (
                displayedPupils.map((s) => (
                  // The combinedPupilFeesList now contains totalFee, totalPaid, outstanding
                  <tr key={s.id || s.studentID} className="bg-white">
                    <td className="border p-2">{s.studentName || `${s.firstName} ${s.lastName}`}</td>
                    <td className="border p-2">{s.class}</td>
                    <td className="border p-2">{s.totalFee || 0}</td>
                    <td className="border p-2">{s.totalPaid || 0}</td>
                    <td className="border p-2 text-red-600">{s.outstanding || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="border p-2 text-center text-gray-700">
                    No pupils found {selectedClass ? `in ${selectedClass}` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">
          <button
            onClick={() => setPupilsPage((p) => Math.max(p - 1, 1))}
            disabled={pupilsPage === 1}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm font-medium">
            Page {pupilsPage} of {totalPupilsPages}
          </span>
          <button
            onClick={() => setPupilsPage((p) => Math.min(p + 1, totalPupilsPages))}
            disabled={pupilsPage === totalPupilsPages || totalPupilsPages === 0}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}