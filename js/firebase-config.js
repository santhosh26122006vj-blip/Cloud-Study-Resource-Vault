/**
 * Cloud Study Resource Vault - Centralized Firebase Configuration
 * 
 * 100% Spark (Free) Plan Compatible:
 * - Firebase Authentication
 * - Cloud Firestore Database
 * - ZERO Firebase Storage dependency
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

// ============================================================================
// FIREBASE CONFIGURATION (Spark Plan: Auth + Firestore only)
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBbZGXvTGaVifVZtaumTYE_rJzExvou2_o",
  authDomain: "cloud-study-resource-vault.firebaseapp.com",
  projectId: "cloud-study-resource-vault",
  messagingSenderId: "985626683684",
  appId: "1:985626683684:web:aae6864f1bf936da7aabb1",
  measurementId: "G-3LMX4T5FLY"
};

// Check if credentials are valid
export const isConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);

// Initialize Firebase instances (Auth & Firestore only)
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase initialization notice:", error);
}

export { 
  app, 
  auth, 
  db,
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
  writeBatch
};
