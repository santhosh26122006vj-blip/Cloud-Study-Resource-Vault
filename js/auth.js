/**
 * Authentication Module for Cloud Study Resource Vault
 * Handles Registration, Login, Logout, Password Reset, and Role-Based Route Guards.
 */

import {
  auth,
  db,
  isConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from './firebase-config.js';

import { showToast } from './ui.js';

let currentUserProfile = null;

// ============================================================================
// MAP FIREBASE ERROR CODES TO HUMAN-FRIENDLY STRINGS
// ============================================================================
export function getFriendlyErrorMessage(error) {
  if (!error) return "An unexpected error occurred.";
  const code = error.code || "";
  
  switch (code) {
    case 'auth/email-already-in-use':
      return "This email is already registered. Please log in instead.";
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    case 'auth/operation-not-allowed':
      return "Email/Password sign-in is not enabled in Firebase Console.";
    case 'auth/weak-password':
      return "The password is too weak. Please use at least 6 characters.";
    case 'auth/user-disabled':
      return "This user account has been disabled by an administrator.";
    case 'auth/user-not-found':
      return "No account found with this email address.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "Incorrect email or password. Please verify and try again.";
    case 'auth/too-many-requests':
      return "Too many failed login attempts. Please reset your password or wait a moment.";
    case 'auth/network-request-failed':
      return "Network connection error. Please check your internet connection.";
    case 'permission-denied':
      return "Access denied. Insufficient permissions to complete this action.";
    default:
      return error.message || "An unknown error occurred. Please try again.";
  }
}

// ============================================================================
// REGISTER USER
// ============================================================================
export async function registerStudent(name, email, password, confirmPassword) {
  // Client-side validations
  if (!name || !email || !password || !confirmPassword) {
    throw new Error("Please fill in all required fields.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match. Please re-enter.");
  }

  if (!isConfigured) {
    // If Firebase keys aren't set yet, show friendly prompt
    showToast("Setup Note", "Using local demo profile since Firebase is not yet configured with real API keys.", "warning");
    const demoUser = {
      uid: "demo-user-123",
      email: email,
      displayName: name
    };
    localStorage.setItem('study_vault_mock_user', JSON.stringify({
      uid: demoUser.uid,
      name: name,
      email: email,
      role: 'student',
      createdAt: new Date().toISOString()
    }));
    window.location.href = 'dashboard.html';
    return;
  }

  // 1. Create Firebase Auth account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // 2. Update display name in Firebase Auth
  await updateProfile(user, { displayName: name });

  // 3. Store user record in Firestore
  const userDocRef = doc(db, "users", user.uid);
  const userData = {
    name: name,
    email: email,
    role: "student", // default role
    createdAt: serverTimestamp()
  };
  await setDoc(userDocRef, userData);

  return user;
}

// ============================================================================
// LOGIN USER
// ============================================================================
export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error("Please enter both email and password.");
  }

  if (!isConfigured) {
    showToast("Setup Note", "Using demo login since Firebase credentials are still placeholders.", "info");
    const role = email.toLowerCase().includes('admin') ? 'admin' : 'student';
    localStorage.setItem('study_vault_mock_user', JSON.stringify({
      uid: "demo-user-123",
      name: email.split('@')[0],
      email: email,
      role: role,
      createdAt: new Date().toISOString()
    }));
    window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
    return;
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Fetch Firestore role
  let role = 'student';
  try {
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (userDocSnap.exists()) {
      role = userDocSnap.data().role || 'student';
    }
  } catch (e) {
    console.warn("Could not read user role from Firestore, defaulting to student:", e);
  }

  return { user, role };
}

// ============================================================================
// LOGOUT USER
// ============================================================================
export async function logoutUser() {
  localStorage.removeItem('study_vault_mock_user');
  if (isConfigured && auth) {
    await signOut(auth);
  }
  showToast("Logged Out", "You have been safely signed out.", "info");
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 500);
}

// ============================================================================
// PASSWORD RESET
// ============================================================================
export async function resetPassword(email) {
  if (!email) {
    throw new Error("Please enter your email address to receive the reset link.");
  }
  if (!isConfigured) {
    showToast("Demo Mode", "Password reset email simulated for: " + email, "info");
    return;
  }
  await sendPasswordResetEmail(auth, email);
}

// ============================================================================
// GET CURRENT USER PROFILE
// ============================================================================
export async function fetchUserProfile(uid) {
  if (currentUserProfile && currentUserProfile.uid === uid) {
    return currentUserProfile;
  }

  if (!isConfigured) {
    const raw = localStorage.getItem('study_vault_mock_user');
    if (raw) {
      currentUserProfile = JSON.parse(raw);
      return currentUserProfile;
    }
    return { uid: 'demo-123', name: 'Demo Student', email: 'student@studyvault.edu', role: 'student' };
  }

  try {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
      currentUserProfile = { uid, ...docSnap.data() };
      return currentUserProfile;
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
  }

  return {
    uid: uid,
    name: auth.currentUser?.displayName || 'Student',
    email: auth.currentUser?.email || '',
    role: 'student'
  };
}

// ============================================================================
// ROUTE GUARDS & AUTH STATE DETECTOR
// ============================================================================
export function initAuthGuard(options = { requireAuth: true, requireAdmin: false, publicOnly: false }, onUserReady = null) {
  // If not configured, check mock user
  if (!isConfigured) {
    const raw = localStorage.getItem('study_vault_mock_user');
    const mockUser = raw ? JSON.parse(raw) : null;

    if (options.publicOnly && mockUser) {
      window.location.href = mockUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
      return;
    }

    if (options.requireAuth && !mockUser) {
      window.location.href = 'login.html';
      return;
    }

    if (options.requireAdmin && mockUser?.role !== 'admin') {
      showToast("Access Restricted", "Admin privileges required.", "error");
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
      return;
    }

    updateNavbarUser(mockUser || { name: 'Demo User', role: 'student' });
    if (onUserReady) onUserReady(mockUser);
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (options.publicOnly) {
      if (user) {
        const profile = await fetchUserProfile(user.uid);
        window.location.href = profile.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }
      return;
    }

    if (options.requireAuth) {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      const profile = await fetchUserProfile(user.uid);

      if (options.requireAdmin && profile.role !== 'admin') {
        showToast("Access Denied", "Administrator access only. Redirecting to student dashboard.", "error");
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
        return;
      }

      updateNavbarUser(profile);
      if (onUserReady) onUserReady(profile, user);
    } else {
      if (user) {
        const profile = await fetchUserProfile(user.uid);
        updateNavbarUser(profile);
      }
    }
  });
}

function updateNavbarUser(profile) {
  if (!profile) return;

  const nameEls = document.querySelectorAll('.user-display-name');
  nameEls.forEach(el => { el.textContent = profile.name || 'Student'; });

  const roleEls = document.querySelectorAll('.user-display-role');
  roleEls.forEach(el => {
    el.textContent = (profile.role || 'student').toUpperCase();
    if (profile.role === 'admin') {
      el.className = 'badge badge-warning text-xs';
    } else {
      el.className = 'badge badge-primary text-xs';
    }
  });

  const avatarEls = document.querySelectorAll('.user-avatar-circle');
  avatarEls.forEach(el => {
    const initial = (profile.name || 'S').charAt(0).toUpperCase();
    el.textContent = initial;
  });

  const logoutBtns = document.querySelectorAll('.logout-trigger-btn');
  logoutBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      logoutUser();
    };
  });
}
