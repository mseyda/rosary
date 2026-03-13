/* ── Color Map ─────────────────────────────────────── */
const COLOR_MAP = {
  'Damla': '#D4891A', 'Beyaz': '#E8E4D8', 'Siyah': '#2a2a2a',
  'Kahve': '#7A4A2A', 'Sarı': '#D4A820', 'Turuncu': '#D4661A',
  'Mor': '#7A3A9A', 'Mavi Yeşil': '#1A8A7A', 'Yeşil': '#2A7A3A',
  'Pembe': '#C45A7A', 'Bej': '#C8A880', 'Krem': '#C8BC94',
  'Turkuaz': '#1AB0C0', 'Ateş': '#C42A0A', 'Hediye': '#6A8A6A',
  'Çekoslavak': '#4A7A5A', 'default': '#5a4a2a',
};
function getColor(c) { return COLOR_MAP[c] || COLOR_MAP['default']; }

/* ── Date ──────────────────────────────────────────── */
function formatDate(serial) {
  if (!serial) return '—';
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Media Storage ─────────────────────────────────── */
const API_URL    = '/.netlify/functions/rosary-image';
const IMG_PREFIX = 'rosary_img_';    // legacy single-image localStorage key
let   cloudMedia   = {};             // { rosaryId: { images: [url,...], video: url } }
let   stagedPhotos = {};             // { slotIndex: dataUrl } — staged for current item, not yet uploaded
let   customData   = { deleted: [], added: [] }; // from GitHub data/custom.json

function normalizeMedia(raw) {
  if (!raw) return { images: new Array(8).fill(null), video: null };
  if (typeof raw === 'string') {
    const imgs = new Array(8).fill(null); imgs[0] = raw;
    return { images: imgs, video: null };
  }
  const imgs = new Array(8).fill(null);
  (raw.images || []).forEach((u, i) => { if (i < 8) imgs[i] = u || null; });
  return { images: imgs, video: raw.video || null };
}

function getMedia(id) {
  const cloud = cloudMedia[String(id)];
  if (cloud) return normalizeMedia(cloud);
  // Fallback to legacy localStorage
  const legacy = localStorage.getItem(IMG_PREFIX + id);
  if (legacy) { const m = normalizeMedia(null); m.images[0] = legacy; return m; }
  return normalizeMedia(null);
}

function getFirstImage(id) {
  const m = getMedia(id);
  return m.images.find(u => u) || null;
}

// Compress image (max 1200px, 85% JPEG)
function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width: w, height: h } = img;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function cloudUploadImage(id, dataUrl, index) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(id), type: 'image', imageIndex: index, imageBase64: dataUrl }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      const m = normalizeMedia(cloudMedia[String(id)]);
      m.images[index] = json.url;
      cloudMedia[String(id)] = m;
      return json.url;
    }
    console.warn('Cloud upload failed:', json.error);
  } catch (e) { console.warn('Cloud error:', e.message); }
  return null;
}

async function cloudUploadVideo(id, dataUrl, mime) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(id), type: 'video', videoBase64: dataUrl, videoMime: mime }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      const m = normalizeMedia(cloudMedia[String(id)]);
      m.video = json.url;
      cloudMedia[String(id)] = m;
      return json.url;
    }
    console.warn('Video upload failed:', json.error);
  } catch (e) { console.warn('Video error:', e.message); }
  return null;
}

async function cloudSetCover(id, index) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(id), action: 'reorder', fromIndex: 0, toIndex: index }),
    });
    if (res.ok) {
      const m = normalizeMedia(cloudMedia[String(id)]);
      const tmp = m.images[0]; m.images[0] = m.images[index]; m.images[index] = tmp;
      cloudMedia[String(id)] = m;
      return true;
    }
  } catch (e) {}
  return false;
}

async function cloudDeleteImage(id, index) {
  try {
    await fetch(API_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(id), type: 'image', imageIndex: index }),
    });
    const m = normalizeMedia(cloudMedia[String(id)]);
    m.images[index] = null;
    cloudMedia[String(id)] = m;
  } catch (e) {}
}

