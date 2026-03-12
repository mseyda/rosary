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
  return new Date((serial - 25569) * 86400 * 1000);
}

function formatDate(serial) {
  const d = excelDateToDate(serial);
  if (!d) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Image Storage ─────────────────────────────────── */
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

/* ── Data Edits Storage ────────────────────────────── */
const EDITS_KEY = 'rosary_edits';

function getAllEdits() {
  return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}');
}

function saveEdit(id, field, value) {
  const edits = getAllEdits();
  if (!edits[id]) edits[id] = {};
  edits[id][field] = value;
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
}

function getItemWithEdits(item) {
  const edits = getAllEdits();
  return { ...item, ...(edits[String(item.id)] || {}) };
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

/* ── Admin UI ──────────────────────────────────────── */
function updateAdminUI() {
  const isAdmin = Auth.isAdmin();
  document.body.classList.toggle('is-admin', isAdmin);

  const lockBtn  = document.getElementById('lock-btn');
  const adminBadge = document.getElementById('admin-badge');

  if (isAdmin) {
    lockBtn.innerHTML = '🔓';
    lockBtn.title = 'Admin — Çıkış Yap';
    adminBadge.style.display = 'inline-flex';
  } else {
    lockBtn.innerHTML = '🔒';
    lockBtn.title = 'Admin Girişi';
    adminBadge.style.display = 'none';
  }

  renderCollection();
  renderArchive();
}

/* ── Auth Modal ────────────────────────────────────── */
function openAuthModal() {
  const isAdmin = Auth.isAdmin();
  if (isAdmin) {
    openLogoutModal();
    return;
  }
  const modal = document.getElementById('auth-modal-overlay');
  const title = document.getElementById('auth-modal-title');
  const hint  = document.getElementById('auth-modal-hint');
  const changePwSection = document.getElementById('change-pw-section');

  if (!Auth.isSetup()) {
    title.textContent = 'Admin Şifresi Belirle';
    hint.textContent  = 'Şifreni ilk kez belirliyorsun. En az 6 karakter.';
    document.getElementById('auth-submit-btn').textContent = 'Şifreyi Kaydet';
  } else {
    title.textContent = 'Admin Girişi';
    hint.textContent  = '';
    document.getElementById('auth-submit-btn').textContent = 'Giriş Yap';
  }

  changePwSection.style.display = 'none';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').textContent = '';
  modal.classList.add('open');
}

function openLogoutModal() {
  const modal = document.getElementById('auth-modal-overlay');
  const title = document.getElementById('auth-modal-title');
  const hint  = document.getElementById('auth-modal-hint');

  title.textContent = 'Admin Paneli';
  hint.textContent  = '';
  document.getElementById('auth-submit-btn').textContent = 'Çıkış Yap';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('change-pw-section').style.display = 'block';
  modal.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').classList.remove('open');
}

function handleAuthSubmit() {
  const pw  = document.getElementById('auth-password').value;
  const err = document.getElementById('auth-error');

  if (Auth.isAdmin()) {
    Auth.logout();
    closeAuthModal();
    updateAdminUI();
    return;
  }

  const res = Auth.isSetup() ? Auth.login(pw) : Auth.setup(pw);
  if (res.ok) {
    closeAuthModal();
    updateAdminUI();
  } else {
    err.textContent = res.msg;
  }
}

function handleChangePassword() {
  const oldPw = document.getElementById('change-old-pw').value;
  const newPw = document.getElementById('change-new-pw').value;
  const err   = document.getElementById('change-pw-error');

  const res = Auth.changePassword(oldPw, newPw);
  if (res.ok) {
    err.style.color = '#6ee7b7';
    err.textContent = 'Şifre değiştirildi.';
    document.getElementById('change-old-pw').value = '';
    document.getElementById('change-new-pw').value = '';
  } else {
    err.style.color = '#ef4444';
    err.textContent = res.msg;
  }
}

/* ── Stats ─────────────────────────────────────────── */
function renderStats() {
  const items    = ROSARY_DATA.collection.map(getItemWithEdits);
  const totalEUR = items.reduce((s, i) => s + (parseFloat(i.valueEUR) || 0), 0);
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
  const items     = ROSARY_DATA.collection;
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
  let items = ROSARY_DATA.collection.map(getItemWithEdits);

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
    'value-desc':  (a, b) => (parseFloat(b.valueEUR) || 0) - (parseFloat(a.valueEUR) || 0),
    'value-asc':   (a, b) => (parseFloat(a.valueEUR) || 0) - (parseFloat(b.valueEUR) || 0),
    'weight-desc': (a, b) => (b.weight || 0) - (a.weight || 0),
    'weight-asc':  (a, b) => (a.weight || 0) - (b.weight || 0),
  };
  items.sort(sortFns[state.sort] || sortFns['date-desc']);
  return items;
}

