// Datanase/SchoolResults.jsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyB7QkKYE5FZfUtVJTL4QTGIPN2p3em2IGA",
  authDomain: "christstandardgrades.firebaseapp.com",
  projectId: "christstandardgrades",
  storageBucket: "christstandardgrades.firebasestorage.app",
  messagingSenderId: "45136419510",
  appId: "1:45136419510:web:91a8fdaff2d1e209a7e417",
  measurementId: "G-P1CK26TEVX"
};

// Initialize Firebase with a unique name: "schoolResultsApp"
const schoolapp = initializeApp(firebaseConfig, "schoolResultsApp"); // ⭐️ FIX IS HERE
const analytics = getAnalytics(schoolapp);
const schooldb = getFirestore(schoolapp);

export { schooldb };