async function cloudDeleteVideo(id) {
  try {
    await fetch(API_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(id), type: 'video' }),
    });
    const m = normalizeMedia(cloudMedia[String(id)]);
    m.video = null;
    cloudMedia[String(id)] = m;
  } catch (e) {}
}

async function loadCloudMedia() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      const mediaRaw = data.media || data; // backward compat
      Object.keys(mediaRaw).forEach(id => { cloudMedia[id] = normalizeMedia(mediaRaw[id]); });
      if (data.custom) {
        customData.deleted = data.custom.deleted || [];
        customData.added   = data.custom.added   || [];
      }
      renderStats(); populateFilters(); renderCollection(); renderArchive();
    }
  } catch (e) {}
}

async function apiDeleteRosary(item) {
  if (!confirm(`"${item.material}" tespihini silmek istediğine emin misin?\nBu işlem geri alınamaz.`)) return;
  const res = await fetch(API_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminPassword: Auth.getPlaintext(), rosaryId: String(item.id), action: 'deleteRosary' }),
  });
  if (res.ok) {
    customData.deleted.push(String(item.id));
    customData.added = customData.added.filter(r => String(r.id) !== String(item.id));
    closeModal();
    renderStats(); populateFilters(); renderCollection(); renderArchive();
  } else {
    alert('Silinemedi. Tekrar deneyin.');
  }
}

async function apiAddRosary(rosaryData) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminPassword: Auth.getPlaintext(), action: 'addRosary', rosaryData }),
  });
  const json = await res.json();
  if (res.ok && json.ok) {
    customData.added.push({ ...rosaryData, id: json.id });
    renderStats(); populateFilters(); renderCollection();
    return json.id;
  }
  return null;
}

/* ── Data Edits ────────────────────────────────────── */
const EDITS_KEY = 'rosary_edits';
function getAllEdits() { return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}'); }
function saveEdit(id, field, value) {
  const e = getAllEdits(); if (!e[id]) e[id] = {};
  e[id][field] = value; localStorage.setItem(EDITS_KEY, JSON.stringify(e));
}
function getItemWithEdits(item) { return { ...item, ...(getAllEdits()[String(item.id)] || {}) }; }

/* ── State ─────────────────────────────────────────── */
let state = {
  search: '', material: '', color: '', maker: '',
  sort: 'date-desc', archiveOpen: false,
  activeItem: null,
  activeSlot: null, // { type: 'image', index: 0-7 } | { type: 'video' }
};

/* ── Admin UI ──────────────────────────────────────── */
function updateAdminUI() {
  const isAdmin = Auth.isAdmin();
  document.body.classList.toggle('is-admin', isAdmin);
  const lockBtn  = document.getElementById('lock-btn');
  const badge    = document.getElementById('admin-badge');
  const addBtn   = document.getElementById('btn-add-rosary');
  lockBtn.innerHTML   = isAdmin ? '🔓' : '🔒';
  lockBtn.title       = isAdmin ? 'Admin — Çıkış Yap' : 'Admin Girişi';
  badge.style.display = isAdmin ? 'inline-flex' : 'none';
  if (addBtn) addBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  renderCollection(); renderArchive();
}

/* ── Auth Modal ────────────────────────────────────── */
function openAuthModal() {
  if (Auth.isAdmin()) {
    document.getElementById('auth-modal-title').textContent    = 'Admin Paneli';
    document.getElementById('auth-modal-hint').textContent     = '';
    document.getElementById('auth-submit-btn').textContent     = 'Çıkış Yap';
    document.getElementById('auth-password').value             = '';
    document.getElementById('auth-error').textContent          = '';
    document.getElementById('auth-modal-overlay').classList.add('open');
    return;
  }
  document.getElementById('auth-modal-title').textContent    = 'Admin Girişi';
  document.getElementById('auth-modal-hint').textContent     = '';
  document.getElementById('auth-submit-btn').textContent     = 'Giriş Yap';
  document.getElementById('auth-password').value             = '';
  document.getElementById('auth-error').textContent          = '';
  document.getElementById('auth-modal-overlay').classList.add('open');
}
function closeAuthModal() { document.getElementById('auth-modal-overlay').classList.remove('open'); }

