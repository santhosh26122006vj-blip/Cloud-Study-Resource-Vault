/**
 * Resources Browser Controller
 * Full-featured search, multi-criteria filtering, multi-order sorting,
 * and reactive UI updates for all cloud study materials.
 */

import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, renderResourceDetailModal, formatDate, getTypeBadge, escapeHTML } from './ui.js';
import { getAllResources, getUserFavoriteIds, toggleFavorite } from './resource-service.js';

let currentUser = null;
let allResources = [];
let userFavoriteIds = new Set();

// Active filter state
const filters = {
  searchQuery: '',
  category: 'all',
  subject: 'all',
  semester: 'all',
  type: 'all',
  sortBy: 'newest'
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();

  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
    currentUser = profile;

    // Parse URL Query parameters (e.g. ?q=cloud or ?category=Notes)
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    const initialCat = urlParams.get('category');
    const initialSubject = urlParams.get('subject');

    if (initialQuery) {
      filters.searchQuery = initialQuery;
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = initialQuery;
    }
    if (initialCat) {
      filters.category = initialCat;
      const catSelect = document.getElementById('categoryFilter');
      if (catSelect) catSelect.value = initialCat;
    }
    if (initialSubject) {
      filters.subject = initialSubject;
      const subSelect = document.getElementById('subjectFilter');
      if (subSelect) subSelect.value = initialSubject;
    }

    setupEventListeners();
    await fetchAndRender();
  });
});

function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const catFilter = document.getElementById('categoryFilter');
  const subFilter = document.getElementById('subjectFilter');
  const semFilter = document.getElementById('semesterFilter');
  const typeFilter = document.getElementById('typeFilter');
  const sortSelect = document.getElementById('sortSelect');
  const resetBtn = document.getElementById('resetFiltersBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filters.searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      filters.category = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (subFilter) {
    subFilter.addEventListener('change', (e) => {
      filters.subject = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (semFilter) {
    semFilter.addEventListener('change', (e) => {
      filters.semester = e.target.value;
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
      filters.category = 'all';
      filters.subject = 'all';
      filters.semester = 'all';
      filters.type = 'all';
      filters.sortBy = 'newest';

      if (searchInput) searchInput.value = '';
      if (catFilter) catFilter.value = 'all';
      if (subFilter) subFilter.value = 'all';
      if (semFilter) semFilter.value = 'all';
      if (typeFilter) typeFilter.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';

      applyFiltersAndRender();
      showToast("Filters Cleared", "Showing all resources.", "info");
    });
  }
}

async function fetchAndRender() {
  try {
    const [resources, favIds] = await Promise.all([
      getAllResources(),
      getUserFavoriteIds(currentUser.uid)
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

  // 1. Text Search across Title, Subject, Category, Description, Tags
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchSubject = (item.subject || '').toLowerCase().includes(q);
      const matchCategory = (item.category || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
      return matchTitle || matchSubject || matchCategory || matchDesc || matchTags;
    });
  }

  // 2. Category Filter
  if (filters.category !== 'all') {
    filtered = filtered.filter(item => (item.category || '').toLowerCase() === filters.category.toLowerCase());
  }

  // 3. Subject Filter
  if (filters.subject !== 'all') {
    filtered = filtered.filter(item => (item.subject || '').toLowerCase() === filters.subject.toLowerCase());
  }

  // 4. Semester Filter
  if (filters.semester !== 'all') {
    filtered = filtered.filter(item => (item.semester || '').toLowerCase() === filters.semester.toLowerCase());
  }

  // 5. Type Filter
  if (filters.type !== 'all') {
    filtered = filtered.filter(item => (item.type || '').toLowerCase() === filters.type.toLowerCase());
  }

  // 6. Sorting
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
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'} found`;
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
        <p>No study materials match your current search query and filter criteria. Try adjusting keywords or clear active filters.</p>
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
              ${res.tags.slice(0, 4).map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join('')}
              ${res.tags.length > 4 ? `<span class="tag-pill">+${res.tags.length - 4}</span>` : ''}
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
        showToast("Added to Favorites", "Resource saved to your vault.", "success");
      } else {
        btn.classList.remove('active');
        icon.className = 'fa-regular fa-star';
        userFavoriteIds.delete(resId);
        showToast("Removed", "Removed from your favorites.", "info");
      }
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
