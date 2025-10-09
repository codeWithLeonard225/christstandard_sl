import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GeneralReportCard = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedPupil, setSelectedPupil] = useState("");
  const [pupils, setPupils] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [pupilGradesData, setPupilGradesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("Term 1");

  // 🧮 Define term-test mapping
  const termTests = {
    "Term 1": ["Test 1", "Test 2"],
    "Term 2": ["Test 3", "Test 4"],
    "Term 3": ["Test 5", "Test 6"],
  };

  // 🔹 Fetch academic years and classes
  useEffect(() => {
    const q = query(collection(db, "PupilGrades"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(data.map((d) => d.academicYear))];
      const classes = [...new Set(data.map((d) => d.className))];
      setAcademicYears(years.sort().reverse());
      setAvailableClasses(classes.sort());
      if (years.length > 0) setAcademicYear(years[0]);
      if (classes.length > 0) setSelectedClass(classes[0]);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Fetch pupils in class/year
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    const q = query(
      collection(db, "PupilsReg"),
      where("academicYear", "==", academicYear),
      where("class", "==", selectedClass)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPupils(data);
      if (data.length > 0 && !selectedPupil) setSelectedPupil(data[0].studentID);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass]);

  // 🔹 Fetch grades for class
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    const q = query(
      collection(db, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassGradesData(snapshot.docs.map((doc) => doc.data()));
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass]);

  // 🔹 Fetch pupil grades
  useEffect(() => {
    if (!academicYear || !selectedClass || !selectedPupil) return;
    setLoading(true);
    const q = query(
      collection(db, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass),
      where("pupilID", "==", selectedPupil)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPupilGradesData(snapshot.docs.map((doc) => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, selectedPupil]);

  const tests = termTests[selectedTerm];

  // 🧮 Ranking + Computation
  const { subjects, reportRows, totalMarks, overallPercentage, overallRank } = useMemo(() => {
    if (pupilGradesData.length === 0)
      return { subjects: [], reportRows: [], totalMarks: 0, overallPercentage: 0, overallRank: "—" };

    const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];
    const classMeansBySubject = {};

    for (const subject of [...new Set(classGradesData.map((d) => d.subject))]) {
      const subjectScores = pupilIDs.map((id) => {
        const g = classGradesData.filter((x) => x.pupilID === id && x.subject === subject);
        const t1 = g.find((x) => x.test === tests[0])?.grade || 0;
        const t2 = g.find((x) => x.test === tests[1])?.grade || 0;
        return { id, mean: (Number(t1) + Number(t2)) / 2 };
      });
      subjectScores.sort((a, b) => b.mean - a.mean);
      subjectScores.forEach((x, i) => {
        if (i > 0 && x.mean === subjectScores[i - 1].mean) x.rank = subjectScores[i - 1].rank;
        else x.rank = i + 1;
      });
      classMeansBySubject[subject] = subjectScores;
    }

    const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();
    let totalSum = 0;

    const subjectData = uniqueSubjects.map((subject) => {
      const t1 = pupilGradesData.find((g) => g.subject === subject && g.test === tests[0])?.grade || 0;
      const t2 = pupilGradesData.find((g) => g.subject === subject && g.test === tests[1])?.grade || 0;
      const rawMean = (Number(t1) + Number(t2)) / 2;
      const mean = Math.round(rawMean);
      totalSum += rawMean;

      const rank = classMeansBySubject[subject]?.find((s) => s.id === selectedPupil)?.rank || "—";
      return { subject, test1: t1, test2: t2, mean, rank };
    });

    const overallScores = pupilIDs.map((id) => {
      const pupilData = classGradesData.filter((x) => x.pupilID === id);
      const subjects = [...new Set(pupilData.map((d) => d.subject))];
      const totalMean = subjects.reduce((acc, subject) => {
        const t1 = pupilData.find((x) => x.subject === subject && x.test === tests[0])?.grade || 0;
        const t2 = pupilData.find((x) => x.subject === subject && x.test === tests[1])?.grade || 0;
        return acc + (Number(t1) + Number(t2)) / 2;
      }, 0);
      return { id, totalMean };
    });

    overallScores.sort((a, b) => b.totalMean - a.totalMean);
    overallScores.forEach((x, i) => {
      if (i > 0 && x.totalMean === overallScores[i - 1].totalMean) x.rank = overallScores[i - 1].rank;
      else x.rank = i + 1;
    });

    const overallRank = overallScores.find((x) => x.id === selectedPupil)?.rank || "—";
    const totalMarks = Math.round(totalSum);
    const overallPercentage = uniqueSubjects.length ? (totalSum / uniqueSubjects.length).toFixed(1) : 0;

    return { subjects: uniqueSubjects, reportRows: subjectData, totalMarks, overallPercentage, overallRank };
  }, [pupilGradesData, classGradesData, selectedPupil, selectedTerm]);

  const pupilInfo = pupils.find((p) => p.studentID === selectedPupil);
  const getGradeColor = (val) =>
    val >= 70 ? "text-green-600 font-bold" : val >= 40 ? "text-yellow-600 font-medium" : "text-red-600 font-bold";

  // 🧾 Handle PDF Printing
  const handlePrintPDF = () => {
    if (!pupilInfo) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });

    // Logo & Pupil Photo
    const logoUrl = "/images/Zadet.jpg"; // replace with your logo path
    const pupilPhotoUrl = pupilInfo.userPhotoUrl || "https://via.placeholder.com/96";

    // Load images as promises
    const loadImage = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.crossOrigin = "anonymous"; // avoid CORS issues
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    Promise.all([loadImage(logoUrl), loadImage(pupilPhotoUrl)]).then(([logo, pupilPhoto]) => {
      // Draw logo
      if (logo) doc.addImage(logo, "PNG", 40, 20, 50, 50);

      // Draw pupil photo
      if (pupilPhoto) doc.addImage(pupilPhoto, "PNG", 480, 20, 50, 50);

      // Header text
      doc.setFontSize(16);
      doc.text("MODEL SECONDARY SCHOOL", 210, 40, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Academic Year: ${academicYear}   |   Term: ${selectedTerm}`, 210, 60, { align: "center" });
      doc.text(`Class: ${selectedClass}`, 210, 75, { align: "center" });

      // Student Info
      doc.setFontSize(11);
      doc.text(`Student Name: ${pupilInfo.studentName}`, 40, 100);
      doc.text(`Student ID: ${pupilInfo.studentID}`, 40, 115);

      // Table Data
      const tableData = reportRows.map((r) => [r.subject, r.test1, r.test2, r.mean, r.rank]);

      autoTable(doc, {
        startY: 130,
        head: [["Subject", tests[0], tests[1], "Mean", "Rank"]],
        body: tableData,
        theme: "striped",
        styles: { halign: "center", fontSize: 10 },
        headStyles: { fillColor: [63, 81, 181], textColor: 255 },
        margin: { left: 40, right: 40 },
      });

      // Footer Summary
      const finalY = doc.lastAutoTable.finalY + 20;
      doc.text(`Total Marks: ${totalMarks}`, 40, finalY);
      doc.text(`Percentage: ${overallPercentage}%`, 40, finalY + 15);
      doc.text(`Position: ${overallRank}`, 40, finalY + 30);

      doc.save(`${pupilInfo.studentName}_Report.pdf`);
    });
  };


  // 🧾 UI
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Model Secondary School</h2>

      {/* Term selector */}
      <div className="flex justify-center gap-4 mb-6">
        {Object.keys(termTests).map((term) => (
          <button
            key={term}
            onClick={() => setSelectedTerm(term)}
            className={`px-4 py-2 rounded-lg border ${selectedTerm === term ? "bg-indigo-600 text-white" : "bg-gray-100 hover:bg-indigo-100"
              }`}
          >
            {term}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 border rounded-lg bg-indigo-50">
        <div>
          <label className="font-semibold">Academic Year:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {academicYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold">Class:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {availableClasses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold">Pupil:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={selectedPupil} onChange={(e) => setSelectedPupil(e.target.value)}>
            {pupils.map((p) => (
              <option key={p.studentID} value={p.studentID}>
                {p.studentName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Print Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handlePrintPDF}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow"
        >
          Print PDF
        </button>
      </div>

      {/* 🧑‍🎓 Pupil Info */}
      {pupilInfo && (
        <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
          {pupilInfo.userPhotoUrl ? (
            <img
              src={pupilInfo.userPhotoUrl}
              alt="Pupil"
              className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/96";
              }}
            />
          ) : (
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
              No Photo
            </div>
          )}

          <div>
            <p className="text-lg font-semibold text-indigo-800">{pupilInfo.studentName}</p>
            <p className="text-gray-600">
              <span className="font-medium">Class:</span> {pupilInfo.class || "N/A"}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Academic Year:</span> {pupilInfo.academicYear || "N/A"}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Student ID:</span> {pupilInfo.studentID}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">Loading report...</div>
      ) : subjects.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg shadow-md">
          <table className="min-w-full text-sm text-center border-collapse">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-4 py-2 text-left">Subject</th>
                {tests.map((t) => (
                  <th key={t} className="px-4 py-2">
                    {t}
                  </th>
                ))}
                <th className="px-4 py-2">Mn</th>
                <th className="px-4 py-2">Rnk</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition">
                  <td className="text-left px-4 py-2 font-semibold">{row.subject}</td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test1)}`}>{row.test1}</td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test2)}`}>{row.test2}</td>
                  <td className={`px-4 py-2 font-bold ${getGradeColor(row.mean)}`}>{row.mean}</td>
                  <td className="px-4 py-2 font-bold text-indigo-700">{row.rank}</td>
                </tr>
              ))}

              {/* Footer rows */}
              <tr className="bg-indigo-100 font-bold text-indigo-800 border-t-2 border-indigo-600">
                <td className="text-left px-4 py-2 text-base">Combined Scores</td>
                <td colSpan="2"></td>
                <td className="px-4 py-2 text-base">{totalMarks}</td>
                <td>—</td>
              </tr>
              <tr className="bg-indigo-100/70 font-bold text-indigo-800">
                <td className="text-left px-4 py-2 text-base">Percentage</td>
                <td colSpan="2"></td>
                <td className="px-4 py-2 text-base">{overallPercentage}%</td>
                <td>—</td>
              </tr>
              <tr className="bg-indigo-200 font-bold text-indigo-900 border-b-2 border-indigo-600">
                <td className="text-left px-4 py-2 text-base">Position</td>
                <td colSpan="3"></td>
                <td className="text-lg">{overallRank}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-6 text-gray-500 border rounded-lg">No grades found for this pupil.</div>
      )}


    </div>

  );
};

export default GeneralReportCard;