async function handleAuthSubmit() {
  const pw  = document.getElementById('auth-password').value;
  const err = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');
  if (Auth.isAdmin()) { Auth.logout(); closeAuthModal(); updateAdminUI(); return; }
  btn.disabled = true; btn.textContent = '…';
  const res = await Auth.login(pw);
  btn.disabled = false; btn.textContent = 'Giriş Yap';
  if (res.ok) { closeAuthModal(); updateAdminUI(); } else { err.textContent = res.msg; }
}

function getAllItems() {
  const deleted = customData.deleted.map(String);
  return [
    ...ROSARY_DATA.collection.filter(i => !deleted.includes(String(i.id))),
    ...customData.added,
  ].map(getItemWithEdits);
}

/* ── Stats ─────────────────────────────────────────── */
function renderStats() {
  const items    = getAllItems();
  const isAdmin  = Auth.isAdmin();
  const totalEUR = items.reduce((s, i) => s + (parseFloat(i.valueEUR) || 0), 0);
  const matCount = {};
  items.forEach(i => { matCount[i.material] = (matCount[i.material] || 0) + 1; });
  const topMat = Object.entries(matCount).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('header-stats').innerHTML = `
    <div class="stat-item"><span class="stat-num">${items.length}</span><span class="stat-lbl">Tespih</span></div>
    ${isAdmin ? `<div class="stat-item"><span class="stat-num">€${totalEUR.toFixed(0)}</span><span class="stat-lbl">Toplam Değer</span></div>` : ''}
    <div class="stat-item"><span class="stat-num">${topMat?.[0] || '—'}</span><span class="stat-lbl">En Çok</span></div>
    <div class="stat-item"><span class="stat-num">${ROSARY_DATA.archive.length}</span><span class="stat-lbl">Arşiv</span></div>`;
}

