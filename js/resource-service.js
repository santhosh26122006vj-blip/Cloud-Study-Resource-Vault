/**
 * Resource Service for Cloud Study Resource Vault
 * 
 * 100% Spark (Free) Plan: Cloud Firestore metadata & relative / external file paths.
 * ZERO Firebase Storage dependency.
 */

import {
  db,
  auth,
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
  serverTimestamp
} from './firebase-config.js';

import { saveFileBlob, fileToBase64 } from './file-storage.js';

// ============================================================================
// LOCAL STORAGE MOCK HELPERS (Offline / Demo Fallback)
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
  // Every resource query is scoped to the currently authenticated account.
  // This is intentionally enforced here as well as in firestore.rules.
  if (!isConfigured) {
    const mockUser = JSON.parse(localStorage.getItem('study_vault_mock_user') || 'null');
    const userId = mockUser?.uid;
    if (!userId) return [];

    let list = getMockResources().filter(r => r.uploadedBy === userId);
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
  }

  const userId = auth?.currentUser?.uid;
  if (!userId) return [];

  try {
    // Do NOT use a collection-wide fallback. Firestore security rules require
    // the query to prove that the requested resources belong to this user.
    const q = query(
      collection(db, "resources"),
      where("uploadedBy", "==", userId)
    );

    const snapshot = await getDocs(q);
    let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));


    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
  } catch (error) {
    console.error("Error fetching user resources:", error);
    throw error;
  }
}

export async function getRecentlyAddedResources(max = 6) {
  const all = await getAllResources();
  return all.slice(0, max);
}

export async function getUserResources(userId) {
  if (!userId) return [];

  // In Firebase mode, the query is always limited to the authenticated user.
  // In mock mode, filter the local data by the supplied owner UID.
  if (!isConfigured) {
    let list = getMockResources().filter(r => r.uploadedBy === userId);
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
  }

  if (auth?.currentUser?.uid !== userId) return [];
  return getAllResources();
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

  const all = await getAllResources(true);
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
    return false;
  } else {
    await setDoc(favDocRef, {
      userId: userId,
      resourceId: resourceId,
      createdAt: serverTimestamp()
    });
    return true;
  }
}

// ============================================================================
// CREATE RESOURCE (Pure Firestore Document with file URL/path)
// ============================================================================
export async function createResource({
  title,
  subject,
  unit,
  description = '',
  fileName = '',
  fileUrl = '',
  fileType = 'PDF',
  file = null,
  currentUser
}) {
  if (!title || !title.trim()) {
    throw new Error("Resource title is required.");
  }
  if (!subject || !subject.trim()) {
    throw new Error("Subject is required.");
  }

  // Determine file name and URL
  let cleanFileName = (fileName || (file ? file.name : '')).trim();
  let cleanUrl = (fileUrl || '').trim();

  if (!cleanUrl && file) {
    cleanUrl = `resources/${file.name}`;
  }

  if (!cleanFileName && cleanUrl) {
    cleanFileName = cleanUrl.split('/').pop().split('?')[0] || 'study-resource';
  }

  if (!cleanUrl && !file) {
    throw new Error("Please select a study material file or enter a valid resource URL.");
  }

  // Detect file type if not specified
  let detectedType = (fileType || 'PDF').toUpperCase();
  if (file && (!fileType || fileType === 'Other')) {
    const ext = file.name.toLowerCase();
    if (ext.endsWith('.pdf')) detectedType = 'PDF';
    else if (ext.endsWith('.ppt') || ext.endsWith('.pptx')) detectedType = 'PPT';
    else if (ext.endsWith('.doc') || ext.endsWith('.docx')) detectedType = 'DOC';
  }

  // Base64 encoding for small files. Keep this conservative because Base64 increases size and Firestore documents are limited to 1 MiB.
  let fileData = null;
  if (file && file.size <= 650 * 1024) {
      // Store the binary in Firestore so every authenticated student can access it.

    try {
      fileData = await fileToBase64(file);
    } catch (e) {
      console.warn("Base64 conversion failed:", e);
    }
  }

  const uploaderId = currentUser?.uid || auth?.currentUser?.uid;
  if (!uploaderId) {
    throw new Error("You must be logged in to save a resource.");
  }
  const uploaderName = currentUser?.name || currentUser?.displayName || auth?.currentUser?.displayName || "Student";

  const resourceData = {
    title: title.trim(),
    subject: subject.trim(),
    unit: (unit || 'Unit 1').trim(),
    description: (description || '').trim(),
    fileName: cleanFileName,
    fileUrl: cleanUrl,
    fileType: detectedType,
    fileSize: file ? file.size : 0,
    fileData: fileData, // Inline data for small files
    uploadedBy: uploaderId,
    uploaderName: uploaderName,
    createdAt: isConfigured ? serverTimestamp() : new Date().toISOString(),
    downloadCount: 0,
  };

  // Mock mode fallback
  if (!isConfigured) {
    const newRes = {
      id: "res-" + Date.now(),
      ...resourceData
    };

    if (file) {
      await saveFileBlob(newRes.id, file);
      if (cleanFileName) await saveFileBlob(cleanFileName, file);
    }

    const currentList = getMockResources();
    currentList.unshift(newRes);
    saveMockResources(currentList);
    return newRes;
  }

  if (file && !fileData) {
    throw new Error("This file is too large for the Firebase Spark-plan upload system. Please use a file smaller than 650 KB.");
  }

  // Save directly to Firestore
  const newDocRef = doc(collection(db, "resources"));
  await setDoc(newDocRef, resourceData);

  // Firestore contains the shared Base64 fileData. IndexedDB is not required
  // for cross-device access and is therefore intentionally not used here.

  return { id: newDocRef.id, ...resourceData };
}

