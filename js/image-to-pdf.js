import { initAuthGuard } from './auth.js';
import { initSidebar } from './ui.js';

const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const qualitySettings = { high: 0.94, medium: 0.82, standard: 0.68 };
const marginSettings = { none: 0, small: 8, normal: 16 };
const maxImageEdge = 3508;

let selectedImages = [];
let draggedImageId = null;
let isConverting = false;

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initAuthGuard({ requireAuth: true });
  bindImageTool();
});

function bindImageTool() {
  const fileInput = document.getElementById('imageFiles');
  const selectButton = document.getElementById('selectImagesBtn');
  const dropzone = document.getElementById('imageDropzone');
  const clearButton = document.getElementById('clearImagesBtn');
  const convertButton = document.getElementById('convertImagesBtn');
  const grid = document.getElementById('imagePreviewGrid');

  selectButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addSelectedFiles(fileInput.files);
    fileInput.value = '';
  });
  clearButton.addEventListener('click', clearSelectedImages);
  convertButton.addEventListener('click', convertImagesToPdf);

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', (event) => {
    if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    addSelectedFiles(event.dataTransfer?.files || []);
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || isConverting) return;

    const card = button.closest('[data-image-id]');
    if (!card) return;

    if (button.dataset.action === 'remove') {
      removeImage(card.dataset.imageId);
    } else if (button.dataset.action === 'move-up') {
      moveImage(card.dataset.imageId, -1);
    } else if (button.dataset.action === 'move-down') {
      moveImage(card.dataset.imageId, 1);
    }
  });

  grid.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-image-id]');
    if (!card || isConverting || event.target.closest('button')) {
      event.preventDefault();
      return;
    }
    draggedImageId = card.dataset.imageId;
    card.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedImageId);
  });

  grid.addEventListener('dragend', (event) => {
    event.target.closest('[data-image-id]')?.classList.remove('is-dragging');
    draggedImageId = null;
  });

  grid.addEventListener('dragover', (event) => {
    if (event.target.closest('[data-image-id]')) event.preventDefault();
  });

  grid.addEventListener('drop', (event) => {
    const targetCard = event.target.closest('[data-image-id]');
    if (!targetCard || !draggedImageId || draggedImageId === targetCard.dataset.imageId) return;
    event.preventDefault();
    moveImageBefore(draggedImageId, targetCard.dataset.imageId);
  });

  window.addEventListener('beforeunload', releaseImageUrls);
  renderSelectedImages();
}

function addSelectedFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const validFiles = files.filter(isSupportedImage);
  const hasUnsupported = validFiles.length !== files.length;

  validFiles.forEach((file) => {
    selectedImages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file)
    });
  });

  renderSelectedImages();
  if (hasUnsupported) {
    showStatus('Please select JPG, PNG, or WebP images.', 'error');
  } else if (validFiles.length) {
    clearStatus();
  }
}

function isSupportedImage(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);
  return validExtension && (!file.type || supportedTypes.has(file.type.toLowerCase()));
}

function renderSelectedImages() {
  const grid = document.getElementById('imagePreviewGrid');
  const count = document.getElementById('imageCount');
  const emptyState = document.getElementById('imageEmptyState');
  const clearButton = document.getElementById('clearImagesBtn');
  const convertButton = document.getElementById('convertImagesBtn');

  count.textContent = String(selectedImages.length);
  emptyState.hidden = selectedImages.length > 0;
  clearButton.disabled = selectedImages.length === 0 || isConverting;
  convertButton.disabled = isConverting;
  grid.replaceChildren(...selectedImages.map((image, index) => createImageCard(image, index)));
}

function createImageCard(image, index) {
  const card = document.createElement('article');
  card.className = 'image-pdf-image-card';
  card.dataset.imageId = image.id;
  card.draggable = !isConverting;

  const thumbnailWrap = document.createElement('div');
  thumbnailWrap.className = 'image-pdf-thumb-wrap';

  const thumbnail = document.createElement('img');
  thumbnail.className = 'image-pdf-thumb';
  thumbnail.src = image.url;
  thumbnail.alt = `Preview of ${image.file.name}`;
  thumbnail.loading = 'lazy';

  const order = document.createElement('span');
  order.className = 'image-pdf-order';
  order.textContent = String(index + 1);
  order.setAttribute('aria-label', `Page ${index + 1}`);
  thumbnailWrap.append(thumbnail, order);

  const details = document.createElement('div');
  details.className = 'image-pdf-card-details';
  const filename = document.createElement('span');
  filename.className = 'image-pdf-filename';
  filename.textContent = image.file.name;
  filename.title = image.file.name;

  const actions = document.createElement('div');
  actions.className = 'image-pdf-card-actions';
  actions.append(
    createCardButton('move-up', 'Move image up', 'fa-arrow-up', index === 0),
    createCardButton('move-down', 'Move image down', 'fa-arrow-down', index === selectedImages.length - 1),
    createCardButton('remove', `Remove ${image.file.name}`, 'fa-xmark', false, true)
  );
  details.append(filename, actions);
  card.append(thumbnailWrap, details);
  return card;
}

