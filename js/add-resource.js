/**
 * Add Resource Controller
 * Handles file validation, Firebase Storage resilient multi-part upload,
 * real-time progress indicators, and Cloud Firestore metadata persistence.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, formatFileSize, escapeHTML } from './ui.js';
import { createResource } from './resource-service.js';

let currentUser = null;
let selectedFile = null;

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, (profile) => {
    currentUser = profile;
  });

  setupDropzone();
  setupFormSubmission();
});

function setupDropzone() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');
  const filePreview = document.getElementById('filePreviewContainer');

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
  // Validate extension
  const fileName = file.name.toLowerCase();
  const isValidExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!isValidExt) {
    showToast("Invalid File Type", "Allowed formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG", "error");
    return;
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    showToast("File Too Large", "Maximum permitted file size is 30MB.", "error");
    return;
  }

  selectedFile = file;

  // Auto-detect type dropdown if not yet chosen
  const typeSelect = document.getElementById('resourceType');
  if (typeSelect && (!typeSelect.value || typeSelect.value === 'Other')) {
    if (fileName.endsWith('.pdf')) typeSelect.value = 'PDF';
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) typeSelect.value = 'Document';
    else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) typeSelect.value = 'Presentation';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg')) typeSelect.value = 'Image';
  }

  // Render preview card
  const container = document.getElementById('filePreviewContainer');
  if (container) {
    container.innerHTML = `
      <div class="file-preview-card">
        <div style="display:flex; align-items:center; gap:0.75rem; overflow:hidden;">
          <i class="fa-solid fa-file-circle-check" style="font-size:1.5rem; color:var(--success);"></i>
          <div style="min-width:0;">
            <div style="font-weight:600; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(file.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button type="button" class="btn btn-icon btn-sm" id="removeFileBtn" title="Remove file">
          <i class="fa-solid fa-trash-can" style="color:var(--danger);"></i>
        </button>
      </div>
    `;

    document.getElementById('removeFileBtn').onclick = () => {
      selectedFile = null;
      document.getElementById('fileInput').value = '';
      container.innerHTML = '';
    };
  }
}

function setupFormSubmission() {
  const form = document.getElementById('addResourceForm');
  const submitBtn = document.getElementById('submitResourceBtn');
  const progressWrapper = document.getElementById('uploadProgressWrapper');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  const successBanner = document.getElementById('uploadSuccessBanner');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('resourceTitle').value.trim();
    const description = document.getElementById('resourceDescription').value.trim();
    const subject = document.getElementById('resourceSubject').value;
    const category = document.getElementById('resourceCategory').value;
    const semester = document.getElementById('resourceSemester').value;
    const type = document.getElementById('resourceType').value;
    const externalUrl = document.getElementById('externalUrl').value.trim();
    const tagsRaw = document.getElementById('resourceTags').value.trim();

    if (!title || !subject || !category) {
      showToast("Validation Error", "Title, Subject, and Category are mandatory.", "error");
      return;
    }

    if (!selectedFile && !externalUrl) {
      showToast("Content Required", "Please either select a study file to upload or enter an external URL link.", "warning");
      return;
    }

    // Process tags
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0)
      : [];

    // UI state: uploading
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Storing in Cloud...`;
    if (progressWrapper) progressWrapper.style.display = 'block';

    try {
      const created = await createResource({
        title,
        description,
        subject,
        category,
        semester,
        type,
        tags,
        file: selectedFile,
        externalUrl,
        currentUser,
        onProgress: (percent) => {
          const rounded = Math.round(percent);
          if (progressBar) progressBar.style.width = `${rounded}%`;
          if (progressText) progressText.textContent = `Uploading to Cloud Storage: ${rounded}%`;
        }
      });

      showToast("Resource Created", "Resource uploaded successfully to cloud repository!", "success");

      // Show success screen with action
      if (successBanner) {
        successBanner.style.display = 'block';
        successBanner.scrollIntoView({ behavior: 'smooth' });
        const viewLink = document.getElementById('viewUploadedResourceLink');
        if (viewLink) {
          viewLink.href = `resources.html?q=${encodeURIComponent(title)}`;
        }
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
      if (progressWrapper) progressWrapper.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
    }
  });
}
