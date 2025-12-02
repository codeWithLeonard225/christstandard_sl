import React, { useState } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";

const CopyPupilGrades = () => {
  const [schoolId, setSchoolId] = useState("");
  const [status, setStatus] = useState("");

  const handleCopy = async () => {
    if (!schoolId) {
      setStatus("❌ Please enter schoolId");
      return;
    }

    try {
      setStatus("⏳ Loading grades...");

      // 🔹 Read from main database
      const sourceQuery = query(
        collection(db, "PupilGrades"),
        where("schoolId", "==", schoolId)
      );

      const snapshot = await getDocs(sourceQuery);

      if (snapshot.empty) {
        setStatus("⚠️ No grades found for this schoolId.");
        return;
      }

      setStatus(`📦 Found ${snapshot.size} records. Copying...`);

      // 🔹 Write each record into your local schooldb
      for (const doc of snapshot.docs) {
        const data = doc.data();

        await addDoc(collection(schooldb, "PupilGrades"), data);
      }

      setStatus("✅ Copy completed successfully!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error copying data.");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px" }}>
      <h2>Copy Pupil Grades (db ➜ schooldb)</h2>

      <input
        type="text"
        placeholder="Enter schoolId"
        value={schoolId}
        onChange={(e) => setSchoolId(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />

      <button
        onClick={handleCopy}
        style={{
          padding: "10px 20px",
          background: "blue",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Copy Grades
      </button>

      <p style={{ marginTop: "10px" }}>{status}</p>
    </div>
  );
};

export default CopyPupilGrades;