/* ── Create Card ───────────────────────────────────── */
function createCard(item, isArchive = false) {
  const merged  = getItemWithEdits(item);
  const color   = getColor(merged.color);
  const img     = loadImage(merged.id);
  const isAdmin = Auth.isAdmin();
  const card    = document.createElement('div');
  card.className = 'rosary-card' + (isArchive ? ' is-archive' : '');
  card.dataset.id = merged.id;

  const isGift   = !merged.valueTRY || merged.valueTRY === 0;
  const valueStr = isGift
    ? '<span class="card-value free">Hediye</span>'
    : `<span class="card-value">€${parseFloat(merged.valueEUR).toFixed(2)}</span>`;

  card.innerHTML = `
    <div class="card-color-bar" style="background:${color}"></div>
    <div class="card-image-area">
      ${img
        ? `<img src="${img}" alt="${merged.material}" loading="lazy">`
        : `<div class="card-img-placeholder">📿</div><span class="card-no-img-overlay">Görsel yok</span>`
      }
      ${isAdmin ? `<span class="admin-card-badge">✏️ Admin</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-material">${merged.material}</div>
      <div class="card-maker">
        ${merged.maker}
        <span class="ua-badge">${merged.ua === 'U' ? 'Usta' : 'Atölye'}</span>
      </div>
      <div class="card-meta">
        <span class="badge badge-shape">${merged.shape}</span>
        <span class="badge">${merged.count} tane</span>
        ${merged.weight ? `<span class="badge">${merged.weight}g</span>` : ''}
        ${merged.style === 'S' ? `<span class="badge badge-style-s">Süslü</span>` : ''}
        ${isGift ? `<span class="badge badge-hediye">Hediye</span>` : ''}
        ${isArchive && merged.givenTo ? `<span class="badge" style="color:#6ee7b7;border-color:#065f46">${merged.givenTo}'e verildi</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      ${valueStr}
      <span class="card-date">${formatDate(merged.dateSerial)}</span>
    </div>
  `;

  card.addEventListener('click', () => openModal(item));
  return card;
}

/* ── Render ────────────────────────────────────────── */
function renderCollection() {
  const grid  = document.getElementById('rosary-grid');
  const label = document.getElementById('collection-count');
  const items = getFiltered();

  grid.innerHTML = '';
  label.textContent = `${items.length} tespih`;

  if (items.length === 0) {
    grid.innerHTML = '<div class="no-results">Arama kriterlerine uyan tespih bulunamadı.</div>';
    return;
  }
  items.forEach(item => {
    const original = ROSARY_DATA.collection.find(i => i.id === item.id) || item;
    grid.appendChild(createCard(original));
  });
}

function renderArchive() {
  const grid = document.getElementById('archive-cards');
  grid.innerHTML = '';
  ROSARY_DATA.archive.forEach(item => grid.appendChild(createCard(item, true)));
}

/* ── Modal ─────────────────────────────────────────── */
function openModal(item) {
  state.activeItem = item;
  const merged  = getItemWithEdits(item);
  const overlay = document.getElementById('modal-overlay');
  const isAdmin = Auth.isAdmin();
  const color   = getColor(merged.color);
  const img     = loadImage(merged.id);

  document.getElementById('modal-color-bar').style.background = color;

  // Image
  const imgEl       = document.getElementById('modal-img');
  const placeholder = document.getElementById('modal-img-placeholder');
  const btnRemove   = document.getElementById('btn-remove-img');
  const btnUpload   = document.getElementById('btn-upload');

  if (img) {
    imgEl.src = img;
    imgEl.style.display = 'block';
    placeholder.style.display = 'none';
    btnRemove.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    imgEl.src = '';
    imgEl.style.display = 'none';
    placeholder.style.display = 'flex';
    btnRemove.style.display = 'none';
  }
  btnUpload.style.display   = isAdmin ? 'inline-block' : 'none';

  // Header info
  const isGift = !merged.valueTRY || merged.valueTRY === 0;
  document.getElementById('modal-header').innerHTML = `
    <div class="modal-material">${merged.material}</div>
    <div class="modal-maker">
      ${merged.maker}
      <span class="ua-badge" style="margin-left:0.4rem">${merged.ua === 'U' ? 'Usta' : 'Atölye'}</span>
    </div>
    ${merged.color ? `
      <div class="modal-color-chip">
        <span class="color-dot" style="background:${color}"></span>
        ${merged.color}
      </div>
    ` : '<div style="margin-bottom:1.5rem"></div>'}
  `;

  // Editable fields definition: [label, field, displayValue, isEditable, isNumber]
  const rows = [
    ['Şekil',        'shape',    merged.shape,    false],
    ['Tane Sayısı',  'count',    `${merged.count} adet`, false],
    ['En × Boy',     null,       merged.width && merged.length ? `${merged.width} × ${merged.length} mm` : '—', false],
    ['Ağırlık (g)',  'weight',   merged.weight ? `${merged.weight}` : '—', true],
    ['Tür',          null,       merged.style === 'S' ? 'Süslü' : 'Düz', false],
    ['Renk',         'color',    merged.color || '—', true],
    ['Değer (TRY)',  'valueTRY', isGift ? 'Hediye' : `${parseInt(merged.valueTRY).toLocaleString('tr-TR')} ₺`, true],
    ['Değer (EUR)',  'valueEUR', isGift ? '—' : `€${parseFloat(merged.valueEUR).toFixed(2)}`, true],
    ['Tarih',        null,       formatDate(merged.dateSerial), false],
    ['Satıcı',       null,       merged.seller || '—', false],
    merged.givenTo ? ['Verildi', null, merged.givenTo, false] : null,
  ].filter(Boolean);

  const tableHTML = rows.map(([label, field, display, editable]) => {
    const isValueField = label.includes('Değer');
    const cellClass = isValueField ? 'value-highlight' : '';
    if (editable && isAdmin && field) {
      return `
        <tr>
          <td>${label}</td>
          <td class="${cellClass}">
            <span class="editable-display" data-field="${field}" data-id="${item.id}">${display}</span>
            <button class="inline-edit-btn" data-field="${field}" data-id="${item.id}" title="Düzenle">✏️</button>
          </td>
        </tr>`;
    }
    return `<tr><td>${label}</td><td class="${cellClass}">${display}</td></tr>`;
  }).join('');

  document.getElementById('details-table').innerHTML = tableHTML;

  // Attach inline edit listeners
  if (isAdmin) {
    document.querySelectorAll('.inline-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineEdit(btn.dataset.field, btn.dataset.id, btn);
      });
    });
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ── Inline Editing ────────────────────────────────── */
function startInlineEdit(field, id, btn) {
  const display = btn.previousElementSibling;
  const currentText = display.textContent.replace(/[₺€, ]/g, '').trim();
  const numFields = ['valueTRY', 'valueEUR', 'weight'];
  const isNum = numFields.includes(field);

  const input = document.createElement('input');
  input.type = isNum ? 'number' : 'text';
  input.className = 'inline-edit-input';
  input.value = currentText === '—' ? '' : currentText;
  input.step = isNum ? 'any' : undefined;

  const saveBtn = document.createElement('button');
  saveBtn.className = 'inline-save-btn';
  saveBtn.textContent = '✓';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'inline-cancel-btn';
  cancelBtn.textContent = '✕';

  display.style.display = 'none';
  btn.style.display = 'none';
  btn.after(cancelBtn);
  btn.after(saveBtn);
  btn.after(input);
  input.focus();

  function doSave() {
    const val = isNum ? parseFloat(input.value) : input.value.trim();
    if (input.value.trim() !== '') {
      saveEdit(id, field, val);
      // Update display
      if (field === 'valueTRY') display.textContent = `${parseInt(val).toLocaleString('tr-TR')} ₺`;
      else if (field === 'valueEUR') display.textContent = `€${parseFloat(val).toFixed(2)}`;
      else if (field === 'weight') display.textContent = `${val}`;
      else display.textContent = val;
    }
    cleanup();
    renderStats();
    renderCollection();
  }

  function cleanup() {
    input.remove();
    saveBtn.remove();
    cancelBtn.remove();
    display.style.display = '';
    btn.style.display = '';
  }

  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', cleanup);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') cleanup();
  });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.activeItem = null;
}

