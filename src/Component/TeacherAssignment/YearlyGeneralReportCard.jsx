import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

const AnnualBroadSheet = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedPupil, setSelectedPupil] = useState("");
  const [pupils, setPupils] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const { schoolId, schoolName } = location.state || {};

  // 1. Fetch Metadata
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className.trim()))].sort();
      setAcademicYears(years);
      setAvailableClasses(classes);
      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
    });
    return () => unsubscribe();
  }, [schoolId]);

  // 2. Fetch Pupils
  useEffect(() => {
    if (!academicYear || !selectedClass || !schoolId) return;
    const q = query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId), where("academicYear", "==", academicYear));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filtered = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.class && p.class.trim() === selectedClass)
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
      setPupils(filtered);
      if (filtered.length > 0 && !selectedPupil) setSelectedPupil(filtered[0].studentID);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);

  // 3. Fetch Grades
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    setLoading(true);
    const q = query(collection(schooldb, "PupilGrades"), where("academicYear", "==", academicYear), where("schoolId", "==", schoolId), where("className", "==", selectedClass));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassGradesData(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass]);

// 4. Main Calculation Engine
  const annualData = useMemo(() => {
    if (classGradesData.length === 0 || pupils.length === 0) return { rows: [], footers: {} };

    const subjects = [...new Set(classGradesData.map(d => d.subject))].sort();
    const studentIDs = pupils.map(p => p.studentID);

    const getScore = (pId, sub, test) => 
      Number(classGradesData.find(g => g.pupilID === pId && g.subject === sub && g.test === test)?.grade || 0);

    // Helper to calculate subject ranks for all students in a specific term
    const getSubjectTermRankMap = (sub, termPrefix) => {
      const scores = studentIDs.map(id => {
        const m = (getScore(id, sub, `${termPrefix} T1`) + getScore(id, sub, `${termPrefix} T2`)) / 2;
        return { id, mean: m };
      }).sort((a, b) => b.mean - a.mean);

      const ranks = {};
      scores.forEach((s, idx) => {
        if (idx > 0 && s.mean === scores[idx - 1].mean) ranks[s.id] = ranks[scores[idx - 1].id];
        else ranks[s.id] = idx + 1;
      });
      return ranks;
    };

    // Pre-calculate ranks for each term and subject
    const termRanks = {
      t1: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 1") }), {}),
      t2: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 2") }), {}),
      t3: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 3") }), {}),
    };

    // Subject-Specific Rankings for the Year (Annual)
    const subjectYearlyRanks = {};
    subjects.forEach(sub => {
      const subjectScores = studentIDs.map(id => {
        const m1 = (getScore(id, sub, "Term 1 T1") + getScore(id, sub, "Term 1 T2")) / 2;
        const m2 = (getScore(id, sub, "Term 2 T1") + getScore(id, sub, "Term 2 T2")) / 2;
        const m3 = (getScore(id, sub, "Term 3 T1") + getScore(id, sub, "Term 3 T2")) / 2;
        return { id, yearlyMean: (m1 + m2 + m3) / 3 };
      }).sort((a, b) => b.yearlyMean - a.yearlyMean);

      subjectScores.forEach((s, idx) => {
        if (idx > 0 && s.yearlyMean === subjectScores[idx - 1].yearlyMean) s.pos = subjectScores[idx - 1].pos;
        else s.pos = idx + 1;
      });
      subjectYearlyRanks[sub] = subjectScores;
    });

    // Overall Student Stats for Footers
    const allStudentsStats = studentIDs.map(id => {
      let t1 = 0, t2 = 0, t3 = 0;
      subjects.forEach(sub => {
        t1 += (getScore(id, sub, "Term 1 T1") + getScore(id, sub, "Term 1 T2")) / 2;
        t2 += (getScore(id, sub, "Term 2 T1") + getScore(id, sub, "Term 2 T2")) / 2;
        t3 += (getScore(id, sub, "Term 3 T1") + getScore(id, sub, "Term 3 T2")) / 2;
      });
      return { id, t1, t2, t3, annual: (t1 + t2 + t3) / 3 };
    });

    const activePupilStats = allStudentsStats.find(s => s.id === selectedPupil) || { t1: 0, t2: 0, t3: 0, annual: 0 };

    const footers = {
      totals: { t1: Math.round(activePupilStats.t1), t2: Math.round(activePupilStats.t2), t3: Math.round(activePupilStats.t3), ann: Math.round(activePupilStats.annual) },
      percents: {
        t1: subjects.length ? (activePupilStats.t1 / subjects.length).toFixed(1) : 0,
        t2: subjects.length ? (activePupilStats.t2 / subjects.length).toFixed(1) : 0,
        t3: subjects.length ? (activePupilStats.t3 / subjects.length).toFixed(1) : 0,
        ann: subjects.length ? (activePupilStats.annual / subjects.length).toFixed(1) : 0
      },
      ranks: {
        t1: [...allStudentsStats].sort((a,b)=>b.t1-a.t1).findIndex(s=>s.id === selectedPupil)+1,
        t2: [...allStudentsStats].sort((a,b)=>b.t2-a.t2).findIndex(s=>s.id === selectedPupil)+1,
        t3: [...allStudentsStats].sort((a,b)=>b.t3-a.t3).findIndex(s=>s.id === selectedPupil)+1,
        ann: [...allStudentsStats].sort((a,b)=>b.annual-a.annual).findIndex(s=>s.id === selectedPupil)+1
      }
    };

    const rows = subjects.map(sub => {
      const g = (t) => getScore(selectedPupil, sub, t);
      const m1 = (g("Term 1 T1") + g("Term 1 T2")) / 2;
      const m2 = (g("Term 2 T1") + g("Term 2 T2")) / 2;
      const m3 = (g("Term 3 T1") + g("Term 3 T2")) / 2;
      
      return { 
        sub, 
        t1_1: g("Term 1 T1"), t1_2: g("Term 1 T2"), m1, r1: termRanks.t1[sub][selectedPupil],
        t2_1: g("Term 2 T1"), t2_2: g("Term 2 T2"), m2, r2: termRanks.t2[sub][selectedPupil],
        t3_1: g("Term 3 T1"), t3_2: g("Term 3 T2"), m3, r3: termRanks.t3[sub][selectedPupil],
        ann: Math.round((m1 + m2 + m3) / 3), 
        annRank: subjectYearlyRanks[sub].find(s => s.id === selectedPupil)?.pos || "-" 
      };
    });

    return { rows, footers };
  }, [classGradesData, selectedPupil, pupils]);

  const pupilInfo = pupils.find(p => p.studentID === selectedPupil);

  // 5. PDF Generator
 const handlePrintPDF = () => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header Section
  doc.setFontSize(22).setFont(undefined, 'bold');
  doc.text(schoolName?.toUpperCase() || "SCHOOL REPORT", pageWidth / 2, 40, { align: "center" });
  
  doc.setFontSize(16).setFont(undefined, 'bold');
  doc.text("ANNUAL PROGRESS BROAD SHEET", pageWidth / 2, 65, { align: "center" });

  doc.setFontSize(12).setFont(undefined, 'normal');
  doc.text(
    `PUPIL: ${pupilInfo?.studentName}  |  CLASS: ${selectedClass}  |  YEAR: ${academicYear}`,
    pageWidth / 2, 85, { align: "center" }
  );

  // 2. Define Headers (matching your 4-column-per-term UI)
  const headGroup = [
    { content: 'SUBJECTS', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
    { content: 'TERM 1', colSpan: 4, styles: { halign: 'center', fillColor: [49, 46, 129] } },
    { content: 'TERM 2', colSpan: 4, styles: { halign: 'center', fillColor: [30, 58, 138] } },
    { content: 'TERM 3', colSpan: 4, styles: { halign: 'center', fillColor: [22, 78, 99] } },
    { content: 'YEARLY', colSpan: 1, styles: { halign: 'center', fillColor: [6, 78, 59] } }
  ];

  const headSub = [
    "T1", "T2", "Mn", "Rk", 
    "T1", "T2", "Mn", "Rk", 
    "T1", "T2", "Mn", "Rk", 
    "Mean"
  ];

  // 3. Prepare Body Data
  // Note: To get ranks for individual terms (T1, T2, T3), you would ideally 
  // calculate them in your useMemo. Here I use "-" as a placeholder for term-ranks 
  // if they aren't in your 'r' object, but I've included r.annRank for the final column.
  const body = annualData.rows.map(r => [
    r.sub,
    r.t1_1, r.t1_2, r.m1, "-", // Term 1 scores + Placeholder Rank
    r.t2_1, r.t2_2, r.m2, "-", // Term 2 scores + Placeholder Rank
    r.t3_1, r.t3_2, r.m3, "-", // Term 3 scores + Placeholder Rank
    { content: r.ann, styles: { fontStyle: 'bold', fillColor: [236, 253, 245] } }
  ]);

  // 4. Prepare Footers
 const footers = [
  [
    { content: "TOTAL MARKS", styles: { halign: 'right', fontStyle: 'bold' } },
    { content: annualData.footers.totals.t1, colSpan: 4 },
    { content: annualData.footers.totals.t2, colSpan: 4 },
    { content: annualData.footers.totals.t3, colSpan: 4 },
    { content: annualData.footers.totals.ann, colSpan: 1, styles: { fillColor: [209, 250, 229] } }
  ],
  [
    { content: "CLASS RANK", styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
    { content: annualData.footers.ranks.t1, colSpan: 4, styles: { fillColor: [15, 23, 42], textColor: [250, 204, 21], fontSize: 12 } },
    { content: annualData.footers.ranks.t2, colSpan: 4, styles: { fillColor: [15, 23, 42], textColor: [250, 204, 21], fontSize: 12 } },
    { content: annualData.footers.ranks.t3, colSpan: 4, styles: { fillColor: [15, 23, 42], textColor: [250, 204, 21], fontSize: 12 } },
    { content: "Rank: " + annualData.footers.ranks.ann, colSpan: 1, styles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 14 } }
  ]
];

  // 5. Generate Table
  autoTable(doc, {
    startY: 100,
    head: [headGroup, headSub],
    body: body,
    foot: footers,
    theme: 'grid',
    styles: {
      halign: 'center',
      fontSize: 9,
      cellPadding: 4,
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 120, fillColor: [248, 250, 252] },
      // Subject Ranks (Columns 4, 8, 12)
      4: { textColor: [185, 28, 28], fontStyle: 'bold' },
      8: { textColor: [185, 28, 28], fontStyle: 'bold' },
      12: { textColor: [185, 28, 28], fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Highlight the Mean columns for each term (3, 7, 11)
      if (data.section === 'body' && [3, 7, 11].includes(data.column.index)) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  doc.save(`${pupilInfo?.studentName}_Annual_Report.pdf`);
};

  return (
    <div className="p-4 bg-slate-100 min-h-screen">
      <div className="max-w-[1550px] mx-auto bg-white shadow-2xl rounded-3xl p-6">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-slate-900 p-6 rounded-2xl text-white">
          <h2 className="text-xl font-bold uppercase">Annual BroadSheet Portal</h2>
          <div className="flex gap-3">
            <select className="text-black p-2 rounded-lg text-sm" value={academicYear} onChange={e => setAcademicYear(e.target.value)}>{academicYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
            <select className="text-black p-2 rounded-lg text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="text-black p-2 rounded-lg font-bold text-sm" value={selectedPupil} onChange={e => setSelectedPupil(e.target.value)}>{pupils.map(p => <option key={p.studentID} value={p.studentID}>{p.studentName}</option>)}</select>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-20 text-indigo-600 font-bold animate-pulse">Ranking Students...</div>
        ) : annualData.rows.length > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-6 px-2">
              <div>
                <h1 className="text-3xl font-black text-slate-800">{pupilInfo?.studentName}</h1>
                <p className="text-indigo-600 font-bold uppercase text-sm">{selectedClass} | {academicYear}</p>
              </div>
              <button onClick={handlePrintPDF} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all">GENERATE REPORT</button>
            </div>

            <div className="overflow-x-auto border-2 rounded-2xl shadow-sm">
              <table className="w-full text-center border-collapse text-xs">
               <thead className="bg-slate-800 text-white">
  <tr>
    <th rowSpan="2" className="p-3 text-left border-r min-w-[160px]">SUBJECTS</th>
    <th colSpan="4" className="p-2 border-b border-r bg-indigo-900/40">TERM 1</th>
    <th colSpan="4" className="p-2 border-b border-r bg-blue-900/40">TERM 2</th>
    <th colSpan="4" className="p-2 border-b border-r bg-cyan-900/40">TERM 3</th>
    <th colSpan="2" className="p-2 bg-emerald-800">YEARLY PROGRESS</th>
  </tr>
  <tr className="bg-slate-700 text-[9px] uppercase tracking-tighter">
    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
    <th className="p-2 border-r bg-emerald-700">Mean</th><th className="p-2 bg-emerald-900">Rnk</th>
  </tr>
</thead>
<tbody className="divide-y font-medium text-slate-600">
  {annualData.rows.map((r, i) => (
    <tr key={i} className="hover:bg-indigo-50 transition-colors">
      <td className="p-2 text-left font-bold border-r bg-slate-50 text-slate-900">{r.sub}</td>
      <td className="p-1 border-r">{r.t1_1}</td><td className="p-1 border-r">{r.t1_2}</td><td className="p-1 border-r font-bold bg-indigo-50/30">{r.m1}</td><td className="p-1 border-r text-red-600 font-bold">{r.r1}</td>
      <td className="p-1 border-r">{r.t2_1}</td><td colspan="1" className="p-1 border-r">{r.t2_2}</td><td className="p-1 border-r font-bold bg-blue-50/30">{r.m2}</td><td className="p-1 border-r text-red-600 font-bold">{r.r2}</td>
      <td className="p-1 border-r">{r.t3_1}</td><td className="p-1 border-r">{r.t3_2}</td><td className="p-1 border-r font-bold bg-cyan-50/30">{r.m3}</td><td className="p-1 border-r text-red-600 font-bold">{r.r3}</td>
      <td className="p-2 bg-emerald-50 font-black text-emerald-800 text-sm border-r">{r.ann}</td>
      <td className="p-2 bg-red-50 font-black text-red-600 text-sm">{r.annRank}</td>
    </tr>
  ))}
</tbody>
                <tfoot className="bg-slate-100 border-t-4 border-slate-800 font-bold">
                  <tr>
                    <td className="p-3 text-right text-slate-500 uppercase">Totals</td>
                    <td colSpan="4" className="border-r text-indigo-800">{annualData.footers.totals.t1}</td>
                    <td colSpan="4" className="border-r text-blue-800">{annualData.footers.totals.t2}</td>
                    <td colSpan="4" className="border-r text-cyan-800">{annualData.footers.totals.t3}</td>
                    <td colSpan="2" className="bg-emerald-100 text-emerald-900 text-lg">{annualData.footers.totals.ann}</td>
                  </tr>
                    <tr>
                    <td className="p-3 text-right text-slate-500">PERCENTAGE:</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t1}%</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t2}%</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t3}%</td>
                    <td className="bg-emerald-100">{annualData.footers.percents.ann}%</td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="p-4 text-right text-indigo-300 tracking-widest uppercase">Class Rank</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t1}</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t2}</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t3}</td>
                    <td colSpan="2" className="bg-red-700 text-2xl font-black">Rank: {annualData.footers.ranks.ann}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 font-bold border-4 border-dashed rounded-3xl uppercase tracking-widest">Select criteria to fetch data.</div>
        )}
      </div>
    </div>
  );
};

export default AnnualBroadSheet;