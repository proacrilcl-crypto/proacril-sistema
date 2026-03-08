import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, runTransaction, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmCk-Ca0BYPSL-9Wt-4UyqIAHhTt-7QH0",
  authDomain: "asociados-pa-sistema-1c624.firebaseapp.com",
  projectId: "asociados-pa-sistema-1c624",
  storageBucket: "asociados-pa-sistema-1c624.firebasestorage.app",
  messagingSenderId: "836387608363",
  appId: "1:836387608363:web:12c4dc20bd13765488d76e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, runTransaction, setDoc };
