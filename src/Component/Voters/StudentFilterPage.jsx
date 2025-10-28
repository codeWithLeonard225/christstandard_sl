import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const StudentFilterPage = () => {
  const { user } = useAuth();
  const currentSchoolId = user?.schoolId || "N/A";

  const [students, setStudents] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Fetch students in real-time
  useEffect(() => {
    if (!currentSchoolId || currentSchoolId === "N/A") return;

    const q = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => a.studentName?.localeCompare(b.studentName)); // ✅ Sort A–Z by Name
        setStudents(data);


        const classes = [...new Set(data.map((s) => s.class).filter(Boolean))];
        const years = [...new Set(data.map((s) => s.academicYear).filter(Boolean))];
        setClassOptions(classes);
        setYearOptions(years);
      },
      (error) => {
        console.error("Failed to fetch students:", error);
        toast.error("Failed to load students.");
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      return (
        (!selectedClass || s.class === selectedClass) &&
        (!selectedYear || s.academicYear === selectedYear)
      );
    });
  }, [students, selectedClass, selectedYear]);

  // Download PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Student List", 14, 16);

    const tableData = filteredStudents.map((student, index) => [
      index + 1,
      student.studentID,
      student.studentName,
      student.class,
      student.academicYear,
    ]);

    autoTable(doc, {
      startY: 20,
      head: [["#", "ID", "Name", "Class", "Academic Year"]],
      body: tableData,
    });

    doc.save("Student_List.pdf");
  };

  // Print Preview
  const printPreview = () => {
    const printContent = document.getElementById("printableArea");
    const WinPrint = window.open("", "", "width=900,height=600");
    WinPrint.document.write(`
      <html>
        <head>
          <title>Print Preview</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h2>Pupils List</h2>
          ${printContent.innerHTML}
          <button onclick="window.print();">Print</button>
        </body>
      </html>
    `);
    WinPrint.document.close();
  };

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4 text-center">Filter Students</h1>

      <div className="flex flex-col md:flex-row md:space-x-4 mb-6">
        <div className="flex-1">
          <label className="block mb-2 font-medium">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="">All Classes</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block mb-2 font-medium">Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex space-x-4 mb-4">
        <button
          onClick={downloadPDF}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Download PDF
        </button>
        <button
          onClick={printPreview}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Print Preview
        </button>
      </div>

      <div id="printableArea" className="overflow-x-auto bg-white p-4 rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">#</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">ID</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Class</th>

            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStudents.map((student, index) => (
              <tr key={student.id}>
                <td className="px-4 py-2 text-sm text-gray-700">{index + 1}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{student.studentID}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{student.studentName}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{student.class}</td>

              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentFilterPage;
