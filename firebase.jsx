// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyCTKz6HzMkfCFqjKacgCYGiTnY6u22Ktic",
  authDomain: "christstandard-sl.firebaseapp.com",
  projectId: "christstandard-sl",
  storageBucket: "christstandard-sl.firebasestorage.app",
  messagingSenderId: "857867450125",
  appId: "1:857867450125:web:9415a40e8ceed3cd5b6244",
  measurementId: "G-F0WYW05EF7"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };
