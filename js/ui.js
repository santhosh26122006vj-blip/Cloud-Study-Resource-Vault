/**
 * UI Utilities and Components for Cloud Study Resource Vault
 * Handles toasts, modals, confirmation popups, formatters, and icons.
 */

import { isConfigured } from './firebase-config.js';

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
export function showToast(title, message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  const iconClass = icons[type] || icons.info;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-message">${escapeHTML(message)}</div>
    </div>
    <i class="fa-solid fa-xmark toast-close" title="Dismiss"></i>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

// ============================================================================
// CONFIRMATION MODAL
// ============================================================================
export function showConfirmModal({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Delete",
  cancelText = "Cancel",
  confirmClass = "btn-danger",
  onConfirm = () => {}
}) {
  let modal = document.getElementById('globalConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalConfirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-container" style="max-width: 440px;">
        <div class="modal-header">
          <h3 id="confirmModalTitle">Confirm Action</h3>
          <i class="fa-solid fa-xmark modal-close-btn" id="confirmModalClose"></i>
        </div>
        <div class="modal-body">
          <p id="confirmModalMessage" style="color: var(--text-secondary);"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" id="confirmModalCancel">Cancel</button>
          <button type="button" class="btn btn-sm" id="confirmModalOk">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = modal.querySelector('#confirmModalTitle');
  const msgEl = modal.querySelector('#confirmModalMessage');
  const okBtn = modal.querySelector('#confirmModalOk');
  const cancelBtn = modal.querySelector('#confirmModalCancel');
  const closeBtn = modal.querySelector('#confirmModalClose');

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = confirmText;
  okBtn.className = `btn btn-sm ${confirmClass}`;
  cancelBtn.textContent = cancelText;

  modal.classList.add('active');

  const cleanup = () => {
    modal.classList.remove('active');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
    closeBtn.onclick = null;
  };

  okBtn.onclick = () => {
    cleanup();
    onConfirm();
  };

  cancelBtn.onclick = cleanup;
  closeBtn.onclick = cleanup;
}

// ============================================================================
// FORMATTERS & TYPE METADATA
// ============================================================================
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(timestamp) {
  if (!timestamp) return 'Just now';
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    return 'Recently';
  }

  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getTypeBadge(type) {
  const normType = (type || 'other').toLowerCase();
  let icon = 'fa-file';
  let cssClass = 'type-other';

  if (normType.includes('pdf')) {
    icon = 'fa-file-pdf';
    cssClass = 'type-pdf';
  } else if (normType.includes('doc') || normType.includes('word')) {
    icon = 'fa-file-word';
    cssClass = 'type-doc';
  } else if (normType.includes('presentation') || normType.includes('ppt')) {
    icon = 'fa-file-powerpoint';
    cssClass = 'type-ppt';
  } else if (normType.includes('image') || normType.includes('jpg') || normType.includes('png')) {
    icon = 'fa-file-image';
    cssClass = 'type-img';
  } else if (normType.includes('youtube')) {
    icon = 'fa-youtube';
    cssClass = 'type-youtube';
  } else if (normType.includes('video')) {
    icon = 'fa-file-video';
    cssClass = 'type-video';
  } else if (normType.includes('web') || normType.includes('link')) {
    icon = 'fa-arrow-up-right-from-square';
    cssClass = 'type-link';
  }

  return {
    icon: `fa-solid ${icon}`,
    cssClass: cssClass,
    label: type || 'Resource'
  };
}

// ============================================================================
// MOBILE NAVIGATION & ACTIVE LINK HIGHLIGHTER
// ============================================================================
export function initSidebar() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('appSidebar');

  if (menuToggle && sidebar) {
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    };

    menuToggle.addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', toggleSidebar);
  }

  // Highlight active link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href === currentPath) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Check Firebase Config Banner
  checkConfigBanner();
}

