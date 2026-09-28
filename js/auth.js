/**
 * Authentication Module for Cloud Study Resource Vault
 * Handles Registration, Login, Logout, Password Reset, and Role-Based Guards.
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
      return "This email is already registered. Please sign in instead.";
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    case 'auth/operation-not-allowed':
      return "Email/Password sign-in is not enabled in Firebase Console. Enable it under Authentication > Sign-in method.";
    case 'auth/weak-password':
      return "Password should be at least 6 characters long.";
    case 'auth/user-disabled':
      return "This account has been disabled by an administrator.";
    case 'auth/user-not-found':
      return "No account found with this email. Please click 'Create Account' to register.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "Incorrect email or password. If you haven't registered yet, please create an account first.";
    case 'auth/too-many-requests':
      return "Too many failed attempts. Please wait a moment or reset your password.";
    case 'auth/network-request-failed':
      return "Network connection error. Please check your internet connection.";
    case 'permission-denied':
      return "Access denied. Insufficient permissions in Cloud Firestore.";
    default:
      return error.message || "An unknown error occurred. Please try again.";
  }
}

// ============================================================================
// REGISTER STUDENT
// ============================================================================
export async function registerStudent(name, email, password, confirmPassword) {
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

  const role = email.toLowerCase().includes('admin') ? 'admin' : 'student';

  // 1. Fallback if Firebase keys are still placeholders
  if (!isConfigured) {
    const demoUser = {
      uid: "user-" + Date.now(),
      name: name,
      email: email,
      role: role,
      createdAt: new Date().toISOString()
    };
    currentUserProfile = demoUser;
    localStorage.setItem('study_vault_mock_user', JSON.stringify(demoUser));
    return demoUser;
  }

  // 2. Real Firebase Authentication account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Update display name
  await updateProfile(user, { displayName: name });

  // Store user document in Firestore users/{uid}
  const userDocRef = doc(db, "users", user.uid);
  const userData = {
    uid: user.uid,
    name: name,
    email: email,
    role: role,
    createdAt: serverTimestamp()
  };
  await setDoc(userDocRef, userData);

  currentUserProfile = { uid: user.uid, ...userData };
  return user;
}

// ============================================================================
// LOGIN USER
// ============================================================================
export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error("Please enter both email and password.");
  }

  // 1. Fallback mode if Firebase keys not configured
  if (!isConfigured) {
    const role = email.toLowerCase().includes('admin') ? 'admin' : 'student';
    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const mockUser = {
      uid: "user-" + (role === 'admin' ? 'admin-123' : 'student-123'),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email: email,
      role: role,
      createdAt: new Date().toISOString()
    };
    currentUserProfile = mockUser;
    localStorage.setItem('study_vault_mock_user', JSON.stringify(mockUser));
    return { user: mockUser, role };
  }

  // 2. Real Firebase Auth Login
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    // If demo credentials used and account doesn't exist yet in Firebase, auto-provision it!
    const isDemo = (email === 'student@studyvault.edu' || email === 'admin@studyvault.edu') && password.length >= 6;
    if (isDemo && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
      const role = email.includes('admin') ? 'admin' : 'student';
      const name = role === 'admin' ? 'System Administrator' : 'Demo Student';
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          name,
          email,
          role,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Could not save initial user doc:", e);
      }
      currentUserProfile = { uid: userCredential.user.uid, name, email, role };
      return { user: userCredential.user, role };
    }
    throw error;
  }

  const user = userCredential.user;

  // Fetch role from Firestore
  let role = 'student';
  try {
    const rolePromise = getDoc(doc(db, "users", user.uid));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
    const userDocSnap = await Promise.race([rolePromise, timeoutPromise]);
    if (userDocSnap && userDocSnap.exists()) {
      role = userDocSnap.data().role || 'student';
    }
  } catch (e) {
    if (email.toLowerCase().includes('admin')) {
      role = 'admin';
    }
  }

  currentUserProfile = {
    uid: user.uid,
    name: user.displayName || email.split('@')[0],
    email: user.email,
    role
  };

  return { user, role };
}

// ============================================================================
// LOGOUT USER
// ============================================================================
export async function logoutUser() {
  currentUserProfile = null;
  localStorage.removeItem('study_vault_mock_user');
  
  if (isConfigured && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out error:", e);
    }
  }

  showToast("Logged Out", "You have been safely signed out.", "info");
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
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
    console.warn("Error fetching user profile from Firestore:", err);
  }

  const role = auth.currentUser?.email?.includes('admin') ? 'admin' : 'student';
  return {
    uid: uid,
    name: auth.currentUser?.displayName || 'Student',
    email: auth.currentUser?.email || '',
    role
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

    if (options.publicOnly) {
      if (mockUser && onUserReady) {
        onUserReady(mockUser);
      }
      return;
    }

    if (options.requireAuth && !mockUser) {
      window.location.href = 'login.html';
      return;
    }

    if (options.requireAdmin && mockUser?.role !== 'admin') {
      showToast("Access Denied", "Administrator access required.", "error");
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
      return;
    }

    updateNavbarUser(mockUser || { name: 'Demo Student', role: 'student' });
    if (onUserReady) onUserReady(mockUser);
    return;
  }

  // Real Firebase onAuthStateChanged
  onAuthStateChanged(auth, async (user) => {
    if (options.publicOnly) {
      if (user) {
        const profile = await fetchUserProfile(user.uid);
        if (onUserReady) {
          onUserReady(profile, user);
        }
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
        showToast("Access Denied", "Administrator access required.", "error");
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 800);
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

  const isAdmin = profile.role === 'admin';

  const nameEls = document.querySelectorAll('.user-display-name');
  nameEls.forEach(el => { el.textContent = profile.name || (isAdmin ? 'Admin' : 'Student'); });

  const roleEls = document.querySelectorAll('.user-display-role');
  roleEls.forEach(el => {
    el.textContent = isAdmin ? 'ADMIN' : 'STUDENT';
    el.className = isAdmin ? 'badge badge-warning user-display-role' : 'badge badge-primary user-display-role';
    el.style.fontSize = '0.65rem';
    el.style.padding = '0.15rem 0.45rem';
  });

  const avatarEls = document.querySelectorAll('.user-avatar-circle');
  avatarEls.forEach(el => {
    const initial = (profile.name || profile.email || (isAdmin ? 'A' : 'S')).charAt(0).toUpperCase();
    el.textContent = initial;
    if (isAdmin) {
      el.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)';
    }
  });

  // Toggle visibility of admin-only navigation/action buttons
  const adminOnlyEls = document.querySelectorAll('.admin-only');
  adminOnlyEls.forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  const logoutBtns = document.querySelectorAll('.logout-trigger-btn');
  logoutBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      logoutUser();
    };
  });
}
