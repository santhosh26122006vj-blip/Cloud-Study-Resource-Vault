/**
 * My Resources Controller
 * Displays exclusively the study resources authored by the logged-in student,
 * providing direct Edit and Delete capabilities with security safeguards.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, showConfirmModal, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getUserResources, updateResource, deleteResource, getUserFavoriteIds, toggleFavorite } from './resource-service.js';

let currentUser = null;
let myResourcesList = [];
let userFavoriteIds = new Set();
let editingResourceId = null;
let editReplacementFile = null;

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
    currentUser = profile;
    await fetchAndRenderMyResources();
  });

  setupEditModalEvents();
});

async function fetchAndRenderMyResources() {
  try {
    const [resources, favIds] = await Promise.all([
      getUserResources(currentUser.uid),
      getUserFavoriteIds(currentUser.uid)
    ]);

    myResourcesList = resources;
    userFavoriteIds = favIds;

    const countEl = document.getElementById('myResourcesCount');
    if (countEl) {
      countEl.textContent = `${resources.length} uploaded by you`;
    }

    renderGrid(myResourcesList);
  } catch (error) {
    console.error("Error loading user resources:", error);
    showToast("Load Failed", error.message, "error");
  }
}

function renderGrid(resources) {
  const container = document.getElementById('myResourcesGrid');
  if (!container) return;

  if (resources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
        <h3>You Haven't Uploaded Any Resources Yet</h3>
        <p>Upload lecture notes, sample question banks, lab sheets, or references to build your cloud study portfolio.</p>
        <a href="add-resource.html" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-plus"></i> Add Your First Resource
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = resources.map(res => {
    const isFav = userFavoriteIds.has(res.id);
    const badge = getTypeBadge(res.type);

    return `
      <div class="resource-card" data-id="${res.id}">
        <div class="card-header-type">
          <div class="type-indicator">
            <div class="type-icon ${badge.cssClass}">
              <i class="${badge.icon}"></i>
            </div>
            <span>${escapeHTML(res.type || 'Resource')}</span>
          </div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-id="${res.id}" title="${isFav ? 'Remove Favorite' : 'Save to Favorites'}">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
        </div>

        <div class="card-body">
          <div class="card-meta-tags">
            <span class="badge badge-primary">${escapeHTML(res.category)}</span>
            <span class="badge badge-secondary">${escapeHTML(res.subject)}</span>
            ${res.semester ? `<span class="badge badge-muted">${escapeHTML(res.semester)}</span>` : ''}
          </div>
          <h4 class="resource-title" title="${escapeHTML(res.title)}">${escapeHTML(res.title)}</h4>
          <p class="resource-description">${escapeHTML(res.description || 'No description provided.')}</p>
          
          ${res.tags && res.tags.length > 0 ? `
            <div class="resource-tags">
              ${res.tags.slice(0, 3).map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join('')}
              ${res.tags.length > 3 ? `<span class="tag-pill">+${res.tags.length - 3}</span>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="card-footer">
          <span style="font-size:0.8rem; color:var(--text-muted);">
            <i class="fa-regular fa-calendar"></i> ${formatDate(res.createdAt)}
          </span>

          <div style="display:flex; align-items:center; gap:0.4rem;">
            <button class="btn btn-outline btn-sm view-res-btn" data-view-id="${res.id}" title="View Details">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-secondary btn-sm edit-res-btn" data-edit-id="${res.id}" title="Edit Resource">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-icon btn-sm delete-res-btn" data-del-id="${res.id}" title="Delete Resource" style="color:var(--danger); border-color:var(--danger-border);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Favorites
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const resId = btn.getAttribute('data-fav-id');
      const isNowFav = await toggleFavorite(currentUser.uid, resId);
      
      const icon = btn.querySelector('i');
      if (isNowFav) {
        btn.classList.add('active');
        icon.className = 'fa-solid fa-star';
        userFavoriteIds.add(resId);
        showToast("Added to Favorites", "Saved to your favorites.", "success");
      } else {
        btn.classList.remove('active');
        icon.className = 'fa-regular fa-star';
        userFavoriteIds.delete(resId);
        showToast("Removed", "Removed from your favorites.", "info");
      }
    });
  });

  // View modal
  container.querySelectorAll('.view-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = myResourcesList.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, userFavoriteIds.has(item.id), async (id) => {
          const status = await toggleFavorite(currentUser.uid, id);
          if (status) userFavoriteIds.add(id);
          else userFavoriteIds.delete(id);
          return status;
        });
      }
    });
  });

  // Edit modal trigger
  container.querySelectorAll('.edit-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-edit-id');
      const item = myResourcesList.find(r => r.id === resId);
      if (item) {
        openEditModal(item);
      }
    });
  });

  // Delete trigger
  container.querySelectorAll('.delete-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-del-id');
      const item = myResourcesList.find(r => r.id === resId);
      if (item) {
        showConfirmModal({
          title: "Delete Resource",
          message: `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
          confirmText: "Delete Resource",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            try {
              await deleteResource(item.id, item.fileUrl);
              showToast("Resource Deleted", "The resource was successfully removed.", "info");
              await fetchAndRenderMyResources();
            } catch (err) {
              console.error("Delete error:", err);
              showToast("Delete Failed", err.message, "error");
            }
          }
        });
      }
    });
  });
}

function openEditModal(resource) {
  editingResourceId = resource.id;
  editReplacementFile = null;

  document.getElementById('editTitle').value = resource.title || '';
  document.getElementById('editDescription').value = resource.description || '';
  document.getElementById('editSubject').value = resource.subject || 'Cloud Computing';
  document.getElementById('editCategory').value = resource.category || 'Notes';
  document.getElementById('editSemester').value = resource.semester || 'Semester 5';
  document.getElementById('editType').value = resource.type || 'PDF';
  document.getElementById('editTags').value = (resource.tags || []).join(', ');
  document.getElementById('editExternalUrl').value = resource.fileUrl?.startsWith('http') && !resource.fileUrl.includes('firebasestorage') ? resource.fileUrl : '';

  const modal = document.getElementById('editResourceModal');
  if (modal) modal.classList.add('active');
}

function setupEditModalEvents() {
  const modal = document.getElementById('editResourceModal');
  const closeBtn = document.getElementById('closeEditModalBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const form = document.getElementById('editResourceForm');
  const fileInput = document.getElementById('editFileInput');

  if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');
  if (cancelBtn) cancelBtn.onclick = () => modal?.classList.remove('active');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        editReplacementFile = e.target.files[0];
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!editingResourceId) return;

      const title = document.getElementById('editTitle').value.trim();
      const description = document.getElementById('editDescription').value.trim();
      const subject = document.getElementById('editSubject').value;
      const category = document.getElementById('editCategory').value;
      const semester = document.getElementById('editSemester').value;
      const type = document.getElementById('editType').value;
      const externalUrl = document.getElementById('editExternalUrl').value.trim();
      const tagsRaw = document.getElementById('editTags').value.trim();

      const tags = tagsRaw
        ? tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0)
        : [];

      const saveBtn = document.getElementById('saveEditBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner"></span> Updating...`;

      try {
        const updatePayload = {
          title,
          description,
          subject,
          category,
          semester,
          type,
          tags
        };

        if (externalUrl) {
          updatePayload.fileUrl = externalUrl;
        }

        await updateResource(editingResourceId, updatePayload, editReplacementFile, currentUser);

        showToast("Success", "Resource updated successfully!", "success");
        modal?.classList.remove('active');
        await fetchAndRenderMyResources();
      } catch (error) {
        console.error("Error updating resource:", error);
        showToast("Update Failed", error.message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `Save Changes`;
      }
    });
  }
}
