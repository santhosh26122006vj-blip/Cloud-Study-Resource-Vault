/**
 * Add Resource Controller (Admin Only)
 * Creates new study resource metadata in Cloud Firestore with relative file paths or external URLs.
 * Spark plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast } from './ui.js';
import { createResource } from './resource-service.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: true }, (profile) => {
    currentUser = profile;
  });

  setupPresetButtons();
  setupFormSubmission();
});

function setupPresetButtons() {
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('resourceTitle').value = btn.getAttribute('data-title') || '';
      document.getElementById('resourceSubject').value = btn.getAttribute('data-subject') || '';
      document.getElementById('resourceUnit').value = btn.getAttribute('data-unit') || 'Unit 1';
      document.getElementById('resourceDescription').value = btn.getAttribute('data-desc') || '';
      document.getElementById('resourceFileName').value = btn.getAttribute('data-file') || '';
      document.getElementById('resourceFileUrl').value = btn.getAttribute('data-url') || '';
      document.getElementById('resourceFileType').value = btn.getAttribute('data-type') || 'PDF';
      
      showToast("Preset Applied", "Fields filled with sample syllabus resource.", "info");
    });
  });
}

function setupFormSubmission() {
  const form = document.getElementById('addResourceForm');
  const submitBtn = document.getElementById('submitResourceBtn');
  const successBanner = document.getElementById('uploadSuccessBanner');
  const addAnotherBtn = document.getElementById('addAnotherBtn');

  if (addAnotherBtn) {
    addAnotherBtn.onclick = () => {
      if (successBanner) successBanner.style.display = 'none';
      form?.reset();
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

    if (!fileUrl) {
      showToast("Validation Error", "Please enter a valid file URL or relative path (e.g. resources/cloud-computing-unit-1.pdf).", "error");
      document.getElementById('resourceFileUrl').focus();
      return;
    }

    // UI state: saving
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Saving to Firestore...`;

    try {
      await createResource({
        title,
        subject,
        unit,
        description,
        fileName: fileName || fileUrl.split('/').pop().split('?')[0] || 'study-resource',
        fileUrl,
        fileType,
        isPublished,
        currentUser
      });

      showToast("Success", "Study resource added to Cloud Firestore!", "success");

      // Reveal success alert banner
      if (successBanner) {
        successBanner.style.display = 'block';
        successBanner.scrollIntoView({ behavior: 'smooth' });
      }

      form.reset();

    } catch (error) {
      console.error("Resource creation error:", error);
      showToast("Creation Error", error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> Add Resource`;
    }
  });
}
