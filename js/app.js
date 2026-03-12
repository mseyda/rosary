/* ── Color Map ─────────────────────────────────────── */
const COLOR_MAP = {
  'Damla':       '#D4891A',
  'Beyaz':       '#E8E4D8',
  'Siyah':       '#2a2a2a',
  'Kahve':       '#7A4A2A',
  'Sarı':        '#D4A820',
  'Turuncu':     '#D4661A',
  'Mor':         '#7A3A9A',
  'Mavi Yeşil':  '#1A8A7A',
  'Yeşil':       '#2A7A3A',
  'Pembe':       '#C45A7A',
  'Bej':         '#C8A880',
  'Krem':        '#C8BC94',
  'Turkuaz':     '#1AB0C0',
  'Ateş':        '#C42A0A',
  'Hediye':      '#6A8A6A',
  'Çekoslavak':  '#4A7A5A',
  'default':     '#5a4a2a',
};

function getColor(colorName) {
  return COLOR_MAP[colorName] || COLOR_MAP['default'];
}

/* ── Date Helpers ──────────────────────────────────── */
function excelDateToDate(serial) {
  if (!serial) return null;
  const utcDays = serial - 25569;
  return new Date(utcDays * 86400 * 1000);
}

function formatDate(serial) {
  const d = excelDateToDate(serial);
  if (!d) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Image Storage (localStorage) ─────────────────── */
const IMG_PREFIX = 'rosary_img_';

function saveImage(id, dataUrl) {
  try {
    localStorage.setItem(IMG_PREFIX + id, dataUrl);
    return true;
  } catch (e) {
    alert('Görsel kaydedilemedi. Tarayıcı depolama alanı dolu olabilir.');
    return false;
  }
}

function loadImage(id) {
  return localStorage.getItem(IMG_PREFIX + id) || null;
}

function removeImage(id) {
  localStorage.removeItem(IMG_PREFIX + id);
}

/* ── State ─────────────────────────────────────────── */
let state = {
  search: '',
  material: '',
  color: '',
  maker: '',
  sort: 'date-desc',
  archiveOpen: false,
  activeItem: null,
};

/* ── Stats ─────────────────────────────────────────── */
function renderStats() {
  const items = ROSARY_DATA.collection;
  const totalEUR = items.reduce((s, i) => s + (i.valueEUR || 0), 0);

  // Most common material
  const matCount = {};
  items.forEach(i => { matCount[i.material] = (matCount[i.material] || 0) + 1; });
  const topMat = Object.entries(matCount).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('header-stats').innerHTML = `
    <div class="stat-item">
      <span class="stat-num">${items.length}</span>
      <span class="stat-lbl">Tespih</span>
    </div>
    <div class="stat-item">
      <span class="stat-num">€${totalEUR.toFixed(0)}</span>
      <span class="stat-lbl">Toplam Değer</span>
    </div>
    <div class="stat-item">
      <span class="stat-num">${topMat ? topMat[0] : '—'}</span>
      <span class="stat-lbl">En Çok</span>
    </div>
    <div class="stat-item">
      <span class="stat-num">${ROSARY_DATA.archive.length}</span>
      <span class="stat-lbl">Arşiv</span>
    </div>
  `;
}

/* ── Populate Filters ──────────────────────────────── */
function populateFilters() {
  const items = ROSARY_DATA.collection;
  const materials = [...new Set(items.map(i => i.material))].sort();
  const colors    = [...new Set(items.map(i => i.color).filter(Boolean))].sort();
  const makers    = [...new Set(items.map(i => i.maker))].sort();

  function fillSelect(id, values, label) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${label}</option>` +
      values.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  fillSelect('filter-material', materials, 'Tüm Hammaddeler');
  fillSelect('filter-color',    colors,    'Tüm Renkler');
  fillSelect('filter-maker',    makers,    'Tüm Ustalar');
}

/* ── Filter & Sort ─────────────────────────────────── */
function getFiltered() {
  let items = [...ROSARY_DATA.collection];

  if (state.search) {
    const q = state.search.toLowerCase();
    items = items.filter(i =>
      i.maker.toLowerCase().includes(q) ||
      i.material.toLowerCase().includes(q) ||
      (i.color || '').toLowerCase().includes(q) ||
      (i.shape || '').toLowerCase().includes(q)
    );
  }

  if (state.material) items = items.filter(i => i.material === state.material);
  if (state.color)    items = items.filter(i => i.color === state.color);
  if (state.maker)    items = items.filter(i => i.maker === state.maker);

  const sortFns = {
    'date-desc':   (a, b) => b.dateSerial - a.dateSerial,
    'date-asc':    (a, b) => a.dateSerial - b.dateSerial,
    'value-desc':  (a, b) => b.valueEUR - a.valueEUR,
    'value-asc':   (a, b) => a.valueEUR - b.valueEUR,
    'weight-desc': (a, b) => (b.weight || 0) - (a.weight || 0),
    'weight-asc':  (a, b) => (a.weight || 0) - (b.weight || 0),
  };
  items.sort(sortFns[state.sort] || sortFns['date-desc']);
  return items;
}

/* ── Create Card Element ───────────────────────────── */
function createCard(item, isArchive = false) {
  const color = getColor(item.color);
  const img   = loadImage(item.id);
  const card  = document.createElement('div');
  card.className = 'rosary-card' + (isArchive ? ' is-archive' : '');
  card.dataset.id = item.id;

  const isGift  = item.valueTRY === 0;
  const valueStr = isGift
    ? '<span class="card-value free">Hediye</span>'
    : `<span class="card-value">€${item.valueEUR.toFixed(2)}</span>`;

  card.innerHTML = `
    <div class="card-color-bar" style="background:${color}"></div>
    <div class="card-image-area">
      ${img
        ? `<img src="${img}" alt="${item.material}" loading="lazy">`
        : `<div class="card-img-placeholder">📿</div><span class="card-no-img-overlay">Görsel yok</span>`
      }
    </div>
    <div class="card-body">
      <div class="card-material">${item.material}</div>
      <div class="card-maker">
        ${item.maker}
        <span class="ua-badge">${item.ua === 'U' ? 'Usta' : 'Atölye'}</span>
      </div>
      <div class="card-meta">
        <span class="badge badge-shape">${item.shape}</span>
        <span class="badge">${item.count} tane</span>
        ${item.weight ? `<span class="badge">${item.weight}g</span>` : ''}
        ${item.style === 'S' ? `<span class="badge badge-style-s">Süslü</span>` : ''}
        ${isGift ? `<span class="badge badge-hediye">Hediye</span>` : ''}
        ${isArchive && item.givenTo ? `<span class="badge" style="color:#6ee7b7;border-color:#065f46">${item.givenTo}'e verildi</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      ${valueStr}
      <span class="card-date">${formatDate(item.dateSerial)}</span>
    </div>
  `;

  card.addEventListener('click', () => openModal(item));
  return card;
}

/* ── Render Collection ─────────────────────────────── */
function renderCollection() {
  const grid    = document.getElementById('rosary-grid');
  const label   = document.getElementById('collection-count');
  const items   = getFiltered();

  grid.innerHTML = '';
  label.textContent = `${items.length} tespih`;

  if (items.length === 0) {
    grid.innerHTML = '<div class="no-results">Arama kriterlerine uyan tespih bulunamadı.</div>';
    return;
  }

  items.forEach(item => grid.appendChild(createCard(item)));
}

/* ── Render Archive ────────────────────────────────── */
function renderArchive() {
  const grid = document.getElementById('archive-cards');
  grid.innerHTML = '';
  ROSARY_DATA.archive.forEach(item => grid.appendChild(createCard(item, true)));
}

/* ── Modal ─────────────────────────────────────────── */
function openModal(item) {
  state.activeItem = item;
  const overlay = document.getElementById('modal-overlay');
  const color   = getColor(item.color);
  const img     = loadImage(item.id);

  // Color bar
  document.getElementById('modal-color-bar').style.background = color;

  // Image
  const imgEl       = document.getElementById('modal-img');
  const placeholder = document.getElementById('modal-img-placeholder');
  const btnRemove   = document.getElementById('btn-remove-img');

  if (img) {
    imgEl.src = img;
    imgEl.style.display = 'block';
    placeholder.style.display = 'none';
    btnRemove.style.display = 'inline-block';
  } else {
    imgEl.src = '';
    imgEl.style.display = 'none';
    placeholder.style.display = 'flex';
    btnRemove.style.display = 'none';
  }

  // Header info
  const isGift = item.valueTRY === 0;
  document.getElementById('modal-header').innerHTML = `
    <div class="modal-material">${item.material}</div>
    <div class="modal-maker">
      ${item.maker}
      <span class="ua-badge" style="margin-left:0.4rem">${item.ua === 'U' ? 'Usta' : 'Atölye'}</span>
    </div>
    ${item.color ? `
      <div class="modal-color-chip">
        <span class="color-dot" style="background:${color}"></span>
        ${item.color}
      </div>
    ` : '<div style="margin-bottom:1.5rem"></div>'}
  `;

  // Details table
  const rows = [
    ['Şekil',      item.shape],
    ['Tane Sayısı', `${item.count} adet`],
    ['En × Boy',   item.width && item.length ? `${item.width} × ${item.length} mm` : '—'],
    ['Ağırlık',    item.weight ? `${item.weight} g` : '—'],
    ['Tür',        item.style === 'S' ? 'Süslü' : 'Düz'],
    ['Değer (TRY)', isGift ? 'Hediye' : `${item.valueTRY.toLocaleString('tr-TR')} ₺`],
    ['Değer (EUR)', isGift ? '—' : `€${item.valueEUR.toFixed(2)}`],
    ['Tarih',      formatDate(item.dateSerial)],
    ['Satıcı',     item.seller || '—'],
    item.givenTo ? ['Verildi',  item.givenTo] : null,
  ].filter(Boolean);

  document.getElementById('details-table').innerHTML = rows
    .map(([k, v]) => `
      <tr>
        <td>${k}</td>
        <td class="${k.includes('Değer') ? 'value-highlight' : ''}">${v}</td>
      </tr>
    `).join('');

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.activeItem = null;
}

/* ── Image Upload ──────────────────────────────────── */
function handleImageUpload(file) {
  if (!file || !state.activeItem) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (saveImage(state.activeItem.id, dataUrl)) {
      // Update modal view
      const imgEl       = document.getElementById('modal-img');
      const placeholder = document.getElementById('modal-img-placeholder');
      imgEl.src         = dataUrl;
      imgEl.style.display = 'block';
      placeholder.style.display = 'none';
      document.getElementById('btn-remove-img').style.display = 'inline-block';
      // Refresh card in grid
      renderCollection();
      renderArchive();
    }
  };
  reader.readAsDataURL(file);
}

/* ── Event Listeners ───────────────────────────────── */
function initEvents() {
  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    renderCollection();
  });

  // Filters
  ['filter-material', 'filter-color', 'filter-maker'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => {
      state[id.replace('filter-', '')] = e.target.value;
      renderCollection();
    });
  });

  // Sort
  document.getElementById('sort-by').addEventListener('change', e => {
    state.sort = e.target.value;
    renderCollection();
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Image upload
  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('image-input').click();
  });

  document.getElementById('image-input').addEventListener('change', e => {
    handleImageUpload(e.target.files[0]);
    e.target.value = ''; // reset so same file can be re-selected
  });

  // Remove image
  document.getElementById('btn-remove-img').addEventListener('click', () => {
    if (!state.activeItem) return;
    if (!confirm('Görseli kaldırmak istediğinize emin misiniz?')) return;
    removeImage(state.activeItem.id);
    const imgEl       = document.getElementById('modal-img');
    const placeholder = document.getElementById('modal-img-placeholder');
    imgEl.src         = '';
    imgEl.style.display = 'none';
    placeholder.style.display = 'flex';
    document.getElementById('btn-remove-img').style.display = 'none';
    renderCollection();
    renderArchive();
  });

  // Archive toggle
  document.getElementById('archive-toggle').addEventListener('click', () => {
    state.archiveOpen = !state.archiveOpen;
    const cards   = document.getElementById('archive-cards');
    const chevron = document.querySelector('.archive-chevron');
    cards.style.display   = state.archiveOpen ? 'grid' : 'none';
    chevron.classList.toggle('open', state.archiveOpen);
  });
}

/* ── Init ──────────────────────────────────────────── */
function init() {
  renderStats();
  populateFilters();
  renderCollection();
  renderArchive();
  initEvents();
}

document.addEventListener('DOMContentLoaded', init);
