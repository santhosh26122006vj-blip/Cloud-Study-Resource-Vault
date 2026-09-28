import { initAuthGuard } from './auth.js';
import { initSidebar, showToast, escapeHTML, formatDate, getTypeBadge } from './ui.js';
import { getUserResources, deleteResource, updateResource } from './resource-service.js';
import { openStudyResource, fileToBase64 } from './file-storage.js';

let currentUser = null;
let resources = [];
const MAX_FILE_BYTES = 700 * 1024;

const extType = (name) => {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'PDF';
  if (n.endsWith('.pptx')) return 'PPTX';
  if (n.endsWith('.ppt')) return 'PPT';
  if (n.endsWith('.docx')) return 'DOCX';
  if (n.endsWith('.doc')) return 'DOC';
  if (n.endsWith('.txt')) return 'TXT';
  return 'Other';
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initAuthGuard({ requireAuth: true, requireAdmin: false }, async (profile) => {
    currentUser = profile;
    await loadResources();
  });
});

async function loadResources() {
  const grid = document.getElementById('myResourcesGrid');
  try {
    resources = await getUserResources(currentUser.uid);
    const count = document.getElementById('myResourcesCount');
    if (count) count.textContent = `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'}`;
    render(resources);
  } catch (error) {
    console.error(error);
    if (grid) grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Unable to load your resources</h3><p>${escapeHTML(error.message)}</p></div>`;
  }
}

function render(items) {
  const grid = document.getElementById('myResourcesGrid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div><h3>No uploads yet</h3><p>Share your first study material with your classmates.</p><a href="add-resource.html" class="btn btn-primary btn-sm">Upload Resource</a></div>`;
    return;
  }

  grid.innerHTML = items.map(res => {
    const badge = getTypeBadge(res.fileType || 'PDF');
    return `<article class="resource-card">
      <div class="card-body">
        <div class="resource-topline">
          <div class="type-icon ${badge.cssClass}"><i class="${badge.icon}"></i></div>
          <span class="badge ${res.isPublished === false ? 'badge-warning' : 'badge-success'}">${res.isPublished === false ? 'Unpublished' : 'Published'}</span>
        </div>
        <span class="badge badge-secondary">${escapeHTML(res.subject || 'General')}</span>
        <span class="badge badge-primary">${escapeHTML(res.unit || 'Unit 1')}</span>
        <h4 class="resource-title">${escapeHTML(res.title)}</h4>
        <p class="resource-description">${escapeHTML(res.description || 'Study resource')}</p>
        <div class="text-xs text-muted"><i class="fa-regular fa-file"></i> ${escapeHTML(res.fileName || 'file')} • ${escapeHTML(res.fileType || 'FILE')}</div>
      </div>
      <div class="card-footer" style="display:flex;gap:.5rem;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm open-btn" data-id="${res.id}"><i class="fa-solid fa-download"></i> Open / Download</button>
        <button class="btn btn-secondary btn-sm edit-btn" data-id="${res.id}"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${res.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('.open-btn').forEach(btn => btn.onclick = async () => {
    const item = resources.find(r => r.id === btn.dataset.id);
    if (item) await openStudyResource(item);
  });
  grid.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = () => removeResource(btn.dataset.id));
  grid.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = () => openEdit(resources.find(r => r.id === btn.dataset.id)));
}

async function removeResource(id) {
  const item = resources.find(r => r.id === id);
  if (!item || !confirm(`Delete "${item.title}" from your uploads?`)) return;
  try {
    await deleteResource(id);
    showToast('Deleted', 'Your resource was removed.', 'success');
    await loadResources();
  } catch (e) {
    showToast('Delete failed', e.message, 'error');
  }
}

function openEdit(item) {
  if (!item) return;
  const modal = document.getElementById('editResourceModal');
  if (!modal) return;
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editDescription').value = item.description || '';
  document.getElementById('editSubject').value = item.subject || 'Other';
  modal.dataset.id = item.id;
  modal.style.display = 'flex';
}

function closeEdit() {
  const modal = document.getElementById('editResourceModal');
  if (modal) modal.style.display = 'none';
  document.getElementById('editFileInput').value = '';
}

document.getElementById('closeEditModalBtn')?.addEventListener('click', closeEdit);
document.getElementById('cancelEditBtn')?.addEventListener('click', closeEdit);

document.getElementById('editResourceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const modal = document.getElementById('editResourceModal');
  const id = modal.dataset.id;
  const item = resources.find(r => r.id === id);
  if (!item) return;
  const newFile = document.getElementById('editFileInput').files[0];
  const data = {
    title: document.getElementById('editTitle').value.trim(),
    description: document.getElementById('editDescription').value.trim(),
    subject: document.getElementById('editSubject').value
  };
  if (!data.title) return showToast('Validation Error', 'Title is required.', 'error');
  if (newFile) {
    if (newFile.size > MAX_FILE_BYTES) return showToast('File Too Large', 'Replacement files must be 700 KB or smaller on the free-plan architecture.', 'error');
    data.fileName = newFile.name;
    data.fileType = extType(newFile.name);
    data.fileSize = newFile.size;
    data.fileUrl = `resources/${encodeURIComponent(newFile.name)}`;
    data.fileData = await fileToBase64(newFile);
  }
  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  try {
    await updateResource(id, data);
    closeEdit();
    showToast('Updated', 'Resource updated successfully.', 'success');
    await loadResources();
  } catch (error) {
    showToast('Update failed', error.message, 'error');
  } finally { btn.disabled = false; }
});
