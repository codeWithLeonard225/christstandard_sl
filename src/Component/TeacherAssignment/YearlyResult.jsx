import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

const YearlyResult = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [allYearGrades, setAllYearGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calcMode, setCalcMode] = useState("auto"); // Options: "auto", "term1_2", "term2_3", "3"
  
  const location = useLocation();
  const { schoolId, schoolName } = location.state || {};

  // 1. Initial Metadata Fetch
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className))].sort();
      setAcademicYears(years);
      setAvailableClasses(classes);
      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
    });
    return () => unsubscribe();
  }, [schoolId]);

  // 2. Fetch Pupils and Grades
  useEffect(() => {
    if (!academicYear || !selectedClass || !schoolId) return;
    setLoading(true);

    const pQuery = query(collection(db, "PupilsReg"), 
      where("schoolId", "==", schoolId), 
      where("academicYear", "==", academicYear), 
      where("class", "==", selectedClass)
    );

    const gQuery = query(collection(schooldb, "PupilGrades"), 
      where("academicYear", "==", academicYear), 
      where("schoolId", "==", schoolId), 
      where("className", "==", selectedClass)
    );

    const unsubPupils = onSnapshot(pQuery, (snapshot) => {
      setPupils(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.studentName.localeCompare(b.studentName)));
    });

    const unsubGrades = onSnapshot(gQuery, (snapshot) => {
      setAllYearGrades(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });

    return () => { unsubPupils(); unsubGrades(); };
  }, [academicYear, selectedClass, schoolId]);

  // 3. Yearly Logic Engine
  const yearlyData = useMemo(() => {
    if (allYearGrades.length === 0 || pupils.length === 0) return { subjects: [], studentMap: {}, summaries: {} };

    const subjects = [...new Set(allYearGrades.map(d => d.subject))].sort();
    const studentMap = {};
    const summaries = {};

    const calculateTermMean = (pId, sub, term) => {
      const t1Key = `${term} T1`;
      const t2Key = `${term} T2`;
      const tests = allYearGrades.filter(g => g.pupilID === pId && g.subject === sub && (g.test === t1Key || g.test === t2Key));
      if (tests.length === 0) return 0;
      const t1 = Number(tests.find(t => t.test === t1Key)?.grade || 0);
      const t2 = Number(tests.find(t => t.test === t2Key)?.grade || 0);
      return Math.round((t1 + t2) / 2);
    };

    const subjectStandings = {};
    subjects.forEach(sub => {
      const scores = pupils.map(p => {
        const m1 = calculateTermMean(p.studentID, sub, "Term 1");
        const m2 = calculateTermMean(p.studentID, sub, "Term 2");
        const m3 = calculateTermMean(p.studentID, sub, "Term 3");
        
        let divisor = 3; 
        let scoreSum = m1 + m2 + m3;

        if (calcMode === "auto") {
          let activeTermsCount = 0;
          if (m1 > 0) activeTermsCount++;
          if (m2 > 0) activeTermsCount++;
          if (m3 > 0) activeTermsCount++;
          divisor = activeTermsCount > 0 ? activeTermsCount : 1;
        } else if (calcMode === "term1_2") {
          divisor = 2;
          scoreSum = m1 + m2;
        } else if (calcMode === "term2_3") {
          divisor = 2;
          scoreSum = m2 + m3;
        } else {
          divisor = Number(calcMode);
        }

        const calculatedAvg = Math.round(scoreSum / divisor);

        return { id: p.studentID, avg: calculatedAvg, m1, m2, m3, divisorUsed: divisor };
      });

      scores.sort((a, b) => b.avg - a.avg);
      scores.forEach((s, i) => {
        if (i > 0 && s.avg === scores[i - 1].avg) s.rank = scores[i - 1].rank;
        else s.rank = i + 1;
      });
      subjectStandings[sub] = scores;
    });

    const overallScores = pupils.map(pupil => {
      const pId = pupil.studentID;
      const results = {};
      let totalYearlySum = 0;
      let totalMaxAchievableScore = 0;

      subjects.forEach(sub => {
        const data = subjectStandings[sub].find(s => s.id === pId);
        results[sub] = { m1: data.m1, m2: data.m2, m3: data.m3, yearlyMean: data.avg, subRank: data.rank };
        totalYearlySum += data.avg;
        totalMaxAchievableScore += 100; 
      });

      studentMap[pId] = results;
      
      const percentage = totalMaxAchievableScore > 0 
        ? ((totalYearlySum / totalMaxAchievableScore) * 100).toFixed(1) 
        : "0.0";

      return { id: pId, total: totalYearlySum, percentage };
    });

    overallScores.sort((a, b) => b.total - a.total);
    overallScores.forEach((s, i) => {
      const rank = i > 0 && s.total === overallScores[i - 1].total ? summaries[overallScores[i - 1].id].rank : i + 1;
      summaries[s.id] = { total: s.total, percentage: s.percentage, rank };
    });

    return { subjects, studentMap, summaries };
  }, [allYearGrades, pupils, calcMode]);

  // 4. Print Mode A: Original Standard Matrix (Subjects on Left, Students on Top)
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    const pupilsPerPage = 6; 

    for (let i = 0; i < pupils.length; i += pupilsPerPage) {
      const chunk = pupils.slice(i, i + pupilsPerPage);
      if (i > 0) doc.addPage();

      doc.setFontSize(22).setFont(undefined, 'bold');
      doc.text(schoolName.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 45, { align: "center" });
      
      doc.setFontSize(14).setFont(undefined, 'normal');
      doc.text(
        `ANNUAL PROGRESS BROAD SHEET - ${selectedClass} (${academicYear}) | Mode: ${calcMode.toUpperCase()} | Page ${Math.floor(i / pupilsPerPage) + 1}`,
        doc.internal.pageSize.getWidth() / 2, 75, { align: "center" }
      );

      const head1 = [
        { content: "SUBJECTS", styles: { halign: 'left', fillColor: [40, 44, 52] } }, 
        ...chunk.map(p => ({ 
          content: p.studentName.toUpperCase(), 
          colSpan: 5, 
          styles: { halign: 'center', fillColor: [63, 81, 181], fontSize: 10 } 
        }))
      ];
      
      const head2 = ["", ...chunk.flatMap(() => ["TM1", "TM2", "TM3", "AVG", "POS"])];

      const body = yearlyData.subjects.map(sub => [
        sub,
        ...chunk.flatMap(p => {
          const r = yearlyData.studentMap[p.studentID]?.[sub] || {};
          return [r.m1 || 0, r.m2 || 0, r.m3 || 0, r.yearlyMean || 0, r.subRank || "-"];
        })
      ]);

      const footerStyles = { fontStyle: 'bold', halign: 'center', fontSize: 11 };
      const totalRow = ["TOTAL MARKS", ...chunk.flatMap(p => [{ content: yearlyData.summaries[p.studentID].total, colSpan: 5, styles: { ...footerStyles, fillColor: [240, 240, 240] } }])];
      const percRow = ["PERCENTAGE", ...chunk.flatMap(p => [{ content: yearlyData.summaries[p.studentID].percentage + "%", colSpan: 5, styles: { ...footerStyles, fillColor: [240, 240, 240] } }])];
      const rankRow = ["ANNUAL RANK", ...chunk.flatMap(p => [{ content: yearlyData.summaries[p.studentID].rank, colSpan: 5, styles: { ...footerStyles, textColor: [200, 0, 0], fillColor: [230, 230, 250], fontSize: 13 } }])];

      autoTable(doc, {
        startY: 100,
        head: [head1, head2],
        body: [...body, totalRow, percRow, rankRow],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 6, valign: 'middle', lineWidth: 0.5, lineColor: [150, 150, 150] },
        headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255], fontSize: 10, cellPadding: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120, fillColor: [245, 245, 245], fontSize: 11 } },
        didParseCell: (data) => {
          if (data.section === 'body' && typeof data.cell.raw === 'number' && data.cell.raw < 50) {
            data.cell.styles.textColor = [220, 0, 0];
          }
        },
        margin: { left: 20, right: 20, bottom: 40 },
      });
    }
    doc.save(`${selectedClass}_Annual_Standard_BroadSheet_${academicYear}.pdf`);
  };

  // Print Mode B: Transposed Matrix (Student Names on Left, Subjects on Top)
 // Print Mode B: Transposed Matrix (Student Names on Left, Subjects on Top)
  const handlePrintTransposed = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    
    // Chunk down to exactly 6 subjects per landscape block as requested
    const subjectsPerPage = 6; 
    const totalSubjects = yearlyData.subjects.length;

    for (let sIdx = 0; sIdx < totalSubjects; sIdx += subjectsPerPage) {
      const subjectChunk = yearlyData.subjects.slice(sIdx, sIdx + subjectsPerPage);
      
      // Determine if this is the absolute final chunk of subjects
      const isLastChunk = (sIdx + subjectsPerPage) >= totalSubjects;

      if (sIdx > 0) doc.addPage();

      doc.setFontSize(22).setFont(undefined, 'bold');
      doc.text(schoolName.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 45, { align: "center" });
      
      doc.setFontSize(14).setFont(undefined, 'normal');
      doc.text(
        `ANNUAL PROGRESS TRANSPOSED SHEET - ${selectedClass} (${academicYear}) | Part ${Math.floor(sIdx / subjectsPerPage) + 1}`,
        doc.internal.pageSize.getWidth() / 2, 70, { align: "center" }
      );

      // Build out dynamic Headers based on whether we include the Overalls block or not
      const head1 = [
        { content: "STUDENT NAMES", rowSpan: 2, styles: { valign: 'middle', halign: 'left', fillColor: [40, 44, 52] } },
        ...subjectChunk.map(sub => ({ content: sub.toUpperCase(), colSpan: 5, styles: { halign: 'center', fillColor: [63, 81, 181], fontSize: 9 } }))
      ];

      const head2 = [
        ...subjectChunk.flatMap(() => ["TM1", "TM2", "TM3", "AVG", "POS"])
      ];

      // Append Overall Summary Blocks ONLY if it's the last page chunk
      if (isLastChunk) {
        head1.push({ content: "YEARLY OVERALLS", colSpan: 3, styles: { halign: 'center', fillColor: [30, 41, 59], fontSize: 9 } });
        head2.push("TOTAL", "PERC", "ANNUAL RANK");
      }

      // Populate Table Body Rows
      const body = pupils.map(p => {
        const studentRow = [p.studentName.toUpperCase()];
        
        // Push the scores for the current 6 subjects in this chunk
        subjectChunk.forEach(sub => {
          const r = yearlyData.studentMap[p.studentID]?.[sub] || {};
          studentRow.push(r.m1 || 0, r.m2 || 0, r.m3 || 0, r.yearlyMean || 0, r.subRank || "-");
        });

        // Push overall calculations onto the row array ONLY on the final page
        if (isLastChunk) {
          const summary = yearlyData.summaries[p.studentID] || {};
          studentRow.push(summary.total || "0", (summary.percentage || "0") + "%", summary.rank || "-");
        }

        return studentRow;
      });

      autoTable(doc, {
        startY: 90,
        head: [head1, head2],
        body: body,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle', lineWidth: 0.5, lineColor: [150, 150, 150], halign: 'center' },
        headStyles: { textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 150, halign: 'left', fillColor: [245, 245, 245] }
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const subjectsActiveSpan = subjectChunk.length * 5;
            
            // Apply unique styles to score columns on any current sheet
            if (data.column.index > 0 && data.column.index <= subjectsActiveSpan) {
              const isPosSubCol = data.column.index % 5 === 0;
              if (isPosSubCol) {
                data.cell.styles.textColor = [190, 24, 74];
                data.cell.styles.fontStyle = 'bold';
              } else {
                const scoreVal = parseFloat(data.cell.raw);
                if (!isNaN(scoreVal) && scoreVal < 50) {
                  data.cell.styles.textColor = [220, 0, 0];
                }
              }
            }
            
            // Highlight final summary ranking indicators on the last sheet only
            if (isLastChunk && data.column.index === subjectsActiveSpan + 3) {
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 253];
            }
          }
        },
        margin: { left: 20, right: 20, bottom: 40 },
      });
    }
    doc.save(`${selectedClass}_Annual_Transposed_BroadSheet_${academicYear}.pdf`);
  };

  const handlePrintPreview = () => {
    window.print();
  };

  return (
    <div className="max-w-full mx-auto p-6 bg-white shadow-2xl rounded-3xl border border-gray-100">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-sheet, #printable-sheet * { visibility: visible; }
          #printable-sheet { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
          }
          .no-print { display: none !important; }
          @page { size: A3 landscape; margin: 1cm; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd !important; padding: 4px !important; font-size: 8px !important; }
          .sticky { position: static !important; }
        }
      `}</style>

      {/* Header UI */}
      <div className="no-print flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Annual Broad Sheet</h2>
          <p className="text-gray-500 font-medium">{schoolName} • Results Management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handlePrintPreview} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-sm transition-all"
          >
            Print Preview
          </button>
          <button 
            onClick={handleExportPDF} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-sm transition-all"
          >
            Export Standard Matrix
          </button>
          <button 
            onClick={handlePrintTransposed} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-sm transition-all"
          >
            Export Transposed Matrix
          </button>
        </div>
      </div>

      {/* Filters Form Blocks */}
      <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-600 uppercase">Academic Year</label>
          <select className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white font-medium" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-600 uppercase">Class Tier</label>
          <select className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white font-medium" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-red-700 uppercase flex items-center gap-1">
            ⚙️ Yearly Mean Divisor Mode
          </label>
          <select 
            className="border-2 border-red-200 rounded-xl px-4 py-3 bg-red-50 font-bold text-red-900 focus:outline-none focus:border-red-400" 
            value={calcMode} 
            onChange={(e) => setCalcMode(e.target.value)}
          >
            <option value="auto">🔄 Auto Detect (Divide by active terms)</option>
            <option value="term1_2">🔢 Force Divide by 2 (Terms 1 & 2 only)</option>
            <option value="term2_3">🔢 Force Divide by 2 (Terms 2 & 3 only)</option>
            <option value="3">🔢 Force Divide by 3 (Full Academic Year)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-20 text-emerald-700 font-bold animate-pulse">Compiling Annual Broad Sheet...</div>
      ) : (
        <div id="printable-sheet" className="overflow-x-auto border border-gray-200 rounded-2xl">
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold uppercase">{schoolName}</h1>
            <h2 className="text-lg">ANNUAL PROGRESS BROAD SHEET - {selectedClass} ({academicYear})</h2>
            <p className="text-xs italic">Calculation Mode: Forced / {calcMode.toUpperCase()}</p>
          </div>

          <table className="w-full text-center border-collapse">
            <thead className="bg-gray-900 text-white text-[11px] uppercase print:bg-gray-200 print:text-black">
              <tr>
                <th className="p-4 border-r sticky left-0 bg-gray-900 z-30 print:bg-white" rowSpan="2">Subject</th>
                {pupils.map(p => (
                  <th key={p.studentID} colSpan="5" className="px-4 py-3 border-b border-r min-w-[180px]">
                    {p.studentName}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-800 text-[9px] print:bg-gray-100">
                {pupils.map(p => (
                  <React.Fragment key={`subh-${p.studentID}`}>
                    <th className="p-1 border-r">TM 1</th>
                    <th className="p-1 border-r">TM 2</th>
                    <th className="p-1 border-r">TM 3</th>
                    <th className="p-1 border-r bg-emerald-900 print:bg-gray-300">AVG</th>
                    <th className="p-1 border-r text-amber-400 print:text-black font-bold">POS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="text-[10px] font-medium text-gray-700">
              {yearlyData.subjects.map((sub) => (
                <tr key={sub} className="border-b hover:bg-gray-50">
                  <td className="text-left px-4 py-3 font-bold border-r sticky left-0 bg-white shadow-md print:shadow-none">{sub}</td>
                  {pupils.map(p => {
                    const res = yearlyData.studentMap[p.studentID]?.[sub] || {};
                    return (
                      <React.Fragment key={`${p.studentID}-${sub}`}>
                        <td className="p-1 border-r">{res.m1 || 0}</td>
                        <td className="p-1 border-r">{res.m2 || 0}</td>
                        <td className="p-1 border-r">{res.m3 || 0}</td>
                        <td className="p-1 border-r font-black bg-emerald-50 text-emerald-700 print:text-black">{res.yearlyMean || 0}</td>
                        <td className="p-1 border-r font-bold text-rose-600 print:text-black">{res.subRank || "-"}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              
              <tr className="bg-gray-100 font-bold">
                <td className="sticky left-0 bg-gray-100 px-4 py-3 border-r">TOTAL SUM</td>
                {pupils.map(p => (
                  <td key={`tot-${p.studentID}`} colSpan="5" className="border-r text-emerald-700 print:text-black">
                    {yearlyData.summaries[p.studentID]?.total}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className="sticky left-0 bg-gray-100 px-4 py-3 border-r">PERCENTAGE (%)</td>
                {pupils.map(p => (
                  <td key={`per-${p.studentID}`} colSpan="5" className="border-r text-emerald-700 print:text-black">
                    {yearlyData.summaries[p.studentID]?.percentage}%
                  </td>
                ))}
              </tr>
              <tr className="bg-amber-50 font-black border-t-2 border-amber-200 print:bg-white">
                <td className="sticky left-0 bg-amber-100 px-4 py-5 border-r text-amber-900 print:text-black">ANNUAL RANK</td>
                {pupils.map(p => (
                  <td key={`rankf-${p.studentID}`} colSpan="5" className="border-r text-xl text-rose-600 italic print:text-black print:text-sm">
                    #{yearlyData.summaries[p.studentID]?.rank}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default YearlyResult;