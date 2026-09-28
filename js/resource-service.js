/**
 * Resource Service for Cloud Study Resource Vault
 * Handles all CRUD operations with Cloud Firestore and Firebase Storage.
 */

import {
  db,
  storage,
  isConfigured,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from './firebase-config.js';

// ============================================================================
// LOCAL STORAGE MOCK HELPERS (When Firebase credentials not yet supplied)
// ============================================================================
function getMockResources() {
  return JSON.parse(localStorage.getItem('study_vault_mock_resources') || '[]');
}

function saveMockResources(list) {
  localStorage.setItem('study_vault_mock_resources', JSON.stringify(list));
}

function getMockFavorites() {
  return JSON.parse(localStorage.getItem('study_vault_mock_favorites') || '[]');
}

function saveMockFavorites(list) {
  localStorage.setItem('study_vault_mock_favorites', JSON.stringify(list));
}

// ============================================================================
// FETCH RESOURCES
// ============================================================================
export async function getAllResources() {
  if (!isConfigured) {
    return getMockResources();
  }

  try {
    const q = query(collection(db, "resources"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Falling back to unordered query if index is building:", error);
    const snapshot = await getDocs(collection(db, "resources"));
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Client-side sort by date
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }
}

export async function getRecentlyAddedResources(max = 6) {
  if (!isConfigured) {
    const list = getMockResources();
    return list.slice(0, max);
  }

  try {
    const q = query(collection(db, "resources"), orderBy("createdAt", "desc"), limit(max));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Unordered query fallback for recent resources:", error);
    const all = await getAllResources();
    return all.slice(0, max);
  }
}

export async function getUserResources(userId) {
  if (!isConfigured) {
    return getMockResources().filter(r => r.uploadedBy === userId);
  }

  try {
    const q = query(collection(db, "resources"), where("uploadedBy", "==", userId));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  } catch (error) {
    console.error("Error fetching user resources:", error);
    throw error;
  }
}

// ============================================================================
// FAVORITES HANDLING
// ============================================================================
export async function getUserFavoriteIds(userId) {
  if (!userId) return new Set();

  if (!isConfigured) {
    const favs = getMockFavorites().filter(f => f.userId === userId);
    return new Set(favs.map(f => f.resourceId));
  }

  try {
    const q = query(collection(db, "favorites"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const ids = new Set();
    snapshot.docs.forEach(d => {
      ids.add(d.data().resourceId);
    });
    return ids;
  } catch (error) {
    console.error("Error fetching favorite IDs:", error);
    return new Set();
  }
}

export async function getUserFavoriteResources(userId) {
  if (!userId) return [];
  const favIds = await getUserFavoriteIds(userId);
  if (favIds.size === 0) return [];

  const all = await getAllResources();
  return all.filter(r => favIds.has(r.id));
}

export async function toggleFavorite(userId, resourceId) {
  if (!userId) throw new Error("Must be logged in to favorite a resource.");

  const docId = `${userId}_${resourceId}`;

  if (!isConfigured) {
    let favs = getMockFavorites();
    const index = favs.findIndex(f => f.userId === userId && f.resourceId === resourceId);
    let isNowFavorited = false;
    if (index >= 0) {
      favs.splice(index, 1);
      isNowFavorited = false;
    } else {
      favs.push({
        id: docId,
        userId: userId,
        resourceId: resourceId,
        createdAt: new Date().toISOString()
      });
      isNowFavorited = true;
    }
    saveMockFavorites(favs);
    return isNowFavorited;
  }

  const favDocRef = doc(db, "favorites", docId);
  const docSnap = await getDoc(favDocRef);

  if (docSnap.exists()) {
    await deleteDoc(favDocRef);
    return false; // removed
  } else {
    await setDoc(favDocRef, {
      userId: userId,
      resourceId: resourceId,
      createdAt: serverTimestamp()
    });
    return true; // added
  }
}

// ============================================================================
// CREATE RESOURCE (Storage + Firestore)
// ============================================================================
export async function createResource({
  title,
  description,
  subject,
  category,
  semester,
  type,
  tags = [],
  file = null,
  externalUrl = '',
  currentUser,
  onProgress = null
}) {
  if (!title || !subject || !category) {
    throw new Error("Title, Subject, and Category are required.");
  }

  if (!file && !externalUrl) {
    throw new Error("Please either upload a file or provide an external link.");
  }

  const uploaderId = currentUser?.uid || "unknown-user";
  const uploaderName = currentUser?.name || currentUser?.displayName || "Student";

  // Mock mode fallback
  if (!isConfigured) {
    let mockUrl = externalUrl;
    let mockFileName = externalUrl ? "External Resource" : (file ? file.name : "document.pdf");
    let mockFileSize = file ? file.size : 0;

    if (file) {
      mockUrl = URL.createObjectURL(file);
    }

    const newRes = {
      id: "res-" + Date.now(),
      title,
      description,
      subject,
      category,
      semester: semester || "Other",
      type: type || "PDF",
      fileUrl: mockUrl,
      fileName: mockFileName,
      fileSize: mockFileSize,
      tags: tags,
      uploadedBy: uploaderId,
      uploaderName: uploaderName,
      createdAt: new Date().toISOString()
    };

    const currentList = getMockResources();
    currentList.unshift(newRes);
    saveMockResources(currentList);
    return newRes;
  }

  // 1. Prepare new Firestore document reference to obtain unique ID
  const resourcesCol = collection(db, "resources");
  const newDocRef = doc(resourcesCol);
  const resourceId = newDocRef.id;

  let fileUrl = externalUrl || "";
  let fileName = externalUrl ? "External Resource" : "";
  let fileSize = 0;

  // 2. Upload to Firebase Storage if a file was selected
  if (file) {
    fileName = file.name;
    fileSize = file.size;

    // Validate size (max 30MB)
    const MAX_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error("File exceeds maximum allowed size of 30MB.");
    }

    // Storage path: resources/{userId}/{resourceId}/{filename}
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `resources/${uploaderId}/${resourceId}/${cleanFileName}`;
    const fileStorageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(fileStorageRef, file);

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error("Storage upload error:", error);
          reject(new Error("File upload failed: " + error.message));
        },
        async () => {
          try {
            fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  // 3. Save metadata into Cloud Firestore
  const resourceData = {
    title,
    description: description || "",
    subject,
    category,
    semester: semester || "Other",
    type: type || "PDF",
    fileUrl,
    fileName,
    fileSize,
    tags,
    uploadedBy: uploaderId,
    uploaderName: uploaderName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(newDocRef, resourceData);

  return { id: resourceId, ...resourceData };
}

// ============================================================================
// UPDATE RESOURCE
// ============================================================================
export async function updateResource(resourceId, updatedData, newFile = null, currentUser = null, onProgress = null) {
  if (!resourceId) throw new Error("Missing resource ID.");

  if (!isConfigured) {
    const list = getMockResources();
    const index = list.findIndex(r => r.id === resourceId);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      if (newFile) {
        list[index].fileUrl = URL.createObjectURL(newFile);
        list[index].fileName = newFile.name;
        list[index].fileSize = newFile.size;
      }
      saveMockResources(list);
      return list[index];
    }
    throw new Error("Resource not found in local mock.");
  }

  const docRef = doc(db, "resources", resourceId);

  // If replaced file
  if (newFile && currentUser) {
    const cleanFileName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `resources/${currentUser.uid}/${resourceId}/${cleanFileName}`;
    const fileStorageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileStorageRef, newFile);

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        reject,
        async () => {
          updatedData.fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          updatedData.fileName = newFile.name;
          updatedData.fileSize = newFile.size;
          resolve();
        }
      );
    });
  }

  updatedData.updatedAt = serverTimestamp();
  await updateDoc(docRef, updatedData);
}

// ============================================================================
// DELETE RESOURCE
// ============================================================================
export async function deleteResource(resourceId, fileUrl) {
  if (!resourceId) throw new Error("Missing resource ID.");

  if (!isConfigured) {
    let list = getMockResources();
    list = list.filter(r => r.id !== resourceId);
    saveMockResources(list);

    // Remove favorites
    let favs = getMockFavorites();
    favs = favs.filter(f => f.resourceId !== resourceId);
    saveMockFavorites(favs);
    return;
  }

  // 1. Delete Firestore resource doc
  await deleteDoc(doc(db, "resources", resourceId));

  // 2. Delete file from Storage if applicable
  if (fileUrl && fileUrl.includes("firebasestorage.googleapis.com")) {
    try {
      const fileRef = ref(storage, fileUrl);
      await deleteObject(fileRef);
    } catch (e) {
      console.warn("Storage file could not be deleted or was already removed:", e);
    }
  }

  // 3. Clean up related favorites
  try {
    const favQuery = query(collection(db, "favorites"), where("resourceId", "==", resourceId));
    const favSnaps = await getDocs(favQuery);
    for (const d of favSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn("Could not delete related favorite documents:", e);
  }
}

// ============================================================================
// DASHBOARD & ADMIN METRICS
// ============================================================================
export async function getDashboardStats(userId) {
  const allResources = await getAllResources();
  const myResources = allResources.filter(r => r.uploadedBy === userId);
  const questionPapers = allResources.filter(r => (r.category || '').toLowerCase().includes('question'));
  const favIds = await getUserFavoriteIds(userId);

  return {
    totalResources: allResources.length,
    myResources: myResources.length,
    favorites: favIds.size,
    questionPapers: questionPapers.length
  };
}

export async function getAdminStats() {
  const allResources = await getAllResources();
  let totalUsers = 1;

  if (isConfigured) {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      totalUsers = usersSnap.size;
    } catch (e) {
      console.warn("Could not count users:", e);
    }
  }

  const notesCount = allResources.filter(r => (r.category || '').toLowerCase() === 'notes').length;
  const qpCount = allResources.filter(r => (r.category || '').toLowerCase().includes('question')).length;
  const presCount = allResources.filter(r => (r.category || '').toLowerCase().includes('presentation')).length;
  const assignCount = allResources.filter(r => (r.category || '').toLowerCase().includes('assignment')).length;

  return {
    totalUsers,
    totalResources: allResources.length,
    totalNotes: notesCount,
    totalQuestionPapers: qpCount,
    totalPresentations: presCount,
    totalAssignments: assignCount
  };
}

export async function getAllUsers() {
  if (!isConfigured) {
    return [
      {
        id: "demo-user-1",
        name: "Admin User",
        email: "admin@studyvault.edu",
        role: "admin",
        createdAt: new Date().toISOString()
      },
      {
        id: "demo-user-2",
        name: "Raj Kumar",
        email: "rajkumar@student.edu",
        role: "student",
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }

  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}
