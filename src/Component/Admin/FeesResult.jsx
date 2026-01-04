import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import {
    collection,
    onSnapshot,
    query,
    where,
    doc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";

import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import localforage from "localforage";

// 💾 LocalForage Stores
const pupilStore = localforage.createInstance({ name: "PupilDataCache", storeName: "pupil_reg" });
const feesCostStore = localforage.createInstance({ name: "FeesCache", storeName: "fees_cost" });
const receiptStore = localforage.createInstance({ name: "ReceiptsCache", storeName: "receipt_data" });

// Status Dropdown Options
const STATUS_OPTIONS = [
    { value: "", label: "Select status" },
    { value: "Open", label: "Open" },
    { value: "Closed", label: "Closed" },
];

// Helper: calculate outstanding fees
const calculateOutstanding = (receipts, currentYear, feeCosts) => {
    const studentMap = {};
    receipts.forEach((r) => {
        if (!studentMap[r.studentID]) {
            studentMap[r.studentID] = {
                studentID: r.studentID,
                studentName: r.studentName,
                class: r.class,
                academicYear: r.academicYear,
                totalPaid: 0,
            };
        }
        studentMap[r.studentID].totalPaid += r.amount || 0;
    });

    return Object.values(studentMap).map((s) => {
        const classFee = feeCosts.find(
            (f) => f.academicYear === s.academicYear && f.className === s.class
        );
        const totalFee = (s.academicYear === currentYear && classFee) ? classFee.totalAmount : 0;
        return { ...s, totalFee, outstanding: totalFee - s.totalPaid };
    });
};

// Helper: chart data
const calculatePupilsChartData = (pupils) => {
    const counts = {};
    pupils.forEach((p) => {
        const cls = p.class || "Unknown";
        counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.keys(counts).sort().map((cls) => ({ class: cls, pupils: counts[cls] }));
};

export default function FeesResult() {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // States
    const [academicYear, setAcademicYear] = useState("");
    const [allYears, setAllYears] = useState([]);
    const [allPupils, setAllPupils] = useState([]);
    const [feesCost, setFeesCost] = useState([]);
    const [feesOutstanding, setFeesOutstanding] = useState([]);
    const [pupilsData, setPupilsData] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusInputs, setStatusInputs] = useState({});
    const [savingRow, setSavingRow] = useState(null);

    // Loading
    const [loadingPupils, setLoadingPupils] = useState(true);
    const [loadingFeesCost, setLoadingFeesCost] = useState(true);
    const [loadingReceipts, setLoadingReceipts] = useState(true);

    // Pagination
    const [pupilsListLimit, setPupilsListLimit] = useState(10);
    const [pupilsPage, setPupilsPage] = useState(1);

    const overallLoading = loadingPupils || loadingFeesCost || loadingReceipts;

    // --- Load Pupils ---
    useEffect(() => {
        if (!schoolId) return;
        const PUPILS_CACHE_KEY = `pupils_reg_${schoolId}`;

        const loadAndListen = async () => {
            setLoadingPupils(true);
            // Cache first
            try {
                const cached = await pupilStore.getItem(PUPILS_CACHE_KEY);
                if (cached?.data) {
                    setAllPupils(cached.data);
                    const years = [...new Set(cached.data.map(p => p.academicYear))].sort().reverse();
                    setAllYears(years);
                    if (!academicYear && years.length) setAcademicYear(years[0]);
                    console.log("Loaded pupils from cache");
                }
            } catch (e) { console.error(e); }

            // Firestore listener
            const q = query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId));
            const unsub = onSnapshot(q, (snap) => {
                const pupils = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllPupils(pupils);
                const years = [...new Set(pupils.map(p => p.academicYear))].sort().reverse();
                setAllYears(years);
                if (!academicYear && years.length) setAcademicYear(years[0]);
                // Save to cache
                pupilStore.setItem(PUPILS_CACHE_KEY, { timestamp: Date.now(), data: pupils }).catch(console.error);
                setLoadingPupils(false);
            }, (err) => { console.error(err); toast.error("Failed to stream pupils"); setLoadingPupils(false); });
            return () => unsub();
        };

        loadAndListen();
    }, [schoolId]);

    // --- Load FeesCost ---
    useEffect(() => {
        if (!schoolId) return;
        const FEES_CACHE_KEY = `fees_cost_${schoolId}`;
        const loadFees = async () => {
            setLoadingFeesCost(true);
            try {
                const cached = await feesCostStore.getItem(FEES_CACHE_KEY);
                if (cached?.data) setFeesCost(cached.data);
            } catch (e) { console.error(e); }

            const q = query(collection(db, "FeesCost"), where("schoolId", "==", schoolId));
            const unsub = onSnapshot(q, (snap) => {
                const fees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setFeesCost(fees);
                feesCostStore.setItem(FEES_CACHE_KEY, { timestamp: Date.now(), data: fees }).catch(console.error);
                setLoadingFeesCost(false);
            }, (err) => { console.error(err); toast.error("Failed to load fees"); setLoadingFeesCost(false); });
            return () => unsub();
        };
        loadFees();
    }, [schoolId]);

    // --- Load Receipts & calculate outstanding ---
    useEffect(() => {
        if (!academicYear || !schoolId || feesCost.length === 0) return;
        const RECEIPTS_CACHE_KEY = `receipts_${schoolId}_${academicYear}`;

        const loadReceipts = async () => {
            setLoadingReceipts(true);
            try {
                const cached = await receiptStore.getItem(RECEIPTS_CACHE_KEY);
                if (cached?.data) setFeesOutstanding(calculateOutstanding(cached.data, academicYear, feesCost));
            } catch (e) { console.error(e); }

            const q = query(collection(db, "Receipts"),
                where("schoolId", "==", schoolId),
                where("academicYear", "==", academicYear)
            );
            const unsub = onSnapshot(q, snap => {
                const receipts = snap.docs.map(d => d.data());
                setFeesOutstanding(calculateOutstanding(receipts, academicYear, feesCost));
                receiptStore.setItem(RECEIPTS_CACHE_KEY, { timestamp: Date.now(), data: receipts }).catch(console.error);
                setLoadingReceipts(false);
            }, (err) => { console.error(err); toast.error("Failed to load receipts"); setLoadingReceipts(false); });
            return () => unsub();
        };
        loadReceipts();
    }, [academicYear, feesCost, schoolId]);

    // --- Load Saved Status ---
    useEffect(() => {
        if (!schoolId || !academicYear) return;
        const q = query(collection(db, "StudentFeesStatus"),
            where("schoolId", "==", schoolId),
            where("academicYear", "==", academicYear)
        );
        const unsub = onSnapshot(q, snap => {
            const map = {};
            snap.forEach(d => { const data = d.data(); map[data.studentID] = data.status; });
            setStatusInputs(map);
        });
        return () => unsub();
    }, [schoolId, academicYear]);

    // --- Merge Pupils with Fees ---
    const mergedPupils = useMemo(() => {
        return allPupils.map(p => {
            const fee = feesCost.find(f => f.className === p.class && f.academicYear === p.academicYear);
            const totalFee = fee ? fee.totalAmount : 0;
            const receipt = feesOutstanding.find(r => r.studentID === p.studentID);
            const totalPaid = receipt ? receipt.totalPaid : 0;
            const outstanding = totalFee - totalPaid;
            return { ...p, totalFee: totalFee.toFixed(2), totalPaid: totalPaid.toFixed(2), outstanding: outstanding.toFixed(2) };
        });
    }, [allPupils, feesCost, feesOutstanding]);

    const filteredPupils = useMemo(() => {
        return mergedPupils.filter(p => {
            const matchClass = selectedClass ? p.class === selectedClass : true;
            const term = searchTerm.toLowerCase();
            const matchSearch =
                p.firstName?.toLowerCase().includes(term) ||
                p.lastName?.toLowerCase().includes(term) ||
                p.studentName?.toLowerCase().includes(term) ||
                p.class?.toLowerCase().includes(term);
            return matchClass && matchSearch;
        });
    }, [mergedPupils, selectedClass, searchTerm]);
    // --- Gender Breakdown (Total / Male / Female) ---
    const genderBreakdown = useMemo(() => {
        const male = filteredPupils.filter(
            (p) => p.gender?.toLowerCase() === "male"
        ).length;

        const female = filteredPupils.filter(
            (p) => p.gender?.toLowerCase() === "female"
        ).length;

        return {
            male,
            female,
            total: filteredPupils.length,
        };
    }, [filteredPupils]);


    const totalPages = Math.ceil(filteredPupils.length / pupilsListLimit) || 1;
    const displayedPupils = filteredPupils.slice((pupilsPage - 1) * pupilsListLimit, pupilsPage * pupilsListLimit);

    // --- Save status ---
    const handleSaveStatus = async (student) => {
        const sid = student.studentID;
        const statusValue = statusInputs[sid];
        if (!statusValue) { toast.warn("Select a status"); return; }
        try {
            setSavingRow(sid);
            const safeYear = academicYear.replace(/\//g, "-");
            const docId = `${schoolId}_${safeYear}_${sid}`;
            await setDoc(doc(db, "StudentFeesStatus", docId), {
                schoolId, academicYear, studentID: sid, studentName: student.studentName || `${student.firstName} ${student.lastName}`,
                class: student.class, status: statusValue, updatedAt: serverTimestamp()
            }, { merge: true });
            toast.success("Status saved");
        } catch (e) { console.error(e); toast.error("Failed"); }
        finally { setSavingRow(null); }
    };

    return (
        <div className="w-full h-screen bg-blue-300 flex flex-col">
            <div className="p-4 border-b border-blue-400 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold">Pupil Fees List</h1>
                   

                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setPupilsPage(1); }} className="p-1 border rounded bg-white text-black">
                        <option value="">All Classes</option>
                        {[...new Set(allPupils.map(s => s.class))].filter(Boolean).sort().map(cls => <option key={cls} value={cls}>{cls}</option>)}
                    </select>
                </div>
                <input type="text" placeholder="Search pupil or class..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPupilsPage(1); }} className="p-2 rounded border w-full text-sm" />
            </div>

             {/* GENDER SUMMARY */}
                    <div className="p-2 border-b border-blue-400 bg-blue-100 flex justify-between text-sm font-semibold">
                        <p>
                            Total: <span className="text-blue-700">{genderBreakdown.total}</span>
                        </p>
                        <p>
                            Male: <span className="text-blue-700">{genderBreakdown.male}</span>
                        </p>
                        <p>
                            Female: <span className="text-pink-700">{genderBreakdown.female}</span>
                        </p>
                    </div>


            <div className="flex-1 overflow-y-auto p-4">
                <table className="min-w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2">Student ID</th>
                            <th className="border p-2">Pupil Name</th>
                            <th className="border p-2">Class</th>
                            <th className="border p-2">Paid</th>
                            <th className="border p-2">Bal</th>
                            <th className="border p-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedPupils.length > 0 ? displayedPupils.map(s => (
                            <tr key={s.id || s.studentID} className="bg-white">
                                <td className="border p-2 text-xs font-mono text-gray-600">{s.studentID}</td>
                                <td className="border p-2 font-semibold">{s.studentName || `${s.firstName} ${s.lastName}`}</td>
                                <td className="border p-2">{s.class}</td>
                                <td className="border p-2">{s.totalPaid}</td>
                                <td className={`border p-2 ${Number(s.outstanding) > 0 ? "text-red-600 font-bold" : "text-green-700 font-semibold"}`}>{s.outstanding}</td>
                                <td className="border p-2">
                                    <div className="flex gap-2">
                                        <select
                                            value={statusInputs[s.studentID] || ""}
                                            onChange={e => setStatusInputs(prev => ({ ...prev, [s.studentID]: e.target.value }))}
                                            className={`px-2 py-1 border rounded text-sm ${statusInputs[s.studentID] === "Closed" ? "bg-green-100 text-green-800" : statusInputs[s.studentID] === "Open" ? "bg-red-100 text-red-700" : ""}`}
                                        >
                                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <button onClick={() => handleSaveStatus(s)} disabled={savingRow === s.studentID} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">{savingRow === s.studentID ? "Saving..." : "Save"}</button>
                                    </div>
                                </td>
                            </tr>
                        )) : <tr><td colSpan={6} className="border p-4 text-center">{overallLoading ? "Loading..." : "No pupils found."}</td></tr>}
                    </tbody>
                </table>
            </div>

            <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">
                <button onClick={() => setPupilsPage(p => Math.max(p - 1, 1))} disabled={pupilsPage === 1} className="px-3 py-1 bg-white rounded shadow disabled:opacity-50">Prev</button>
                <span className="text-sm font-medium">Page {pupilsPage} of {totalPages}</span>
                <button onClick={() => setPupilsPage(p => Math.min(p + 1, totalPages))} disabled={pupilsPage === totalPages || totalPages === 0} className="px-3 py-1 bg-white rounded shadow disabled:opacity-50">Next</button>
            </div>
        </div>
    );
}
