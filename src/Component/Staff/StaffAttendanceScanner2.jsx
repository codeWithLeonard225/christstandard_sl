import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    serverTimestamp 
} from "firebase/firestore";
import { db } from "../../../firebase";
import { toast } from "react-toastify";

export default function StaffAttendanceScanner({ schoolId = "N/A" }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);
    const [isScannerActive, setIsScannerActive] = useState(false);

    const html5QrCodeRef = useRef(null);
    const teachersMapRef = useRef(new Map());

    // 1. Pre-cache Teachers on Mount (O(1) Instant Lookup)
    useEffect(() => {
        const prefetchTeachers = async () => {
            if (!schoolId || schoolId === "N/A") return;
            try {
                const q = query(
                    collection(db, "Teachers"), 
                    where("schoolId", "==", schoolId)
                );
                const snap = await getDocs(q);
                const map = new Map();
                snap.docs.forEach((docSnap) => {
                    const data = docSnap.data();
                    const tId = data.teacherID || data.id || docSnap.id;
                    map.set(String(tId).trim(), { id: docSnap.id, ...data });
                });
                teachersMapRef.current = map;
            } catch (err) {
                console.error("Error pre-caching teachers:", err);
            }
        };

        prefetchTeachers();
    }, [schoolId]);

    // 2. Initialize / Teardown Scanner
    useEffect(() => {
        const qrCodeId = "reader";
        const html5QrCode = new Html5Qrcode(qrCodeId);
        html5QrCodeRef.current = html5QrCode;

        const config = {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment",
                focusMode: "continuous",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => {} // suppress minor scan errors
        ).then(() => {
            setIsScannerActive(true);
        }).catch((err) => {
            console.error("Failed to start scanner:", err);
            setIsScannerActive(false);
        });

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
            }
        };
    }, []);

    // 3. Fast Handlers
    const onScanSuccess = async (decodedText) => {
        if (isProcessing) return;

        try {
            html5QrCodeRef.current?.pause(true);
        } catch (e) {
            console.warn("Pause warning:", e);
        }

        setIsProcessing(true);
        const scannedId = String(decodedText).trim();

        try {
            // Memory Lookup (Instant)
            const teacher = teachersMapRef.current.get(scannedId);

            if (!teacher) {
                toast.error(`Teacher ID standard "${scannedId}" not found in local cache.`);
                return;
            }

            const todayStr = new Date().toISOString().split("T")[0];

            // Single targeted Firestore check
            const attendanceRef = collection(db, "StaffAttendance");
            const todayQuery = query(
                attendanceRef,
                where("schoolId", "==", schoolId),
                where("teacherID", "==", scannedId),
                where("date", "==", todayStr)
            );

            const todaySnap = await getDocs(todayQuery);

            if (!todaySnap.empty) {
                toast.error(`${teacher.fullName || teacher.name} has already scanned in today.`);
            } else {
                // Record Attendance
                await addDoc(attendanceRef, {
                    schoolId,
                    teacherID: scannedId,
                    teacherName: teacher.fullName || teacher.name || "N/A",
                    date: todayStr,
                    timestamp: serverTimestamp(),
                    status: "Present"
                });

                setLastScanned({
                    name: teacher.fullName || teacher.name,
                    time: new Date().toLocaleTimeString()
                });
                toast.success(`Marked Present: ${teacher.fullName || teacher.name}`);
            }
        } catch (err) {
            console.error("Attendance processing failed:", err);
            toast.error("Failed to record attendance. Try again.");
        } finally {
            // 300ms Cooldown instead of 1000ms
            setTimeout(() => {
                if (html5QrCodeRef.current) {
                    try {
                        html5QrCodeRef.current.resume();
                    } catch (e) {
                        console.error("Resume error:", e);
                    }
                }
                setIsProcessing(false);
            }, 300);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
                Staff Attendance Scanner
            </h2>

            <div className="relative overflow-hidden rounded-lg bg-black min-h-[300px]">
                <div id="reader" className="w-full h-full"></div>
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold">
                        Processing...
                    </div>
                )}
            </div>

            {lastScanned && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm text-green-800 font-medium">Last Record Added:</p>
                    <p className="text-base font-bold text-green-900">{lastScanned.name}</p>
                    <p className="text-xs text-green-600">{lastScanned.time}</p>
                </div>
            )}
        </div>
    );
}