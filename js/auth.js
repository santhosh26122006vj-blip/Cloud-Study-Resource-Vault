/** Student-only Firebase Authentication module. */
import {
  auth, db, isConfigured, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail, updateProfile, doc, getDoc, setDoc, serverTimestamp
} from './firebase-config.js';
import { showToast } from './ui.js';

let currentUserProfile = null;

export function getFriendlyErrorMessage(error) {
  if (!error) return "An unexpected error occurred.";
  const code = error.code || "";
  switch (code) {
    case 'auth/email-already-in-use': return "This email is already registered. Please sign in instead.";
    case 'auth/invalid-email': return "Please enter a valid email address.";
    case 'auth/operation-not-allowed': return "Email/Password sign-in is not enabled in Firebase Console. Enable it under Authentication > Sign-in method.";
    case 'auth/weak-password': return "Password should be at least 6 characters long.";
    case 'auth/user-disabled': return "This account has been disabled.";
    case 'auth/user-not-found': return "No account found with this email. Please create an account first.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return "Incorrect email or password. If you haven't registered yet, please create an account first.";
    case 'auth/too-many-requests': return "Too many failed attempts. Please wait a moment or reset your password.";
    case 'auth/network-request-failed': return "Network connection error. Please check your internet connection.";
    case 'permission-denied': return "Access denied. Please check your Firebase security rules.";
    default: return error.message || "An unknown error occurred. Please try again.";
  }
}

export async function registerStudent(name, email, password, confirmPassword) {
  if (!name || !email || !password || !confirmPassword) throw new Error("Please fill in all required fields.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
  if (password !== confirmPassword) throw new Error("Passwords do not match. Please re-enter.");

  if (!isConfigured) {
    const demoUser = { uid: "user-" + Date.now(), name, email, createdAt: new Date().toISOString() };
    currentUserProfile = demoUser;
    localStorage.setItem('study_vault_mock_user', JSON.stringify(demoUser));
    return { user: demoUser };
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await updateProfile(user, { displayName: name });
  const userData = { uid: user.uid, name, email, createdAt: serverTimestamp() };
  await setDoc(doc(db, "users", user.uid), userData);
  currentUserProfile = { uid: user.uid, ...userData };
  return { user };
}

export async function loginUser(email, password) {
  if (!email || !password) throw new Error("Please enter both email and password.");

  if (!isConfigured) {
    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const mockUser = { uid: "user-demo-" + email.toLowerCase(), name: name.charAt(0).toUpperCase() + name.slice(1), email, createdAt: new Date().toISOString() };
    currentUserProfile = mockUser;
    localStorage.setItem('study_vault_mock_user', JSON.stringify(mockUser));
    return { user: mockUser };
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  let profile = null;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) profile = snap.data();
  } catch (error) {
    console.warn("Could not fetch user profile; using Firebase Auth profile.", error);
  }
  currentUserProfile = { uid: user.uid, name: profile?.name || user.displayName || email.split('@')[0], email: user.email || email };
  return { user, profile: currentUserProfile };
}

export async function logoutUser() {
  currentUserProfile = null;
  localStorage.removeItem('study_vault_mock_user');
  if (isConfigured && auth) {
    try { await signOut(auth); } catch (e) { console.warn("Sign out error:", e); }
  }
  showToast("Logged Out", "You have been safely signed out.", "info");
  setTimeout(() => { window.location.href = 'login.html'; }, 400);
}

export async function resetPassword(email) {
  if (!email) throw new Error("Please enter your email address to receive the reset link.");
  if (!isConfigured) { showToast("Demo Mode", "Password reset email simulated for: " + email, "info"); return; }
  await sendPasswordResetEmail(auth, email);
}

export async function fetchUserProfile(uid) {
  if (currentUserProfile && currentUserProfile.uid === uid) return currentUserProfile;
  if (!isConfigured) {
    const raw = localStorage.getItem('study_vault_mock_user');
    if (raw) { currentUserProfile = JSON.parse(raw); return currentUserProfile; }
    return null;
  }
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      currentUserProfile = { uid, name: data.name || auth.currentUser?.displayName || 'Student', email: data.email || auth.currentUser?.email || '' };
      return currentUserProfile;
    }
  } catch (err) { console.warn("Error fetching user profile from Firestore:", err); }
  currentUserProfile = { uid, name: auth.currentUser?.displayName || 'Student', email: auth.currentUser?.email || '' };
  return currentUserProfile;
}

export function initAuthGuard(options = { requireAuth: true, publicOnly: false }, onUserReady = null) {
  if (!isConfigured) {
    const raw = localStorage.getItem('study_vault_mock_user');
    const mockUser = raw ? JSON.parse(raw) : null;
    if (options.publicOnly) { if (mockUser && onUserReady) onUserReady(mockUser); return; }
    if (options.requireAuth && !mockUser) { window.location.href = 'login.html'; return; }
    updateNavbarUser(mockUser || { name: 'Student' });
    if (onUserReady) onUserReady(mockUser);
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (options.publicOnly) {
      if (user && onUserReady) onUserReady(await fetchUserProfile(user.uid), user);
      return;
    }
    if (options.requireAuth && !user) { window.location.href = 'login.html'; return; }
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      updateNavbarUser(profile);
      if (onUserReady) onUserReady(profile, user);
    } else if (onUserReady) onUserReady(null, null);
  });
}

function updateNavbarUser(profile) {
  if (!profile) return;
  document.querySelectorAll('.user-display-name').forEach(el => { el.textContent = profile.name || 'Student'; });
  document.querySelectorAll('.user-display-role').forEach(el => {
    el.textContent = 'STUDENT';
    el.className = 'badge badge-primary user-display-role';
    el.style.fontSize = '0.65rem'; el.style.padding = '0.15rem 0.45rem';
  });
  document.querySelectorAll('.user-avatar-circle').forEach(el => {
    el.textContent = (profile.name || profile.email || 'S').charAt(0).toUpperCase();
    el.style.background = 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)';
  });
  document.querySelectorAll('.logout-trigger-btn').forEach(btn => { btn.onclick = (e) => { e.preventDefault(); logoutUser(); }; });
}
