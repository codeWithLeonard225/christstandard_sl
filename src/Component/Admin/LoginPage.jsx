import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";


const LoginPage = () => {
  const [userID, setUserID] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedUserID = userID.trim().toLowerCase();
    const trimmedUserName = userName.trim().toLowerCase();

    try {
      // 1️⃣ Pupils
      const pupilQuery = query(
        collection(db, "PupilsReg"),
        where("studentID", "==", trimmedUserID),
        where("studentName", "==", trimmedUserName)
      );
      const pupilSnap = await getDocs(pupilQuery);

      if (!pupilSnap.empty) {
        const pupil = pupilSnap.docs[0].data();
        setUser({ role: "pupil", data: pupil });
        navigate("/PupilsDashboard", { state: { pupil } });
        return;
      }

      // 2️⃣ Admin
      const adminQuery = query(
        collection(db, "Admins"),
        where("adminID", "==", trimmedUserID),
        where("adminName", "==", trimmedUserName)
      );
      const adminSnap = await getDocs(adminQuery);

      if (!adminSnap.empty) {
        const admin = adminSnap.docs[0].data();
        setUser({ role: "admin", data: admin });
        navigate("/admin");
        return;
      }

      // 3️⃣ Teacher / Staff
      const teacherQuery = query(
        collection(db, "Teachers"),
        where("teacherID", "==", trimmedUserID),
        where("teacherName", "==", trimmedUserName)
      );
      const teacherSnap = await getDocs(teacherQuery);

      if (!teacherSnap.empty) {
        const teacher = teacherSnap.docs[0].data();
        // Pass teacher name and photo to context
        setUser({ role: "teacher", data: { ...teacher } });
        navigate("/teacher", { state: { teacherName: teacher.teacherName, userPhoto: teacher.userPhoto } });
        return;
      }

      // 4️⃣ CEO
      const ceoQuery = query(
        collection(db, "CEOs"),
        where("ceoID", "==", trimmedUserID),
        where("ceoName", "==", trimmedUserName)
      );
      const ceoSnap = await getDocs(ceoQuery);

      if (!ceoSnap.empty) {
        const ceo = ceoSnap.docs[0].data();
        setUser({ role: "ceo", data: ceo });
        navigate("/ceo");
        return;
      }

      // ❌ Not found
      setError("Invalid ID or Name");
    } catch (err) {
      console.error(err);
      setError("Error connecting to database");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-700 mb-6 text-center">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
         <div className="relative">
  <label className="block text-gray-700 font-semibold mb-1">ID</label>
  <input
    type={showPassword ? "text" : "password"}
    value={userID}
    onChange={(e) => setUserID(e.target.value)}
    className="w-full border p-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 pr-10"
    required
    disabled={loading}
    placeholder="Enter your ID"
  />
  <span
    className="absolute right-3 top-9 text-gray-500 cursor-pointer"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? <FaEyeSlash /> : <FaEye />}
  </span>
</div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full border p-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className={`w-full p-2 rounded-lg font-semibold transition ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-700 text-white hover:bg-indigo-800"
            }`}
            disabled={loading}
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
