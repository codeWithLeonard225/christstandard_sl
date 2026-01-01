import React, { useState, useMemo, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const FeesReport = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [academicYear, setAcademicYear] = useState("");
    const [allYears, setAllYears] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [filterStatus, setFilterStatus] = useState("All"); // All, Paid, Owing

    const [rawPupils, setRawPupils] = useState([]);
    const [rawReceipts, setRawReceipts] = useState([]);
    const [rawFeesCost, setRawFeesCost] = useState([]);

    // 1. Initial Load: Get Academic Years and Fee Structures
    useEffect(() => {
        if (!schoolId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Fee Structures
                const feesSnap = await getDocs(query(collection(db, "FeesCost"), where("schoolId", "==", schoolId)));
                const fees = feesSnap.docs.map(doc => doc.data());
                setRawFeesCost(fees);

                // Get unique years from Fee Structures
                const years = [...new Set(fees.map(f => f.academicYear))].sort().reverse();
                setAllYears(years);
                if (years.length > 0) setAcademicYear(years[0]);

            } catch (err) {
                toast.error("Failed to load initial report data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [schoolId]);

    // 2. Fetch Detailed Data when Academic Year changes
    const generateReport = async () => {
        if (!academicYear) return;
        setLoading(true);
        try {
            // Fetch Pupils for the year
            const pSnap = await getDocs(query(
                collection(db, "PupilsReg"), 
                where("schoolId", "==", schoolId),
                where("academicYear", "==", academicYear)
            ));
            setRawPupils(pSnap.docs.map(doc => doc.data()));

            // Fetch Receipts for the year
            const rSnap = await getDocs(query(
                collection(db, "Receipts"),
                where("schoolId", "==", schoolId),
                where("academicYear", "==", academicYear)
            ));
            setRawReceipts(rSnap.docs.map(doc => doc.data()));
        } catch (err) {
            toast.error("Error generating report");
        } finally {
            setLoading(false);
        }
    };

    // 3. Logic: Merge Data and Calculate
    const reportData = useMemo(() => {
        return rawPupils.map(pupil => {
            const fullName = `${pupil.firstName} ${pupil.lastName}`;
            
            // Find Fee Cost for this specific class
            const feeConfig = rawFeesCost.find(f => f.className === pupil.class && f.academicYear === academicYear);
            const totalFee = feeConfig ? feeConfig.totalAmount : 0;

            // Sum all receipts for this student
            const studentReceipts = rawReceipts.filter(r => r.studentID === pupil.studentID);
            const totalPaid = studentReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
            
            const balance = totalFee - totalPaid;

            return {
                id: pupil.studentID,
                name: fullName,
                class: pupil.class,
                total: totalFee,
                paid: totalPaid,
                balance: balance,
                status: balance <= 0 ? "Paid" : "Owing"
            };
        }).filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClass = selectedClass ? item.class === selectedClass : true;
            const matchesStatus = filterStatus === "All" ? true : item.status === filterStatus;
            return matchesSearch && matchesClass && matchesStatus;
        });
    }, [rawPupils, rawReceipts, rawFeesCost, academicYear, searchTerm, selectedClass, filterStatus]);

    // Financial Totals for the header
    const totals = useMemo(() => {
        return reportData.reduce((acc, curr) => ({
            totalExpected: acc.totalExpected + curr.total,
            totalCollected: acc.totalCollected + curr.paid,
            totalDebt: acc.totalDebt + curr.balance
        }), { totalExpected: 0, totalCollected: 0, totalDebt: 0 });
    }, [reportData]);

    return (
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen font-sans text-gray-800">
            <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
                
                {/* REPORT HEADER */}
                <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Fees Liability Report</h1>
                        <p className="text-slate-400 text-sm">School ID: {schoolId} • Generated on {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            className="bg-slate-800 border border-slate-700 p-2 rounded text-sm outline-none"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                        >
                            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button 
                            onClick={generateReport}
                            className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded text-sm font-bold transition-all uppercase"
                        >
                            Update Report
                        </button>
                    </div>
                </div>

                {/* KPI STRIP */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-b">
                    <div className="p-6 text-center border-r">
                        <p className="text-[10px] font-black uppercase text-gray-400">Total Expected</p>
                        <p className="text-2xl font-black">Le {totals.totalExpected.toLocaleString()}</p>
                    </div>
                    <div className="p-6 text-center border-r bg-green-50">
                        <p className="text-[10px] font-black uppercase text-green-600">Total Collected</p>
                        <p className="text-2xl font-black text-green-700">Le {totals.totalCollected.toLocaleString()}</p>
                    </div>
                    <div className="p-6 text-center bg-red-50">
                        <p className="text-[10px] font-black uppercase text-red-600">Total Outstanding</p>
                        <p className="text-2xl font-black text-red-700">Le {totals.totalDebt.toLocaleString()}</p>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="p-4 bg-gray-50 flex flex-wrap gap-3 items-center border-b">
                    <input 
                        type="text" 
                        placeholder="Search student name..."
                        className="flex-1 min-w-[200px] p-2 border rounded-lg text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="p-2 border rounded-lg text-sm bg-white"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">All Classes</option>
                        {[...new Set(rawPupils.map(p => p.class))].sort().map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select 
                        className="p-2 border rounded-lg text-sm bg-white"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        <option value="Paid">Fully Paid</option>
                        <option value="Owing">Owing</option>
                    </select>
                    <button 
                        onClick={() => window.print()} 
                        className="bg-gray-200 hover:bg-gray-300 p-2 px-4 rounded-lg text-sm font-bold transition-all"
                    >
                        Print PDF
                    </button>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-[10px] uppercase font-black text-gray-500 border-b">
                                <th className="p-4">Student ID</th>
                                <th className="p-4">Full Name</th>
                                <th className="p-4">Class</th>
                                <th className="p-4">Total Fee</th>
                                <th className="p-4">Amt Paid</th>
                                <th className="p-4">Balance</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="7" className="p-20 text-center text-gray-400 font-bold animate-pulse">GENERATING REPORT DATA...</td></tr>
                            ) : reportData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-xs font-mono text-gray-400">{item.id}</td>
                                    <td className="p-4 text-sm font-bold uppercase">{item.name}</td>
                                    <td className="p-4 text-sm">{item.class}</td>
                                    <td className="p-4 text-sm font-semibold">Le {item.total.toLocaleString()}</td>
                                    <td className="p-4 text-sm font-semibold text-green-600">Le {item.paid.toLocaleString()}</td>
                                    <td className="p-4 text-sm font-black text-red-600">Le {item.balance.toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${item.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FeesReport;