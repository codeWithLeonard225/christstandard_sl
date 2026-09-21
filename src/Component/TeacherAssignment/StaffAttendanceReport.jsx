
import React, { useState, useEffect, useMemo } from "react";
import {
    collection,
    query,
    where,
    onSnapshot
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


// =====================================================
// GET TODAY
// =====================================================

const getTodayDate = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};


// =====================================================
// FORMAT TIME
// =====================================================

const formatTime = (time) => {

    if (!time) {
        return "N/A";
    }

    // Firebase Timestamp
    if (time?.toDate) {
        return time.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // JavaScript Date
    if (time instanceof Date) {
        return time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // String
    if (typeof time === "string") {
        return time;
    }

    return "N/A";
};


// =====================================================
// NORMALIZE STATUS
// =====================================================

const normalizeStatus = (record) => {

    if (record?.status) {

        const status = String(record.status)
            .trim()
            .toLowerCase();

        if (status === "present") {
            return "Present";
        }

        if (status === "late") {
            return "Late";
        }

        if (status === "absent") {
            return "Absent";
        }

        if (
            status === "leave" ||
            status === "on leave"
        ) {
            return "On Leave";
        }

        if (
            status === "excused" ||
            status === "excuse"
        ) {
            return "Excused";
        }

        if (status === "clocked out") {
            return "Present";
        }
    }


    // A clock-in means the staff attended.
    if (record?.clockInTime) {
        return "Present";
    }


    return "Absent";
};


// =====================================================
// STAFF SELF ATTENDANCE REPORT
// =====================================================

const StaffSelfAttendanceReport = () => {

    const { user } = useAuth();


    // =====================================================
    // USER INFORMATION
    // =====================================================

    const schoolId =
        user?.schoolId ||
        user?.data?.schoolId ||
        "";


    const teacherID =
        user?.data?.teacherID ||
        user?.teacherID ||
        user?.id ||
        "";


    const teacherName =
        user?.data?.teacherName ||
        user?.teacherName ||
        "Teacher";


    // =====================================================
    // STATE
    // =====================================================

    const [attendanceHistory, setAttendanceHistory] =
        useState([]);

    const [schoolAttendance, setSchoolAttendance] =
        useState([]);

    const [loading, setLoading] =
        useState(true);


    // =====================================================
    // SELECTED MONTH
    // =====================================================

    const [selectedMonth, setSelectedMonth] =
        useState(getTodayDate().slice(0, 7));


    // =====================================================
    // FETCH MY ATTENDANCE
    // =====================================================

    useEffect(() => {

        if (!teacherID || !schoolId) {

            setAttendanceHistory([]);
            setLoading(false);

            return;
        }


        setLoading(true);


        const q = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId),
            where("teacherID", "==", teacherID)
        );


        const unsubscribe = onSnapshot(
            q,

            (querySnapshot) => {

                const records =
                    querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));


                setAttendanceHistory(records);

                setLoading(false);
            },

            (error) => {

                console.error(
                    "Error listening to staff attendance:",
                    error
                );

                setAttendanceHistory([]);

                setLoading(false);
            }
        );


        return () => unsubscribe();

    }, [schoolId, teacherID]);


    // =====================================================
    // FETCH ALL SCHOOL ATTENDANCE
    //
    // This tells us whether attendance activity happened
    // anywhere in the school on a particular date.
    // =====================================================

    useEffect(() => {

        if (!schoolId) {

            setSchoolAttendance([]);

            return;
        }


        const q = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId)
        );


        const unsubscribe = onSnapshot(
            q,

            (querySnapshot) => {

                const records =
                    querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));


                setSchoolAttendance(records);
            },

            (error) => {

                console.error(
                    "Error loading school attendance:",
                    error
                );

                setSchoolAttendance([]);
            }
        );


        return () => unsubscribe();

    }, [schoolId]);


    // =====================================================
    // SCHOOL ATTENDANCE DAYS
    //
    // A date becomes an attendance day if at least one
    // staff attendance record exists for that date.
    // =====================================================

    const schoolAttendanceDays = useMemo(() => {

        const days = new Set();


        schoolAttendance.forEach(record => {

            if (!record.date) {
                return;
            }


            days.add(record.date);
        });


        return days;

    }, [schoolAttendance]);


    // =====================================================
    // CREATE COMPLETE ATTENDANCE HISTORY
    //
    // Actual record:
    //     Use actual status.
    //
    // No record + school attendance:
    //     Automatically Absent.
    //
    // No school attendance:
    //     Do not create a record.
    // =====================================================

    const completeAttendanceHistory = useMemo(() => {

        const myRecords = new Map();


        attendanceHistory.forEach(record => {

            if (!record.date) {
                return;
            }


            myRecords.set(record.date, record);
        });


        const results = [];


        schoolAttendanceDays.forEach(date => {

            const myRecord = myRecords.get(date);


            if (myRecord) {

                results.push({
                    ...myRecord,

                    calculatedStatus:
                        normalizeStatus(myRecord),

                    isAutomaticallyAbsent: false
                });

            } else {

                results.push({

                    id: `auto-absent-${date}`,

                    date,

                    teacherID,

                    teacherName,

                    status: "Absent",

                    calculatedStatus: "Absent",

                    clockInTime: null,

                    clockOutTime: null,

                    note: "",

                    isAutomaticallyAbsent: true

                });
            }
        });


        return results.sort((a, b) =>
            b.date.localeCompare(a.date)
        );

    }, [
        attendanceHistory,
        schoolAttendanceDays,
        teacherID,
        teacherName
    ]);


    // =====================================================
    // SELECTED MONTH RECORDS
    // =====================================================

    const monthlyRecords = useMemo(() => {

        if (!selectedMonth) {
            return [];
        }


        return completeAttendanceHistory
            .filter(record =>
                record.date?.startsWith(selectedMonth)
            )
            .sort((a, b) =>
                b.date.localeCompare(a.date)
            );

    }, [
        completeAttendanceHistory,
        selectedMonth
    ]);


    // =====================================================
    // SELECTED MONTH STATISTICS
    // =====================================================

    const monthlyStats = useMemo(() => {

        const stats = {

            present: 0,

            late: 0,

            absent: 0,

            excused: 0,

            leave: 0,

            total: 0
        };


        monthlyRecords.forEach(record => {

            const status =
                record.calculatedStatus;


            if (status === "Present") {
                stats.present++;
            }

            else if (status === "Late") {
                stats.late++;
            }

            else if (status === "Absent") {
                stats.absent++;
            }

            else if (status === "Excused") {
                stats.excused++;
            }

            else if (status === "On Leave") {
                stats.leave++;
            }


            stats.total++;
        });


        return stats;

    }, [monthlyRecords]);


    // =====================================================
    // MONTHLY SUMMARY
    //
    // Creates totals for every month in the attendance
    // history.
    // =====================================================

    const monthlySummary = useMemo(() => {

        const summary = {};


        completeAttendanceHistory.forEach(record => {

            if (!record.date) {
                return;
            }


            const month =
                record.date.slice(0, 7);


            if (!summary[month]) {

                summary[month] = {

                    month,

                    present: 0,

                    late: 0,

                    absent: 0,

                    excused: 0,

                    leave: 0,

                    total: 0
                };
            }


            const status =
                record.calculatedStatus;


            if (status === "Present") {

                summary[month].present++;

            } else if (status === "Late") {

                summary[month].late++;

            } else if (status === "Absent") {

                summary[month].absent++;

            } else if (status === "Excused") {

                summary[month].excused++;

            } else if (status === "On Leave") {

                summary[month].leave++;
            }


            summary[month].total++;
        });


        return Object.values(summary)
            .sort((a, b) =>
                b.month.localeCompare(a.month)
            );

    }, [completeAttendanceHistory]);


    // =====================================================
    // MONTH NAME
    // =====================================================

    const formatMonth = (monthString) => {

        if (!monthString) {
            return "";
        }


        const [year, month] =
            monthString.split("-");


        return new Date(
            Number(year),
            Number(month) - 1,
            1
        ).toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );
    };


    // =====================================================
    // CALENDAR MAP
    // =====================================================

    const calendarMap = useMemo(() => {

        const map = {};


        monthlyRecords.forEach(record => {

            map[record.date] =
                record.calculatedStatus;

        });


        return map;

    }, [monthlyRecords]);


    // =====================================================
    // CALENDAR INFORMATION
    // =====================================================

    const calendarInfo = useMemo(() => {

        if (!selectedMonth) {
            return {
                days: [],
                firstDay: 0
            };
        }


        const [
            year,
            month
        ] = selectedMonth.split("-");


        const numericYear =
            Number(year);

        const numericMonth =
            Number(month);


        const daysInMonth =
            new Date(
                numericYear,
                numericMonth,
                0
            ).getDate();


        /*
         * JavaScript:
         *
         * 0 = Sunday
         * 1 = Monday
         * ...
         * 6 = Saturday
         */

        const firstDay =
            new Date(
                numericYear,
                numericMonth - 1,
                1
            ).getDay();


        return {

            days: Array.from(
                { length: daysInMonth },
                (_, index) => index + 1
            ),

            firstDay
        };

    }, [selectedMonth]);


    // =====================================================
    // STATUS CLASS
    // =====================================================

    const getStatusClass = (status) => {

        switch (status) {

            case "Present":

                return "bg-green-100 text-green-700 border-green-200";


            case "Late":

                return "bg-amber-100 text-amber-700 border-amber-200";


            case "Absent":

                return "bg-red-100 text-red-700 border-red-200";


            case "Excused":

                return "bg-blue-100 text-blue-700 border-blue-200";


            case "On Leave":

                return "bg-purple-100 text-purple-700 border-purple-200";


            default:

                return "bg-gray-50 text-gray-400 border-gray-100";
        }
    };


    // =====================================================
    // EXPORT PDF
    // =====================================================

    const exportPDF = () => {

        if (monthlyRecords.length === 0) {
            return;
        }


        const pdf = new jsPDF();


        pdf.setFontSize(16);

        pdf.text(
            "Staff Attendance Report",
            14,
            15
        );


        pdf.setFontSize(10);

        pdf.text(
            `Name: ${teacherName}`,
            14,
            22
        );


        pdf.text(
            `Staff ID: ${teacherID}`,
            14,
            28
        );


        pdf.text(
            `Month: ${formatMonth(selectedMonth)}`,
            14,
            34
        );


        // =================================================
        // MONTH SUMMARY
        // =================================================

        autoTable(pdf, {

            startY: 41,

            head: [[
                "Present",
                "Late",
                "Absent",
                "Excused",
                "Leave",
                "Total"
            ]],

            body: [[
                monthlyStats.present,
                monthlyStats.late,
                monthlyStats.absent,
                monthlyStats.excused,
                monthlyStats.leave,
                monthlyStats.total
            ]],

            styles: {
                fontSize: 8
            },

            headStyles: {
                fillColor: [79, 70, 229]
            }

        });


        // =================================================
        // ATTENDANCE DETAILS
        // =================================================

        const finalY =
            pdf.lastAutoTable?.finalY || 50;


        autoTable(pdf, {

            startY: finalY + 10,

            head: [[
                "Date",
                "Status",
                "Clock-In",
                "Clock-Out",
                "Note"
            ]],

            body: monthlyRecords.map(record => [

                record.date,

                record.calculatedStatus || "N/A",

                formatTime(
                    record.clockInTime
                ),

                formatTime(
                    record.clockOutTime
                ),

                record.note || ""

            ]),

            styles: {
                fontSize: 8
            },

            headStyles: {
                fillColor: [79, 70, 229]
            }

        });


        const safeName =
            teacherName
                .replace(/[^a-z0-9]/gi, "_");


        pdf.save(
            `Attendance_${safeName}_${selectedMonth}.pdf`
        );
    };


    // =====================================================
    // RETURN
    // =====================================================

    return (

        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">

            <div className="max-w-6xl mx-auto flex flex-col gap-6">


                {/* =====================================================
                    HEADER
                ===================================================== */}

                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                    <div>

                        <h1 className="text-xl sm:text-2xl font-black text-gray-800 uppercase tracking-tight">

                            Staff Attendance Report

                        </h1>


                        <p className="text-indigo-600 font-bold text-[10px] sm:text-xs uppercase tracking-widest">

                            Personal Attendance Record

                        </p>

                    </div>


                    <div className="bg-indigo-50 px-3 sm:px-4 py-2 rounded-2xl border border-indigo-100 text-center">

                        <p className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase">

                            Staff Name

                        </p>


                        <p className="text-xs sm:text-sm font-bold text-indigo-900">

                            {teacherName}

                        </p>


                        <p className="text-[9px] text-indigo-500 mt-0.5">

                            ID: {teacherID}

                        </p>

                    </div>

                </div>


                {/* =====================================================
                    MONTH SELECTOR
                ===================================================== */}

                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">

                        <div>

                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">

                                Select Month

                            </label>


                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) =>
                                    setSelectedMonth(e.target.value)
                                }
                                className="border rounded-xl px-4 py-2 text-sm font-bold bg-gray-50 shadow-sm w-full sm:w-64 focus:bg-white transition"
                            />

                        </div>


                        <button
                            onClick={exportPDF}
                            disabled={
                                loading ||
                                monthlyRecords.length === 0
                            }
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-indigo-700 w-full sm:w-auto transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >

                            📄 Export Monthly PDF

                        </button>

                    </div>

                </div>


                {/* =====================================================
                    SELECTED MONTH STATISTICS
                ===================================================== */}

                <div>

                    <div className="mb-3">

                        <h2 className="text-sm sm:text-base font-black text-gray-700 uppercase">

                            {formatMonth(selectedMonth)} Attendance Summary

                        </h2>

                        <p className="text-[10px] text-gray-400 mt-1">

                            Attendance totals for the selected month

                        </p>

                    </div>


                  
                </div>


                {/* =====================================================
                    MONTHLY SUMMARY
                ===================================================== */}

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6">

                    <div className="mb-4">

                        <h2 className="text-sm sm:text-base font-black text-gray-700 uppercase">

                            Monthly Attendance Summary

                        </h2>

                        <p className="text-[10px] text-gray-400 mt-1">

                            Attendance totals recorded by month

                        </p>

                    </div>


                    {monthlySummary.length > 0 ? (

                        <div className="overflow-x-auto">

                            <table className="min-w-full">

                                <thead>

                                    <tr className="border-b border-gray-100">

                                        <th className="text-left px-3 py-3 text-[10px] font-black uppercase text-gray-400">
                                            Month
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-green-500">
                                            Present
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-amber-500">
                                            Late
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-red-500">
                                            Absent
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-blue-500">
                                            Excused
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-purple-500">
                                            Leave
                                        </th>

                                        <th className="text-center px-3 py-3 text-[10px] font-black uppercase text-gray-400">
                                            Total
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    {monthlySummary.map(month => (

                                        <tr
                                            key={month.month}
                                            className="border-b border-gray-50 hover:bg-gray-50"
                                        >

                                            <td className="px-3 py-3 text-xs font-bold text-gray-700">

                                                {formatMonth(month.month)}

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-black">

                                                    {month.present}

                                                </span>

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-black">

                                                    {month.late}

                                                </span>

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-black">

                                                    {month.absent}

                                                </span>

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">

                                                    {month.excused}

                                                </span>

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-black">

                                                    {month.leave}

                                                </span>

                                            </td>


                                            <td className="px-3 py-3 text-center">

                                                <span className="text-xs font-black text-gray-700">

                                                    {month.total}

                                                </span>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                    ) : (

                        <div className="py-8 text-center text-gray-400 text-xs font-bold uppercase">

                            No monthly attendance data available.

                        </div>

                    )}

                </div>


                {/* =====================================================
                    MONTHLY CALENDAR
                ===================================================== */}

                <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100">

                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-5">

                        <div>

                            <h3 className="font-black text-gray-700 uppercase text-sm sm:text-base">

                                Attendance Calendar

                            </h3>

                            <p className="text-[10px] text-gray-400 mt-1">

                                {formatMonth(selectedMonth)}

                            </p>

                        </div>

                    </div>


                    {/* WEEK DAYS */}

                    <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">

                        {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat"
                        ].map(day => (

                            <div
                                key={day}
                                className="text-center text-[8px] sm:text-xs font-black uppercase text-gray-400 py-2"
                            >

                                {day}

                            </div>

                        ))}

                    </div>


                    {/* CALENDAR */}

                    <div className="grid grid-cols-7 gap-1 sm:gap-2">

                        {/* EMPTY CELLS BEFORE FIRST DAY */}

                        {Array.from(
                            {
                                length:
                                    calendarInfo.firstDay
                            }
                        ).map((_, index) => (

                            <div
                                key={`empty-${index}`}
                                className="h-10 sm:h-14 rounded-xl bg-gray-50/50"
                            />

                        ))}


                        {/* DAYS */}

                        {calendarInfo.days.map(day => {

                            const dateStr =
                                `${selectedMonth}-${String(day).padStart(2, "0")}`;


                            const status =
                                calendarMap[dateStr];


                            /*
                             * If no attendance activity happened
                             * at school on this date, keep it neutral.
                             */

                            const hasAttendanceActivity =
                                schoolAttendanceDays.has(dateStr);


                            return (

                                <div
                                    key={dateStr}
                                    className={`h-10 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition ${
                                        status
                                            ? getStatusClass(status)
                                            : hasAttendanceActivity
                                                ? "bg-red-50 text-red-600 border-red-100"
                                                : "bg-gray-50 text-gray-400 border-gray-100"
                                    }`}
                                >

                                    <span className="text-[10px] sm:text-sm font-black">

                                        {day}

                                    </span>


                                    {status && (

                                        <span className="text-[6px] sm:text-[8px] font-black uppercase mt-0.5">

                                            {status}

                                        </span>

                                    )}


                                    {!status &&
                                        hasAttendanceActivity && (

                                            <span className="text-[6px] sm:text-[8px] font-black uppercase mt-0.5">

                                                Absent

                                            </span>

                                        )}

                                </div>

                            );

                        })}

                    </div>


                    {/* LEGEND */}

                    <div className="flex flex-wrap gap-3 sm:gap-4 mt-5 pt-4 border-t border-gray-100">

                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-green-600">

                            <span className="h-3 w-3 rounded-full bg-green-500"></span>

                            Present

                        </span>


                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-amber-600">

                            <span className="h-3 w-3 rounded-full bg-amber-500"></span>

                            Late

                        </span>


                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-red-600">

                            <span className="h-3 w-3 rounded-full bg-red-500"></span>

                            Absent

                        </span>


                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-blue-600">

                            <span className="h-3 w-3 rounded-full bg-blue-500"></span>

                            Excused

                        </span>


                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-purple-600">

                            <span className="h-3 w-3 rounded-full bg-purple-500"></span>

                            On Leave

                        </span>


                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-gray-400">

                            <span className="h-3 w-3 rounded-full bg-gray-300"></span>

                            No Activity

                        </span>

                    </div>

                </div>


                {/* =====================================================
                    ATTENDANCE RECORDS
                ===================================================== */}

                <div>

                    <div className="mb-3">

                        <h2 className="text-sm sm:text-base font-black text-gray-700 uppercase">

                            Attendance Records — {formatMonth(selectedMonth)}

                        </h2>

                    </div>


                    {loading ? (

                        <div className="text-center py-6 font-bold text-gray-400 animate-pulse uppercase text-sm">

                            Syncing Records...

                        </div>

                    ) : monthlyRecords.length > 0 ? (

                        <div className="space-y-3">

                            {monthlyRecords.map(record => (

                                <div
                                    key={record.id}
                                    className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col gap-4 ${
                                        record.isAutomaticallyAbsent
                                            ? "border-red-200 bg-red-50/30"
                                            : "border-gray-100"
                                    }`}
                                >

                                    {/* DATE + STATUS */}

                                    <div className="flex flex-col sm:flex-row justify-between gap-3">

                                        <div className="flex items-center gap-3 sm:gap-4">

                                            <div className="bg-gray-100 h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex flex-col items-center justify-center text-gray-500">

                                                <span className="text-[7px] sm:text-[8px] font-black uppercase">
                                                    Date
                                                </span>

                                                <span className="text-xs sm:text-sm font-bold">
                                                    {record.date.split("-")[2]}
                                                </span>

                                            </div>


                                            <div>

                                                <p className="text-[9px] sm:text-xs font-black text-gray-400 uppercase">

                                                    {new Date(
                                                        `${record.date}T00:00:00`
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            month: "long",
                                                            day: "numeric",
                                                            year: "numeric"
                                                        }
                                                    )}

                                                </p>


                                                <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">

                                                    Attendance Record

                                                </h3>

                                            </div>

                                        </div>


                                        <div
                                            className={`self-start px-3 sm:px-5 py-1 sm:py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${getStatusClass(
                                                record.calculatedStatus
                                            )}`}
                                        >

                                            {record.calculatedStatus}

                                        </div>

                                    </div>


                                    {/* AUTOMATIC ABSENCE NOTICE */}

                                    {record.isAutomaticallyAbsent && (

                                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">

                                            <p className="text-[9px] font-black uppercase text-red-500">

                                                Attendance Notice

                                            </p>

                                            <p className="text-xs text-red-700 mt-1">

                                                Attendance was recorded by the school on this day, but no attendance record was found for you.

                                            </p>

                                        </div>

                                    )}


                                    {/* CLOCK TIMES */}

                                    <div className="grid grid-cols-2 gap-3">

                                        <div className="bg-green-50 border border-green-100 rounded-xl p-3">

                                            <p className="text-[9px] font-black uppercase text-green-500">
                                                Clock-In
                                            </p>

                                            <p className="text-sm font-bold text-green-800">

                                                {formatTime(
                                                    record.clockInTime
                                                )}

                                            </p>

                                        </div>


                                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">

                                            <p className="text-[9px] font-black uppercase text-red-500">
                                                Clock-Out
                                            </p>

                                            <p className="text-sm font-bold text-red-800">

                                                {formatTime(
                                                    record.clockOutTime
                                                )}

                                            </p>

                                        </div>

                                    </div>


                                    {/* NOTE */}

                                    {record.note && (

                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">

                                            <p className="text-[9px] font-black uppercase text-gray-400">
                                                Note
                                            </p>

                                            <p className="text-xs text-gray-600 italic">
                                                "{record.note}"
                                            </p>

                                        </div>

                                    )}


                                    {/* MANUAL / FINAL STATUS */}

                                    <div className="flex flex-wrap gap-2">

                                        {record.isManual && (

                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase">

                                                Manual Entry

                                            </span>

                                        )}


                                        {record.isFinal && (

                                            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[9px] font-bold uppercase">

                                                Finalized

                                            </span>

                                        )}

                                    </div>

                                </div>

                            ))}

                        </div>

                    ) : (

                        <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center">

                            <p className="text-gray-400 font-bold uppercase text-sm">

                                No attendance activity found for this month.

                            </p>

                        </div>

                    )}

                </div>

            </div>

        </div>
    );
};


export default StaffSelfAttendanceReport;
