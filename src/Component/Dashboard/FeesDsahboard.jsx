import React, { useState, useEffect } from "react";
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

export default function FeesDashboard() {
  const [pupilsData, setPupilsData] = useState([]);
  const [academicYear, setAcademicYear] = useState("");
  const [allYears, setAllYears] = useState([]);
  const [feesOutstanding, setFeesOutstanding] = useState([]);
  const [feesCost, setFeesCost] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  // Pagination
  const [outstandingLimit, setOutstandingLimit] = useState(7);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [feesListLimit, setFeesListLimit] = useState(10);
  const [feesPage, setFeesPage] = useState(1);

  // --- Fetch academic years dynamically ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "PupilsReg"), (snapshot) => {
      const pupils = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(pupils.map((p) => p.academicYear))].sort().reverse();
      setAllYears(years);
      if (!academicYear && years.length) setAcademicYear(years[0]);
    });
    return () => unsub();
  }, [academicYear]);

  // --- Pupils per Class chart ---
  useEffect(() => {
    if (!academicYear) return;
    const pupilsRef = collection(db, "PupilsReg");
    const q = query(pupilsRef, where("academicYear", "==", academicYear));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pupils = snapshot.docs.map((doc) => doc.data());
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

  // --- Fetch FeesCost ---
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

  // --- Fetch Receipts & Calculate Outstanding ---
  useEffect(() => {
    if (!academicYear || feesCost.length === 0) return;

    const receiptsRef = collection(db, "Receipts");
    const q = query(receiptsRef, where("academicYear", "==", academicYear));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receipts = snapshot.docs.map((doc) => doc.data());
      const studentMap = {};

      receipts.forEach((r) => {
        if (!studentMap[r.studentID]) {
          studentMap[r.studentID] = {
            studentID: r.studentID,
            studentName: r.studentName,
            class: r.class,
            academicYear: r.academicYear,
            totalPaid: 0,
          };
        }
        studentMap[r.studentID].totalPaid += r.amount || 0;
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

  // --- Class options dynamically ---
  const allClasses = [...new Set(feesOutstanding.map((s) => s.class))].sort();

// --- Filtered lists ---
const filteredOutstanding = feesOutstanding.filter((s) => s.outstanding > 0);

// Fees List shows all students, regardless of outstanding
const filteredFeesList = selectedClass
    ? feesOutstanding.filter((s) => s.class === selectedClass)
    : feesOutstanding;

  // --- Pagination ---
  const totalOutstandingPages = Math.ceil(filteredOutstanding.length / outstandingLimit) || 1;
  const displayedOutstanding = filteredOutstanding.slice(
    (outstandingPage - 1) * outstandingLimit,
    outstandingPage * outstandingLimit
  );

  const totalFeesPages = Math.ceil(filteredFeesList.length / feesListLimit) || 1;
  const displayedFees = filteredFeesList.slice(
    (feesPage - 1) * feesListLimit,
    feesPage * feesListLimit
  );

  return (
    <div className="flex flex-col md:flex-row w-full h-screen">
      {/* LEFT SIDE: Fees Outstanding */}
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
            <h1 className="text-xl font-bold">Fees Outstanding</h1>
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

      {/* RIGHT SIDE: Fees List Table */}
      <div className="md:w-[30%] bg-blue-300 flex flex-col border-lw-full md:w-[30%] bg-blue-300 flex flex-col border-l">
        <div className="p-4 border-b border-blue-400 sticky top-0 bg-blue-300 z-10 flex justify-between items-center">
          <h1 className="text-xl font-bold">Fees List</h1>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setFeesPage(1);
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

        <div className="p-2 bg-blue-200 sticky top-[52px] z-10 flex items-center gap-2">
          <label className="text-sm">Show:</label>
          <select
            value={feesListLimit}
            onChange={(e) => {
              setFeesListLimit(Number(e.target.value));
              setFeesPage(1);
            }}
            className="px-2 py-1 rounded border"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <span className="text-sm">per page</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="min-w-full text-left border-collapse">
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
              {displayedFees.length > 0 ? (
                displayedFees.map((s) => (
                  <tr key={s.studentID} className="bg-white">
                    <td className="border p-2">{s.studentName}</td>
                    <td className="border p-2">{s.class}</td>
                    <td className="border p-2">{s.totalFee}</td>
                    <td className="border p-2">{s.totalPaid}</td>
                    <td className={`border p-2 ${s.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                      {s.outstanding}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="border p-2 text-center text-gray-700">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">
          <button
            onClick={() => setFeesPage((p) => Math.max(p - 1, 1))}
            disabled={feesPage === 1}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm font-medium">
            Page {feesPage} of {totalFeesPages}
          </span>
          <button
            onClick={() => setFeesPage((p) => Math.min(p + 1, totalFeesPages))}
            disabled={feesPage === totalFeesPages || totalFeesPages === 0}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
