import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

const SubjectData = () => {
  const [categoryName, setCategoryName] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // ✅ Add subject temporarily
 // ✅ Prevent duplicates and trim input
const handleAddSubject = () => {
  const newSubject = subjectInput.trim();
  if (newSubject === "") return;

  setSubjects((prev) => {
    if (prev.includes(newSubject)) {
      alert("This subject already exists in the list.");
      return prev;
    }
    return [...prev, newSubject].sort((a, b) => a.localeCompare(b));
  });

  setSubjectInput("");
};

// ✅ Save or update category with subjects
const handleSave = async () => {
  if (!categoryName.trim() || subjects.length === 0) {
    alert("Please enter a category name and at least one subject.");
    return;
  }

  // Remove duplicates just in case
  const uniqueSubjects = [...new Set(subjects)].sort((a, b) =>
    a.localeCompare(b)
  );

  try {
    if (editingId) {
      await updateDoc(doc(db, "SubjectCategories", editingId), {
        categoryName,
        subjects: uniqueSubjects,
        updatedAt: new Date(),
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, "SubjectCategories"), {
        categoryName,
        subjects: uniqueSubjects,
        createdAt: new Date(),
      });
    }

    setCategoryName("");
    setSubjects([]);
    alert("Category saved successfully!");
  } catch (error) {
    console.error("Error saving category:", error);
  }
};


  // ✅ Fetch categories
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "SubjectCategories"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(list);
    });
    return () => unsub();
  }, []);

  // ✅ Delete category
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      await deleteDoc(doc(db, "SubjectCategories", id));
    }
  };

  // ✅ Edit category
  const handleEdit = (cat) => {
    setCategoryName(cat.categoryName);
    setSubjects(cat.subjects);
    setEditingId(cat.id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
        Subject Categories Setup
      </h2>

      {/* Input Section */}
      <div className="space-y-4">
        <div>
          <label className="font-medium text-gray-700">Category Name:</label>
          <input
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300"
            placeholder="e.g. JSS, SSS, Primary"
          />
        </div>

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

            <div className="flex flex-wrap gap-2 mt-2">
  <button
    onClick={() =>
      setSubjects([
        ...new Set([
          ...subjects,
          "Business Accounting",
          "Business Management",
          "Clerical Office Duties",
          "Commerce",
          "Economics",
          "English",
          "Health Science",
          "Mathematics",
          "Principles of Account",
        ]),
      ].sort((a, b) => a.localeCompare(b)))
    }
    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
  >
    Add SSS Business
  </button>

  <button
    onClick={() =>
      setSubjects([
        ...new Set([
          ...subjects,
          "CRS",
          "English",
          "Geography",
          "Health Science",
          "History",
          "Literature",
          "Mathematics",
          "MIL",
          "Politics & Governance",
        ]),
      ].sort((a, b) => a.localeCompare(b)))
    }
    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
  >
    Add SSS Arts
  </button>

  <button
    onClick={() =>
      setSubjects([
        ...new Set([
          ...subjects,
          "Agricultural Science",
          "Biology",
          "Chemistry",
          "Economics",
          "English",
          "Further Mathematics",
          "Mathematics",
          "Physics",
          "Science Core",
        ]),
      ].sort((a, b) => a.localeCompare(b)))
    }
    className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
  >
    Add SSS Science
  </button>
</div>

            <button
              onClick={handleAddSubject}
              className="bg-green-600 text-white px-4 rounded-md hover:bg-green-700"
            >
              Add
            </button>
          </div>

          {subjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((subj, i) => (
                <span
                  key={i}
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
          {editingId ? "Update Category" : "Save Category"}
        </button>
      </div>

      {/* Table */}
      <h3 className="text-xl font-semibold mt-8 mb-3 text-gray-800 text-center">
        Saved Categories & Subjects
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Category</th>
              <th className="border px-3 py-2 text-left">Subjects</th>
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4 text-gray-500">
                  No categories added yet.
                </td>
              </tr>
            ) : (
              categories.map((cat, i) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{i + 1}</td>
                  <td className="border px-3 py-2">{cat.categoryName}</td>
                  <td className="border px-3 py-2">
                    {cat.subjects?.join(", ") || "—"}
                  </td>
                  <td className="border px-3 py-2 space-x-2">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
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

export default SubjectData;
