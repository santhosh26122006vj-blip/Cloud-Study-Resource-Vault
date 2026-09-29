/**
 * Dashboard Controller
 * Displays personal vault statistics (Total Resources, Saved Resources, Subjects, Units),
 * quick shortcuts, recently added study materials, and direct resource access.
 * Spark plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getDashboardStats, getRecentlyAddedResources, getUserFavoriteIds, toggleFavorite, incrementDownloadCount } from './resource-service.js';
import { openStudyResource } from './file-storage.js';

let currentUser = null;
let userFavoriteIds = new Set();
let recentResources = [];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true }, async (profile) => {
    currentUser = profile;
    const greetingEl = document.getElementById('welcomeGreeting');
    if (greetingEl) {
      greetingEl.textContent = `Welcome back, ${profile.name || 'Student'} 👋`;
    }

    await loadDashboardData();
  });

  // Search input redirect
  const dashSearch = document.getElementById('dashboardSearchInput');
  const dashSearchBtn = document.getElementById('dashboardSearchBtn');
  const handleSearch = () => {
    const q = dashSearch?.value.trim();
    if (q) {
      window.location.href = `resources.html?q=${encodeURIComponent(q)}`;
    }
  };

  if (dashSearch) {
    dashSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }
  if (dashSearchBtn) {
    dashSearchBtn.addEventListener('click', handleSearch);
  }

});

async function loadDashboardData() {
  try {
    // 1. Fetch Stats & Favorites concurrently
    const [stats, favIds, recents] = await Promise.all([
      getDashboardStats(currentUser?.uid),
      getUserFavoriteIds(currentUser?.uid),
      getRecentlyAddedResources(6)
    ]);

    userFavoriteIds = favIds;
    recentResources = recents;

    // Update Telemetry Elements
    const elTotal = document.getElementById('statTotalResources');
    const elPub = document.getElementById('statSavedResources');
    const elSub = document.getElementById('statTotalSubjects');
    const elUnits = document.getElementById('statTotalUnits');

    if (elTotal) elTotal.textContent = stats.totalResources;
    if (elPub) elPub.textContent = stats.savedResources;
    if (elSub) elSub.textContent = stats.totalSubjects;
    if (elUnits) elUnits.textContent = stats.totalUnits;

    // Render Recent Resources
    renderRecentResources(recentResources);

  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showToast("Data Sync Error", error.message, "error");
  }
}

function renderRecentResources(resources) {
  const container = document.getElementById('recentResourcesGrid');
  if (!container) return;

  if (!resources || resources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
        <h3>No Study Resources Yet</h3>
        <p>Your personal cloud vault is empty. Upload your first study resource to get started.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = resources.map(res => {
    const isFav = userFavoriteIds.has(res.id);
    const fileType = res.fileType || res.type || 'PDF';
    const badge = getTypeBadge(fileType);
    const unitText = res.unit || 'Unit 1';

    return `
      <div class="resource-card" data-id="${res.id}">
        <div class="card-header-type">
          <div class="type-indicator">
            <div class="type-icon ${badge.cssClass}">
              <i class="${badge.icon}"></i>
            </div>
            <span>${escapeHTML(fileType)}</span>
          </div>
          <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-id="${res.id}" title="${isFav ? 'Remove Favorite' : 'Save to Favorites'}">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
        </div>

        <div class="card-body">
          <div class="card-meta-tags">
            <span class="badge badge-secondary">${escapeHTML(res.subject || 'General')}</span>
            <span class="badge badge-primary">${escapeHTML(unitText)}</span>
          </div>

          <h4 class="resource-title" title="${escapeHTML(res.title)}">${escapeHTML(res.title)}</h4>
          <p class="resource-description">${escapeHTML(res.description || 'Comprehensive notes and study reference material.')}</p>
        </div>

        <div class="card-footer">
          <div class="uploader-info">
            <i class="fa-regular fa-calendar"></i>
            <span>${formatDate(res.createdAt)}</span>
          </div>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-outline btn-sm view-resource-btn" data-view-id="${res.id}" title="View Details">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            <button class="btn btn-primary btn-sm open-resource-btn" data-url="${escapeHTML(res.fileUrl)}" data-id="${res.id}" data-downloads="${res.downloadCount || 0}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Favorites listener
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
        showToast("Added to Favorites", "Saved to your study collection.", "success");
      } else {
        btn.classList.remove('active');
        icon.className = 'fa-regular fa-star';
        userFavoriteIds.delete(resId);
        showToast("Removed", "Removed from your favorites.", "info");
      }
    });
  });

  // Open resource button listener
  container.querySelectorAll('.open-resource-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = recentResources.find(r => r.id === id);

      if (!item) {
        showToast("Error", "Resource not found.", "warning");
        return;
      }

      incrementDownloadCount(id, item.downloadCount || 0);
      await openStudyResource(item);
    });
  });

  // View modal listener
  container.querySelectorAll('.view-resource-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = recentResources.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, userFavoriteIds.has(item.id), async (id) => {
          const status = await toggleFavorite(currentUser.uid, id);
          if (status) userFavoriteIds.add(id);
          else userFavoriteIds.delete(id);
          renderRecentResources(recentResources);
          return status;
        });
      }
    });
  });
}
