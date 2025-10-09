import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  onSnapshot,
  getDoc,      // <-- ADDED: To fetch current class data
  getDocs,     // <-- ADDED: To fetch students for batch update
  writeBatch,  // <-- ADDED: For efficient bulk updates
  where        // <-- ADDED: To query students by class name
} from "firebase/firestore";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

// Admin password for delete
const ADMIN_PASSWORD = "1234";

const ClassRegistration = () => {
  const [classData, setClassData] = useState({
    id: null,
    classId: uuidv4().slice(0, 8),
    className: "",
  });

  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time listener
  useEffect(() => {
    const collectionRef = collection(db, "Classes");
    const q = query(collectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classList);
    });

    return () => unsubscribe();
  }, []);

  // Generate unique Class ID
  const generateUniqueId = () => {
    let newId;
    do {
      newId = uuidv4().slice(0, 8);
    } while (classes.find(c => c.classId === newId));
    return newId;
  };

  useEffect(() => {
    if (!classData.id) {
      setClassData(prev => ({ ...prev, classId: generateUniqueId() }));
    }
  }, [classes, classData.id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClassData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classData.className) return toast.error("Please enter class name");
    setIsSubmitting(true);
    try {
      if (classData.id) {
        // --- UPDATE LOGIC WITH CROSS-COLLECTION RECONCILIATION ---
        
        const classRef = doc(db, "Classes", classData.id);
        const currentClassDoc = await getDoc(classRef);
        const oldClassName = currentClassDoc.data().className;
        const newClassName = classData.className;

        // 1. Update the Class document in 'Classes'
        await updateDoc(classRef, {
          classId: classData.classId,
          className: newClassName
        });

        // 2. Check if the class name actually changed
        if (oldClassName !== newClassName) {
          // 3. Find all students (Voters) with the old class name
          const votersCollectionRef = collection(db, "Voters");
          // Use 'where' query to find documents matching the old name
          const studentsQuery = query(votersCollectionRef, where("class", "==", oldClassName));
          const studentSnapshot = await getDocs(studentsQuery);

          if (!studentSnapshot.empty) {
            // 4. Use a Batch Write for efficiency and atomicity
            const batch = writeBatch(db);
            
            studentSnapshot.docs.forEach((studentDoc) => {
              const studentRef = doc(db, "Voters", studentDoc.id);
              batch.update(studentRef, { class: newClassName });
            });
            
            await batch.commit();
            toast.success(`Class updated successfully! Also reconciled ${studentSnapshot.size} student record(s).`);
          } else {
            toast.success("Class updated successfully!");
          }
        } else {
          toast.success("Class updated successfully!");
        }
        // --- END UPDATE LOGIC ---
      } else {
        // --- ADD LOGIC ---
        const newId = generateUniqueId();
        await addDoc(collection(db, "Classes"), {
          classId: newId,
          className: classData.className,
          timestamp: new Date(),
        });
        toast.success("Class added successfully!");
      }

      // Reset form
      setClassData({
        id: null,
        classId: generateUniqueId(),
        className: "",
      });
    } catch (err) {
      console.error("Update failed:", err);
      toast.error("Failed to save class or update student records.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = (cls) => {
    setClassData({
      id: cls.id,
      classId: cls.classId,
      className: cls.className,
    });
    toast.info(`Editing class: ${cls.className}`);
  };

  const handleDelete = async (id, className) => {
    const password = window.prompt("Enter password to delete this class:");
    if (password === ADMIN_PASSWORD) {
      if (window.confirm(`Are you sure you want to delete class: ${className}? THIS MAY LEAVE STUDENTS UNASSIGNED.`)) {
        try {
            // NOTE: You may also want to set the 'class' field to an empty string 
            // or 'Unassigned' for all students using this class before deleting it.
          await deleteDoc(doc(db, "Classes", id));
          toast.success("Class deleted successfully!");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete class");
        }
      }
    } else if (password !== null) {
      toast.error("Incorrect password");
    }
  };

  const filteredClasses = useMemo(() => {
    if (!searchTerm.trim()) return classes;
    const term = searchTerm.toLowerCase();
    return classes.filter(c => c.className.toLowerCase().includes(term) || c.classId.toLowerCase().includes(term));
  }, [classes, searchTerm]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-center mb-4">{classData.id ? "Update Class" : "Register Class"}</h2>

        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">Class ID</label>
            <input
              type="text"
              name="classId"
              value={classData.classId}
              readOnly
              disabled
              className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
            />
          </div>
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">Class Name</label>
            <input
              type="text"
              name="className"
              value={classData.className}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
              placeholder="Enter class name"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {isSubmitting ? "Submitting..." : classData.id ? "Update Class" : "Add Class"}
        </button>
      </form>

      {/* ---------------- Table ---------------- */}
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Registered Classes ({filteredClasses.length} of {classes.length})</h2>

        <input
          type="text"
          placeholder="Search by Class Name or ID"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClasses.map(cls => (
                <tr key={cls.id}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{cls.classId}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{cls.className}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleUpdate(cls)} className="text-indigo-600 hover:text-indigo-900 mr-2">
                      Update
                    </button>
                    <button onClick={() => handleDelete(cls.id, cls.className)} className="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                    No classes found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClassRegistration;