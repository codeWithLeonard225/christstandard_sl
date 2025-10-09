import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
// import { useAuth } from "../Security/AuthContext"; // Uncomment if needed

const GradeSheetPage = () => {
  // 1. STATE MANAGEMENT
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]); // All available years
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTest, setSelectedTest] = useState("Final Exam"); // Default to a more common final test
  const [availableClasses, setAvailableClasses] = useState([]);
  const [pupils, setPupils] = useState([]); // List of pupils for the selected class
  const [gradesData, setGradesData] = useState([]); // Raw grades data from DB
  const [loading, setLoading] = useState(false);

  const tests = ["Test 1", "Test 2", "Test 3", "Final Exam"];
  const MAX_SCORE_PER_SUBJECT = 100; // Standard assumption for percentage calculation

  // 2. DATA FETCHING HOOKS

  // Fetch all years/classes and set defaults
  useEffect(() => {
    // Note: Fetching from PupilGrades ensures we only show options that actually have grades
    const q = query(collection(db, "PupilGrades"), orderBy("academicYear", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const years = [...new Set(snapshot.docs.map(doc => doc.data().academicYear).filter(Boolean))];
      const classes = [...new Set(snapshot.docs.map(doc => doc.data().className).filter(Boolean))];
      
      setAcademicYears(years.sort().reverse());
      setAvailableClasses(classes.sort());

      // Set initial state defaults ONLY if they haven't been set by the user
      if (years.length > 0 && !academicYear) setAcademicYear(years[0]); 
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]); 
    });
    return () => unsub();
  }, []);

  // Fetch pupils for the selected class/year (used for column headers)
  useEffect(() => {
    if (!selectedClass || !academicYear) {
      setPupils([]);
      return;
    }
    
    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("class", "==", selectedClass),
      where("academicYear", "==", academicYear),
      orderBy("studentName", "asc") 
    );

    const unsub = onSnapshot(pupilsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), studentID: doc.data().studentID }));
      setPupils(data);
    });

    return () => unsub();
  }, [selectedClass, academicYear]);

  // Fetch grades based on all three filters
  useEffect(() => {
    if (!selectedClass || !selectedTest || !academicYear) {
      setGradesData([]);
      return;
    }

    setLoading(true);
    
    const gradesQuery = query(
      collection(db, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass),
      where("test", "==", selectedTest)
    );

    const fetchGrades = async () => {
        try {
            const snapshot = await getDocs(gradesQuery);
            const data = snapshot.docs.map((doc) => doc.data());
            setGradesData(data);
        } catch (error) {
            console.error("Error fetching grades:", error);
            setGradesData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchGrades();

  }, [selectedClass, selectedTest, academicYear]);


  // 3. DATA TRANSFORMATION (Pivot table logic, Total Sum, and Percentage calculation)

const { subjects, pupilGradesMap, pupilTotals } = React.useMemo(() => {
    // 1. Get a unique list of all subjects (same as before)
    const uniqueSubjects = [
      ...new Set(gradesData.map((grade) => grade.subject)),
    ].sort();

    // 2. Map grades for easy lookup (same as before)
    const gradesMap = uniqueSubjects.reduce((acc, subject) => {
      acc[subject] = {};
      return acc;
    }, {});

    gradesData.forEach((grade) => {
      if (gradesMap[grade.subject]) {
        gradesMap[grade.subject][grade.pupilID] = grade.grade;
      }
    });

    // 3. Calculate Total Sum and Percentage for each pupil
    const pupilPerformance = []; // Use an array for easier sorting later

    pupils.forEach((pupil) => {
        let totalScore = 0;
        let subjectsAttempted = 0;

        uniqueSubjects.forEach((subject) => {
            const grade = gradesMap[subject]?.[pupil.studentID];
            if (grade !== undefined && grade !== null) {
                totalScore += grade;
                subjectsAttempted += 1;
            }
        });

        let percentage = 0;
        if (subjectsAttempted > 0) {
            const maxScoreForAttempted = subjectsAttempted * MAX_SCORE_PER_SUBJECT;
            percentage = (totalScore / maxScoreForAttempted) * 100;
        }

        pupilPerformance.push({
            studentID: pupil.studentID,
            totalSum: totalScore,
            percentage: parseFloat(percentage.toFixed(2)),
            // Rank will be calculated next
            rank: null
        });
    });
    
    // 4. Calculate Rank (Standard Competition Ranking)
    
    // Sort the performance data by percentage descending
    pupilPerformance.sort((a, b) => b.percentage - a.percentage);

    const rankedTotalsMap = {};
    let currentRank = 1;
    let previousPercentage = -1;
    let rankCount = 0;

    // Assign ranks (1, 2, 2, 4...)
    pupilPerformance.forEach((item, index) => {
        rankCount++;
        
        if (item.percentage < previousPercentage) {
            currentRank = rankCount;
        } 
        // If percentages are the same, they share the rank (currentRank)
        else if (index === 0) { 
             currentRank = 1;
        }


        // Handle pupils who may have no grades (0% score) by not ranking them
        if (item.percentage === 0 && item.totalSum === 0) {
            item.rank = "N/A";
        } else {
            item.rank = currentRank;
        }

        previousPercentage = item.percentage;
        
        // Final map for easy lookup by studentID in the render function
        rankedTotalsMap[item.studentID] = {
            totalSum: item.totalSum,
            percentage: item.percentage,
            rank: item.rank
        };
    });

    return { subjects: uniqueSubjects, pupilGradesMap: gradesMap, pupilTotals: rankedTotalsMap };
}, [gradesData, pupils]);


  // 4. RENDER LOGIC

  // Helper to color the grade
  const getGradeColor = (grade) => {
    if (grade === undefined) return "text-gray-400";
    if (grade >= 70) return "text-green-600 font-bold";
    if (grade >= 40) return "text-yellow-600 font-medium";
    return "text-red-600 font-bold";
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-2xl shadow-xl">
      <h2 className="text-3xl font-bold mb-8 text-center text-indigo-700">
        Pupil Grade Sheet Report
      </h2>

      {/* Filter Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 border rounded-lg bg-indigo-50">
        
        <div>
          <label className="font-semibold text-gray-700 block mb-1">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
            disabled={academicYears.length === 0}
          >
            {academicYears.map((year, i) => (
              <option key={i} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold text-gray-700 block mb-1">Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
            disabled={availableClasses.length === 0}
          >
            {availableClasses.map((className, i) => (
              <option key={i} value={className}>{className}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold text-gray-700 block mb-1">Assessment:</label>
          <select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-white"
          >
            {tests.map((test, i) => (
              <option key={i} value={test}>{test}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-center mb-6">
        <h3 className="text-xl font-medium text-gray-800">
          Grade Summary for **{selectedTest}** in **{selectedClass}**
        </h3>
      </div>
      
      {loading && (
        <div className="text-center p-8 text-indigo-600 font-medium">
          Loading grades, please wait...
        </div>
      )}

      {/* Grade Table Container */}
      {!loading && subjects.length > 0 && (
        // Added max-h-[80vh] and overflow-y-auto for vertical scrolling
        <div className="overflow-x-auto border rounded-lg shadow-lg max-h-[80vh] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-indigo-600 text-white sticky top-0">
              <tr>
                {/* 1. Fixed Subject Column Header */}
                <th 
                  className="px-4 py-3 text-left text-sm font-medium border-r border-indigo-700 sticky left-0 bg-indigo-600 z-30 w-48 whitespace-nowrap"
                >
                  Subject
                </th>
                
                {/* 2. Pupil Names (Rotated Column Headers) */}
                {pupils.map((pupil) => (
                  <th
                    key={pupil.studentID}
                    className="th-rotate" 
                    style={{ width: '50px' }}
                  >
                    <div>
                      {pupil.studentName}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Subject Grade Rows */}
              {subjects.map((subject, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  
                  {/* Subject Name (Sticky Row Header) */}
                  <td 
                    className="px-4 py-3 font-semibold text-gray-900 border-r border-gray-300 sticky left-0 bg-white z-10 w-48 whitespace-nowrap"
                  >
                    {subject}
                  </td>
                  
                  {/* Grades for each pupil */}
                  {pupils.map((pupil) => {
                    const grade = pupilGradesMap[subject]?.[pupil.studentID];
                    return (
                      <td
                        key={pupil.studentID}
                        className="px-4 py-3 text-center text-sm border-l border-gray-200 grade-cell" 
                      >
                        <span className={getGradeColor(grade)}>
                          {grade !== undefined ? grade : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* Total Sum Row */}
              <tr className="bg-gray-100 font-bold border-t-2 border-indigo-300">
                <td 
                  className="px-4 py-3 text-gray-900 sticky left-0 bg-gray-100 z-50 w-48 whitespace-nowrap"
                >
                  Total Sum
                </td>
                {pupils.map((pupil) => (
                  <td 
                    key={`sum-${pupil.studentID}`} 
                    className="px-4 py-3 text-center text-sm border-l border-gray-200 grade-cell"
                  >
                    {pupilTotals[pupil.studentID]?.totalSum || "—"}
                  </td>
                ))}
              </tr>

              {/* Percentage Row */}
              <tr className="bg-indigo-50 font-bold">
                <td 
                  className="px-4 py-3 text-indigo-700 sticky left-0 bg-indigo-50 z-50 w-48 whitespace-nowrap"
                >
                  Percentage (%)
                </td>
                {pupils.map((pupil) => (
                  <td 
                    key={`percent-${pupil.studentID}`} 
                    className="px-4 py-3 text-center text-sm border-l border-gray-200 grade-cell"
                  >
                    {pupilTotals[pupil.studentID]?.percentage !== undefined 
                      ? `${pupilTotals[pupil.studentID].percentage}%` 
                      : "—"}
                  </td>
                ))}
              </tr>
              {/* NEW: Rank Row */}
                        <tr className="bg-indigo-100 font-extrabold border-t border-indigo-300">
                            <td 
                                className="px-4 py-3 text-indigo-800 sticky left-0 bg-indigo-100 z-50 w-48 whitespace-nowrap"
                            >
                                Class Rank
                            </td>
                            {pupils.map((pupil) => (
                                <td 
                                    key={`rank-${pupil.studentID}`} 
                                    className="px-4 py-3 text-center text-sm border-l border-gray-200 grade-cell"
                                >
                                    {pupilTotals[pupil.studentID]?.rank || "—"}
                                </td>
                            ))}
                        </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* No Data Message */}
      {!loading && subjects.length === 0 && (
        <div className="text-center p-8 bg-yellow-50 text-yellow-800 border border-yellow-300 rounded-lg">
          No grades found for the selected combination.
        </div>
      )}
    </div>
  );
};

export default GradeSheetPage;