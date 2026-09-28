/**
 * Favorites Controller
 * Renders user's bookmarked study vault materials with instant open, preview
 * and removal functionality.
 * Spark plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getUserFavoriteResources, toggleFavorite, incrementDownloadCount } from './resource-service.js';
import { openStudyResource } from './file-storage.js';

let currentUser = null;
let favoriteResources = [];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
    currentUser = profile;
    await fetchAndRenderFavorites();
  });
});

async function fetchAndRenderFavorites() {
  try {
    const list = await getUserFavoriteResources(currentUser.uid);
    favoriteResources = list;

    const countEl = document.getElementById('favoritesCount');
    if (countEl) {
      countEl.textContent = `${list.length} ${list.length === 1 ? 'bookmarked' : 'bookmarked'}`;
    }

    renderGrid(favoriteResources);
  } catch (error) {
    console.error("Error loading favorites:", error);
    showToast("Load Failed", error.message, "error");
  }
}

function renderGrid(resources) {
  const container = document.getElementById('favoritesGrid');
  if (!container) return;

  if (resources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-regular fa-star"></i></div>
        <h3>No Favorited Resources Yet</h3>
        <p>You haven't bookmarked any study resources yet. Click the star icon on any lecture note to pin it here.</p>
        <a href="resources.html" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-compass"></i> Explore All Resources
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = resources.map(res => {
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
          <button class="fav-btn active" data-fav-id="${res.id}" title="Remove from Favorites">
            <i class="fa-solid fa-star"></i>
          </button>
        </div>

        <div class="card-body">
          <div class="card-meta-tags">
            <span class="badge badge-secondary">${escapeHTML(res.subject || 'General')}</span>
            <span class="badge badge-primary">${escapeHTML(unitText)}</span>
          </div>

          <h4 class="resource-title" title="${escapeHTML(res.title)}">${escapeHTML(res.title)}</h4>
          <p class="resource-description">${escapeHTML(res.description || 'Comprehensive study reference notes.')}</p>
        </div>

        <div class="card-footer">
          <div class="uploader-info">
            <i class="fa-regular fa-calendar"></i>
            <span>${formatDate(res.createdAt)}</span>
          </div>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-outline btn-sm view-res-btn" data-view-id="${res.id}" title="View Details">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            <button class="btn btn-primary btn-sm open-res-btn" data-url="${escapeHTML(res.fileUrl)}" data-id="${res.id}" data-downloads="${res.downloadCount || 0}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Unfavorite click
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const resId = btn.getAttribute('data-fav-id');
      await toggleFavorite(currentUser.uid, resId);
      showToast("Removed", "Resource removed from your favorites list.", "info");
      await fetchAndRenderFavorites();
    });
  });

  // Open resource click
  container.querySelectorAll('.open-res-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = favoriteResources.find(r => r.id === id);

      if (!item) {
        showToast("Error", "Resource not found.", "warning");
        return;
      }

      incrementDownloadCount(id, item.downloadCount || 0);
      await openStudyResource(item);
    });
  });

  // View modal
  container.querySelectorAll('.view-res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = favoriteResources.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, true, async (id) => {
          const status = await toggleFavorite(currentUser.uid, id);
          await fetchAndRenderFavorites();
          return status;
        });
      }
    });
  });
}