/* ── Image Upload ──────────────────────────────────── */
function handleImageUpload(file) {
  if (!file || !state.activeItem || !Auth.isAdmin()) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (saveImage(state.activeItem.id, dataUrl)) {
      const imgEl       = document.getElementById('modal-img');
      const placeholder = document.getElementById('modal-img-placeholder');
      imgEl.src         = dataUrl;
      imgEl.style.display = 'block';
      placeholder.style.display = 'none';
      document.getElementById('btn-remove-img').style.display = 'inline-block';
      renderCollection();
      renderArchive();
    }
  };
  reader.readAsDataURL(file);
}

/* ── Event Listeners ───────────────────────────────── */
function initEvents() {
  // Search & filters
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value.trim();
    renderCollection();
  });

  ['filter-material', 'filter-color', 'filter-maker'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => {
      state[id.replace('filter-', '')] = e.target.value;
      renderCollection();
    });
  });

  document.getElementById('sort-by').addEventListener('change', e => {
    state.sort = e.target.value;
    renderCollection();
  });

  // Lock button → auth modal
  document.getElementById('lock-btn').addEventListener('click', openAuthModal);

  // Auth modal
  document.getElementById('auth-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('auth-modal-overlay')) closeAuthModal();
  });
  document.getElementById('auth-close-btn').addEventListener('click', closeAuthModal);
  document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAuthSubmit();
  });
  document.getElementById('change-pw-btn').addEventListener('click', handleChangePassword);

  // Toggle password visibility
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  // Collection modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeAuthModal();
    }
  });

  // Image upload
  document.getElementById('btn-upload').addEventListener('click', () => {
    if (!Auth.isAdmin()) return;
    document.getElementById('image-input').click();
  });

  document.getElementById('image-input').addEventListener('change', e => {
    handleImageUpload(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('btn-remove-img').addEventListener('click', () => {
    if (!state.activeItem || !Auth.isAdmin()) return;
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
    cards.style.display = state.archiveOpen ? 'grid' : 'none';
    chevron.classList.toggle('open', state.archiveOpen);
  });
}

/* ── Init ──────────────────────────────────────────── */
function init() {
  renderStats();
  populateFilters();
  renderCollection();
  renderArchive();
  updateAdminUI();
  initEvents();
}

document.addEventListener('DOMContentLoaded', init);