// ============================================================================
// UPDATE RESOURCE
// ============================================================================
export async function updateResource(resourceId, updatedData) {
  if (!resourceId) throw new Error("Missing resource ID.");

  if (!isConfigured) {
    const mockUser = JSON.parse(localStorage.getItem('study_vault_mock_user') || 'null');
    const list = getMockResources();
    const index = list.findIndex(r => r.id === resourceId && r.uploadedBy === mockUser?.uid);

    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      saveMockResources(list);
      return list[index];
    }
    throw new Error("Resource not found or it does not belong to your account.");
  }

  const userId = auth?.currentUser?.uid;
  if (!userId) throw new Error("You must be logged in to update a resource.");

  const docRef = doc(db, "resources", resourceId);
  const resourceSnap = await getDoc(docRef);

  if (!resourceSnap.exists()) {
    throw new Error("Resource not found.");
  }

  if (resourceSnap.data().uploadedBy !== userId) {
    throw new Error("You can only edit resources belonging to your account.");
  }

  await updateDoc(docRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  });
}

// ============================================================================
// DOWNLOAD COUNT
// ============================================================================
export async function incrementDownloadCount(resourceId, currentCount = 0) {
  try {
    await updateResource(resourceId, { downloadCount: (currentCount || 0) + 1 });
  } catch (e) {
    // Non-blocking telemetry
    console.warn("Could not increment count:", e);
  }
}

// ============================================================================
// DELETE RESOURCE (Firestore Document Only — ZERO physical file deletion)
// ============================================================================
export async function deleteResource(resourceId) {
  if (!resourceId) throw new Error("Missing resource ID.");

  if (!isConfigured) {
    const mockUser = JSON.parse(localStorage.getItem('study_vault_mock_user') || 'null');
    let list = getMockResources();
    const resource = list.find(r => r.id === resourceId);

    if (!resource) throw new Error("Resource not found.");
    if (resource.uploadedBy !== mockUser?.uid) {
      throw new Error("You can only delete resources belonging to your account.");
    }

    list = list.filter(r => r.id !== resourceId);
    saveMockResources(list);

    let favs = getMockFavorites();
    favs = favs.filter(f => f.resourceId !== resourceId);
    saveMockFavorites(favs);
    return;
  }

  const userId = auth?.currentUser?.uid;
  if (!userId) throw new Error("You must be logged in to delete a resource.");

  const resourceRef = doc(db, "resources", resourceId);
  const resourceSnap = await getDoc(resourceRef);

  if (!resourceSnap.exists()) throw new Error("Resource not found.");
  if (resourceSnap.data().uploadedBy !== userId) {
    throw new Error("You can only delete resources belonging to your account.");
  }

  // Delete only the resource owned by the signed-in user.
  await deleteDoc(resourceRef);

  // Remove favorites associated with this resource.
  try {
    const favQuery = query(
      collection(db, "favorites"),
      where("resourceId", "==", resourceId),
      where("userId", "==", userId)
    );
    const favSnaps = await getDocs(favQuery);
    for (const d of favSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn("Favorite cleanup warning:", e);
  }
}

// ============================================================================
// DASHBOARD METRICS
// ============================================================================
export async function getDashboardStats(userId = null) {
  const allResources = await getAllResources();
  const saved = allResources;
  
  // Count unique subjects & units
  const subjects = new Set(allResources.map(r => r.subject).filter(Boolean));
  const units = new Set(allResources.map(r => r.unit).filter(Boolean));

  let favCount = 0;
  if (userId) {
    const favIds = await getUserFavoriteIds(userId);
    favCount = favIds.size;
  }

  return {
    totalResources: allResources.length,
    savedResources: saved.length,
    totalSubjects: subjects.size,
    totalUnits: units.size,
    favorites: favCount
  };
}
