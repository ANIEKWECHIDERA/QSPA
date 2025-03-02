// This file is used to initialize the Firebase app and export the auth, db, and analytics services.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB1LZP22zCiCskUnx5iPgN8NUy4fVE4PSk",
  authDomain: "qspa-a4f23.firebaseapp.com",
  projectId: "qspa-a4f23",
  storageBucket: "qspa-a4f23.firebasestorage.app",
  messagingSenderId: "326037271165",
  appId: "1:326037271165:web:6657dc0e28b6c253cf7714",
  measurementId: "G-2N9XD6C1G7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export { doc };
