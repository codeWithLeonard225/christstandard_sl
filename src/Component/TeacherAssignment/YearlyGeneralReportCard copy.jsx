"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

const FullReportCard = () => {
  const location = useLocation();

  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
  } = location.state || {};

  const [academicYear, setAcademicYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [pupils, setPupils] = useState([]);
  const [selectedPupil, setSelectedPupil] = useState("");
  const [classGradesData, setClassGradesData] = useState([]);

  // 🔷 FETCH PUPILS
  useEffect(() => {
    if (!schoolId || !academicYear || !selectedClass) return;

    const q = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.class?.trim() === selectedClass);

      setPupils(data);

      if (data.length > 0) setSelectedPupil(data[0].studentID);
    });

    return () => unsub();
  }, [schoolId, academicYear, selectedClass]);

  // 🔷 FETCH GRADES
  useEffect(() => {
    if (!schoolId || !academicYear || !selectedClass) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass)
    );

    const unsub = onSnapshot(q, (snap) => {
      setClassGradesData(snap.docs.map(doc => doc.data()));
    });

    return () => unsub();
  }, [schoolId, academicYear, selectedClass]);

  const pupilInfo = pupils.find(p => p.studentID === selectedPupil);

  // 🔷 COMPUTE FULL REPORT
  const report = useMemo(() => {
    if (!classGradesData.length || !selectedPupil) return [];

    const subjects = [...new Set(classGradesData.map(d => d.subject))];

    const getTerm = (subject, term) => {
      const t1 = classGradesData.find(g =>
        g.subject === subject &&
        g.pupilID === selectedPupil &&
        g.test === `${term} T1`
      )?.grade || 0;

      const t2 = classGradesData.find(g =>
        g.subject === subject &&
        g.pupilID === selectedPupil &&
        g.test === `${term} T2`
      )?.grade || 0;

      const mean = Math.round((Number(t1) + Number(t2)) / 2);

      return { t1, t2, mean };
    };

    return subjects.map(subject => {
      const t1 = getTerm(subject, "Term 1");
      const t2 = getTerm(subject, "Term 2");
      const t3 = getTerm(subject, "Term 3");

      const yearlyMean = Math.round((t1.mean + t2.mean + t3.mean) / 3);

      return { subject, t1, t2, t3, yearlyMean };
    });

  }, [classGradesData, selectedPupil]);

  // 🔷 TOTAL + PERCENTAGE
  const totalMarks = report.reduce((acc, r) => acc + r.yearlyMean, 0);
  const overallPercentage = report.length
    ? ((totalMarks / (report.length * 100)) * 100).toFixed(1)
    : 0;

  // 🔷 PDF GENERATOR
  const handlePrintPDF = () => {
    if (!pupilInfo) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });

    let y = 40;

    doc.setFont("helvetica", "bold").setFontSize(22);
    doc.text(schoolName?.toUpperCase() || "", 600, y, { align: "center" });

    y += 30;

    doc.setFontSize(14);
    doc.text(`ANNUAL REPORT (${academicYear})`, 600, y, { align: "center" });

    y += 40;

    doc.setFontSize(11);

    doc.text(`NAME: ${pupilInfo.studentName}`, 40, y);
    doc.text(`CLASS: ${pupilInfo.class}`, 350, y);

    y += 20;

    doc.text(`STUDENT ID: ${pupilInfo.studentID}`, 40, y);
    doc.text(`YEAR: ${academicYear}`, 350, y);

    y += 30;

    autoTable(doc, {
      startY: y,
      head: [[
        "SUBJECT",
        "T1-1", "T1-2", "T1-MN",
        "T2-1", "T2-2", "T2-MN",
        "T3-1", "T3-2", "T3-MN",
        "YEAR-MN"
      ]],
      body: report.map(r => [
        r.subject,
        r.t1.t1, r.t1.t2, r.t1.mean,
        r.t2.t1, r.t2.t2, r.t2.mean,
        r.t3.t1, r.t3.t2, r.t3.mean,
        r.yearlyMean
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [63, 81, 181] }
    });

    let finalY = doc.lastAutoTable.finalY + 20;

    doc.text(`TOTAL: ${totalMarks}`, 40, finalY);
    doc.text(`PERCENTAGE: ${overallPercentage}%`, 300, finalY);

    doc.save(`${pupilInfo.studentName}_Report.pdf`);
  };

  return (
    <div className="p-6 bg-white shadow-xl rounded-xl max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">{schoolName}</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <input
          placeholder="Academic Year"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          placeholder="Class"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <select
        value={selectedPupil}
        onChange={(e) => setSelectedPupil(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      >
        {pupils.map(p => (
          <option key={p.studentID} value={p.studentID}>
            {p.studentName}
          </option>
        ))}
      </select>

      <button
        onClick={handlePrintPDF}
        className="bg-indigo-600 text-white px-4 py-2 rounded"
      >
        Generate Report Card PDF
      </button>
    </div>
  );
};

export default FullReportCard;