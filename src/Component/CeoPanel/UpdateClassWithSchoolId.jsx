import React, { useState } from "react";
import { db } from "../../../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { toast } from "react-toastify"; // Assuming you have react-toastify configured

const UpdateClassWithSchoolId = () => {
    // Removed pupilType state and DEFAULT_PUPIL_TYPE
    const [schoolId, setSchoolId] = useState("");

    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [updatedCount, setUpdatedCount] = useState(0);
    const [totalDocs, setTotalDocs] = useState(0);
    const [message, setMessage] = useState("");
    const [processedCount, setProcessedCount] = useState(0); // For UI progress

    const handleUpdate = async () => {
        const schoolIdToUse = schoolId.trim();

        // 1. Validation (Only checking School ID)
        if (!schoolIdToUse) {
            toast.error("Please enter a valid School ID.");
            return;
        }

        const confirmMessage = `⚠️ MASS OVERWRITE: Are you sure you want to set ALL documents in the 'Classes' collection to schoolId=${schoolIdToUse}? This will ADD the field if missing and OVERWRITE it if it exists.`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setIsUpdating(true);
        setProgress(0);
        setUpdatedCount(0);
        setProcessedCount(0);
        setMessage("");

        try {
            // NOTE: Targeting the 'Classes' collection as indicated in your code
            const collectionRef = collection(db, "TeacherAssignments"); 
            const snapshot = await getDocs(collectionRef);
            const total = snapshot.size;
            setTotalDocs(total);

            let count = 0;
            let documentsProcessed = 0;

            // 2. Define the update payload (Only schoolId)
            const updates = {
                schoolId: schoolIdToUse,
            };

            for (const classDoc of snapshot.docs) {
                // Apply the update to every document
                await updateDoc(doc(db, "TeacherAssignments", classDoc.id), updates);

                count++;
                documentsProcessed++;

                // Update state for progress bar
                setProcessedCount(documentsProcessed);
                setProgress(Math.round((documentsProcessed / total) * 100));
            }

            setUpdatedCount(count);
            toast.success(`✅ Done! School ID set/updated for all ${count} class records.`);
            setMessage(`✅ Done! School ID set/updated for all ${count} records in 'Classes'.`);
        } catch (error) {
            console.error("Error updating fields:", error);
            toast.error("❌ An error occurred while updating records.");
            setMessage("❌ An error occurred while updating records.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4 text-red-700">
                    ⚠️ GLOBAL School ID Set/Overwrite Tool
                </h1>
                <p className="text-gray-600 mb-6 text-sm bg-yellow-100 p-3 border-l-4 border-red-500 font-semibold">
                    This tool will **SET** or **OVERWRITE** the **schoolId** field on **ALL** documents in the **`Classes`** collection.
                </p>

                {/* School ID Input (REQUIRED) */}
                <div className="mb-6 text-left">
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                        1. School ID Value:
                    </label>
                    <input
                        type="text"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full p-3 border-2 border-red-400 rounded-lg text-center font-semibold uppercase"
                        placeholder="e.g., f541b0c1"
                        disabled={isUpdating}
                    />
                </div>
                
                {/* Removed Pupil Type Input */}

                {/* Button */}
                <button
                    // Disabled check only requires schoolId now
                    onClick={handleUpdate}
                    disabled={isUpdating || !schoolId.trim()} 
                    className={`px-6 py-3 rounded-lg text-white font-semibold transition w-full ${
                        isUpdating ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
                    }`}
                >
                    {isUpdating ? "Processing..." : "START GLOBAL SET/OVERWRITE"}
                </button>

                {/* Progress Bar */}
                {isUpdating && (
                    <div className="w-full mt-6 bg-gray-200 rounded-full h-4">
                        <div
                            className="bg-green-500 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}

                {/* Progress Text */}
                {isUpdating && (
                    <p className="mt-2 text-gray-700 text-sm">
                        {progress}% completed ({processedCount}/{totalDocs} updated)
                    </p>
                )}

                {/* Message */}
                {message && (
                    <p className="mt-4 text-md font-semibold text-gray-800">{message}</p>
                )}
            </div>
        </div>
    );
};

export default UpdateClassWithSchoolId;