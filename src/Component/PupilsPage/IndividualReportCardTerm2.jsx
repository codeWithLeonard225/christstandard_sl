import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";

const IndividualReportCardTerm2 = () => {
  const location = useLocation();
  const pupilData = location.state?.pupil || {};

  // Individual pupil's grades
  const [pupilGradesData, setPupilGradesData] = useState([]); 
  // All grades for the current class/year (used for ranking)
  const [classGradesData, setClassGradesData] = useState([]); 
  const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
  const [loading, setLoading] = useState(true);

  const tests = ["Test 3", "Test 4"];

  // ✅ Step 1: Fetch latest class & academic year for the pupil
  useEffect(() => {
    if (!pupilData.studentID) return;

    const pupilRegRef = query(
      collection(db, "PupilsReg"),
      where("studentID", "==", pupilData.studentID),
     
    );

    const unsubscribe = onSnapshot(pupilRegRef, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setLatestInfo({
          class: data.class,
          academicYear: data.academicYear,
        });
      }
    }, (error) => {
        console.error("Firestore Error in PupilsReg lookup:", error);
    });

    return () => unsubscribe();
  }, [pupilData.studentID]);

  // ✅ Step 2A: Fetch individual pupil's grades (real-time)
  useEffect(() => {
    if (!latestInfo.academicYear || !latestInfo.class || !pupilData.studentID) return;

    const pupilGradesRef = query(
      collection(db, "PupilGrades"),
      where("academicYear", "==", latestInfo.academicYear),
      where("className", "==", latestInfo.class),
      where("pupilID", "==", pupilData.studentID)
    );

    const unsubscribe = onSnapshot(pupilGradesRef, (snapshot) => {
      setPupilGradesData(snapshot.docs.map((doc) => doc.data()));
    });

    return () => unsubscribe();
  }, [latestInfo, pupilData.studentID]);

  // ✅ Step 2B: Fetch all class grades for ranking (real-time)
  useEffect(() => {
    if (!latestInfo.academicYear || !latestInfo.class) return;

    const classGradesRef = query(
      collection(db, "PupilGrades"),
      where("academicYear", "==", latestInfo.academicYear),
      where("className", "==", latestInfo.class)
    );

    const unsubscribe = onSnapshot(classGradesRef, (snapshot) => {
      setClassGradesData(snapshot.docs.map((doc) => doc.data()));
      setLoading(false); 
    });

    return () => unsubscribe();
  }, [latestInfo]);


  // ✅ Step 3: Compute averages, totals, and RANKING (UPDATED ROUNDING)
  const { subjects, reportRows, totalMarks, overallPercentage, overallRank } = useMemo(() => {
    if (pupilGradesData.length === 0) return { subjects: [], reportRows: [], totalMarks: 0, overallPercentage: 0, overallRank: "—" };

    const pupilIDs = [...new Set(classGradesData.map(d => d.pupilID))];

    // ----------------------------------------------------
    // 1. Calculate Mean for ALL Students/Subjects in the Class (for subject rank)
    // ----------------------------------------------------
    const classMeansBySubject = {};
    for (const subject of [...new Set(classGradesData.map(d => d.subject))]) {
      const subjectScores = [];

      for (const id of pupilIDs) {
        const studentSubjectGrades = classGradesData.filter(
          (g) => g.pupilID === id && g.subject === subject
        );
        const t1 = studentSubjectGrades.find(g => g.test === "Test 3")?.grade || 0;
        const t2 = studentSubjectGrades.find(g => g.test === "Test 4")?.grade || 0;
        const mean = (Number(t1) + Number(t2)) / 2;
        subjectScores.push({ id, mean });
      }

      subjectScores.sort((a, b) => b.mean - a.mean);
      
      for (let i = 0; i < subjectScores.length; i++) {
        if (i > 0 && subjectScores[i].mean === subjectScores[i - 1].mean) {
            subjectScores[i].rank = subjectScores[i - 1].rank;
        } else {
            subjectScores[i].rank = i + 1;
        }
      }
      classMeansBySubject[subject] = subjectScores;
    }

    // ----------------------------------------------------
    // 2. Build the current Pupil's Report Rows (with subject rank)
    // ----------------------------------------------------
    const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();
    let finalTotalMeanSum = 0; // Sum of unrounded means for accurate total calculation

    const subjectData = uniqueSubjects.map((subject) => {
      const t1 = pupilGradesData.find((g) => g.subject === subject && g.test === "Test 3")?.grade || 0;
      const t2 = pupilGradesData.find((g) => g.subject === subject && g.test === "Test 4")?.grade || 0;
      const rawMean = (Number(t1) + Number(t2)) / 2;
      
      // ✅ Subject Mean: 0 decimal place (rounded to nearest whole number)
      const displayMean = Math.round(rawMean);
      
      finalTotalMeanSum += rawMean; // Use raw mean for accurate overall calculation

      const rankEntry = classMeansBySubject[subject]?.find(item => item.id === pupilData.studentID);
      const rank = rankEntry ? rankEntry.rank : "—";
      
      return { 
          subject, 
          test1: Number(t1), 
          test2: Number(t2), 
          mean: displayMean, // Use rounded mean for display
          rawMean: rawMean, // Keep raw mean for total calculation
          rank 
      };
    });

    // ----------------------------------------------------
    // 3. Calculate Overall Total Score and Rank for ALL Pupils (using raw means)
    // ----------------------------------------------------
    const overallScores = [];

    for (const id of pupilIDs) { 
        const pupilGrades = classGradesData.filter(d => d.pupilID === id);
        const subjectsInClass = [...new Set(pupilGrades.map(d => d.subject))];
        let totalRawMeanSum = 0;
        
        for (const subject of subjectsInClass) {
            const t1 = pupilGrades.find(g => g.subject === subject && g.test === "Test 3")?.grade || 0;
            const t2 = pupilGrades.find(g => g.subject === subject && g.test === "Test 4")?.grade || 0;
            totalRawMeanSum += (Number(t1) + Number(t2)) / 2;
        }

        if (subjectsInClass.length > 0) {
            overallScores.push({ id, totalRawMeanSum });
        }
    }

    overallScores.sort((a, b) => b.totalRawMeanSum - a.totalRawMeanSum);

    let overallRank = "—";
    for (let i = 0; i < overallScores.length; i++) {
        // Assign rank (handling ties)
        if (i > 0 && overallScores[i].totalRawMeanSum === overallScores[i - 1].totalRawMeanSum) {
            overallScores[i].rank = overallScores[i - 1].rank;
        } else {
            overallScores[i].rank = i + 1;
        }
        
        if (overallScores[i].id === pupilData.studentID) {
            overallRank = overallScores[i].rank;
            break;
        }
    }

    // ----------------------------------------------------
    // 4. Final Summary Metrics for Current Pupil
    // ----------------------------------------------------
    // Total Marks: Sum of unrounded means, rounded to 0 decimal places
    const totalMarks = Math.round(finalTotalMeanSum);

    // Overall Percentage: Unrounded mean average, 1 decimal place
    const overallPercentage = subjectData.length > 0 
        ? (finalTotalMeanSum / subjectData.length).toFixed(1)
        : 0;

    return { subjects: uniqueSubjects, reportRows: subjectData, totalMarks, overallPercentage, overallRank };
  }, [pupilGradesData, classGradesData, pupilData.studentID]);

  // ✅ Step 4: Grade color helper
  const getGradeColor = (val) => {
    // Note: val here is the grade itself, or the rounded mean.
    if (val >= 70) return "text-green-600 font-bold";
    if (val >= 40) return "text-yellow-600 font-medium";
    return "text-red-600 font-bold";
  };

  // ✅ Step 5: UI 
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">
       Christ Standard Secondary School
      </h2>

      {/* 🧑‍🎓 Pupil Info */}
      <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
        {pupilData.userPhotoUrl ? (
          <img
            src={pupilData.userPhotoUrl}
            alt="Pupil"
            className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500"
            onError={(e) => { e.target.onerror = null; e.target.src="https://via.placeholder.com/96" }}
          />
        ) : (
          <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
            No Photo
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-indigo-800">{pupilData.studentName}</p>
          <p className="text-gray-600">
            <span className="font-medium">Class:</span>{" "}
            {latestInfo.class || "N/A"}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Academic Year:</span>{" "}
            {latestInfo.academicYear || "N/A"}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Student ID:</span> {pupilData.studentID}
          </p>
        </div>
      </div>

      {/* 📊 Grades Table */}
      {loading ? (
        <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">
          Loading report and class ranking data...
        </div>
      ) : subjects.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg shadow-md">
          <table className="min-w-full text-sm text-center border-collapse">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-4 py-2 text-left">Subject</th>
                {tests.map((t, i) => (
                  <th key={i} className="px-4 py-2">
                    {t}
                  </th>
                ))}
                <th className="px-4 py-2">Mn</th>
                <th className="px-4 py-2">Rnk</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject Rows */}
              {reportRows.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition-colors"><td className="text-left px-4 py-2 font-semibold">
                    {row.subject}
                  </td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test1)}`}>
                    {row.test1}
                  </td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test2)}`}>
                    {row.test2}
                  </td>
                  {/* Mean now displayed as a whole number (0 D.P.) */}
                  <td className={`px-4 py-2 font-bold ${getGradeColor(row.mean)}`}>
                    {row.mean}
                  </td>
                  <td className="px-4 py-2 font-bold text-indigo-700">
                    {row.rank}
                  </td>
                </tr>
              ))}
              
              {/* NEW FOOTER ROWS */}
              
              {/* 1. Combined Scores (Total Marks) */}
              <tr className="bg-indigo-100 font-bold text-indigo-800 border-t-2 border-indigo-600">
                <td className="text-left px-4 py-2 text-base">Combined Scores</td>
                <td colSpan="2" className="text-right"></td>
                <td className="px-4 py-2 text-base">{totalMarks}</td>
                <td className="px-4 py-2 text-sm text-gray-700">—</td>
              </tr>

              {/* 2. Overall Percentage (1 D.P.) */}
              <tr className="bg-indigo-100/70 font-bold text-indigo-800">
                <td className="text-left px-4 py-2 text-base">Percentage</td>
                <td colSpan="2"></td>
                <td className="px-4 py-2 text-base">{overallPercentage}%</td>
                <td className="px-4 py-2 text-sm text-gray-700">—</td>
              </tr>
              
              {/* 3. Overall Position/Rank */}
              <tr className="bg-indigo-200 font-bold text-indigo-900 border-b-2 border-indigo-600">
                <td className="text-left px-4 py-3 text-lg">Position</td>
                <td colSpan="3"></td>
                <td className="px-4 py-3 text-xl">{overallRank}</td>
              </tr>

            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-6 text-gray-500 border rounded-lg">
          No grades found for this pupil.
        </div>
      )}
    </div>
  );
};

export default IndividualReportCardTerm2;