function checkConfigBanner() {
  if (!isConfigured) {
    const existing = document.getElementById('firebaseConfigNotice');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'firebaseConfigNotice';
      banner.style.cssText = `
        background: #eff6ff;
        color: #1e40af;
        border-bottom: 1px solid #bfdbfe;
        padding: 0.65rem 1.5rem;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        z-index: 10000;
        font-weight: 500;
        flex-wrap: wrap;
        gap: 0.5rem;
      `;
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <i class="fa-solid fa-circle-info" style="font-size:1.1rem; color:#2563eb;"></i>
          <span><strong>Running in Demo Mode:</strong> You can log in and test everything right now! (When ready for college submission, add your free Firebase keys in <code>js/firebase-config.js</code>).</span>
        </div>
        <a href="README.md" target="_blank" style="color:#1d4ed8; text-decoration:underline; font-weight:600;">How to Connect Firebase</a>
      `;
      document.body.prepend(banner);
    }
  }
}

// ============================================================================
// RESOURCE DETAILS MODAL
// ============================================================================
export function renderResourceDetailModal(resource, isFavorited, onToggleFav) {
  let modal = document.getElementById('resourceDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'resourceDetailModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const badge = getTypeBadge(resource.type);
  const tagsHtml = (resource.tags || []).map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join(' ');

  modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div class="type-icon ${badge.cssClass}">
            <i class="${badge.icon}"></i>
          </div>
          <div>
            <h3 style="font-size:1.15rem; line-height:1.2;">${escapeHTML(resource.title)}</h3>
            <span class="text-xs text-muted">${escapeHTML(resource.category)} &bull; ${escapeHTML(resource.subject)}</span>
          </div>
        </div>
        <i class="fa-solid fa-xmark modal-close-btn" id="closeDetailModal"></i>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:1.25rem;">
        <div>
          <h5 class="text-xs text-muted" style="text-transform:uppercase; margin-bottom:0.35rem; font-weight:700;">Description</h5>
          <p style="font-size:0.925rem; white-space:pre-line; color:var(--text-secondary);">${escapeHTML(resource.description || 'No detailed description provided.')}</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem; background:var(--bg-surface-secondary); padding:1rem; border-radius:var(--border-radius-md);">
          <div>
            <span class="text-xs text-muted" style="display:block;">Subject</span>
            <strong class="text-sm">${escapeHTML(resource.subject)}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Category</span>
            <strong class="text-sm">${escapeHTML(resource.category)}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Semester</span>
            <strong class="text-sm">${escapeHTML(resource.semester || 'All')}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Uploaded By</span>
            <strong class="text-sm">${escapeHTML(resource.uploaderName || 'Student')}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Upload Date</span>
            <strong class="text-sm">${formatDate(resource.createdAt)}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Resource Type</span>
            <strong class="text-sm">${escapeHTML(resource.type || 'File')}</strong>
          </div>
        </div>

        ${resource.fileName ? `
          <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-muted); background:var(--bg-body); padding:0.6rem 0.85rem; border-radius:var(--border-radius-sm);">
            <i class="fa-solid fa-paperclip"></i>
            <span>File: <strong>${escapeHTML(resource.fileName)}</strong></span>
            ${resource.fileSize ? `<span>(${formatFileSize(resource.fileSize)})</span>` : ''}
          </div>
        ` : ''}

        ${tagsHtml ? `
          <div>
            <span class="text-xs text-muted" style="display:block; margin-bottom:0.3rem;">Tags</span>
            <div class="resource-tags">${tagsHtml}</div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <button type="button" class="btn btn-secondary btn-sm" id="detailFavToggleBtn">
          <i class="${isFavorited ? 'fa-solid' : 'fa-regular'} fa-star" style="color:${isFavorited ? '#f59e0b' : 'inherit'};"></i>
          <span>${isFavorited ? 'Favorited' : 'Add to Favorites'}</span>
        </button>

        <div style="display:flex; gap:0.5rem;">
          ${resource.fileUrl ? `
            <a href="${escapeHTML(resource.fileUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Resource
            </a>
            <a href="${escapeHTML(resource.fileUrl)}" download="${escapeHTML(resource.fileName || 'resource')}" target="_blank" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-download"></i> Download
            </a>
          ` : `
            <button class="btn btn-secondary btn-sm" disabled>No file link</button>
          `}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');

  const closeBtn = modal.querySelector('#closeDetailModal');
  closeBtn.onclick = () => modal.classList.remove('active');

  const favBtn = modal.querySelector('#detailFavToggleBtn');
  favBtn.onclick = async () => {
    if (onToggleFav) {
      const newStatus = await onToggleFav(resource.id);
      const icon = favBtn.querySelector('i');
      const text = favBtn.querySelector('span');
      if (newStatus) {
        icon.className = 'fa-solid fa-star';
        icon.style.color = '#f59e0b';
        text.textContent = 'Favorited';
      } else {
        icon.className = 'fa-regular fa-star';
        icon.style.color = 'inherit';
        text.textContent = 'Add to Favorites';
      }
    }
  };
}
