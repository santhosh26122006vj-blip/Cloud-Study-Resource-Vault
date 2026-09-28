/**
 * Admin Dashboard & Governance Controller
 * Enforces admin-only security gate, visualizes system telemetry,
 * manages student accounts, and moderates all uploaded cloud resources.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, showConfirmModal, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getAdminStats, getAllResources, getAllUsers, deleteResource } from './resource-service.js';
import { seedDemoData } from './demo-data.js';

let currentAdmin = null;
let allResourcesList = [];
let allUsersList = [];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  // Strict route guard requiring role: "admin"
  initAuthGuard({ requireAuth: true, requireAdmin: true }, async (profile) => {
    currentAdmin = profile;
    await loadAdminDashboard();
  });

  const seedBtn = document.getElementById('adminSeedDataBtn');
  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = `<span class="spinner"></span> Seeding...`;
      await seedDemoData(currentAdmin);
      await loadAdminDashboard();
      seedBtn.disabled = false;
      seedBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Seed Demo Resources`;
    });
  }
});

async function loadAdminDashboard() {
  try {
    const [stats, resources, users] = await Promise.all([
      getAdminStats(),
      getAllResources(),
      getAllUsers()
    ]);

    allResourcesList = resources;
    allUsersList = users;

    // Render Stats
    document.getElementById('adminTotalUsers').textContent = stats.totalUsers;
    document.getElementById('adminTotalResources').textContent = stats.totalResources;
    document.getElementById('adminTotalNotes').textContent = stats.totalNotes;
    document.getElementById('adminTotalQuestionPapers').textContent = stats.totalQuestionPapers;
    document.getElementById('adminTotalPresentations').textContent = stats.totalPresentations;
    document.getElementById('adminTotalAssignments').textContent = stats.totalAssignments;

    renderResourcesTable(allResourcesList);
    renderUsersTable(allUsersList);

  } catch (error) {
    console.error("Admin dashboard load error:", error);
    showToast("Telemetry Sync Error", error.message, "error");
  }
}

function renderResourcesTable(resources) {
  const tbody = document.getElementById('adminResourcesTableBody');
  if (!tbody) return;

  if (resources.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding:2rem; color:var(--text-muted);">
          No resources uploaded yet. Click "Seed Demo Resources" to populate demo records.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = resources.map(res => {
    const badge = getTypeBadge(res.type);

    return `
      <tr data-res-id="${res.id}">
        <td>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <div class="type-icon ${badge.cssClass}" style="width:28px; height:28px; font-size:0.8rem;">
              <i class="${badge.icon}"></i>
            </div>
            <div>
              <strong style="color:var(--text-main);">${escapeHTML(res.title)}</strong>
              <div class="text-xs text-muted">${escapeHTML(res.subject)} &bull; ${escapeHTML(res.semester || 'All')}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-primary">${escapeHTML(res.category)}</span>
        </td>
        <td>
          <div>${escapeHTML(res.uploaderName || 'Student')}</div>
        </td>
        <td>
          <span class="text-sm text-muted">${formatDate(res.createdAt)}</span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <button class="btn btn-outline btn-sm admin-view-res-btn" data-view-id="${res.id}" title="View Details">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-icon btn-sm admin-del-res-btn" data-del-id="${res.id}" title="Delete Resource" style="color:var(--danger); border-color:var(--danger-border);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // View modal
  tbody.querySelectorAll('.admin-view-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = allResourcesList.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, false, null);
      }
    });
  });

  // Delete modal
  tbody.querySelectorAll('.admin-del-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-del-id');
      const item = allResourcesList.find(r => r.id === resId);
      if (item) {
        showConfirmModal({
          title: "Admin Moderation: Delete Resource",
          message: `Are you sure you want to administratively delete "${item.title}"? This permanently removes the file from cloud storage.`,
          confirmText: "Delete Permanently",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            try {
              await deleteResource(item.id, item.fileUrl);
              showToast("Resource Deleted", "Administrative deletion completed.", "info");
              await loadAdminDashboard();
            } catch (err) {
              console.error("Admin delete failed:", err);
              showToast("Delete Failed", err.message, "error");
            }
          }
        });
      }
    });
  });
}

function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding:2rem; color:var(--text-muted);">
          No user profiles registered yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const roleBadge = u.role === 'admin'
      ? `<span class="badge badge-warning"><i class="fa-solid fa-shield"></i> ADMIN</span>`
      : `<span class="badge badge-primary"><i class="fa-solid fa-graduation-cap"></i> STUDENT</span>`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <div class="user-avatar-circle" style="width:32px; height:32px; font-size:0.85rem;">
              ${(u.name || 'U').charAt(0).toUpperCase()}
            </div>
            <strong>${escapeHTML(u.name || 'Unnamed')}</strong>
          </div>
        </td>
        <td>
          <span style="color:var(--text-secondary);">${escapeHTML(u.email || 'N/A')}</span>
        </td>
        <td>
          ${roleBadge}
        </td>
        <td>
          <span class="text-sm text-muted">${formatDate(u.createdAt)}</span>
        </td>
      </tr>
    `;
  }).join('');
}
