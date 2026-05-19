import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase"; // For fetching teachers list
import { schoollpq } from "../Database/schoollibAndPastquestion"; // For fetching attendance records
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";

const STAFF_COLLECTION = "Teachers";
const ATT_COLLECTION = "StaffAttendancePro";

export default function StaffAttendanceProfileReport() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";

  // System Core Data States
  const [staffList, setStaffList] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  
  // Interface Control States
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ==========================================
  // REAL-TIME LISTENER FOR ALL TEACHERS
  // ==========================================
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;

    const q = query(
      collection(db, STAFF_COLLECTION),
      where("schoolId", "==", schoolId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStaffList(list);
        setLoadingStaff(false);
      },
      (err) => {
        console.error(err);
        toast.error("Failed to load staff profiles");
        setLoadingStaff(false);
      }
    );

    return () => unsub();
  }, [schoolId]);

  // ==========================================
  // FETCH ATTENDANCE HISTORY FOR SELECTED TEACHER
  // ==========================================
  useEffect(() => {
    const fetchTeacherAttendance = async () => {
      if (!selectedTeacher || schoolId === "N/A") {
        setAttendanceHistory([]);
        return;
      }
      
      setLoadingAttendance(true);
      try {
        const q = query(
          collection(schoollpq, ATT_COLLECTION),
          where("schoolId", "==", schoolId),
          where("teacherID", "==", selectedTeacher.teacherID)
        );
        
        const snap = await getDocs(q);
        const records = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAttendanceHistory(records);
      } catch (error) {
        console.error("Error fetching attendance matrix:", error);
        toast.error("Failed to compile attendance reports");
      } finally {
        setLoadingAttendance(false);
      }
    };

    fetchTeacherAttendance();
  }, [schoolId, selectedTeacher]);

  // ==========================================
  // FILTERED & SORTED TEACHER SEARCH BAR RESULT
  // ==========================================
  const filteredStaffSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return staffList
      .filter(t => (t.teacherName || "").toLowerCase().includes(lower))
      .sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || ""));
  }, [staffList, searchQuery]);

  // Filter actual history entries for the selected localized target month
  const monthlyRecords = useMemo(() => {
    return attendanceHistory.filter(r => r.date && r.date.startsWith(selectedMonth));
  }, [attendanceHistory, selectedMonth]);

  // ==========================================
  // GENERATE DYNAMIC STATISTICS MATRICES
  // ==========================================
  const summaryMetrics = useMemo(() => {
    const metrics = { present: 0, late: 0, absent: 0, sick: 0, leave: 0, excuse: 0, missedOut: 0, totalHours: 0 };
    
    monthlyRecords.forEach(r => {
      metrics.totalHours += Number(r.workingHours || 0);
      
      if (r.clockOut === "Did Not Clock Out") {
        metrics.missedOut++;
      } else {
        switch (r.status) {
          case "Present": metrics.present++; break;
          case "Late": metrics.late++; break;
          case "Absent": metrics.absent++; break;
          case "Sick": metrics.sick++; break;
          case "Leave": metrics.leave++; break;
          case "Excuse": metrics.excuse++; break;
          default: break;
        }
      }
    });
    return metrics;
  }, [monthlyRecords]);

  // Map attendance dates directly to their statuses for instant calendar lookup
  const calendarMap = useMemo(() => {
    const map = {};
    monthlyRecords.forEach(r => {
      map[r.date] = {
        status: r.status,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        workingHours: r.workingHours
      };
    });
    return map;
  }, [monthlyRecords]);

  // ==========================================
  // RENDER DYNAMIC CALENDAR GRIDS FOR SELECTED MONTH
  // ==========================================
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split("-").map(Number);
    
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); 
    const totalDays = new Date(year, month, 0).getDate(); 
    
    const daysArr = [];
    
    // Fill padding blank offsets for standard Sunday-indexed alignment
    for (let i = 0; i < firstDayIndex; i++) {
      daysArr.push({ blank: true });
    }
    
    // Construct actual true sequential Gregorian days
    for (let day = 1; day <= totalDays; day++) {
      const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      daysArr.push({
        blank: false,
        dayNum: day,
        dateStr: dateString,
        data: calendarMap[dateString] || null
      });
    }
    
    return daysArr;
  }, [selectedMonth, calendarMap]);

  // Helper formatting engine
  const formatTime = (timeField) => {
    if (!timeField) return "--";
    if (timeField === "Did Not Clock Out") return "No Show";
    const dateObj = timeField?.seconds ? new Date(timeField.seconds * 1000) : new Date(timeField);
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ==========================================
  // GET TAILWIND COLOR INDICATORS FOR MATRIX CELLS
  // ==========================================
  const getCalendarDayStyles = (dayObj) => {
    if (dayObj.blank) return "bg-gray-50 border-transparent text-transparent";
    if (!dayObj.data) return "bg-white border-gray-200 text-gray-400 hover:bg-indigo-50/40 cursor-default";
    
    if (dayObj.data.clockOut === "Did Not Clock Out") {
      return "bg-orange-50 border-orange-200 text-orange-800 font-bold hover:bg-orange-100 shadow-sm";
    }
    
    switch (dayObj.data.status) {
      case "Present": return "bg-green-50 border-green-200 text-green-800 font-bold hover:bg-green-100 shadow-sm";
      case "Late": return "bg-yellow-50 border-yellow-200 text-yellow-800 font-bold hover:bg-yellow-100 shadow-sm";
      case "Absent": return "bg-red-50 border-red-200 text-red-800 font-bold hover:bg-red-100 shadow-sm";
      case "Sick": return "bg-purple-50 border-purple-200 text-purple-800 font-bold hover:bg-purple-100 shadow-sm";
      case "Leave": return "bg-blue-50 border-blue-200 text-blue-800 font-bold hover:bg-blue-100 shadow-sm";
      case "Excuse": return "bg-cyan-50 border-cyan-200 text-cyan-800 font-bold hover:bg-cyan-100 shadow-sm";
      default: return "bg-white border-gray-200 text-gray-700";
    }
  };
 // ==========================================
  // EXPORT COMPREHENSIVE PDF REPORT
  // ==========================================
  const exportPDF = () => {
    if (!selectedTeacher) return;
    
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(67, 56, 202); // <--- FIXED: changed from textColor to setTextColor
    doc.text("STAFF ATTENDANCE METRIC REPORT", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139); // <--- FIXED
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 26);
    
    // Draw Border Line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 30, 196, 30);
    
    // Teacher Metadata Matrix Layout Block
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); // <--- FIXED
    doc.text("Employee Details", 14, 40);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Full Name: ${selectedTeacher.teacherName}`, 14, 47);
    doc.text(`Teacher ID: ${selectedTeacher.teacherID}`, 14, 53);
    doc.text(`Category: ${selectedTeacher.teacherCategory || "N/A"}`, 14, 59);
    doc.text(`Reporting Period: ${selectedMonth}`, 14, 65);
    
    // Render Quick Analytical Block
    doc.setFont("Helvetica", "bold");
    doc.text("Monthly Metrics Summary", 120, 40);
    doc.setFont("Helvetica", "normal");
    doc.text(`Present (On-Time): ${summaryMetrics.present}`, 120, 47);
    doc.text(`Late Arrival Cycles: ${summaryMetrics.late}`, 120, 53);
    doc.text(`Unexcused Absences: ${summaryMetrics.absent}`, 120, 59);
    doc.text(`Logged Work Hours: ${summaryMetrics.totalHours.toFixed(2)} Hrs`, 120, 65);

    const tableBody = [...monthlyRecords]
      .sort((a,b) => a.date.localeCompare(b.date))
      .map(r => [
        r.date,
        r.clockOut === "Did Not Clock Out" ? "Missed Out Flag" : r.status,
        formatTime(r.clockIn),
        formatTime(r.clockOut),
        `${r.workingHours || 0} hrs`
      ]);

    autoTable(doc, {
      startY: 75,
      head: [["Calendar Date", "Evaluated Status", "Clocked In Time", "Clocked Out Time", "Total Hours"]],
      body: tableBody,
      styles: { fontSize: 9, font: "Helvetica", cellPadding: 3 },
      headStyles: { fillColor: [67, 56, 202], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    
    doc.save(`Attendance_Report_${selectedTeacher.teacherName.replace(/\s+/g, "_")}_${selectedMonth}.pdf`);
  };

  return (
    <div className="w-full mx-auto p-3 sm:p-4 md:p-6 bg-slate-50 min-h-screen antialiased text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* TOP SEARCH CONTROL LAYER BLOCK */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="space-y-0.5">
              <h1 className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight">Staff Attendance Analytics</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Search employees to view historical records, analytical data, and graphical calendar matrix tracking.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Dynamic Native Lookup Control Filter */}
              <div className="relative flex-1 sm:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Type name to search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold transition shadow-inner"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 font-bold">Clear</button>
                )}
                
                {/* AUTOCOMPLETE POPUP PANEL DROPDOWN MAP */}
                {filteredStaffSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
                    {filteredStaffSearchResults.map((teacher) => (
                      <button
                        key={teacher.id}
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 transition flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{teacher.teacherName}</p>
                          <p className="text-slate-400 font-mono text-[10px]">ID: {teacher.teacherID}</p>
                        </div>
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">{teacher.teacherCategory}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Month Selection Input Control Toggle */}
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 bg-white shadow-sm"
              />
            </div>
          </div>

          {/* ACTIVE TEACHER PROFILE BADGE BAR */}
          {selectedTeacher && (
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-indigo-50/40 p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm tracking-wider uppercase">
                  {selectedTeacher.teacherName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{selectedTeacher.teacherName}</h2>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                    <span>ID: <b className="text-slate-700">{selectedTeacher.teacherID}</b></span>
                    <span>•</span>
                    <span>Class: <b className="text-slate-700 font-sans">{selectedTeacher.formMasterClass || "None"}</b></span>
                  </div>
                </div>
              </div>
              <button 
                onClick={exportPDF} 
                disabled={loadingAttendance || monthlyRecords.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export PDF Ledger
              </button>
            </div>
          )}
        </div>

        {/* CORE DATA DISPLAY MATRIX RENDERING PANEL */}
        {!selectedTeacher ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h3 className="font-bold text-slate-700 text-base">No Profile Selected</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Please type an employee name into the database search filter above to compute structural reports matrices.</p>
          </div>
        ) : loadingAttendance ? (
          <div className="text-center py-20 font-bold text-slate-400 animate-pulse tracking-widest text-xs uppercase">Syncing Cloud Log History Matrices...</div>
        ) : (
          <>
            {/* STATS ANALYZE BLOCK ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Present</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.present}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">Late</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.late}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Absent</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.absent}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Sick</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.sick}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Leave</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.leave}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">Excuse</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.excuse}</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Missed Out</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{summaryMetrics.missedOut}</h3>
              </div>
              <div className="bg-indigo-900 border border-indigo-950 rounded-xl p-3 shadow-sm col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Total Hours</p>
                <h3 className="text-xl font-black text-white mt-1">{summaryMetrics.totalHours.toFixed(1)}h</h3>
              </div>
            </div>

            {/* DUAL DISPLAY CALENDAR GRID AND LOG LIST METRIC PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* INTERACTIVE MATRIX GREGORIAN CALENDAR VIEW */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col">
                <div className="mb-4">
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Attendance Calendar Sheet Matrix</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Evaluated micro-grid reporting statuses natively mapped down.</p>
                </div>

                {/* Day Header Matrix Strings */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>

                {/* Dynamic Content Grid Rendering Layout Block */}
                <div className="grid grid-cols-7 gap-1.5 flex-1">
                  {calendarDays.map((day, index) => (
                    <div 
                      key={index}
                      className={`min-h-[64px] sm:min-h-[76px] p-1.5 border rounded-xl text-left flex flex-col justify-between transition-all duration-200 ${getCalendarDayStyles(day)}`}
                    >
                      {!day.blank && (
                        <>
                          <span className="text-xs font-bold leading-none">{day.dayNum}</span>
                          {day.data && (
                            <div className="space-y-0.5 mt-1">
                              {day.data.clockOut === "Did Not Clock Out" ? (
                                <p className="text-[9px] font-extrabold leading-tight text-orange-700 uppercase bg-orange-200/50 px-1 rounded truncate text-center">Missed Out</p>
                              ) : (
                                <>
                                  <p className="text-[9px] font-extrabold leading-tight uppercase tracking-wide truncate">{day.data.status}</p>
                                  {day.data.clockIn && (
                                    <p className="text-[8px] font-mono opacity-80 leading-none truncate">I: {formatTime(day.data.clockIn)}</p>
                                  )}
                                  {day.data.clockOut && (
                                    <p className="text-[8px] font-mono opacity-80 leading-none truncate">O: {formatTime(day.data.clockOut)}</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* CHRONOLOGICAL DATA LIST PANEL REFACTOR */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[560px]">
                <div className="mb-4">
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Chronological Entry Stream</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Chronological text logs parsed for current reporting cycle.</p>
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-1.5">
                  {monthlyRecords.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-semibold">No operational state indexes traced inside this month selection window.</div>
                  ) : (
                    [...monthlyRecords]
                      .sort((a,b) => b.date.localeCompare(a.date))
                      .map((record) => (
                        <div key={record.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-xs text-slate-700 font-mono tracking-tight">{record.date}</span>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase border ${
                              record.clockOut === "Did Not Clock Out" ? "bg-orange-100 text-orange-700 border-orange-200" :
                              record.status === "Present" ? "bg-green-100 text-green-700 border-green-200" :
                              record.status === "Late" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200"
                            }`}>
                              {record.clockOut === "Did Not Clock Out" ? "Missed Out" : record.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-1.5 rounded-lg border border-slate-100 font-mono text-slate-600">
                            <div>
                              <p className="text-[8px] font-sans font-bold text-slate-400 uppercase">In</p>
                              <p className="font-bold mt-0.5">{formatTime(record.clockIn)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-sans font-bold text-slate-400 uppercase">Out</p>
                              <p className="font-bold mt-0.5">{formatTime(record.clockOut)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-sans font-bold text-slate-400 uppercase">Hours</p>
                              <p className="font-bold mt-0.5 text-slate-900">{record.workingHours || 0}h</p>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  );
}