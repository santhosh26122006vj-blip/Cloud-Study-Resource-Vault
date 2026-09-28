/**
 * Resources Browser Controller
 * Full-featured search, subject & unit filtering, file type filtering,
 * and responsive cards with direct resource open/download capabilities.
 * Spark plan compatible: Zero Firebase Storage dependency.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getAllResources, getUserFavoriteIds, toggleFavorite, incrementDownloadCount } from './resource-service.js';
import { openStudyResource } from './file-storage.js';

let currentUser = null;
let allResources = [];
let userFavoriteIds = new Set();

const filters = {
  searchQuery: '',
  subject: 'all',
  unit: 'all',
  type: 'all',
  sortBy: 'newest'
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
    currentUser = profile;

    // Parse URL Query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    const initialSubject = urlParams.get('subject');
    const initialUnit = urlParams.get('unit');

    if (initialQuery) {
      filters.searchQuery = initialQuery.toLowerCase();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = initialQuery;
    }
    if (initialSubject) {
      filters.subject = initialSubject;
      const subSelect = document.getElementById('subjectFilter');
      if (subSelect) subSelect.value = initialSubject;
    }
    if (initialUnit) {
      filters.unit = initialUnit;
      const unitSelect = document.getElementById('unitFilter');
      if (unitSelect) unitSelect.value = initialUnit;
    }

    setupEventListeners();
    await fetchAndRender();
  });
});

function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const subFilter = document.getElementById('subjectFilter');
  const unitFilter = document.getElementById('unitFilter');
  const typeFilter = document.getElementById('typeFilter');
  const sortSelect = document.getElementById('sortSelect');
  const resetBtn = document.getElementById('resetFiltersBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filters.searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  if (subFilter) {
    subFilter.addEventListener('change', (e) => {
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

  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      filters.type = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      filters.sortBy = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      filters.searchQuery = '';
      filters.subject = 'all';
      filters.unit = 'all';
      filters.type = 'all';
      filters.sortBy = 'newest';

      if (searchInput) searchInput.value = '';
      if (subFilter) subFilter.value = 'all';
      if (unitFilter) unitFilter.value = 'all';
      if (typeFilter) typeFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';

      applyFiltersAndRender();
      showToast("Filters Cleared", "Showing all published resources.", "info");
    });
  }
}

async function fetchAndRender() {
  try {
    // Only published resources for students, unless current user is admin
    const isAdmin = currentUser?.role === 'admin';
    const [resources, favIds] = await Promise.all([
      getAllResources(!isAdmin),
      getUserFavoriteIds(currentUser?.uid)
    ]);

    allResources = resources;
    userFavoriteIds = favIds;

    applyFiltersAndRender();
  } catch (error) {
    console.error("Error loading resources:", error);
    showToast("Load Failed", error.message, "error");
  }
}

function applyFiltersAndRender() {
  let filtered = [...allResources];

  // 1. Text Search across Title, Subject, Unit, Description, File Name, File Type
  if (filters.searchQuery) {
    const q = filters.searchQuery;
    filtered = filtered.filter(item => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchSubject = (item.subject || '').toLowerCase().includes(q);
      const matchUnit = (item.unit || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchFile = (item.fileName || '').toLowerCase().includes(q);
      const matchType = (item.fileType || item.type || '').toLowerCase().includes(q);
      return matchTitle || matchSubject || matchUnit || matchDesc || matchFile || matchType;
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

  // 4. File Type Filter
  if (filters.type !== 'all') {
    filtered = filtered.filter(item => {
      const t = (item.fileType || item.type || '').toLowerCase();
      return t === filters.type.toLowerCase();
    });
  }

  // 5. Sorting
  filtered.sort((a, b) => {
    const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
    const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();

    switch (filters.sortBy) {
      case 'oldest':
        return dateA - dateB;
      case 'az':
        return (a.title || '').localeCompare(b.title || '');
      case 'za':
        return (b.title || '').localeCompare(a.title || '');
      case 'newest':
      default:
        return dateB - dateA;
    }
  });

  // Update Result Counter
  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'} available`;
  }

  renderGrid(filtered);
}

function renderGrid(resources) {
  const container = document.getElementById('resourcesBrowserGrid');
  if (!container) return;

  if (resources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <h3>No Resources Found</h3>
        <p>No study materials match your search query and filter criteria. Try adjusting keywords or clear active filters.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="emptyStateResetBtn">
          <i class="fa-solid fa-rotate-left"></i> Reset All Filters
        </button>
      </div>
    `;

    const resetBtn = document.getElementById('emptyStateResetBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        document.getElementById('resetFiltersBtn')?.click();
      };
    }
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
          
          <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; margin-top:0.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <i class="fa-regular fa-file"></i> ${escapeHTML(res.fileName || res.fileUrl || 'resource-file')}
          </div>
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
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Resource
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Favorites toggle listener
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
        showToast("Added to Favorites", "Resource saved to your vault.", "success");
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
      const item = allResources.find(r => r.id === id);

      if (!item) {
        showToast("Error", "Resource not found.", "warning");
        return;
      }

      // Increment download/open counter in Firestore
      incrementDownloadCount(id, item.downloadCount || 0);

      // Open via Blob, Base64, or URL
      await openStudyResource(item);
    });
  });

  // View modal listener
  container.querySelectorAll('.view-resource-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const resId = btn.getAttribute('data-view-id');
      const item = allResources.find(r => r.id === resId);
      if (item) {
        renderResourceDetailModal(item, userFavoriteIds.has(item.id), async (id) => {
          const status = await toggleFavorite(currentUser.uid, id);
          if (status) userFavoriteIds.add(id);
          else userFavoriteIds.delete(id);
          applyFiltersAndRender();
          return status;
        });
      }
    });
  });
}
