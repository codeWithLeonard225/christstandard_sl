import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";

const TeacherGradesPage = () => {
  const { user } = useAuth(); // get logged-in user

  const [assignments, setAssignments] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [grades, setGrades] = useState({});
  const [selectedTest, setSelectedTest] = useState("Test 1");
  const [academicYear, setAcademicYear] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [gradeSummary, setGradeSummary] = useState({ filled: 0, empty: 0 });
  const [submitting, setSubmitting] = useState(false); // NEW state

  const tests = ["Test 1", "Test 2", "Test 3", "Final Exam"];
  const teacherName = user?.data?.teacherName;

  // --- Fetch assignments ---
  useEffect(() => {
    if (!teacherName) return;
    const q = query(collection(db, "TeacherAssignments"), where("teacher", "==", teacherName));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAssignments(data);
      if (data.length > 0) {
        setSelectedClass(data[0].className);
        setSelectedSubject(data[0].subjects[0]);
      }
    });
    return () => unsub();
  }, [teacherName]);

  // --- Fetch latest academic year ---
  useEffect(() => {
    const q = query(collection(db, "PupilsReg"), orderBy("academicYear", "desc"), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setAcademicYear(snapshot.docs[0].data().academicYear);
      }
    });
    return () => unsub();
  }, []);

  // --- Fetch pupils for selected class ---
  useEffect(() => {
    if (!selectedClass || !academicYear) {
      setPupils([]);
      return;
    }

    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("class", "==", selectedClass),
      where("academicYear", "==", academicYear)
    );

    const unsub = onSnapshot(pupilsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPupils(data);
      const initialGrades = {};
      data.forEach((pupil) => (initialGrades[pupil.studentID] = ""));
      setGrades(initialGrades);
    });

    return () => unsub();
  }, [selectedClass, academicYear]);

  // --- Check for existing grades ---
  useEffect(() => {
    const checkExistingGrades = async () => {
      if (!selectedClass || !selectedSubject || !selectedTest || !academicYear) {
        setAlreadySubmitted(false);
        return;
      }

      const q = query(
        collection(db, "PupilGrades"),
        where("className", "==", selectedClass),
        where("subject", "==", selectedSubject),
        where("test", "==", selectedTest),
        where("academicYear", "==", academicYear)
      );

      const snapshot = await getDocs(q);
      setAlreadySubmitted(!snapshot.empty);
    };

    checkExistingGrades();
  }, [selectedClass, selectedSubject, selectedTest, academicYear]);

  const handleGradeChange = (pupilID, value) => {
    setGrades({ ...grades, [pupilID]: value });
  };

  const handleShowPopup = () => {
    const total = pupils.length;
    const filled = Object.values(grades).filter((v) => v !== "").length;
    const empty = total - filled;
    setGradeSummary({ filled, empty });
    setShowPopup(true);
  };

  const handleSubmitGrades = async () => {
    if (!teacherName || !selectedClass || !selectedSubject || !selectedTest) {
      alert("Please select class, subject, and test.");
      return;
    }

    if (alreadySubmitted) {
      alert("Grades for this test and academic year have already been submitted!");
      return;
    }

    setSubmitting(true); // freeze submit
    setShowPopup(false); // close popup immediately

    try {
      for (const pupilID of Object.keys(grades)) {
        const gradeValue = grades[pupilID];
        if (gradeValue !== "") {
          const docRef = doc(collection(db, "PupilGrades"));
          await setDoc(docRef, {
            pupilID,
            className: selectedClass,
            subject: selectedSubject,
            teacher: teacherName,
            grade: parseFloat(gradeValue),
            test: selectedTest,
            academicYear,
            timestamp: serverTimestamp(),
          });
        }
      }

      alert(`✅ Grades for ${selectedTest} (${academicYear}) submitted successfully!`);
      setAlreadySubmitted(true);
      setGrades({}); // ✅ clear all grade inputs
    } catch (err) {
      console.error(err);
      alert("❌ Error submitting grades.");
    } finally {
      setSubmitting(false); // unfreeze button
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-2xl shadow-md relative">
      <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
        Submit Pupils' Grades ({academicYear || "Loading..."})
      </h2>

      <p className="mb-4 text-gray-700 font-medium">
        Logged in as: <span className="font-semibold">{teacherName}</span>
      </p>

      {/* Test Selector */}
      <div className="mb-4">
        <label className="font-medium text-gray-700">Select Test:</label>
        <select
          value={selectedTest}
          onChange={(e) => setSelectedTest(e.target.value)}
          className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-green-300 bg-white"
        >
          {tests.map((test, i) => (
            <option key={i} value={test}>
              {test}
            </option>
          ))}
        </select>
      </div>

      {/* Class Tabs */}
      {assignments.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {assignments.map((a) => (
            <button
              key={a.id}
              className={`px-4 py-2 rounded-md ${
                selectedClass === a.className ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
              onClick={() => {
                setSelectedClass(a.className);
                setSelectedSubject(a.subjects[0]);
              }}
            >
              {a.className}
            </button>
          ))}
        </div>
      )}

      {/* Subject Tabs */}
      {assignments.length > 0 && selectedClass && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {assignments
            .find((a) => a.className === selectedClass)
            .subjects.map((subject, i) => (
              <button
                key={i}
                className={`px-4 py-2 rounded-md ${
                  selectedSubject === subject ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setSelectedSubject(subject)}
              >
                {subject}
              </button>
            ))}
        </div>
      )}

      {/* Pupils Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Student Name</th>
              <th className="border px-3 py-2 text-left">Grade</th>
              <th className="border px-3 py-2 text-left">Class</th>
            </tr>
          </thead>
          <tbody>
            {pupils.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  No pupils found for this class.
                </td>
              </tr>
            ) : (
              pupils.map((pupil, index) => (
                <tr key={pupil.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2">{pupil.studentName}</td>
                  <td className="border px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={grades[pupil.studentID] || ""}
                      onChange={(e) => handleGradeChange(pupil.studentID, e.target.value)}
                      className="w-20 border px-2 py-1 rounded-md text-center"
                      disabled={alreadySubmitted || submitting}
                    />
                  </td>
                  <td className="border px-3 py-2">{pupil.class}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
      <div className="mt-4">
        <button
          onClick={handleShowPopup}
          className={`w-full py-2 rounded-md ${
            alreadySubmitted || submitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          disabled={alreadySubmitted || submitting}
        >
          {alreadySubmitted
            ? "Grades Already Submitted"
            : submitting
            ? "Submitting..."
            : "Submit Grades"}
        </button>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Confirm Submission</h3>
            <p className="text-gray-700 mb-3">
              Total Pupils: <b>{pupils.length}</b>
            </p>
            <p className="text-green-700 mb-2">
              ✅ Grades Entered: <b>{gradeSummary.filled}</b>
            </p>
            <p className="text-red-600 mb-4">
              ⚠️ Grades Missing: <b>{gradeSummary.empty}</b>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Once submitted, grades for this test and academic year cannot be changed.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleSubmitGrades}
                disabled={submitting}
                className={`px-4 py-2 rounded-md ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {submitting ? "Submitting..." : "Proceed & Submit"}
              </button>
              <button
                onClick={() => setShowPopup(false)}
                disabled={submitting}
                className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradesPage;