/* ── Filters ───────────────────────────────────────── */
function populateFilters() {
  const items     = getAllItems();
  const materials = [...new Set(items.map(i => i.material))].sort();
  const colors    = [...new Set(items.map(i => i.color).filter(Boolean))].sort();
  const makers    = [...new Set(items.map(i => i.maker))].sort();
  function fill(id, vals, label) {
    document.getElementById(id).innerHTML = `<option value="">${label}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
  }
  fill('filter-material', materials, 'Tüm Hammaddeler');
  fill('filter-color',    colors,    'Tüm Renkler');
  fill('filter-maker',    makers,    'Tüm Ustalar');
}

function getFiltered() {
  let items = getAllItems();
  if (state.search) {
    const q = state.search.toLowerCase();
    items = items.filter(i => i.maker.toLowerCase().includes(q) || i.material.toLowerCase().includes(q) || (i.color||'').toLowerCase().includes(q) || (i.shape||'').toLowerCase().includes(q));
  }
  if (state.material) items = items.filter(i => i.material === state.material);
  if (state.color)    items = items.filter(i => i.color === state.color);
  if (state.maker)    items = items.filter(i => i.maker === state.maker);
  const fns = {
    'date-desc':   (a,b) => b.dateSerial - a.dateSerial,
    'date-asc':    (a,b) => a.dateSerial - b.dateSerial,
    'value-desc':  (a,b) => (parseFloat(b.valueEUR)||0) - (parseFloat(a.valueEUR)||0),
    'value-asc':   (a,b) => (parseFloat(a.valueEUR)||0) - (parseFloat(b.valueEUR)||0),
    'weight-desc': (a,b) => (b.weight||0) - (a.weight||0),
    'weight-asc':  (a,b) => (a.weight||0) - (b.weight||0),
  };
  items.sort(fns[state.sort] || fns['date-desc']);
  return items;
}

/* ── Card ──────────────────────────────────────────── */
function createCard(item, isArchive = false) {
  const merged  = getItemWithEdits(item);
  const color   = getColor(merged.color);
  const imgUrl  = getFirstImage(merged.id);
  const isAdmin = Auth.isAdmin();
  const isGift  = !merged.valueTRY || merged.valueTRY === 0;
  const card    = document.createElement('div');
  card.className = 'rosary-card' + (isArchive ? ' is-archive' : '');
  card.innerHTML = `
    <div class="card-color-bar" style="background:${color}"></div>
    <div class="card-image-area">
      ${imgUrl ? `<img src="${imgUrl}" alt="${merged.material}" loading="lazy">` : `<div class="card-img-placeholder">📿</div><span class="card-no-img-overlay">Görsel yok</span>`}
      ${isAdmin ? `<span class="admin-card-badge">✏️ Admin</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-material">${merged.material}</div>
      <div class="card-maker">${merged.maker}<span class="ua-badge">${merged.ua==='U'?'Usta':'Atölye'}</span></div>
      <div class="card-meta">
        <span class="badge badge-shape">${merged.shape}</span>
        <span class="badge">${merged.count} tane</span>
        ${merged.weight ? `<span class="badge">${merged.weight}g</span>` : ''}
        ${merged.style==='S' ? `<span class="badge badge-style-s">Süslü</span>` : ''}
        ${isGift ? `<span class="badge badge-hediye">Hediye</span>` : ''}
        ${isArchive && merged.givenTo ? `<span class="badge" style="color:#6ee7b7;border-color:#065f46">${merged.givenTo}'e verildi</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      ${isAdmin ? (isGift ? '<span class="card-value free">Hediye</span>' : `<span class="card-value">€${parseFloat(merged.valueEUR).toFixed(2)}</span>`) : ''}
      <span class="card-date">${formatDate(merged.dateSerial)}</span>
    </div>`;
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
  if (!items.length) { grid.innerHTML = '<div class="no-results">Arama kriterlerine uyan tespih bulunamadı.</div>'; return; }
  items.forEach(item => {
    const orig = ROSARY_DATA.collection.find(i => i.id === item.id) || item;
    grid.appendChild(createCard(orig));
  });
}
function renderArchive() {
  const grid    = document.getElementById('archive-cards');
  const deleted = customData.deleted.map(String);
  grid.innerHTML = '';
  ROSARY_DATA.archive.filter(i => !deleted.includes(String(i.id))).forEach(item => grid.appendChild(createCard(item, true)));
}

/* ── Gallery ───────────────────────────────────────── */
function renderGallery(item) {
  const media   = getMedia(item.id);
  const isAdmin = Auth.isAdmin();

  // Main display
  const imgEl  = document.getElementById('gallery-img');
  const vidEl  = document.getElementById('gallery-video');
  const holdEl = document.getElementById('gallery-placeholder');

  function showInMain(type, src) {
    imgEl.style.display  = 'none';
    vidEl.style.display  = 'none';
    holdEl.style.display = 'none';
    if (type === 'image') { imgEl.src = src; imgEl.style.display = 'block'; }
    else if (type === 'video') { vidEl.src = src; vidEl.style.display = 'block'; vidEl.load(); }
    else { holdEl.style.display = 'flex'; }
  }

  const firstUploaded = media.images.find(u => u);
  const firstStagedIdx = Object.keys(stagedPhotos).map(Number).sort((a,b)=>a-b)[0];
  if (state.activeSlot?.type === 'image') {
    const idx = state.activeSlot.index;
    if (stagedPhotos[idx])      showInMain('image', stagedPhotos[idx]);
    else if (media.images[idx]) showInMain('image', media.images[idx]);
    else if (firstUploaded)     showInMain('image', firstUploaded);
    else if (firstStagedIdx !== undefined) showInMain('image', stagedPhotos[firstStagedIdx]);
    else showInMain('none');
  } else if (state.activeSlot?.type === 'video' && media.video) {
    showInMain('video', media.video);
  } else if (firstUploaded) { showInMain('image', firstUploaded); }
  else if (firstStagedIdx !== undefined) { showInMain('image', stagedPhotos[firstStagedIdx]); }
  else if (media.video) { showInMain('video', media.video); }
  else { showInMain('none'); }

  // Thumbnails
  const thumbsEl = document.getElementById('gallery-thumbs');
  let html = '';

  for (let i = 0; i < 8; i++) {
    const url    = media.images[i];
    const staged = stagedPhotos[i];
    const isActive = state.activeSlot?.type === 'image' && state.activeSlot?.index === i;

    if (staged) {
      const cls = ['gallery-slot', 'staged', isActive ? 'active' : ''].filter(Boolean).join(' ');
      html += `<div class="${cls}" data-type="image" data-index="${i}">
        <img src="${staged}" alt="">
        <span class="staged-badge">↑</span>
      </div>`;
    } else if (url) {
      const cls = ['gallery-slot', 'has-media', i === 0 ? 'is-cover' : '', isActive ? 'active' : ''].filter(Boolean).join(' ');
      html += `<div class="${cls}" data-type="image" data-index="${i}">
        <img src="${url}" loading="lazy" alt="">
        ${i === 0 ? `<span class="cover-badge" title="Kapak fotoğrafı">★</span>` : ''}
        ${isAdmin && i > 0 ? `<button class="slot-cover" data-index="${i}" title="Kapak Yap">★</button>` : ''}
        ${isAdmin ? `<button class="slot-del" data-type="image" data-index="${i}" title="Kaldır">×</button>` : ''}
      </div>`;
    } else if (!isAdmin) {
      html += `<div class="gallery-slot ghost"></div>`;
    } else {
      html += `<div class="gallery-slot empty addable" data-type="image" data-index="${i}" title="Fotoğraf ekle">
        <span class="slot-add-icon">+</span>
      </div>`;
    }
  }

  // Video slot
  const hasVideo = !!media.video;
  const vidActive = state.activeSlot?.type === 'video';
  if (hasVideo) {
    const cls = ['gallery-slot', 'video-slot', 'has-media', vidActive ? 'active' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" data-type="video">
      <span class="slot-video-thumb">▶</span>
      ${isAdmin ? `<button class="slot-del" data-type="video" title="Videoyu kaldır">×</button>` : ''}
    </div>`;
  } else if (isAdmin) {
    html += `<div class="gallery-slot video-slot empty addable" data-type="video" title="Video ekle">
      <span class="slot-add-icon">🎬</span>
    </div>`;
  }

  thumbsEl.innerHTML = html;

  // Upload button
  const uploadBtn = document.getElementById('gallery-upload-btn');
  const stagedCount = Object.keys(stagedPhotos).length;
  if (uploadBtn) {
    uploadBtn.style.display = stagedCount > 0 ? 'block' : 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = `Yükle (${stagedCount})`;
  }

  // Thumb click
  thumbsEl.querySelectorAll('.gallery-slot:not(.ghost)').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('slot-del')) return;
      const type  = el.dataset.type;
      const index = parseInt(el.dataset.index ?? 0);
      if (el.classList.contains('addable') && isAdmin) {
        if (type === 'video') {
          document.getElementById('video-input').click();
          state.activeSlot = { type: 'video' };
        } else {
          state.activeSlot = { type: 'image', index };
          document.getElementById('image-input').click();
        }
      } else {
        state.activeSlot = type === 'video' ? { type: 'video' } : { type: 'image', index };
        renderGallery(item);
      }
    });
  });

  // Cover buttons
  thumbsEl.querySelectorAll('.slot-cover').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      btn.textContent = '⏳';
      const ok = await cloudSetCover(item.id, index);
      if (ok) { state.activeSlot = { type: 'image', index: 0 }; renderGallery(item); renderCollection(); renderArchive(); }
      else { btn.textContent = '★'; alert('Kapak değiştirilemedi.'); }
    });
  });

  // Delete buttons
  thumbsEl.querySelectorAll('.slot-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Bu görseli kaldırmak istediğinize emin misiniz?')) return;
      const type  = btn.dataset.type;
      const index = parseInt(btn.dataset.index ?? 0);
      btn.textContent = '⏳';
      if (type === 'video') { await cloudDeleteVideo(item.id); }
      else { await cloudDeleteImage(item.id, index); localStorage.removeItem(IMG_PREFIX + item.id); }
      state.activeSlot = null;
      renderGallery(item); renderCollection(); renderArchive();
    });
  });
}

