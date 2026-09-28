/**
 * Admin Resource Management Controller
 * Handles CRUD operations, publication status toggles, metrics calculation,
 * and filtering for Cloud Study Resource Vault.
 * Spark plan compatible: Firestore metadata & local file paths only.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import {
  getAllResources,
  updateResource,
  deleteResource,
  togglePublishStatus,
  getDashboardStats
} from './resource-service.js';
import { seedDemoData } from './demo-data.js';

let currentUser = null;
let allResources = [];

const filters = {
  searchQuery: '',
  subject: 'all',
  unit: 'all',
  status: 'all'
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: true }, async (profile) => {
    currentUser = profile;
    setupEventListeners();
    await loadAdminData();
  });
});

function setupEventListeners() {
  const searchInput = document.getElementById('adminSearchInput');
  const subjectFilter = document.getElementById('adminSubjectFilter');
  const unitFilter = document.getElementById('adminUnitFilter');
  const statusFilter = document.getElementById('adminStatusFilter');
  const resetBtn = document.getElementById('adminResetBtn');
  const seedBtn = document.getElementById('seedDataBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filters.searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  if (subjectFilter) {
    subjectFilter.addEventListener('change', (e) => {
      filters.subject = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (unitFilter) {
    unitFilter.addEventListener('change', (e) => {
      filters.unit = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      filters.status = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filters.searchQuery = '';
      filters.subject = 'all';
      filters.unit = 'all';
      filters.status = 'all';

      if (searchInput) searchInput.value = '';
      if (subjectFilter) subjectFilter.value = 'all';
      if (unitFilter) unitFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'all';

      applyFiltersAndRender();
      showToast("Filters Cleared", "Showing all resources.", "info");
    });
  }

  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = `<span class="spinner"></span> Seeding...`;
      await seedDemoData(currentUser);
      await loadAdminData();
      seedBtn.disabled = false;
      seedBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Load Demo Data`;
    });
  }

  // Setup Edit Modal Events
  setupEditModal();
}

async function loadAdminData() {
  try {
    const [resources, stats] = await Promise.all([
      getAllResources(false), // Fetch all including unpublished
      getDashboardStats()
    ]);

    allResources = resources;

    // Update telemetry counters
    const elTotal = document.getElementById('statTotalResources');
    const elPub = document.getElementById('statPublishedResources');
    const elSub = document.getElementById('statTotalSubjects');
    const elUnits = document.getElementById('statTotalUnits');

    if (elTotal) elTotal.textContent = stats.totalResources;
    if (elPub) elPub.textContent = stats.publishedResources;
    if (elSub) elSub.textContent = stats.totalSubjects;
    if (elUnits) elUnits.textContent = stats.totalUnits;

    applyFiltersAndRender();
  } catch (err) {
    console.error("Admin data load error:", err);
    showToast("Load Failed", err.message, "error");
  }
}

function applyFiltersAndRender() {
  let filtered = [...allResources];

  // 1. Text Search across Title, Subject, Unit, FileName, Description
  if (filters.searchQuery) {
    const q = filters.searchQuery;
    filtered = filtered.filter(item => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subjectMatch = (item.subject || '').toLowerCase().includes(q);
      const unitMatch = (item.unit || '').toLowerCase().includes(q);
      const fileMatch = (item.fileName || '').toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      const typeMatch = (item.fileType || item.type || '').toLowerCase().includes(q);
      return titleMatch || subjectMatch || unitMatch || fileMatch || descMatch || typeMatch;
    });
  }

  // 2. Subject Filter
  if (filters.subject !== 'all') {
    filtered = filtered.filter(item => (item.subject || '').toLowerCase() === filters.subject.toLowerCase());
  }

  // 3. Unit Filter
  if (filters.unit !== 'all') {
    filtered = filtered.filter(item => (item.unit || '').toLowerCase() === filters.unit.toLowerCase());
  }

  // 4. Status Filter
  if (filters.status !== 'all') {
    if (filters.status === 'published') {
      filtered = filtered.filter(item => item.isPublished !== false);
    } else if (filters.status === 'unpublished') {
      filtered = filtered.filter(item => item.isPublished === false);
    }
  }

  // Update badge counter
  const badge = document.getElementById('resourceCountBadge');
  if (badge) {
    badge.textContent = `${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'}`;
  }

  renderTable(filtered);
}

function renderTable(resources) {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  if (resources.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-folder-open"></i></div>
          <strong style="display:block; font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 0.25rem;">No matching resources found</strong>
          <p class="text-xs">Adjust your search keyword or filters to locate materials.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = resources.map(res => {
    const isPub = res.isPublished !== false;
    const type = res.fileType || res.type || 'PDF';
    const badge = getTypeBadge(type);
    const unitText = res.unit || 'Unit 1';

    return `
      <tr data-id="${res.id}">
        <td>
          <div style="display:flex; align-items:flex-start; gap:0.75rem;">
            <div class="type-icon ${badge.cssClass}" style="width:36px; height:36px; font-size:1.1rem; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="${badge.icon}"></i>
            </div>
            <div>
              <div style="font-weight:700; color:var(--text-main); font-size:0.95rem; margin-bottom:0.2rem;">
                ${escapeHTML(res.title)}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; margin-bottom:0.25rem;">
                <i class="fa-regular fa-file"></i> ${escapeHTML(res.fileName || res.fileUrl || 'N/A')}
              </div>
              ${res.description ? `
                <div style="font-size:0.8rem; color:var(--text-secondary); max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(res.description)}">
                  ${escapeHTML(res.description)}
                </div>
              ` : ''}
            </div>
          </div>
        </td>

        <td>
          <span class="badge badge-secondary" style="font-size:0.8rem; display:inline-block; margin-bottom:0.25rem;">${escapeHTML(res.subject || 'General')}</span>
          <br>
          <span class="badge badge-primary" style="font-size:0.75rem;">${escapeHTML(unitText)}</span>
        </td>

        <td>
          <span class="badge badge-muted" style="font-weight:700;">${escapeHTML(type)}</span>
        </td>

        <td>
          ${isPub ? `
            <span class="badge badge-success" style="font-size:0.75rem;">
              <i class="fa-solid fa-check"></i> Published
            </span>
          ` : `
            <span class="badge badge-warning" style="font-size:0.75rem;">
              <i class="fa-solid fa-clock"></i> Unpublished
            </span>
          `}
        </td>

        <td style="font-size:0.8rem; color:var(--text-muted);">
          <div>${formatDate(res.createdAt)}</div>
          <div style="font-size:0.75rem;">by ${escapeHTML(res.uploaderName || 'Admin')}</div>
        </td>

        <td style="text-align: right;">
          <div style="display:flex; justify-content:flex-end; gap:0.4rem; flex-wrap:wrap;">
            <!-- Open File -->
            <button type="button" class="btn btn-outline btn-sm action-open-btn" data-url="${escapeHTML(res.fileUrl)}" title="Open resource file">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </button>

            <!-- Toggle Publish -->
            <button type="button" class="btn btn-secondary btn-sm action-toggle-btn" data-id="${res.id}" data-pub="${isPub}" title="${isPub ? 'Unpublish resource' : 'Publish resource'}">
              <i class="fa-solid ${isPub ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isPub ? 'Unpublish' : 'Publish'}
            </button>

            <!-- Edit -->
            <button type="button" class="btn btn-secondary btn-sm action-edit-btn" data-id="${res.id}" title="Edit metadata">
              <i class="fa-solid fa-pen"></i>
            </button>

            <!-- Delete -->
            <button type="button" class="btn btn-danger btn-sm action-delete-btn" data-id="${res.id}" data-title="${escapeHTML(res.title)}" title="Delete Firestore document">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach button event listeners
  tbody.querySelectorAll('.action-open-btn').forEach(btn => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        window.open(url, '_blank');
      } else {
        showToast("Error", "No valid file URL found for this resource.", "warning");
      }
    };
  });

  tbody.querySelectorAll('.action-toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const currentPub = btn.getAttribute('data-pub') === 'true';
      btn.disabled = true;

      try {
        const newStatus = await togglePublishStatus(id, currentPub);
        showToast("Status Updated", `Resource is now ${newStatus ? 'Published' : 'Unpublished'}.`, "success");
        await loadAdminData();
      } catch (err) {
        showToast("Error", err.message, "error");
        btn.disabled = false;
      }
    };
  });

  tbody.querySelectorAll('.action-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const item = allResources.find(r => r.id === id);
      if (item) {
        openEditModal(item);
      }
    };
  });

  tbody.querySelectorAll('.action-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');

      const confirmed = window.confirm(`Are you sure you want to delete the resource "${title}"?\n\nNOTE: This deletes the metadata document from Cloud Firestore. The local physical file in /resources/ is preserved.`);
      if (!confirmed) return;

      try {
        await deleteResource(id);
        showToast("Deleted", "Resource deleted from Cloud Firestore.", "success");
        await loadAdminData();
      } catch (err) {
        console.error("Delete error:", err);
        showToast("Delete Failed", err.message, "error");
      }
    };
  });
}

function setupEditModal() {
  const modal = document.getElementById('editModal');
  const closeBtn = document.getElementById('closeEditModal');
  const cancelBtn = document.getElementById('cancelEditBtn');
  const form = document.getElementById('editResourceForm');

  const closeModal = () => modal?.classList.remove('active');
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const docId = document.getElementById('editDocId').value;
      const title = document.getElementById('editTitle').value.trim();
      const subject = document.getElementById('editSubject').value;
      const unit = document.getElementById('editUnit').value;
      const description = document.getElementById('editDescription').value.trim();
      const fileName = document.getElementById('editFileName').value.trim();
      const fileUrl = document.getElementById('editFileUrl').value.trim();
      const fileType = document.getElementById('editFileType').value;
      const isPublished = document.getElementById('editIsPublished').value === 'true';

      if (!title || !subject || !unit || !fileUrl) {
        showToast("Validation Error", "Title, Subject, Unit, and File URL are required.", "error");
        return;
      }

      const saveBtn = document.getElementById('saveEditBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;

      try {
        await updateResource(docId, {
          title,
          subject,
          unit,
          description,
          fileName: fileName || fileUrl.split('/').pop(),
          fileUrl,
          fileType,
          isPublished
        });

        showToast("Success", "Resource metadata updated successfully in Cloud Firestore!", "success");
        closeModal();
        await loadAdminData();
      } catch (err) {
        console.error("Update error:", err);
        showToast("Update Failed", err.message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Changes`;
      }
    });
  }
}

function openEditModal(resource) {
  const modal = document.getElementById('editModal');
  if (!modal) return;

  document.getElementById('editDocId').value = resource.id;
  document.getElementById('editTitle').value = resource.title || '';
  document.getElementById('editSubject').value = resource.subject || 'Cloud Computing';
  document.getElementById('editUnit').value = resource.unit || 'Unit 1';
  document.getElementById('editDescription').value = resource.description || '';
  document.getElementById('editFileName').value = resource.fileName || '';
  document.getElementById('editFileUrl').value = resource.fileUrl || '';
  document.getElementById('editFileType').value = resource.fileType || resource.type || 'PDF';
  document.getElementById('editIsPublished').value = resource.isPublished !== false ? 'true' : 'false';

  modal.classList.add('active');
}
