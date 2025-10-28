import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../../firebase";
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
    // ⭐️ NEW IMPORTS for Edit/Delete
    updateDoc, 
    deleteDoc, 
    doc,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
// Assuming you have 'react-toastify' installed for user feedback
import { toast } from "react-toastify"; 

const GradeSheetPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedTest, setSelectedTest] = useState("Term 1 T1");
    const [availableClasses, setAvailableClasses] = useState([]);
    const [pupils, setPupils] = useState([]);
    const [gradesData, setGradesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [classesCache, setClassesCache] = useState([]);
    
    // ⭐️ NEW STATE for tracking temporary edits
    // Format: { 'pupilID-subjectName': { value: newGrade, gradeDocId: firestoreId } }
    const [editingGrades, setEditingGrades] = useState({});

    const tests = ["Term 1 T1", "Term 1 T2", "Term 2 T1", "Term 2 T2", "Term 3 T1", "Term 3 T2"];
    const MAX_SCORE_PER_SUBJECT = 100;

    // 🔹 Fetch Classes Cache (for subjectPercentage)
    useEffect(() => {
        if (!schoolId) return;
        const fetchClasses = async () => {
            const snapshot = await getDocs(query(collection(db, "Classes"), where("schoolId", "==", schoolId)));
            const data = snapshot.docs.map(doc => doc.data());
            setClassesCache(data);
        };
        fetchClasses();
    }, [schoolId]);

    // 🔹 Fetch academic years and classes from grades
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;

        const q = query(collection(db, "PupilGrades"), where("schoolId", "==", schoolId));
        const unsub = onSnapshot(q, (snapshot) => {
            const years = [...new Set(snapshot.docs.map(doc => doc.data().academicYear).filter(Boolean))];
            const classes = [...new Set(snapshot.docs.map(doc => doc.data().className).filter(Boolean))];

            setAcademicYears(years.sort().reverse());
            setAvailableClasses(classes.sort());

            if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
            if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
        });

        return () => unsub();
    }, [schoolId, academicYear, selectedClass]);

    // 🔹 Fetch pupils
    useEffect(() => {
        if (!selectedClass || !academicYear || !schoolId) return;

        const pupilsQuery = query(
            collection(db, "PupilsReg"),
            where("schoolId", "==", schoolId),
            where("class", "==", selectedClass),
            where("academicYear", "==", academicYear)
        );

        const unsub = onSnapshot(pupilsQuery, (snapshot) => {
            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data(), studentID: doc.data().studentID }))
                .sort((a, b) => a.studentName.localeCompare(b.studentName)); 
            setPupils(data);
        });

        return () => unsub();
    }, [selectedClass, academicYear, schoolId]);


    // 🔹 Fetch grades (MODIFIED to include doc.id)
    const fetchGrades = React.useCallback(async () => {
        if (!selectedClass || !selectedTest || !academicYear || !schoolId) return;

        setLoading(true);
        // Clear edits state when filters change
        setEditingGrades({}); 
        
        const gradesQuery = query(
            collection(db, "PupilGrades"),
            where("schoolId", "==", schoolId),
            where("academicYear", "==", academicYear),
            where("className", "==", selectedClass),
            where("test", "==", selectedTest)
        );

        const snapshot = await getDocs(gradesQuery);
        // ⭐️ Store the Firestore Document ID (gradeDocId) for updates/deletes
        const data = snapshot.docs.map(doc => ({ 
            gradeDocId: doc.id, 
            ...doc.data() 
        }));
        setGradesData(data);
        setLoading(false);
    }, [selectedClass, selectedTest, academicYear, schoolId]);
    
    useEffect(() => {
        fetchGrades();
    }, [fetchGrades]);


    // 🔹 Calculate subjects, grades, totals, percentages, and ranks (MODIFIED for gradeDocMap)
    const { subjects, pupilGradesMap, pupilTotals, gradeDocMap } = React.useMemo(() => {
        if (!gradesData.length || !pupils.length) return { subjects: [], pupilGradesMap: {}, pupilTotals: {}, gradeDocMap: {} };

        const uniqueSubjects = [...new Set(gradesData.map(g => g.subject))].sort();
        const gradesMap = uniqueSubjects.reduce((acc, sub) => { acc[sub] = {}; return acc; }, {});
        const docMap = uniqueSubjects.reduce((acc, sub) => { acc[sub] = {}; return acc; }, {});

        gradesData.forEach(g => {
            if (gradesMap[g.subject]) {
                gradesMap[g.subject][g.pupilID] = g.grade;
                // ⭐️ Map the Firestore Document ID to pupil and subject
                docMap[g.subject][g.pupilID] = g.gradeDocId;
            }
        });

        // Get subjectPercentage for selected class
        const classInfo = classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass);
        const totalSubjectPercentage = classInfo?.subjectPercentage || (uniqueSubjects.length * MAX_SCORE_PER_SUBJECT);

        const totalsMap = {};
        const perf = pupils.map(pupil => {
            let total = 0;
            uniqueSubjects.forEach(sub => {
                // Use the fetched grade for total calculation
                const grade = gradesMap[sub]?.[pupil.studentID]; 
                if (grade != null) total += grade;
            });
            const percentage = totalSubjectPercentage > 0 ? (total / totalSubjectPercentage) * 100 : 0;
            return { studentID: pupil.studentID, total, percentage };
        });

        perf.sort((a, b) => b.percentage - a.percentage);
        let rank = 1;
        perf.forEach((p, i) => {
            if (i > 0 && p.percentage < perf[i - 1].percentage) rank = i + 1;
            totalsMap[p.studentID] = { totalSum: p.total, percentage: p.percentage.toFixed(1), rank: p.total === 0 ? "N/A" : rank };
        });

        return { subjects: uniqueSubjects, pupilGradesMap: gradesMap, pupilTotals: totalsMap, gradeDocMap: docMap };
    }, [gradesData, pupils, selectedClass, schoolId, classesCache]);


    // 🔹 Handler for grade input change
    const handleGradeInputChange = (pupilID, subject, gradeDocId, value) => {
        // Store temporary edits
        setEditingGrades(prev => ({
            ...prev,
            [`${pupilID}-${subject}`]: { 
                value, 
                gradeDocId 
            }
        }));
    };

    // 🔹 Handler for saving the updated grade
    const handleSaveGrade = async (pupilID, subject, gradeDocId) => {
        const editKey = `${pupilID}-${subject}`;
        const editedGrade = editingGrades[editKey];

        if (!editedGrade || editedGrade.value === "" || editedGrade.gradeDocId === "") {
            toast.error("Invalid grade or document ID.");
            return;
        }

        const newGradeValue = parseFloat(editedGrade.value);

        if (isNaN(newGradeValue) || newGradeValue < 0 || newGradeValue > MAX_SCORE_PER_SUBJECT) {
            toast.error(`Grade must be between 0 and ${MAX_SCORE_PER_SUBJECT}.`);
            return;
        }

        try {
            const gradeRef = doc(db, "PupilGrades", editedGrade.gradeDocId);
            await updateDoc(gradeRef, { grade: newGradeValue });
            
            // Remove the grade from the temporary edits
            setEditingGrades(prev => {
                const newState = { ...prev };
                delete newState[editKey];
                return newState;
            });
            
            // Re-fetch grades to update the table calculations
            await fetchGrades();
            
            toast.success(`✅ Grade for ${pupilID} in ${subject} updated to ${newGradeValue}.`);

        } catch (error) {
            console.error("Error updating grade:", error);
            toast.error("❌ Failed to update grade.");
        }
    };
    
    // 🔹 Handler for deleting the grade
    const handleDeleteGrade = async (pupilID, subject, gradeDocId) => {
        if (!window.confirm(`Are you sure you want to delete the grade for ${pupilID} in ${subject}?`)) {
            return;
        }

        if (!gradeDocId) {
            toast.error("Grade document ID is missing. Cannot delete.");
            return;
        }
        
        try {
            const gradeRef = doc(db, "PupilGrades", gradeDocId);
            await deleteDoc(gradeRef);
            
            // Remove from temporary edits
            setEditingGrades(prev => {
                const newState = { ...prev };
                delete newState[`${pupilID}-${subject}`];
                return newState;
            });

            // Re-fetch grades to update the table calculations
            await fetchGrades();

            toast.warn(`🗑️ Grade for ${pupilID} in ${subject} deleted.`);
            
        } catch (error) {
            console.error("Error deleting grade:", error);
            toast.error("❌ Failed to delete grade.");
        }
    };
    
    // 🔹 Helper to get current grade value
    const getCurrentGradeValue = (pupilID, subject) => {
        const editKey = `${pupilID}-${subject}`;
        // If it's being edited, return the edited value. Otherwise, return the original fetched value.
        return editingGrades[editKey]?.value ?? pupilGradesMap[subject]?.[pupilID] ?? "";
    };


    // 🔹 Helper for grade colors
    const getGradeColor = (grade) => {
        if (grade == null || grade === "") return "text-gray-400";
        // Convert to number for comparison if it's a string from input
        const numericGrade = parseFloat(grade);
        if (numericGrade >= 50) return "text-blue-600 font-bold";
        return "text-red-600 font-bold";
    };

    // 🔹 Print Preview
    const handlePrint = () => window.print();

    // 🔹 Download PDF
    const handleDownloadPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(`Grade Sheet - ${selectedClass} (${academicYear}) - ${selectedTest}`, 14, 15);

        const tableHeaders = ["Subject", ...pupils.map(p => p.studentName)];
        const tableRows = subjects.map(sub => [
            sub,
            // Note: This uses the original fetched grades (pupilGradesMap), not the unsaved edits
            ...pupils.map(p => pupilGradesMap[sub]?.[p.studentID] ?? "—") 
        ]);

        tableRows.push(["Total Sum", ...pupils.map(p => pupilTotals[p.studentID]?.totalSum ?? "—")]);
        tableRows.push(["Percentage (%)", ...pupils.map(p => pupilTotals[p.studentID]?.percentage ?? "—")]);
        tableRows.push(["Rank", ...pupils.map(p => pupilTotals[p.studentID]?.rank ?? "—")]);

        autoTable(doc, {
            head: [tableHeaders],
            body: tableRows,
            startY: 25,
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: { fillColor: [63, 81, 181] },
        });

        doc.save(`GradeSheet_${selectedClass}_${selectedTest}.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-2xl shadow-xl">
            <h2 className="text-3xl font-bold mb-8 text-center text-indigo-700">
                Pupil Grade Sheet Report (Admin Edit)
            </h2>

            {/* Buttons */}
            <div className="flex justify-center gap-4 mb-6 no-print">
                <button
                    onClick={handlePrint}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow"
                >
                    🖨️ Print Preview
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow"
                >
                    📄 Download PDF
                </button>
            </div>
            
            {/* Filter Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 border rounded-lg bg-indigo-50 no-print">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Academic Year:</label>
                    <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {academicYears.map((year, i) => <option key={i} value={year}>{year}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {availableClasses.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Assessment:</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => setSelectedTest(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {tests.map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center text-indigo-600 p-6">Loading grades...</div>
            ) : subjects.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg shadow-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-indigo-600 text-white sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left border-r">Subject</th>
                                {pupils.map((p) => (
                                    <th key={p.studentID} className="px-4 py-3 text-center border-r">
                                        {p.studentName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.map((sub, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-semibold border-r">{sub}</td>
                                    {pupils.map((p) => {
                                        const pupilID = p.studentID;
                                        // Use gradeDocMap to retrieve the document ID for actions
                                        const gradeDocId = gradeDocMap[sub]?.[pupilID] ?? ""; 
                                        const currentValue = getCurrentGradeValue(pupilID, sub);
                                        const isBeingEdited = editingGrades[`${pupilID}-${sub}`];
                                        const hasGrade = gradeDocId !== "";
                                        
                                        return (
                                            <td key={pupilID} className="px-2 py-1 border-r">
                                                <div className="flex items-center space-x-1">
                                                    {/* ⭐️ Grade Input Field */}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={MAX_SCORE_PER_SUBJECT}
                                                        value={currentValue}
                                                        onChange={(e) => 
                                                            handleGradeInputChange(pupilID, sub, gradeDocId, e.target.value)
                                                        }
                                                        className={`w-16 px-1 py-1 text-center border rounded-md text-sm ${getGradeColor(currentValue)} ${isBeingEdited ? 'border-orange-500 ring-2 ring-orange-500' : 'border-gray-300'}`}
                                                        placeholder="—"
                                                    />

                                                    {/* ⭐️ Save Button (Shows only if actively editing) */}
                                                    {isBeingEdited && (
                                                        <button
                                                            onClick={() => handleSaveGrade(pupilID, sub, gradeDocId)}
                                                            className="text-green-600 hover:text-green-800 p-1 rounded-full text-xs"
                                                            title="Save Grade"
                                                        >
                                                            💾
                                                        </button>
                                                    )}

                                                    {/* ⭐️ Delete Button (Shows only if a grade exists and is not currently being edited) */}
                                                    {hasGrade && !isBeingEdited && (
                                                        <button
                                                            onClick={() => handleDeleteGrade(pupilID, sub, gradeDocId)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-full text-xs"
                                                            title="Delete Grade"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td className="px-4 py-3 border-r">Total Sum</td>
                                {pupils.map((p) => <td key={p.studentID} className="px-4 py-3 text-center">{pupilTotals[p.studentID]?.totalSum ?? "—"}</td>)}
                            </tr>
                            <tr className="bg-indigo-50 font-bold">
                                <td className="px-4 py-3 border-r">Percentage (%)</td>
                                {pupils.map((p) => <td key={p.studentID} className="px-4 py-3 text-center">{pupilTotals[p.studentID]?.percentage ?? "—"}%</td>)}
                            </tr>
                            <tr className="bg-indigo-100 font-bold">
                                <td className="px-4 py-3 border-r">Rank</td>
                                {pupils.map((p) => <td key={p.studentID} className="px-4 py-3 text-center">{pupilTotals[p.studentID]?.rank ?? "—"}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center text-yellow-700 p-6 bg-yellow-50 border rounded">
                    No grades found for this selection.
                </div>
            )}
        </div>
    );
};

export default GradeSheetPage;