/* ── Modal ─────────────────────────────────────────── */
function openModal(item) {
  state.activeItem = item;
  state.activeSlot = null;
  const merged  = getItemWithEdits(item);
  const overlay = document.getElementById('modal-overlay');
  const isAdmin = Auth.isAdmin();
  const color   = getColor(merged.color);
  const isGift  = !merged.valueTRY || merged.valueTRY === 0;

  document.getElementById('modal-color-bar').style.background = color;
  document.getElementById('modal-header').innerHTML = `
    <div class="modal-material">${merged.material}</div>
    <div class="modal-maker">${merged.maker}<span class="ua-badge" style="margin-left:0.4rem">${merged.ua==='U'?'Usta':'Atölye'}</span></div>
    ${merged.color ? `<div class="modal-color-chip"><span class="color-dot" style="background:${color}"></span>${merged.color}</div>` : '<div style="margin-bottom:1.5rem"></div>'}`;

  const rows = [
    ['Şekil',       null,       merged.shape,    false],
    ['Tane Sayısı', null,       `${merged.count} adet`, false],
    ['En × Boy',    null,       merged.width && merged.length ? `${merged.width} × ${merged.length} mm` : '—', false],
    ['Ağırlık (g)', 'weight',   merged.weight ? `${merged.weight}` : '—', true],
    ['Tür',         null,       merged.style==='S' ? 'Süslü' : 'Düz', false],
    ['Renk',        'color',    merged.color || '—', true],
    isAdmin ? ['Değer (TRY)', 'valueTRY', isGift ? 'Hediye' : `${parseInt(merged.valueTRY).toLocaleString('tr-TR')} ₺`, true] : null,
    isAdmin ? ['Değer (EUR)', 'valueEUR', isGift ? '—' : `€${parseFloat(merged.valueEUR).toFixed(2)}`, true] : null,
    ['Tarih',       null,       formatDate(merged.dateSerial), false],
    isAdmin ? ['Satıcı',      null,       merged.seller || '—', false] : null,
    merged.givenTo ? ['Verildi', null, merged.givenTo, false] : null,
  ].filter(Boolean);

  document.getElementById('details-table').innerHTML = rows.map(([label, field, display, editable]) => {
    const cls = label.includes('Değer') ? 'value-highlight' : '';
    if (editable && isAdmin && field) {
      return `<tr><td>${label}</td><td class="${cls}">
        <span class="editable-display" data-field="${field}" data-id="${item.id}">${display}</span>
        <button class="inline-edit-btn" data-field="${field}" data-id="${item.id}" title="Düzenle">✏️</button>
      </td></tr>`;
    }
    return `<tr><td>${label}</td><td class="${cls}">${display}</td></tr>`;
  }).join('');

  if (isAdmin) {
    document.querySelectorAll('.inline-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); startInlineEdit(btn.dataset.field, btn.dataset.id, btn); });
    });
  }

  // Delete button (admin only)
  const delBtn = document.getElementById('modal-delete-btn');
  if (delBtn) {
    delBtn.style.display = isAdmin ? 'block' : 'none';
    delBtn.onclick = () => apiDeleteRosary(item);
  }

  renderGallery(item);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ── Add Rosary Modal ──────────────────────────────── */
