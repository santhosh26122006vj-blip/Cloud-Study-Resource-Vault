/**
 * Resource Service for Cloud Study Resource Vault
 * 
 * 100% Spark (Free) Plan: Cloud Firestore metadata & relative / external file paths.
 * ZERO Firebase Storage dependency.
 */

import {
  db,
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
export async function getAllResources(onlyPublished = false) {
  if (!isConfigured) {
    const list = getMockResources();
    return onlyPublished ? list.filter(r => r.isPublished !== false) : list;
  }

  try {
    let q;
    if (onlyPublished) {
      q = query(collection(db, "resources"), where("isPublished", "==", true));
    } else {
      q = query(collection(db, "resources"), orderBy("createdAt", "desc"));
    }
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
  } catch (error) {
    console.warn("Unordered query fallback for resources:", error);
    const snapshot = await getDocs(collection(db, "resources"));
    let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (onlyPublished) {
      list = list.filter(r => r.isPublished !== false);
    }
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }
}

export async function getRecentlyAddedResources(max = 6, onlyPublished = true) {
  const all = await getAllResources(onlyPublished);
  return all.slice(0, max);
}

export async function getUserResources(userId) {
  const all = await getAllResources(false);
  return all.filter(r => r.uploadedBy === userId);
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
  unit = 'Unit 1',
  description = '',
  fileName = '',
  fileUrl = '',
  fileType = 'PDF',
  file = null,
  isPublished = true,
  currentUser
}) {
  if (!title || !title.trim()) throw new Error("Resource title is required.");
  if (!subject || !subject.trim()) throw new Error("Subject is required.");
  if (!currentUser?.uid) throw new Error("You must be logged in to upload a resource.");

  // Firebase Spark has no Cloud Storage access. To keep real uploads shared
  // between students without Storage, small study files are stored as Base64
  // inside the Firestore resource document. Firestore documents are limited to
  // 1 MiB, so keep the binary payload safely below that limit.
  const MAX_FILE_BYTES = 700 * 1024;

  let cleanFileName = (fileName || (file ? file.name : '')).trim();
  let cleanUrl = (fileUrl || '').trim();
  let fileData = null;

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`This free-plan uploader supports files up to 700 KB. Your file is ${Math.ceil(file.size / 1024)} KB. Please compress the file or choose a smaller version.`);
    }

    cleanFileName = file.name;
    cleanUrl = cleanUrl || `resources/${encodeURIComponent(file.name)}`;
    try {
      fileData = await fileToBase64(file);
    } catch (e) {
      throw new Error("The selected file could not be prepared for upload. Please try again.");
    }
  }

  if (!cleanFileName && cleanUrl) {
    cleanFileName = decodeURIComponent(cleanUrl.split('/').pop().split('?')[0] || 'study-resource');
  }
  if (!cleanUrl && !fileData) {
    throw new Error("Please choose a study material file or enter a valid resource URL.");
  }

  let detectedType = (fileType || 'Other').toUpperCase();
  const ext = cleanFileName.toLowerCase();
  if (ext.endsWith('.pdf')) detectedType = 'PDF';
  else if (ext.endsWith('.pptx')) detectedType = 'PPTX';
  else if (ext.endsWith('.ppt')) detectedType = 'PPT';
  else if (ext.endsWith('.docx')) detectedType = 'DOCX';
  else if (ext.endsWith('.doc')) detectedType = 'DOC';
  else if (ext.endsWith('.txt')) detectedType = 'TXT';

  const uploaderId = currentUser.uid;
  const uploaderName = currentUser.name || currentUser.displayName || 'Student';

  const resourceData = {
    title: title.trim(),
    subject: subject.trim(),
    unit: (unit || 'Unit 1').trim(),
    description: (description || '').trim(),
    fileName: cleanFileName,
    fileUrl: cleanUrl,
    fileType: detectedType,
    fileSize: file ? file.size : 0,
    fileData,
    uploadedBy: uploaderId,
    uploaderName,
    createdAt: isConfigured ? serverTimestamp() : new Date().toISOString(),
    downloadCount: 0,
    // Student uploads are immediately visible so classmates can use them.
    isPublished: isPublished !== false
  };

  if (!isConfigured) {
    const newRes = { id: "res-" + Date.now(), ...resourceData };
    const currentList = getMockResources();
    currentList.unshift(newRes);
    saveMockResources(currentList);
    return newRes;
  }

  const newDocRef = doc(collection(db, "resources"));
  await setDoc(newDocRef, resourceData);

  // IndexedDB is only a local cache for the uploader; Firestore fileData is
  // the shared source so other students can download the same file.
  if (file) {
    try {
      await saveFileBlob(newDocRef.id, file);
    } catch (e) {
      console.warn("Local file cache warning:", e);
    }
  }

  return { id: newDocRef.id, ...resourceData };
}

// ============================================================================
// UPDATE RESOURCE
// ============================================================================
export async function updateResource(resourceId, updatedData) {
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
      saveMockResources(list);
      return list[index];
    }
    throw new Error("Resource not found in local mock.");
  }

  const docRef = doc(db, "resources", resourceId);
  await updateDoc(docRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  });
}

// ============================================================================
// TOGGLE PUBLICATION STATUS
// ============================================================================
export async function togglePublishStatus(resourceId, currentStatus) {
  const newStatus = !currentStatus;
  await updateResource(resourceId, { isPublished: newStatus });
  return newStatus;
}

// ============================================================================
// INCREMENT DOWNLOAD / OPEN COUNT
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
    let list = getMockResources();
    list = list.filter(r => r.id !== resourceId);
    saveMockResources(list);

    let favs = getMockFavorites();
    favs = favs.filter(f => f.resourceId !== resourceId);
    saveMockFavorites(favs);
    return;
  }

  // 1. Delete Firestore document
  await deleteDoc(doc(db, "resources", resourceId));

  // 2. Remove related favorites
  try {
    const favQuery = query(collection(db, "favorites"), where("resourceId", "==", resourceId));
    const favSnaps = await getDocs(favQuery);
    for (const d of favSnaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn("Favorite cleanup warning:", e);
  }
}

// ============================================================================
// DASHBOARD & ADMIN METRICS
// ============================================================================
export async function getDashboardStats(userId = null) {
  const allResources = await getAllResources(false);
  const published = allResources.filter(r => r.isPublished !== false);
  
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
    publishedResources: published.length,
    totalSubjects: subjects.size,
    totalUnits: units.size,
    favorites: favCount
  };
}
