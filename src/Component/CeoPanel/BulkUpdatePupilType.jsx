import React, { useState } from "react";
import { db } from "../../../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { toast } from "react-toastify"; // Assuming you have react-toastify configured

const BulkSetAllFields = () => {
  const DEFAULT_PUPIL_TYPE = "Regular";
  
  const [schoolId, setSchoolId] = useState("");
  const [pupilType, setPupilType] = useState(DEFAULT_PUPIL_TYPE);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [message, setMessage] = useState("");
  // ⭐ FIX: New state variable to track processed documents for the UI
  const [processedCount, setProcessedCount] = useState(0); 

  const handleUpdate = async () => {
    const schoolIdToUse = schoolId.trim();
    const pupilTypeToUse = pupilType.trim();

    if (!schoolIdToUse) {
      toast.error("Please enter a valid School ID.");
      return;
    }

    if (!pupilTypeToUse) {
      toast.error("Please enter a valid Pupil Type.");
      return;
    }

    const confirmMessage = `⚠️ MASS OVERWRITE: Are you sure you want to set ALL student records to schoolId=${schoolIdToUse} and pupilType=${pupilTypeToUse}? This will ADD the fields if missing and OVERWRITE them if they exist.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsUpdating(true);
    setProgress(0);
    setUpdatedCount(0);
    setProcessedCount(0); // ⭐ Reset the new state variable
    setMessage("");

    try {
      const pupilCollection = collection(db, "PupilsReg");
      // Fetch ALL documents
      const snapshot = await getDocs(pupilCollection);
      const total = snapshot.size;
      setTotalDocs(total);

      let count = 0;
      let documentsProcessed = 0; // Renamed local variable to avoid confusion

      // Define the update payload once
      const updates = {
        schoolId: schoolIdToUse,
        pupilType: pupilTypeToUse,
      };

      for (const studentDoc of snapshot.docs) {
        // Apply the update to every document
        await updateDoc(doc(db, "PupilsReg", studentDoc.id), updates);
        
        count++;

        documentsProcessed++;
        
        // ⭐ Update the state variable used in the JSX
        setProcessedCount(documentsProcessed); 
        setProgress(Math.round((documentsProcessed / total) * 100));
      }

      setUpdatedCount(count);
      toast.success(`✅ Done! Successfully set/updated fields for all ${count} records.`);
      setMessage(`✅ Done! Successfully set/updated fields for all ${count} records.`);
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
          ⚠️ GLOBAL Field Set/Overwrite Tool
        </h1>
        <p className="text-gray-600 mb-6 text-sm bg-yellow-100 p-3 border-l-4 border-red-500 font-semibold">
          This tool will **SET** or **OVERWRITE** the <strong>schoolId</strong> 
          and <strong>pupilType</strong> fields on **ALL** pupil records.
        </p>

        {/* School ID Input */}
        <div className="mb-4 text-left">
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

        {/* Pupil Type Input */}
        <div className="mb-6 text-left">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            2. Pupil Type Value:
          </label>
          <input
            type="text"
            value={pupilType}
            onChange={(e) => setPupilType(e.target.value)}
            className="w-full p-3 border-2 border-orange-400 rounded-lg text-center font-semibold"
            placeholder={DEFAULT_PUPIL_TYPE}
            disabled={isUpdating}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleUpdate}
          disabled={isUpdating || !schoolId.trim() || !pupilType.trim()}
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
            {progress}% completed ({processedCount}/{totalDocs} updated) {/* ⭐ FIX APPLIED HERE */}
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

export default BulkSetAllFields;