function openAddRosaryModal() {
  document.getElementById('add-rosary-form').reset();
  document.getElementById('add-rosary-error').textContent = '';
  document.getElementById('add-rosary-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAddRosaryModal() {
  document.getElementById('add-rosary-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function dateToSerial(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  return Math.round(d.getTime() / 86400000 + 25569);
}

async function handleAddRosarySubmit(e) {
  e.preventDefault();
  const err = document.getElementById('add-rosary-error');
  const btn = document.getElementById('add-rosary-submit');
  const get = id => document.getElementById(id).value.trim();

  const maker = get('f-maker'), material = get('f-material'), shape = get('f-shape');
  const count = parseInt(get('f-count'));
  if (!maker || !material || !shape || !count) {
    err.textContent = 'Usta, hammadde, şekil ve tane sayısı zorunlu.'; return;
  }

  const rosaryData = {
    maker, material, shape, count,
    ua:        get('f-ua')    || 'U',
    style:     get('f-style') || 'D',
    color:     get('f-color') || '',
    width:     parseFloat(get('f-width'))  || null,
    length:    parseFloat(get('f-length')) || null,
    weight:    parseFloat(get('f-weight')) || null,
    valueTRY:  parseFloat(get('f-valueTRY')) || 0,
    valueEUR:  parseFloat(get('f-valueEUR')) || 0,
    dateSerial: dateToSerial(get('f-date')),
    seller:    get('f-seller') || '',
  };

  btn.disabled = true; btn.textContent = 'Ekleniyor…';
  const id = await apiAddRosary(rosaryData);
  btn.disabled = false; btn.textContent = 'Ekle';

  if (id) {
    closeAddRosaryModal();
  } else {
    err.textContent = 'Eklenemedi. Tekrar deneyin.';
  }
}

/* ── Inline Edit ───────────────────────────────────── */
function startInlineEdit(field, id, btn) {
  const display  = btn.previousElementSibling;
  const numFields = ['valueTRY', 'valueEUR', 'weight'];
  const isNum    = numFields.includes(field);
  const curText  = display.textContent.replace(/[₺€, ]/g, '').trim();
  const input    = document.createElement('input');
  input.type     = isNum ? 'number' : 'text';
  input.className = 'inline-edit-input';
  input.value    = curText === '—' ? '' : curText;
  const saveBtn  = document.createElement('button');
  saveBtn.className = 'inline-save-btn'; saveBtn.textContent = '✓';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'inline-cancel-btn'; cancelBtn.textContent = '✕';

  display.style.display = 'none'; btn.style.display = 'none';
  btn.after(cancelBtn); btn.after(saveBtn); btn.after(input);
  input.focus();

  function doSave() {
    if (input.value.trim() !== '') {
      const val = isNum ? parseFloat(input.value) : input.value.trim();
      saveEdit(id, field, val);
      if (field === 'valueTRY')  display.textContent = `${parseInt(val).toLocaleString('tr-TR')} ₺`;
      else if (field === 'valueEUR') display.textContent = `€${parseFloat(val).toFixed(2)}`;
      else display.textContent = val;
    }
    cleanup(); renderStats(); renderCollection();
  }
  function cleanup() { input.remove(); saveBtn.remove(); cancelBtn.remove(); display.style.display = ''; btn.style.display = ''; }
  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', cleanup);
  input.addEventListener('keydown', e => { if (e.key==='Enter') doSave(); if (e.key==='Escape') cleanup(); });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.activeItem = null; state.activeSlot = null;
  stagedPhotos = {};
  const vid = document.getElementById('gallery-video');
  if (vid) { vid.pause(); vid.src = ''; }
}

/* ── Stage Image (preview before upload) ───────────── */
function stageImage(file, index) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const compressed = await compressImage(e.target.result);
    stagedPhotos[index] = compressed;
    state.activeSlot = { type: 'image', index };
    renderGallery(state.activeItem);
  };
  reader.readAsDataURL(file);
}

