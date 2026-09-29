/**
 * Add Resource Controller
 * Integrates "Choose File" selector, document validation (PDF, PPT, PPTX, DOC, DOCX, TXT),
 * auto-populating file name/type, and Cloud Firestore metadata persistence.
 * Spark plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, formatFileSize, escapeHTML } from './ui.js';
import { createResource } from './resource-service.js';

let currentUser = null;
let selectedFile = null;

// Supported document types per specification
const SUPPORTED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt'];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  // Any authenticated student can upload resources.
  initAuthGuard({ requireAuth: true }, (profile) => {
    currentUser = profile;
  });

  setupFilePicker();
  setupFormSubmission();
});

function setupFilePicker() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');
  const chooseBtn = document.getElementById('chooseFileBtn');

  if (!dropzone || !fileInput) return;

  const triggerPicker = () => fileInput.click();
  dropzone.addEventListener('click', triggerPicker);
  if (chooseBtn) {
    chooseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });
}

function handleFileSelected(file) {
  const lowerName = file.name.toLowerCase();
  const matchedExt = SUPPORTED_EXTENSIONS.find(ext => lowerName.endsWith(ext));

  // File validation
  if (!matchedExt) {
    showToast("Unsupported File Type", "Please select a PDF, PPT, PPTX, DOC, DOCX or TXT file.", "error");
    const container = document.getElementById('filePreviewContainer');
    if (container) {
      container.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:0.75rem 1rem; border-radius:var(--border-radius-md); font-size:0.85rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> <strong>Unsupported file type:</strong> Please select a PDF, PPT, PPTX, DOC, DOCX or TXT file.
        </div>
      `;
    }
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    return;
  }

  selectedFile = file;

  // Detect file type
  let detectedType = 'PDF';
  if (lowerName.endsWith('.pdf')) detectedType = 'PDF';
  else if (lowerName.endsWith('.pptx')) detectedType = 'PPTX';
  else if (lowerName.endsWith('.ppt')) detectedType = 'PPT';
  else if (lowerName.endsWith('.docx')) detectedType = 'DOCX';
  else if (lowerName.endsWith('.doc')) detectedType = 'DOC';
  else if (lowerName.endsWith('.txt')) detectedType = 'TXT';

  // 1. Auto-populate File Name
  const fileNameInput = document.getElementById('resourceFileName');
  if (fileNameInput) {
    fileNameInput.value = file.name;
  }


  // 2. Auto-populate File Type dropdown
  const fileTypeSelect = document.getElementById('resourceFileType');
  if (fileTypeSelect) {
    fileTypeSelect.value = detectedType;
  }

  // 3. Auto-fill Resource Title if currently empty
  const titleInput = document.getElementById('resourceTitle');
  if (titleInput && !titleInput.value.trim()) {
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    titleInput.value = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  // 4. Display selected file indicator in UI
  const container = document.getElementById('filePreviewContainer');
  if (container) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface-secondary); padding:0.85rem 1.25rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; gap:0.75rem; overflow:hidden;">
          <i class="fa-solid fa-file-circle-check" style="font-size:1.5rem; color:var(--success);"></i>
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:0.925rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHTML(file.name)}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${detectedType} &bull; ${formatFileSize(file.size)} &bull; Suggested: <code style="color:var(--primary);">resources/${escapeHTML(file.name)}</code>
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-icon btn-sm" id="removeFileBtn" title="Remove selected file" style="color:var(--danger); border-color:var(--border-color);">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    document.getElementById('removeFileBtn').onclick = (e) => {
      e.stopPropagation();
      selectedFile = null;
      document.getElementById('fileInput').value = '';
      container.innerHTML = '';
      if (fileNameInput) fileNameInput.value = '';
    };
  }

  showToast("File Selected", `Auto-detected: ${file.name} (${detectedType})`, "info");
}

function setupFormSubmission() {
  const form = document.getElementById('addResourceForm');
  const submitBtn = document.getElementById('submitResourceBtn');
  const successBanner = document.getElementById('uploadSuccessBanner');
  const uploadAnotherBtn = document.getElementById('uploadAnotherBtn');

  if (uploadAnotherBtn) {
    uploadAnotherBtn.onclick = () => {
      if (successBanner) successBanner.style.display = 'none';
      form?.reset();
      selectedFile = null;
      const preview = document.getElementById('filePreviewContainer');
      if (preview) preview.innerHTML = '';
      document.getElementById('resourceTitle')?.focus();
    };
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('resourceTitle').value.trim();
    const subject = document.getElementById('resourceSubject').value;
    const unit = document.getElementById('resourceUnit').value;
    const description = document.getElementById('resourceDescription').value.trim();
    const fileName = document.getElementById('resourceFileName').value.trim();
    const fileType = document.getElementById('resourceFileType').value;

    // Field Validations
    if (!title) {
      showToast("Validation Error", "Please provide a resource title.", "error");
      document.getElementById('resourceTitle').focus();
      return;
    }

    if (!subject) {
      showToast("Validation Error", "Please select an academic subject.", "error");
      document.getElementById('resourceSubject').focus();
      return;
    }

    if (!fileName && !selectedFile) {
      showToast("File Required", "Please click 'Choose File' to select a resource document.", "warning");
      document.getElementById('uploadDropzone').scrollIntoView({ behavior: 'smooth' });
      return;
    }


    // UI state: saving
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Saving to Cloud Firestore...`;

    try {
      await createResource({
        title,
        subject,
        unit,
        description,
        fileName: fileName || (selectedFile ? selectedFile.name : fileUrl.split('/').pop()),
        fileUrl: selectedFile ? `resources/${selectedFile.name}` : `resources/${fileName}`,
        fileType: fileType,
        file: selectedFile,
        currentUser: currentUser
      });

      showToast("Resource Added", "Metadata and file reference stored in Cloud Firestore!", "success");

      // Reveal success banner
      if (successBanner) {
        successBanner.style.display = 'block';
        successBanner.scrollIntoView({ behavior: 'smooth' });
      }

      form.reset();
      selectedFile = null;
      const preview = document.getElementById('filePreviewContainer');
      if (preview) preview.innerHTML = '';

    } catch (error) {
      console.error("Resource creation error:", error);
      showToast("Creation Error", error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> ADD RESOURCE`;
    }
  });
}
