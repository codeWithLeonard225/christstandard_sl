import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import localforage from "localforage";

// ---------- LOCALFORAGE CACHE ----------
const timetableCache = localforage.createInstance({
  name: "TimetableManagerCache",
  storeName: "Daaily",
});

const TimetableManager = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";

  // ---------------- STATE ----------------
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [timetableList, setTimetableList] = useState([]);

  // UI Filters
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [filterClass, setFilterClass] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formData, setFormData] = useState({
    className: "",
    day: "Monday",
    period: "1",
    startTime: "08:00",
    endTime: "08:40",
    subject: "",
    teacher: "",
  });

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const periods = ["1", "2", "3", "4", "Lunch", "5", "6", "7", "8"];

  // 1️⃣ Fetch Teachers & Classes
  useEffect(() => {
    if (schoolId === "N/A") return;

    const qT = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
    const qC = query(collection(db, "ClassesAndSubjects"), where("schoolId", "==", schoolId));

    const unsubT = onSnapshot(qT, (s) =>
      setAvailableTeachers(s.docs.map((d) => d.data().teacherName || d.data().fullName))
    );
    const unsubC = onSnapshot(qC, (s) =>
      setAvailableClasses(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubT();
      unsubC();
    };
  }, [schoolId]);

  // 2️⃣ Fetch Timetable Entries (With Cache & ID De-duplication)
 // 2️⃣ Fetch Timetable Entries (Fixed)
useEffect(() => {
  if (schoolId === "N/A") return;

  // Load cached timetable first
  timetableCache
    .getItem("timetableList")
    .then((cachedData) => {
      if (cachedData) setTimetableList(cachedData);
    })
    .catch((err) => console.error("Cache load failed:", err));

  const q = query(collection(schoollpq, "Timetables"), where("schoolId", "==", schoolId));
  const unsub = onSnapshot(q, (snapshot) => {
    const timetableArray = snapshot.docs.map((doc) => {
      const { id: _ignored, ...rest } = doc.data(); // Ignore any existing `id` field in Firestore data
      return { id: doc.id, ...rest }; // Use Firestore doc ID as unique identifier
    });

    setTimetableList(timetableArray);

    // Save to localforage cache
    timetableCache.setItem("timetableList", timetableArray).catch(console.error);
  });

  return () => unsub();
}, [schoolId]);


  // 3️⃣ Auto-update Subjects & Handle Lunch
  useEffect(() => {
    const selectedClassObj = availableClasses.find(
      (cls) => cls.className === formData.className
    );
    setAvailableSubjects(selectedClassObj ? selectedClassObj.subjects : []);

    if (formData.period === "Lunch") {
      setFormData((prev) => ({ ...prev, subject: "LUNCH", teacher: "N/A" }));
    }
  }, [formData.className, formData.period, availableClasses]);

  // 4️⃣ Filtered List (Memoized)
  const displayList = useMemo(() => {
    return timetableList
      .filter((item) => {
        const dayMatch = item.day === selectedDay;
        const classMatch = filterClass === "" || item.className === filterClass;
        const teacherMatch = filterTeacher === "" || item.teacher === filterTeacher;
        return dayMatch && classMatch && teacherMatch;
      })
      .sort(
        (a, b) => periods.indexOf(a.period?.toString()) - periods.indexOf(b.period?.toString())
      );
  }, [timetableList, selectedDay, filterClass, filterTeacher]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  // 5️⃣ PDF Download (Uses Cached Data if Available)
  const handleDownloadPDF = async () => {
    const cachedData = await timetableCache.getItem("timetableList");
    const dataToUse = cachedData || displayList;

    const doc = new jsPDF({
      orientation: "landscape", // Landscape for more periods in one page
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(18);
    doc.setTextColor(13, 148, 136);
    doc.text("OFFICIAL SCHOOL TIMETABLE", 40, 40);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Class: ${filterClass || "All Classes"}`, 40, 60);
    doc.text(`Day: ${selectedDay}`, 40, 75);
    if (filterTeacher) doc.text(`Teacher: ${filterTeacher}`, 40, 90);

    const tableColumn = ["Period", "Subject", "Teacher", "Time"];
    const tableRows = dataToUse.map((item) => [
      item.period === "Lunch" ? "LUNCH" : `P${item.period}`,
      item.subject || "-",
      item.teacher || "-",
      item.time || "-",
    ]);

    autoTable(doc, {
      startY: 110,
      head: [tableColumn],
      body: tableRows,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        if (data.row.cells[0].text[0] === "LUNCH") {
          data.cell.styles.fillColor = [255, 247, 237];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`Timetable_${filterClass || "School"}_${selectedDay}.pdf`);
  };

  // 6️⃣ Add / Update Timetable
  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.className) return toast.error("Please select a class");

  setLoading(true);
  const payload = {
    ...formData,
    schoolId,
    time: `${formData.startTime} - ${formData.endTime}`,
    updatedAt: serverTimestamp(),
  };

  try {
    if (editId) {
      await updateDoc(doc(schoollpq, "Timetables", editId), payload);
      toast.success("Updated Successfully");
    } else {
      await addDoc(collection(schoollpq, "Timetables"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      toast.success("Added to Timetable");
    }
    setEditId(null);
    setFormData({ ...formData, subject: "", teacher: "" });
  } catch (err) {
    toast.error("Error saving schedule");
  } finally {
    setLoading(false);
  }
};


  // 7️⃣ Delete Entry
  const handleDelete = async (id) => {
  if (window.confirm("Are you sure you want to delete this period?")) {
    try {
      await deleteDoc(doc(schoollpq, "Timetables", id)); // id is now Firestore doc ID
      toast.info("Entry Deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  }
};


  // ---------------- JSX ----------------
  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* FORM SECTION */}
        <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            {editId ? "✏️ Edit Period" : "📅 New Timetable Entry"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Class */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Class</label>
              <select
                name="className"
                value={formData.className}
                onChange={handleChange}
                className="border p-2.5 rounded-lg text-sm bg-gray-50 focus:bg-white outline-teal-500"
              >
                <option value="">-- Select --</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.className}>
                    {c.className}
                  </option>
                ))}
              </select>
            </div>

            {/* Day & Period */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Day & Period</label>
              <div className="flex gap-2">
                <select
                  name="day"
                  value={formData.day}
                  onChange={handleChange}
                  className="w-1/2 border p-2.5 rounded-lg text-sm bg-gray-50 outline-teal-500"
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  name="period"
                  value={formData.period}
                  onChange={handleChange}
                  className="w-1/2 border p-2.5 rounded-lg text-sm bg-gray-50 outline-teal-500"
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p === "Lunch" ? "🍱 Lunch" : `P${p}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Subject</label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                disabled={formData.period === "Lunch"}
                className="border p-2.5 rounded-lg text-sm bg-gray-50 disabled:opacity-50 outline-teal-500"
              >
                <option value="">-- Select --</option>
                {availableSubjects.map((s, i) => (
                  <option key={i} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Teacher</label>
              <select
                name="teacher"
                value={formData.teacher}
                onChange={handleChange}
                disabled={formData.period === "Lunch"}
                className="border p-2.5 rounded-lg text-sm bg-gray-50 disabled:opacity-50 outline-teal-500"
              >
                <option value="">-- Select --</option>
                {availableTeachers.map((t, i) => (
                  <option key={i} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Start & End Time */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Start & End Time</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-1/2 border p-2 rounded-lg text-sm"
                />
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-1/2 border p-2 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="lg:col-span-3 flex items-end gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md uppercase text-xs"
              >
                {loading ? "Saving..." : editId ? "Update Schedule" : "Add to Timetable"}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setFormData({
                      className: "",
                      day: "Monday",
                      period: "1",
                      startTime: "08:00",
                      endTime: "08:40",
                      subject: "",
                      teacher: "",
                    });
                  }}
                  className="px-6 py-3 bg-gray-200 rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* VIEWER SECTION */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Day Selection */}
          <div className="flex overflow-x-auto gap-2 p-4 bg-gray-50/50 justify-start md:justify-center no-scrollbar">
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-6 py-2 rounded-full text-xs font-black transition-all shrink-0 ${
                  selectedDay === day
                    ? "bg-teal-600 text-white shadow-lg scale-105"
                    : "bg-white text-gray-400 border border-gray-200 hover:border-teal-300 hover:text-teal-500"
                }`}
              >
                {day.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Filters & PDF */}
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="flex-1 md:w-40 border p-2 rounded-lg bg-gray-50 text-xs font-bold"
              >
                <option value="">🔍 All Classes</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.className}>
                    {c.className}
                  </option>
                ))}
              </select>
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="flex-1 md:w-40 border p-2 rounded-lg bg-gray-50 text-xs font-bold"
              >
                <option value="">👨‍🏫 All Teachers</option>
                {availableTeachers.map((t, i) => (
                  <option key={i} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-teal-700 transition"
            >
              📄 Download PDF
            </button>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-[10px] uppercase tracking-wider">
                  <th className="px-6 py-4 text-left">Period</th>
                  <th className="px-6 py-4 text-left">Time Slot</th>
                  <th className="px-6 py-4 text-left">Classroom</th>
                  <th className="px-6 py-4 text-left">Subject & Teacher</th>
                  <th className="px-6 py-4 text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-20 text-center">
                      <div className="text-gray-300 text-lg font-medium italic">
                        No periods found for {selectedDay}
                      </div>
                      <button
                        onClick={() => {
                          setFilterClass("");
                          setFilterTeacher("");
                        }}
                        className="text-teal-500 text-xs font-bold mt-2 underline"
                      >
                        Clear all filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  displayList.map((item, idx) => (
                    <tr
                      key={`${item.id}-${idx}`}
                      className={`${
                        item.period === "Lunch"
                          ? "bg-orange-50/60"
                          : "hover:bg-teal-50/30 transition-colors"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`font-black text-xs ${
                            item.period === "Lunch" ? "text-orange-600" : "text-teal-600"
                          }`}
                        >
                          {item.period === "Lunch" ? "🍱 BREAK" : `PERIOD ${item.period}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-600">{item.time}</td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 px-3 py-1 rounded text-[10px] font-black text-gray-500">
                          {item.className}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.period === "Lunch" ? (
                          <span className="text-orange-400 font-bold italic text-xs">
                            Lunch Interval
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-black text-gray-800 uppercase text-xs">
                              {item.subject}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                              👨‍🏫 {item.teacher}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-4">
                          <button
                            onClick={() => {
                              const [start, end] = (item.time || "08:00 - 08:40").split(" - ");
                              setFormData({ ...item, startTime: start, endTime: end });
                              setEditId(item.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="text-blue-500 hover:text-blue-700 font-bold text-[11px] uppercase"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-400 hover:text-red-600 font-bold text-[11px] uppercase"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableManager;
