// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyB3dq5_6D2q2FftKM4D6L7E05ZKIcvOy2I",
  authDomain: "pupilspaymentregistry.firebaseapp.com",
  projectId: "pupilspaymentregistry",
  storageBucket: "pupilspaymentregistry.firebasestorage.app",
  messagingSenderId: "256105207194",
  appId: "1:256105207194:web:04bca029d15be29670d623",
  measurementId: "G-9SH194HTHV"
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "pupilspaymentregistry"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const ppr = getFirestore(schoolapp);

export { ppr };