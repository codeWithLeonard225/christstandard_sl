import React, { useState, useEffect } from "react";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc, 
    serverTimestamp 
} from "firebase/firestore";
import { ppr } from "../Database/pupilspaymentregistry";
import { toast } from "react-toastify";
import { 
    FaCheckCircle, 
    FaHourglassHalf, 
    FaSchool, 
    FaSearch, 
    FaLock 
} from "react-icons/fa";

const BankFeesPage = () => {
    const [payments, setPayments] = useState([]);
    const [session, setSession] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1️⃣ Match your LoginPage key: "schoolUser"
        const savedSession = localStorage.getItem("schoolUser");
        
        if (savedSession) {
            const sessionData = JSON.parse(savedSession);
            setSession(sessionData);

            // 2️⃣ Use the schoolId from the savedSession
            const q = query(
                collection(ppr, "ppr_bank_fees"),
                where("schoolId", "==", sessionData.schoolId)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Manual Sort: Newest transactions first
                const sortedData = data.sort((a, b) => 
                    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                );
                
                setPayments(sortedData);
                setLoading(false);
            }, (err) => {
                console.error("Firestore Error:", err);
                toast.error("Failed to load ledger data");
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    }, []);

    const handleReceive = async (payId) => {
        if (!window.confirm("Acknowledge receipt of these funds? This action is permanent and will lock the record.")) return;
        
        try {
            const feeRef = doc(ppr, "ppr_bank_fees", payId);
            await updateDoc(feeRef, {
                status: "received",
                receivedAt: serverTimestamp(),
                receivedBy: session?.data?.adminName || "Admin" // Audit tracking
            });
            toast.success("Payment marked as RECEIVED.");
        } catch (err) {
            console.error("Update Error:", err);
            toast.error("Error updating status");
        }
    };

    // Filter Logic
    const filteredPayments = payments.filter(p => 
        p.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Summary Calculations
    const totalReceived = payments
        .filter(p => p.status === "received")
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="text-indigo-600 font-bold animate-pulse text-xl uppercase tracking-widest">
                    Synchronizing Ledger...
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white shadow-xl rounded-2xl border border-red-100">
                    <h2 className="text-2xl font-black text-red-600 mb-2">ACCESS DENIED</h2>
                    <p className="text-gray-500 mb-6">Please log in to view the financial portal.</p>
                    <button 
                        onClick={() => window.location.href = "/"}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            
            {/* SUMMARY RIBBON */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-700 p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row items-center justify-between col-span-2 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <FaSchool className="text-3xl" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black uppercase text-center md:text-left leading-none">
                                {session.schoolName}
                            </h1>
                            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-2 text-center md:text-left">
                                Financial Audit Ledger
                            </p>
                        </div>
                    </div>
                    <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                        <p className="text-[10px] font-bold uppercase text-indigo-300">Confirmed Bank Deposits</p>
                        <p className="text-3xl font-black">Le {totalReceived.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-center">
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Find Student or Receipt..." 
                            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-full focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* MAIN DATA TABLE */}
            <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-800 text-[10px] uppercase font-bold text-gray-300">
                            <tr>
                                <th className="p-5">Student / Receipt</th>
                                <th className="p-5">Bank Details</th>
                                <th className="p-5">Category</th>
                                <th className="p-5 text-right">Amount</th>
                                <th className="p-5 text-center">Audit Status</th>
                                <th className="p-5 text-center">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {filteredPayments.map((pay) => {
                                const isReceived = pay.status === "received";
                                return (
                                    <tr key={pay.id} className={`border-b hover:bg-gray-50 transition-colors ${!isReceived ? 'bg-amber-50/30' : ''}`}>
                                        <td className="p-5">
                                            <div className="font-black text-gray-800 uppercase text-sm">{pay.studentName}</div>
                                            <div className="text-indigo-600 font-mono text-[10px] tracking-tighter">{pay.receiptNumber}</div>
                                        </td>
                                        <td className="p-5 text-gray-500">
                                            <div className="font-bold text-gray-700">{pay.bankName}</div>
                                            <div className="text-[10px] bg-gray-100 px-1 inline-block rounded uppercase">{pay.branch} branch</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-bold text-gray-700">{pay.feeType}</div>
                                            <div className="text-[10px] text-gray-400">{pay.term || 'General'}</div>
                                        </td>
                                        <td className="p-5 text-right font-black text-gray-900 text-sm">
                                            Le {pay.amount?.toLocaleString()}
                                        </td>
                                        <td className="p-5 text-center">
                                            {isReceived ? (
                                                <div className="text-green-600 font-black flex flex-col items-center gap-1">
                                                    <FaCheckCircle className="text-lg" /> 
                                                    <span className="text-[9px]">CONFIRMED</span>
                                                </div>
                                            ) : (
                                                <div className="text-amber-500 font-black flex flex-col items-center gap-1">
                                                    <FaHourglassHalf className="text-lg animate-pulse" /> 
                                                    <span className="text-[9px]">IN REVIEW</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 text-center">
                                            {!isReceived ? (
                                                <button 
                                                    onClick={() => handleReceive(pay.id)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase transition-all shadow-lg active:scale-95"
                                                >
                                                    Approve
                                                </button>
                                            ) : (
                                                <div className="text-gray-300 flex flex-col items-center opacity-40">
                                                    <FaLock />
                                                    <span className="text-[8px] font-bold">LOCKED</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    {filteredPayments.length === 0 && (
                        <div className="p-16 text-center text-gray-400">
                            <div className="text-4xl mb-2 opacity-20">📂</div>
                            <div className="font-bold uppercase tracking-widest text-[10px]">No financial records found</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BankFeesPage;