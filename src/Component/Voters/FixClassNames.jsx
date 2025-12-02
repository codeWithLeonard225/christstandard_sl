import React, { useState } from "react";
import { db } from "../../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

const FixClassNames = () => {
  const [status, setStatus] = useState("");

  const fixClassNames = async () => {
    try {
      setStatus("⏳ Scanning ClassesAndSubjects...");

      const snap = await getDocs(collection(db, "ClassesAndSubjects"));

      if (snap.empty) {
        setStatus("⚠️ No documents found.");
        return;
      }

      let updated = 0;
      let skipped = 0;

      for (const d of snap.docs) {
        const data = d.data();

        if (!data.className) {
          skipped++;
          continue;
        }

        const original = data.className;
        const cleaned = original.trim();

        if (original === cleaned) {
          skipped++;
          continue;
        }

        // 🔥 Update Firestore document
        await updateDoc(doc(db, "ClassesAndSubjects", d.id), {
          className: cleaned,
        });

        updated++;
      }

      setStatus(`✅ Done! Updated: ${updated}, Skipped: ${skipped}`);

    } catch (error) {
      console.error(error);
      setStatus("❌ Error updating class names.");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px" }}>
      <h2>Clean Up Class Names (Remove Extra Spaces)</h2>

      <button
        onClick={fixClassNames}
        style={{
          padding: "10px 20px",
          background: "green",
          color: "white",
          border: "none",
          cursor: "pointer",
          marginTop: "10px",
        }}
      >
        Fix className Fields
      </button>

      <p style={{ marginTop: "15px" }}>{status}</p>
    </div>
  );
};

export default FixClassNames;
