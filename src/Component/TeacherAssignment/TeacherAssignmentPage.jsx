import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

const TeacherAssignmentPage = () => {
  const [teacher, setTeacher] = useState("");
  const [className, setClassName] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classesAndSubjects, setClassesAndSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [editingId, setEditingId] = useState(null); // Track assignment being edited

  // Fetch teachers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Teachers"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTeachers(data);
    });
    return () => unsub();
  }, []);

  // Fetch all classes & subjects
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ClassesAndSubjects"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClassesAndSubjects(data);
    });
    return () => unsub();
  }, []);

  // Update subjectList based on selected class
  useEffect(() => {
    if (!className) {
      setSubjectList([]);
      setSelectedSubjects([]);
      return;
    }
    const selectedClass = classesAndSubjects.find((cls) => cls.className === className);
    setSubjectList(selectedClass ? selectedClass.subjects : []);
    setSelectedSubjects([]);
  }, [className, classesAndSubjects]);

  // Handle checkbox toggle
  const handleSubjectToggle = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  // Assign or update teacher
  const handleAssign = async () => {
    if (!teacher || !className || selectedSubjects.length === 0) {
      alert("Please select a teacher, class, and at least one subject.");
      return;
    }

    try {
      if (editingId) {
        // Update existing assignment
        const assignmentRef = doc(db, "TeacherAssignments", editingId);
        await updateDoc(assignmentRef, {
          teacher,
          className,
          subjects: selectedSubjects,
        });
        setEditingId(null);
        alert("Assignment updated successfully!");
      } else {
        // Add new assignment
        await addDoc(collection(db, "TeacherAssignments"), {
          teacher,
          className,
          subjects: selectedSubjects,
          createdAt: new Date(),
        });
        alert("Teacher assigned successfully!");
      }

      // Reset form
      setTeacher("");
      setClassName("");
      setSelectedSubjects([]);
    } catch (err) {
      console.error(err);
      alert("Error saving assignment.");
    }
  };

  // Real-time listener for assignments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "TeacherAssignments"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAssignments(data);
    });
    return () => unsub();
  }, []);

  // Start editing an assignment
  const handleEdit = (assignment) => {
    setEditingId(assignment.id);
    setTeacher(assignment.teacher);
    setClassName(assignment.className);
    setSelectedSubjects(assignment.subjects);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
        Teacher Class & Subject Assignment
      </h2>

      {/* Inputs */}
      <div className="space-y-4">
        {/* Teacher Dropdown */}
        <div>
          <label className="font-medium text-gray-700">Select Teacher:</label>
          <select
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.fullName || t.teacherName}>
                {t.fullName || t.teacherName}
              </option>
            ))}
          </select>
        </div>

        {/* Class Dropdown */}
        <div>
          <label className="font-medium text-gray-700">Select Class:</label>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
          >
            <option value="">-- Select Class --</option>
            {classesAndSubjects.map((cls) => (
              <option key={cls.id} value={cls.className}>
                {cls.className}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Checkboxes */}
        {subjectList.length > 0 && (
          <div>
            <label className="font-medium text-gray-700">Select Subjects:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {subjectList.map((subject, index) => (
                <label
                  key={index}
                  className="flex items-center space-x-2 border rounded-md px-2 py-1 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                    className="form-checkbox"
                  />
                  <span>{subject}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleAssign}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
        >
          {editingId ? "Update Assignment" : "Assign Teacher"}
        </button>
      </div>

      {/* Table */}
      <h3 className="text-xl font-semibold mt-8 mb-3 text-gray-800 text-center">
        Assigned Teachers
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Teacher</th>
              <th className="border px-3 py-2 text-left">Class</th>
              <th className="border px-3 py-2 text-left">Subjects</th>
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  No assignments yet.
                </td>
              </tr>
            ) : (
              assignments.map((assign, index) => (
                <tr key={assign.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2">{assign.teacher}</td>
                  <td className="border px-3 py-2">{assign.className}</td>
                  <td className="border px-3 py-2">{assign.subjects.join(", ")}</td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => handleEdit(assign)}
                      className="bg-yellow-400 text-white px-3 py-1 rounded-md hover:bg-yellow-500"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherAssignmentPage;