function createCardButton(action, label, icon, disabled, isRemove = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn-icon image-pdf-${isRemove ? 'remove' : 'reorder'}`;
  button.dataset.action = action;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.disabled = disabled || isConverting;
  const glyph = document.createElement('i');
  glyph.className = `fa-solid ${icon}`;
  button.appendChild(glyph);
  return button;
}

function removeImage(imageId) {
  const index = selectedImages.findIndex((image) => image.id === imageId);
  if (index === -1) return;
  URL.revokeObjectURL(selectedImages[index].url);
  selectedImages.splice(index, 1);
  renderSelectedImages();
}

function clearSelectedImages() {
  if (isConverting) return;
  releaseImageUrls();
  selectedImages = [];
  renderSelectedImages();
  clearStatus();
}

function releaseImageUrls() {
  selectedImages.forEach((image) => URL.revokeObjectURL(image.url));
}

function moveImage(imageId, offset) {
  const fromIndex = selectedImages.findIndex((image) => image.id === imageId);
  const toIndex = fromIndex + offset;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= selectedImages.length) return;
  const [image] = selectedImages.splice(fromIndex, 1);
  selectedImages.splice(toIndex, 0, image);
  renderSelectedImages();
}

function moveImageBefore(imageId, targetId) {
  const fromIndex = selectedImages.findIndex((image) => image.id === imageId);
  const targetIndex = selectedImages.findIndex((image) => image.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) return;
  const [image] = selectedImages.splice(fromIndex, 1);
  const insertionIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
  selectedImages.splice(insertionIndex, 0, image);
  renderSelectedImages();
}

async function convertImagesToPdf() {
  if (!selectedImages.length) {
    showStatus('Please select at least one image.', 'error');
    return;
  }

  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) {
    showStatus('The PDF tool could not load. Check your connection and try again.', 'error');
    return;
  }

  setBusy(true);
  clearStatus();

  try {
    const pageChoice = document.getElementById('pageSize').value;
    const quality = qualitySettings[document.getElementById('imageQuality').value] || qualitySettings.high;
    const requestedMargin = marginSettings[document.getElementById('pageMargins').value] ?? marginSettings.normal;
    const preparedImages = [];

    for (const selected of selectedImages) {
      preparedImages.push(await prepareImage(selected, quality));
    }

    const firstPage = getPageDimensions(pageChoice, preparedImages[0]);
    const pdf = new JsPDF({
      orientation: firstPage.orientation,
      unit: 'mm',
      format: firstPage.format,
      compress: true
    });

    preparedImages.forEach((image, index) => {
      const page = getPageDimensions(pageChoice, image);
      if (index > 0) pdf.addPage(page.format, page.orientation);

      const margin = Math.min(requestedMargin, page.width / 10, page.height / 10);
      const availableWidth = page.width - margin * 2;
      const availableHeight = page.height - margin * 2;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (page.width - width) / 2;
      const y = (page.height - height) / 2;

      pdf.addImage(image.dataUrl, 'JPEG', x, y, width, height);
    });

    pdf.save('cloud-study-images.pdf');
    showStatus('PDF created successfully.', 'success');
  } catch {
    showStatus('Unable to process this image. Please try another file.', 'error');
  } finally {
    setBusy(false);
  }
}

async function prepareImage(selected, quality) {
  const image = new Image();
  image.src = selected.url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image dimensions');

  const scale = Math.min(1, maxImageEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('Image encoding failed');
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
}

function getPageDimensions(pageChoice, image) {
  if (pageChoice === 'a4-landscape') {
    return { width: 297, height: 210, orientation: 'landscape', format: 'a4' };
  }
  if (pageChoice === 'original') {
    const longestEdge = 297;
    const ratio = image.width / image.height;
    const width = ratio >= 1 ? longestEdge : longestEdge * ratio;
    const height = ratio >= 1 ? longestEdge / ratio : longestEdge;
    return { width, height, orientation: ratio >= 1 ? 'landscape' : 'portrait', format: [width, height] };
  }
  return { width: 210, height: 297, orientation: 'portrait', format: 'a4' };
}

function setBusy(busy) {
  isConverting = busy;
  document.getElementById('selectImagesBtn').disabled = busy;
  document.getElementById('imageFiles').disabled = busy;
  document.getElementById('pageSize').disabled = busy;
  document.getElementById('imageQuality').disabled = busy;
  document.getElementById('pageMargins').disabled = busy;
  document.getElementById('convertImagesBtn').innerHTML = busy
    ? '<span class="spinner" aria-hidden="true"></span> Creating PDF...'
    : '<i class="fa-solid fa-file-arrow-down"></i> Convert to PDF';
  renderSelectedImages();
}

function showStatus(message, type) {
  const status = document.getElementById('imagePdfStatus');
  status.textContent = message;
  status.className = `image-pdf-status is-${type}`;
  status.hidden = false;
}

function clearStatus() {
  const status = document.getElementById('imagePdfStatus');
  status.hidden = true;
  status.textContent = '';
  status.className = 'image-pdf-status';
}