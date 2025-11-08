// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB7FTuUkFPhiYnEGTAvILrCGX9grcEiRFc",
  authDomain: "dashboard-evaluasi-shift.firebaseapp.com",
  projectId: "dashboard-evaluasi-shift",
  storageBucket: "dashboard-evaluasi-shift.firebasestorage.app",
  messagingSenderId: "942107699749",
  appId: "1:942107699749:web:cb40b9ab2ef457ca496dcc",
  measurementId: "G-RSY6GG4ZJY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };