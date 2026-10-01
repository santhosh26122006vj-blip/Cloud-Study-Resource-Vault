/**
 * File Storage & Blob Manager for Cloud Study Resource Vault
 * 
 * Provides client-side file persistence using browser IndexedDB and Base64 data encoding.
 * 100% Spark (Free) plan compatible: Stores and opens actual files (PDF, PPT, DOC)
 * without requiring Firebase Cloud Storage or paid Blaze billing!
 */

const DB_NAME = 'StudyVaultFileDB';
const DB_VERSION = 1;
const STORE_NAME = 'resource_files';

let dbInstance = null;

// ============================================================================
// INDEXEDDB INITIALIZATION
// ============================================================================
export function initFileDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (!window.indexedDB) {
      console.warn("IndexedDB not supported in this browser.");
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.warn("IndexedDB open error:", event.target.error);
      resolve(null);
    };
  });
}

// ============================================================================
// SAVE FILE BLOB TO INDEXEDDB
// ============================================================================
export async function saveFileBlob(key, fileBlob) {
  try {
    const db = await initFileDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: key,
        fileName: fileBlob.name || key,
        fileType: fileBlob.type || '',
        blob: fileBlob,
        updatedAt: Date.now()
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = (e) => {
        console.warn("Error saving file blob:", e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("saveFileBlob error:", err);
    return false;
  }
}

// ============================================================================
// GET FILE BLOB FROM INDEXEDDB
// ============================================================================
export async function getFileBlob(key) {
  try {
    const db = await initFileDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(key);

      getReq.onsuccess = (event) => {
        const result = event.target.result;
        resolve(result ? result.blob : null);
      };
      getReq.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("getFileBlob error:", err);
    return null;
  }
}

export async function deleteFileBlob(key) {
  if (!key) return false;

  try {
    const db = await initFileDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch (error) {
    console.warn("deleteFileBlob error:", error);
    return false;
  }
}

// ============================================================================
// CONVERT FILE TO BASE64 DATA URI
// ============================================================================
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// CONVERT BASE64 DATA URI TO BLOB
// ============================================================================
export function base64ToBlob(base64Data, contentType = '') {
  const parts = base64Data.split(';base64,');
  const type = contentType || (parts.length > 1 ? parts[0].split(':')[1] : 'application/octet-stream');
  const raw = window.atob(parts[1] || parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type });
}

// ============================================================================
// OPEN OR DOWNLOAD STUDY RESOURCE
// ============================================================================
export async function openStudyResource(resource) {
  if (!resource) return;

  const fileName = resource.fileName || resource.title || 'study-resource';

  // 1. Check if we have the physical file Blob stored in IndexedDB (by resource id or fileName)
  let blob = await getFileBlob(resource.id);
  if (!blob && resource.fileName) {
    blob = await getFileBlob(resource.fileName);
  }

  // 2. Check if Firestore contains inline Base64 data (for files <= 750KB)
  if (!blob && resource.fileData && resource.fileData.startsWith('data:')) {
    try {
      blob = base64ToBlob(resource.fileData);
    } catch (e) {
      console.warn("Base64 decode failed:", e);
    }
  }

  // If we have a binary Blob:
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    const isPDF = (resource.fileType || '').toUpperCase() === 'PDF' || (blob.type || '').includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

    if (isPDF) {
      // PDFs can be viewed natively in a browser tab
      window.open(blobUrl, '_blank');
    } else {
      // For DOCX, PPTX, etc., trigger download/open
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return;
  }

  // 3. Fallback: If resource has a fileUrl (e.g. resources/file.pdf or external URL)
  if (resource.fileUrl) {
    const isExternal = resource.fileUrl.startsWith('http://') || resource.fileUrl.startsWith('https://');
    if (isExternal) {
      window.open(resource.fileUrl, '_blank');
      return;
    }

    // Relative path (e.g. resources/cloud-computing-unit-1.pdf)
    window.open(resource.fileUrl, '_blank');
    return;
  }

  alert("No file path or data available for this resource.");
}