/* ── Upload Staged Photos ──────────────────────────── */
async function handleUploadStaged() {
  if (!state.activeItem || !Auth.isAdmin()) return;
  const btn = document.getElementById('gallery-upload-btn');
  const indices = Object.keys(stagedPhotos).map(Number).sort((a, b) => a - b);
  if (!indices.length) return;

  btn.disabled = true;
  btn.textContent = 'Yükleniyor…';

  for (const idx of indices) {
    const dataUrl  = stagedPhotos[idx];
    const cloudUrl = await cloudUploadImage(state.activeItem.id, dataUrl, idx);
    if (cloudUrl) {
      delete stagedPhotos[idx];
    } else {
      const rem = Object.keys(stagedPhotos).length;
      btn.disabled = false;
      btn.textContent = `Tekrar Dene (${rem})`;
      alert('Fotoğraf yüklenemedi. Netlify ayarlarında GITHUB_TOKEN ve ADMIN_PASSWORD değerlerini kontrol edin.');
      return;
    }
    const rem = Object.keys(stagedPhotos).length;
    if (rem > 0) btn.textContent = `Yükleniyor… (${rem} kaldı)`;
  }

  renderGallery(state.activeItem);
  renderCollection(); renderArchive();
}

/* ── Video Upload ──────────────────────────────────── */
async function handleVideoUpload(file) {
  if (!file || !state.activeItem || !Auth.isAdmin()) return;
  const MAX_MB = 4;
  if (file.size > MAX_MB * 1024 * 1024) {
    alert(`Video maksimum ${MAX_MB}MB olabilir. Lütfen videoyu kısaltın veya sıkıştırın.\n\nİpucu: 10 saniyenin altındaki kısa klipler genellikle bu sınırın altındadır.`);
    return;
  }
  const vidInput = document.getElementById('video-input');
  vidInput.disabled = true;
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const url = await cloudUploadVideo(state.activeItem.id, e.target.result, file.type);
        if (url) {
          state.activeSlot = { type: 'video' };
          renderGallery(state.activeItem);
          renderCollection(); renderArchive();
        } else {
          alert('Video yüklenemedi. Netlify ayarlarında GITHUB_TOKEN ve ADMIN_PASSWORD değerlerini kontrol edin.');
        }
      } finally { vidInput.disabled = false; }
    };
    reader.readAsDataURL(file);
  } catch { vidInput.disabled = false; }
}

