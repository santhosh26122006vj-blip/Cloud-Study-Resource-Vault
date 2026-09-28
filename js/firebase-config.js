/**
 * Cloud Study Resource Vault - Centralized Firebase Configuration
 * 
 * IMPORTANT FOR SETUP:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new Firebase Project (or select existing)
 * 3. Add a Web App (</>) to your project
 * 4. Copy your firebaseConfig object and paste your credentials below.
 * 
 * Enabled Services Required in Firebase Console:
 * - Authentication -> Sign-in method -> Email/Password: Enable
 * - Firestore Database -> Create database (Start in test mode or deploy rules)
 * - Firebase Storage -> Get Started (Start in test mode or deploy rules)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ============================================================================
// PASTE YOUR FIREBASE PROJECT CONFIGURATION HERE
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBbZGXvTGaVifVZtaumTYE_rJzExvou2_o",
  authDomain: "cloud-study-resource-vault.firebaseapp.com",
  projectId: "cloud-study-resource-vault",
  storageBucket: "cloud-study-resource-vault.firebasestorage.app",
  messagingSenderId: "985626683684",
  appId: "1:985626683684:web:aae6864f1bf936da7aabb1",
  measurementId: "G-3LMX4T5FLY"
};

// Check if credentials have been replaced with real credentials
export const isConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);

// Initialize Firebase instances
let app;
let auth;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn("Firebase initialization warning (credentials may need setup):", error);
}

export { 
  app, 
  auth, 
  db, 
  storage,
  // Auth Functions
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  // Firestore Functions
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  writeBatch,
  // Storage Functions
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject
};
