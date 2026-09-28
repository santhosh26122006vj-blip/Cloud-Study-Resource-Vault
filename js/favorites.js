/**
 * Favorites Controller
 * Renders user's bookmarked study vault materials with instant preview
 * and removal functionality.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getUserFavoriteResources, toggleFavorite } from './resource-service.js';

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
      countEl.textContent = `${list.length} bookmarked`;
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
        <p>You haven't bookmarked any study resources yet. Click the star icon on any lecture note or question paper to pin it here.</p>
        <a href="resources.html" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-compass"></i> Explore All Resources
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = resources.map(res => {
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
          <button class="fav-btn active" data-fav-id="${res.id}" title="Remove from Favorites">
            <i class="fa-solid fa-star"></i>
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
          <div class="uploader-info">
            <i class="fa-regular fa-user"></i>
            <span>${escapeHTML(res.uploaderName || 'Student')}</span>
            <span>&bull;</span>
            <span>${formatDate(res.createdAt)}</span>
          </div>
          <button class="btn btn-outline btn-sm view-res-btn" data-view-id="${res.id}">
            <i class="fa-solid fa-eye"></i> View
          </button>
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