/* ── Events ────────────────────────────────────────── */
function initEvents() {
  document.getElementById('search-input').addEventListener('input', e => { state.search = e.target.value.trim(); renderCollection(); });
  ['filter-material','filter-color','filter-maker'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => { state[id.replace('filter-','')] = e.target.value; renderCollection(); });
  });
  document.getElementById('sort-by').addEventListener('change', e => { state.sort = e.target.value; renderCollection(); });

  document.getElementById('lock-btn').addEventListener('click', openAuthModal);
  document.getElementById('auth-modal-overlay').addEventListener('click', e => { if (e.target===document.getElementById('auth-modal-overlay')) closeAuthModal(); });
  document.getElementById('auth-close-btn').addEventListener('click', closeAuthModal);
  document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
  document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key==='Enter') handleAuthSubmit(); });
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = btn.previousElementSibling;
      inp.type = inp.type==='password' ? 'text' : 'password';
      btn.textContent = inp.type==='password' ? '👁' : '🙈';
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target===document.getElementById('modal-overlay')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key==='Escape') { closeModal(); closeAuthModal(); closeAddRosaryModal(); } });

  document.getElementById('image-input').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (!files.length || !state.activeItem) { e.target.value = ''; return; }
    const media = getMedia(state.activeItem.id);
    const startIdx = state.activeSlot?.type === 'image' ? state.activeSlot.index : 0;
    const emptySlots = [];
    for (let i = 0; i < 8 && emptySlots.length < files.length; i++) {
      const j = (startIdx + i) % 8;
      if (!media.images[j] && !stagedPhotos[j]) emptySlots.push(j);
    }
    files.forEach((file, i) => { if (i < emptySlots.length) stageImage(file, emptySlots[i]); });
    e.target.value = '';
  });
  document.getElementById('video-input').addEventListener('change', e => { handleVideoUpload(e.target.files[0]); e.target.value=''; });
  document.getElementById('gallery-upload-btn').addEventListener('click', handleUploadStaged);

  document.getElementById('btn-add-rosary').addEventListener('click', openAddRosaryModal);
  document.getElementById('add-rosary-close').addEventListener('click', closeAddRosaryModal);
  document.getElementById('add-rosary-overlay').addEventListener('click', e => { if (e.target === document.getElementById('add-rosary-overlay')) closeAddRosaryModal(); });
  document.getElementById('add-rosary-form').addEventListener('submit', handleAddRosarySubmit);

  document.getElementById('archive-toggle').addEventListener('click', () => {
    state.archiveOpen = !state.archiveOpen;
    document.getElementById('archive-cards').style.display = state.archiveOpen ? 'grid' : 'none';
    document.querySelector('.archive-chevron').classList.toggle('open', state.archiveOpen);
  });
}

/* ── Init ──────────────────────────────────────────── */
function init() {
  renderStats(); populateFilters(); renderCollection(); renderArchive();
  updateAdminUI(); initEvents();
  loadCloudMedia();
}
document.addEventListener('DOMContentLoaded', init);
