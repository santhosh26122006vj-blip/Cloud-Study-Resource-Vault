/**
 * Student Dashboard Controller
 * Displays dynamic statistics, quick shortcuts, recently added study materials,
 * and facilitates instant resource preview and favoriting.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getDashboardStats, getRecentlyAddedResources, getUserFavoriteIds, toggleFavorite } from './resource-service.js';
import { seedDemoData } from './demo-data.js';

let currentUser = null;
let userFavoriteIds = new Set();
let recentResources = [];

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
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

  // Seed demo data button
  const seedBtn = document.getElementById('seedDemoDataBtn');
  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = `<span class="spinner"></span> Seeding...`;
      await seedDemoData(currentUser);
      await loadDashboardData();
      seedBtn.disabled = false;
      seedBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Load Demo College Resources`;
    });
  }
});

async function loadDashboardData() {
  const statsContainer = document.getElementById('dashboardStats');
  const recentContainer = document.getElementById('recentResourcesGrid');

  try {
    // 1. Fetch Stats & Favorites concurrently
    const [stats, favIds, recents] = await Promise.all([
      getDashboardStats(currentUser.uid),
      getUserFavoriteIds(currentUser.uid),
      getRecentlyAddedResources(6)
    ]);

    userFavoriteIds = favIds;
    recentResources = recents;

    // Update Stats Elements
    document.getElementById('statTotalResources').textContent = stats.totalResources;
    document.getElementById('statMyResources').textContent = stats.myResources;
    document.getElementById('statFavorites').textContent = stats.favorites;
    document.getElementById('statQuestionPapers').textContent = stats.questionPapers;

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
        <p>Your cloud repository is currently clean. Start by uploading lecture notes, question papers, or load demo curriculum data.</p>
        <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
          <a href="add-resource.html" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Resource
          </a>
          <button type="button" class="btn btn-secondary btn-sm" id="emptyStateSeedBtn">
            <i class="fa-solid fa-database"></i> Load Sample Resources
          </button>
        </div>
      </div>
    `;

    const emptySeed = document.getElementById('emptyStateSeedBtn');
    if (emptySeed) {
      emptySeed.onclick = async () => {
        emptySeed.disabled = true;
        await seedDemoData(currentUser);
        await loadDashboardData();
      };
    }
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
          <div class="uploader-info">
            <i class="fa-regular fa-user"></i>
            <span>${escapeHTML(res.uploaderName || 'Student')}</span>
            <span>&bull;</span>
            <span>${formatDate(res.createdAt)}</span>
          </div>
          <button class="btn btn-outline btn-sm view-resource-btn" data-view-id="${res.id}">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners for Favorites & View Modal
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
      
      // Update favorites metric counter
      document.getElementById('statFavorites').textContent = userFavoriteIds.size;
    });
  });

  container.querySelectorAll('.view-resource-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = recentResources.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, userFavoriteIds.has(item.id), async (id) => {
          const status = await toggleFavorite(currentUser.uid, id);
          if (status) userFavoriteIds.add(id);
          else userFavoriteIds.delete(id);
          document.getElementById('statFavorites').textContent = userFavoriteIds.size;
          renderRecentResources(recentResources);
          return status;
        });
      }
    });
  });
}
