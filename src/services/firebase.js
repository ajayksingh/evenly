import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

// Firebase free tier config - using demo project
// Replace with your own Firebase config from console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyDemo_REPLACE_WITH_YOUR_KEY",
  authDomain: "splitwise-demo.firebaseapp.com",
  projectId: "splitwise-demo",
  storageBucket: "splitwise-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:demo",
};

let app, auth, db, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.log('Firebase init error - using local mode:', error.message);
}

export { auth, db, storage };
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  ref,
  uploadBytes,
  getDownloadURL,
};
