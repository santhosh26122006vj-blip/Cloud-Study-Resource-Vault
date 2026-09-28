/**
 * Add Resource Controller
 * Provides interactive file picker & drag-and-drop file upload.
 * Stores binary file in IndexedDB/Base64 and metadata in Cloud Firestore.
 * 100% Spark Free Plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, formatFileSize, escapeHTML } from './ui.js';
import { createResource } from './resource-service.js';

let currentUser = null;
let selectedFile = null;

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.txt'];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  // Allow ANY logged-in student or administrator to upload resources
  initAuthGuard({ requireAuth: true, requireAdmin: false }, (profile) => {
    currentUser = profile;
  });

  setupDropzone();
  setupPresetButtons();
  setupFormSubmission();
});

function setupDropzone() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

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
  const fileName = file.name.toLowerCase();
  const isValidExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!isValidExt) {
    showToast("Invalid File Type", "Allowed formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG", "error");
    return;
  }

  selectedFile = file;

  // Auto-detect type dropdown
  const typeSelect = document.getElementById('resourceFileType');
  if (typeSelect) {
    if (fileName.endsWith('.pdf')) typeSelect.value = 'PDF';
    else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) typeSelect.value = 'PPT';
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) typeSelect.value = 'DOC';
    else typeSelect.value = 'Other';
  }

  // Auto-fill title if empty
  const titleInput = document.getElementById('resourceTitle');
  if (titleInput && !titleInput.value.trim()) {
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  // Render preview card
  const container = document.getElementById('filePreviewContainer');
  if (container) {
    container.innerHTML = `
      <div class="file-preview-card" style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface-secondary); padding:0.85rem 1.25rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; gap:0.75rem; overflow:hidden;">
          <i class="fa-solid fa-file-circle-check" style="font-size:1.5rem; color:var(--success);"></i>
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(file.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button type="button" class="btn btn-icon btn-sm" id="removeFileBtn" title="Remove file" style="color:var(--danger); border-color:var(--border-color);">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    document.getElementById('removeFileBtn').onclick = () => {
      selectedFile = null;
      document.getElementById('fileInput').value = '';
      container.innerHTML = '';
    };
  }

  showToast("File Selected", `Ready to upload: ${file.name}`, "info");
}

function setupPresetButtons() {
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('resourceTitle').value = btn.getAttribute('data-title') || '';
      document.getElementById('resourceSubject').value = btn.getAttribute('data-subject') || '';
      document.getElementById('resourceUnit').value = btn.getAttribute('data-unit') || 'Unit 1';
      document.getElementById('resourceDescription').value = btn.getAttribute('data-desc') || '';
      document.getElementById('resourceFileUrl').value = btn.getAttribute('data-url') || '';
      document.getElementById('resourceFileType').value = btn.getAttribute('data-type') || 'PDF';

      showToast("Preset Applied", "Fields filled with sample curriculum resource.", "info");
    });
  });
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
    const fileUrl = document.getElementById('resourceFileUrl').value.trim();
    const fileType = document.getElementById('resourceFileType').value;
    const isPublished = document.getElementById('resourcePublished').value === 'true';

    // Validation
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

    if (!selectedFile && !fileUrl) {
      showToast("File Required", "Please click the box to select a study file, or enter an external URL.", "warning");
      return;
    }

    // UI state: saving
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Storing File & Metadata...`;

    try {
      await createResource({
        title,
        subject,
        unit,
        description,
        file: selectedFile,
        fileUrl: fileUrl,
        fileType,
        isPublished,
        currentUser
      });

      showToast("Upload Successful", "Study resource stored securely in Cloud Vault!", "success");

      // Reveal success alert banner
      if (successBanner) {
        successBanner.style.display = 'block';
        successBanner.scrollIntoView({ behavior: 'smooth' });
      }

      form.reset();
      selectedFile = null;
      const preview = document.getElementById('filePreviewContainer');
      if (preview) preview.innerHTML = '';

    } catch (error) {
      console.error("Resource upload error:", error);
      showToast("Upload Error", error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload Resource`;
    }
  });
}
