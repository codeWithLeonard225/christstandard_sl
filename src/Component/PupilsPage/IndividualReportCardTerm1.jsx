import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults"; // ✅ Use the correct DB instance
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

const gradesStore = localforage.createInstance({ name: "GradesCache", storeName: "pupil_grades" });
const classesStore = localforage.createInstance({ name: "ClassesCache", storeName: "school_classes" });

const getGradeColor = (val) => {
  const grade = Number(val);
  return grade >= 50 ? "text-blue-600 font-bold" : "text-red-600 font-bold";
};

const termTests = {
  "Term 1": ["Term 1 T1", "Term 1 T2"],
  "Term 2": ["Term 2 T1", "Term 2 T2"],
  "Term 3": ["Term 3 T1", "Term 3 T2"],
};

const IndividualReportCardTerm1 = () => {
  const { user } = useAuth();
  const location = useLocation();

  const authPupilData = user?.role === "pupil" ? user.data : null;
  const navPupilData = location.state?.user || {};
  const pupilData = authPupilData || navPupilData;

  const schoolId = pupilData?.schoolId || location.state?.schoolId || "N/A";
  const schoolName = location.state?.schoolName || "Unknown School";
  const selectedPupil = pupilData?.studentID;

  const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [pupilGradesData, setPupilGradesData] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [classesCache, setClassesCache] = useState([]);
  const [loadingReg, setLoadingReg] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [feesStatus, setFeesStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const academicYear = latestInfo.academicYear;
  const selectedClass = latestInfo.class?.trim(); // ✅ Trim whitespace
  const tests = termTests[selectedTerm];

  // 1. Check Fees Status
  useEffect(() => {
    if (!schoolId || !academicYear || !selectedPupil) return;
    const q = query(collection(db, "StudentFeesStatus"), 
      where("schoolId", "==", schoolId), 
      where("academicYear", "==", academicYear), 
      where("studentID", "==", selectedPupil)
    );
    return onSnapshot(q, (snap) => {
      setFeesStatus(snap.empty ? "Open" : snap.docs[0].data().status);
      setLoadingStatus(false);
    }, () => { setFeesStatus("Closed"); setLoadingStatus(false); });
  }, [schoolId, academicYear, selectedPupil]);

  // 2. Get Pupil Class & Year
  useEffect(() => {
    if (!selectedPupil || schoolId === "N/A") return;
    const q = query(collection(db, "PupilsReg"), 
      where("studentID", "==", selectedPupil), 
      where("schoolId", "==", schoolId)
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setLatestInfo({ class: d.class, academicYear: d.academicYear });
      }
      setLoadingReg(false);
    });
  }, [selectedPupil, schoolId]);

  // 3. Get Grades (Using schooldb and Trimmed Class)
  useEffect(() => {
    if (!academicYear || !selectedClass || !selectedPupil) return;
    setLoadingGrades(true);
    const key = `grades_${schoolId}_${academicYear}_${selectedClass}`;

    const q = query(
      collection(schooldb, "PupilGrades"), // ✅ Changed to schooldb
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId),
      where("className", "==", selectedClass) // ✅ Matches trimmed class
    );

    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data());
      setClassGradesData(data);
      setPupilGradesData(data.filter((g) => g.pupilID === selectedPupil));
      gradesStore.setItem(key, { data });
      setLoadingGrades(false);
    });
  }, [academicYear, selectedClass, selectedPupil, schoolId]);

  // 4. Calculate Results & Positions
  const { reportRows, totalMarks, overallRank } = useMemo(() => {
    if (!pupilGradesData.length || !tests) return { reportRows: [], totalMarks: 0, overallRank: "—" };

    const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];
    const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();

    // Subject Ranking Logic
    const classMeansBySubject = {};
    uniqueSubjects.forEach(subject => {
      const scores = pupilIDs.map(id => {
        const g = classGradesData.filter(x => x.pupilID === id && x.subject === subject);
        const m = (Number(g.find(x => x.test === tests[0])?.grade || 0) + Number(g.find(x => x.test === tests[1])?.grade || 0)) / 2;
        return { id, mean: m };
      }).sort((a, b) => b.mean - a.mean);
      
      scores.forEach((x, i) => { x.rank = (i > 0 && x.mean === scores[i-1].mean) ? scores[i-1].rank : i + 1; });
      classMeansBySubject[subject] = scores;
    });

    let totalSum = 0;
    const rows = uniqueSubjects.map(subject => {
      const t1 = pupilGradesData.find(g => g.subject === subject && g.test === tests[0])?.grade || 0;
      const t2 = pupilGradesData.find(g => g.subject === subject && g.test === tests[1])?.grade || 0;
      const mean = Math.round((Number(t1) + Number(t2)) / 2);
      totalSum += mean;
      const rank = classMeansBySubject[subject]?.find(s => s.id === selectedPupil)?.rank || "—";
      return { subject, test1: t1, test2: t2, mean, rank };
    });

    return { reportRows: rows, totalMarks: totalSum, overallRank: "—" }; 
  }, [pupilGradesData, classGradesData, tests, selectedPupil]);

  if (loadingStatus || loadingReg) return <p className="text-center p-8">Loading Profile...</p>;

  if (feesStatus === "Closed") {
    return (
      <div className="text-center p-10 bg-white shadow-xl rounded-xl max-w-lg mx-auto mt-10">
        <h2 className="text-2xl font-bold text-red-600">Access Restricted</h2>
        <p className="mt-3 text-gray-700">Please settle your school fees to view your results.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">{schoolName}</h2>
      
      <div className="flex justify-center gap-2 mb-6">
        {Object.keys(termTests).map((term) => (
          <button
            key={term}
            onClick={() => setSelectedTerm(term)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTerm === term ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {term}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50">
        <img src={pupilData.userPhotoUrl || "https://via.placeholder.com/96"} className="w-20 h-20 rounded-full border-2 border-indigo-500 object-cover" alt="pupil" />
        <div>
          <p className="text-lg font-bold text-indigo-900">{pupilData.studentName}</p>
          <p className="text-sm text-gray-600">Class: {selectedClass} | ID: {selectedPupil}</p>
          <p className="text-sm text-gray-600">Year: {academicYear}</p>
        </div>
      </div>

      {loadingGrades ? (
        <p className="text-center py-10">Fetching Grades...</p>
      ) : reportRows.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="min-w-full text-sm text-center">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Subject</th>
                <th>{tests[0].split(' ').pop()}</th>
                <th>{tests[1].split(' ').pop()}</th>
                <th>Mean</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="text-left px-4 py-3 font-medium">{row.subject}</td>
                  <td className={getGradeColor(row.test1)}>{row.test1}</td>
                  <td className={getGradeColor(row.test2)}>{row.test2}</td>
                  <td className={`font-bold ${getGradeColor(row.mean)}`}>{row.mean}</td>
                  <td className="text-red-600 font-bold">{row.rank}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50 font-bold">
                <td className="px-4 py-3 text-left">Combined Score</td>
                <td colSpan="2"></td>
                <td className="text-indigo-700">{totalMarks}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center py-10 text-gray-500">No grades found for {selectedTerm}.</p>
      )}
    </div>
  );
};

export default IndividualReportCardTerm1;