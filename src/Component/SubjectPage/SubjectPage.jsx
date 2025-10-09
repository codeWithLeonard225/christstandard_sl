import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";

const SubjectPage = () => {
  const [className, setClassName] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [allClasses, setAllClasses] = useState([]); // Classes & subjects combined
  const [classList, setClassList] = useState([]); // For dropdown (from Classes collection)
  const [editingId, setEditingId] = useState(null);

  // Fetch all classes from "Classes" collection for dropdown
  useEffect(() => {
    const classRef = collection(db, "Classes");
    const unsubscribe = onSnapshot(classRef, (snapshot) => {
      const fetchedClasses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClassList(fetchedClasses);
    });

    return () => unsubscribe();
  }, []);

  // Add subject to local list
  const handleAddSubject = () => {
    if (subjectInput.trim() !== "") {
      setSubjects([...subjects, subjectInput.trim()]);
      setSubjectInput("");
    }
  };

  // Save class and its subjects to Firestore
  const handleSave = async () => {
    if (!className.trim() || subjects.length === 0) {
      alert("Please select a class name and enter at least one subject.");
      return;
    }

    if (editingId) {
      // Update existing document
      const docRef = doc(db, "ClassesAndSubjects", editingId);
      await updateDoc(docRef, {
        className,
        subjects,
      });
      setEditingId(null);
    } else {
      // Add new document
      await addDoc(collection(db, "ClassesAndSubjects"), {
        className,
        subjects,
        createdAt: new Date(),
      });
    }

    setClassName("");
    setSubjects([]);
  };

  // Real-time listener for all classes and subjects
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ClassesAndSubjects"), (snapshot) => {
      const classData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllClasses(classData);
    });
    return () => unsub();
  }, []);

  // Delete a class & subjects
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this class and its subjects?")) {
      await deleteDoc(doc(db, "ClassesAndSubjects", id));
    }
  };

  // Edit a class & subjects
  const handleEdit = (cls) => {
    setClassName(cls.className);
    setSubjects(cls.subjects);
    setEditingId(cls.id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
        Class and Subjects Setup
      </h2>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Dropdown for Class Name */}
        <div>
          <label className="font-medium text-gray-700">Class Name:</label>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
          >
            <option value="">-- Select Class --</option>
            {classList.map((cls) => (
              <option key={cls.id} value={cls.className}>
                {cls.className}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Input */}
        <div>
          <label className="font-medium text-gray-700">Subjects:</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2 focus:ring focus:ring-blue-300"
              placeholder="Enter subject e.g. Mathematics"
            />
            <button
              onClick={handleAddSubject}
              className="bg-green-600 text-white px-4 rounded-md hover:bg-green-700"
            >
              Add
            </button>
          </div>

          {/* Display subjects being added */}
          {subjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((subj, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {subj}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
        >
          {editingId ? "Update Class & Subjects" : "Save Class & Subjects"}
        </button>
      </div>

      {/* Real-time Table */}
      <h3 className="text-xl font-semibold mt-8 mb-3 text-gray-800 text-center">
        Saved Classes & Subjects
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Class Name</th>
              <th className="border px-3 py-2 text-left">Subjects</th>
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allClasses.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4 text-gray-500">
                  No classes added yet.
                </td>
              </tr>
            ) : (
              allClasses.map((cls, index) => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2">{cls.className}</td>
                  <td className="border px-3 py-2">{cls.subjects.join(", ")}</td>
                  <td className="border px-3 py-2 space-x-2">
                    <button
                      onClick={() => handleEdit(cls)}
                      className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cls.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Delete
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

export default SubjectPage;
