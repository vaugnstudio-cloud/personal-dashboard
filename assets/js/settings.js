/* ============================================================
   settings.js — shared Settings drawer for every page.
   Injects its own DOM (same IDs the tours target), applies
   theme + white-label branding at load, and exposes
   window.SettingsUI = { open, close, applyBrand }.
   Load order: after store/crm-store/sheets-sync, before page apps.
   ============================================================ */

(function () {
  'use strict';

  if (!Store.state) Store.load();
  if (window.CrmStore && !CrmStore.state) CrmStore.load();

  const $ = (sel) => document.querySelector(sel);
  const PAGE = document.body.dataset.page || 'dashboard';

  const THEMES = [
    { id: 'midnight', name: 'Midnight', bg: '#0a0c10', text: '#eef1f6', grad: 'linear-gradient(120deg,#7c5cff,#2dd4ff)' },
    { id: 'creme', name: 'Crème', bg: '#f7f2ea', text: '#221e19', grad: 'linear-gradient(120deg,#6247d9,#0e7e99)' },
    { id: 'ink', name: 'Ink & Gold', bg: '#090e1a', text: '#f2efe8', grad: 'linear-gradient(120deg,#d9a44e,#7cc7f0)', badge: 'Recommended' },
  ];

  /* ══════════════ Injected DOM ══════════════ */

  const host = document.createElement('div');
  host.innerHTML = `
  <div class="scrim" id="settingsScrim"></div>
  <aside class="drawer" id="drawer" aria-hidden="true" aria-label="Settings">
    <div class="drawer__head">
      <h2 class="drawer__title">Settings</h2>
      <button class="drawer__close" id="drawerClose" aria-label="Close settings">✕</button>
    </div>

    <div class="drawer__section" id="drawerAppearance">
      <h3>Appearance</h3>
      <p>Pick a theme — your choice is remembered on this device.</p>
      <div class="theme-grid" id="themeGrid"></div>
      <label class="field"><span>Company / app name</span>
        <input type="text" id="brandNameInput" placeholder="Your studio or brand name" maxlength="24" />
      </label>
      <label class="field"><span>Tagline</span>
        <input type="text" id="brandTagInput" placeholder="e.g. Personal Dashboard · Studio HQ" maxlength="28" />
      </label>
      <span class="field" style="margin-bottom:6px"><span>Logo</span></span>
      <div class="brand-logo-row">
        <span class="brand__mark" id="logoPreview">S</span>
        <div class="btn-row" style="flex:1">
          <label class="btn file-btn">Upload logo<input type="file" id="logoInput" accept="image/*" hidden /></label>
          <button class="btn btn--ghost" id="logoReset">Reset</button>
        </div>
      </div>
    </div>

    <div class="drawer__section" id="drawerHowTo">
      <h3>How to use</h3>
      <p>New here? Browse the Help Center or let the app walk you through it.</p>
      <div class="btn-row">
        <button class="btn" id="howtoReadBtn">📖 Help Center</button>
        <button class="btn btn--primary" id="howtoTourBtn">🧭 Guide me</button>
      </div>
    </div>

    <div class="drawer__section" id="drawerPrefs">
      <h3>Preferences</h3>
      <p>Display options for the whole app.</p>
      <label class="field"><span>Your name</span>
        <input type="text" id="nameInput" placeholder="Your name" />
      </label>
      <label class="field"><span>Currency</span>
        <select id="currencySelect">
          <option value="USD">USD — US Dollar</option>
          <option value="EUR">EUR — Euro</option>
          <option value="GBP">GBP — British Pound</option>
          <option value="PHP">PHP — Philippine Peso</option>
          <option value="AUD">AUD — Australian Dollar</option>
          <option value="CAD">CAD — Canadian Dollar</option>
        </select>
      </label>
      <label class="field"><span>Weight unit</span>
        <select id="weightUnitSelect">
          <option value="lbs">Pounds (lbs)</option>
          <option value="kg">Kilograms (kg)</option>
        </select>
      </label>
      <label class="rcp-toggle"><input type="checkbox" id="kpiSyncToggle" checked /> Auto-sync Leads &amp; Clients from Pipeline</label>
    </div>

    <div class="drawer__section" id="drawerSheets">
      <h3>Google Sheets sync</h3>
      <p>Optional. Deploy <code>apps-script/Code.gs</code> as a Web App under your own Google account, then paste its URL here. The URL is stored only in this browser. Setup guide in the Help Center.</p>
      <label class="field"><span>Apps Script Web App URL</span>
        <input type="url" id="sheetsUrlInput" placeholder="https://script.google.com/macros/s/…/exec" />
      </label>
      <div class="btn-row">
        <button class="btn btn--primary" id="pushBtn">Push to Sheet</button>
        <button class="btn" id="pullBtn">Pull from Sheet</button>
      </div>
    </div>

    <div class="drawer__section" id="drawerBackup">
      <h3>Backup</h3>
      <p><strong>Your data lives only in this browser.</strong> Clearing your browser or switching devices erases it — so export a backup regularly (or use Google Sheets sync above). Two files: dashboard metrics and pipeline leads.</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">⬇ Dashboard JSON</button>
        <button class="btn" id="exportCrmBtn">⬇ Pipeline JSON</button>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <label class="btn file-btn">⬆ Import dashboard<input type="file" id="importInput" accept="application/json,.json" hidden /></label>
        <label class="btn file-btn">⬆ Import pipeline<input type="file" id="importCrmInput" accept="application/json,.json" hidden /></label>
      </div>
    </div>

    <div class="drawer__section" id="drawerSample">
      <h3>Sample data</h3>
      <p id="sampleBlurb">Explore every feature with realistic demo data. Your real data is safely paused and restored exactly as it was when you exit.</p>
      <div class="btn-row">
        <button class="btn" id="sampleToggleBtn">✨ Explore with sample data</button>
      </div>
    </div>

    <div class="drawer__section">
      <h3>Danger zone</h3>
      <p>Erase everything stored in this browser and start over.</p>
      <div class="btn-row">
        <button class="btn btn--danger" id="resetBtn">Reset all data</button>
      </div>
    </div>
  </aside>`;
  document.body.appendChild(host);

  /* ══════════════ Toast (local, works on any page) ══════════════ */

  let toastTimer;
  function toast(msg, kind = 'ok') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast is-visible toast--${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  /* ══════════════ Theme ══════════════ */

  function applyTheme(id) {
    if (id && id !== 'midnight') document.documentElement.dataset.theme = id;
    else delete document.documentElement.dataset.theme;
    renderThemeGrid();
    // charts re-read the palette on next render
    document.dispatchEvent(new CustomEvent('theme:changed'));
  }

  function renderThemeGrid() {
    const active = Store.state.settings.theme || 'midnight';
    $('#themeGrid').innerHTML = THEMES.map((t) => `
      <button class="theme-card ${t.id === active ? 'is-active' : ''}" data-theme-pick="${t.id}">
        <span class="theme-card__preview" style="background:${t.bg}; --tp-grad:${t.grad}; --tp-text:${t.text}"></span>
        <span class="theme-card__name">${t.name}</span>
        ${t.badge ? `<span class="theme-card__badge">★ ${t.badge}</span>` : '<span class="theme-card__badge">&nbsp;</span>'}
      </button>`).join('');
  }

  $('#themeGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-theme-pick]');
    if (!card) return;
    Store.setSetting('theme', card.dataset.themePick);
    applyTheme(card.dataset.themePick);
    toast(`Theme: ${THEMES.find((t) => t.id === card.dataset.themePick).name}`);
  });

  /* ══════════════ White-label branding ══════════════ */

  const DEFAULT_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%237c5cff'/><text x='50' y='68' font-size='52' font-family='sans-serif' font-weight='700' text-anchor='middle' fill='%230a0c10'>V</text></svg>";

  /** Only trust logos that look like the canvas output we generate —
      guards against a crafted backup file injecting markup via the src attr. */
  function safeLogo(v) {
    return typeof v === 'string' && v.startsWith('data:image/') && !/["'<>\s]/.test(v) ? v : null;
  }

  function applyBrand() {
    const s = Store.state.settings;
    const name = s.brandName || 'Vaugn Studio';
    const tag = s.brandTag || 'Personal Dashboard';
    const logo = safeLogo(s.brandLogo);

    document.querySelectorAll('.topbar .brand').forEach((brand) => {
      const mark = brand.querySelector('.brand__mark');
      if (logo) mark.innerHTML = `<img src="${logo}" alt="" />`;
      else mark.textContent = (name.trim()[0] || 'S').toUpperCase();
      const textSpan = brand.querySelector(':scope > span:not(.brand__mark)');
      if (textSpan) textSpan.childNodes[0].textContent = `\n          ${name}\n          `;
      const sub = brand.querySelector('.brand__sub');
      if (sub) sub.textContent = tag;
    });
    // favicon
    let icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = logo || DEFAULT_ICON;
    // drawer preview
    const prev = $('#logoPreview');
    if (prev) prev.innerHTML = logo ? `<img src="${logo}" alt="" />` : (name.trim()[0] || 'S').toUpperCase();
    // consistent per-page titles that follow the brand name
    const PAGE_LABELS = { dashboard: 'Dashboard', crm: 'Sales Pipeline', reports: 'Reports' };
    document.title = `${PAGE_LABELS[PAGE] || 'Dashboard'} — ${name}`;
  }

  $('#brandNameInput').addEventListener('change', (e) => {
    Store.setSetting('brandName', e.target.value.trim());
    applyBrand();
    toast('App name updated.');
  });
  $('#brandTagInput').addEventListener('change', (e) => {
    Store.setSetting('brandTag', e.target.value.trim());
    applyBrand();
  });

  /* ── Logo crop dialog (drag to position, slider to zoom) ── */

  const FRAME = 240;       // must match .cropper__frame in CSS
  const OUT = 128;         // exported square size
  const crop = { url: null, source: null, nw: 0, nh: 0, base: 1, zoom: 1, ox: 0, oy: 0, drag: null };

  const cropHost = document.createElement('div');
  cropHost.innerHTML = `
    <div class="cropper" id="logoCropper" hidden role="dialog" aria-modal="true" aria-label="Position your logo">
      <div class="cropper__card">
        <h3 class="cropper__title">Position your logo</h3>
        <p class="cropper__hint">Drag to move · slider to zoom. It locks to a clean square.</p>
        <div class="cropper__frame" id="cropFrame"><img id="cropImg" alt="" draggable="false" /></div>
        <div class="cropper__row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M21 21l-4-4"/></svg>
          <input type="range" id="cropZoom" class="cropper__zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom" />
        </div>
        <div class="btn-row">
          <button class="btn btn--primary" id="cropSave">Save logo</button>
          <button class="btn" id="cropCancel">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(cropHost);

  const dispScale = () => crop.base * crop.zoom;

  function clampCrop() {
    const dw = crop.nw * dispScale(), dh = crop.nh * dispScale();
    crop.ox = Math.min(0, Math.max(FRAME - dw, crop.ox));
    crop.oy = Math.min(0, Math.max(FRAME - dh, crop.oy));
  }
  function layoutCrop() {
    clampCrop();
    const el = $('#cropImg');
    el.style.width = `${crop.nw * dispScale()}px`;
    el.style.height = `${crop.nh * dispScale()}px`;
    el.style.left = `${crop.ox}px`;
    el.style.top = `${crop.oy}px`;
  }

  function openCropper(file) {
    if (!/^image\//.test(file.type)) { toast('Please choose an image file.', 'error'); return; }
    if (file.size > 12 * 1024 * 1024) { toast('That image is too large (max 12 MB).', 'error'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      crop.url = url; crop.source = img; crop.nw = img.naturalWidth; crop.nh = img.naturalHeight;
      crop.base = FRAME / Math.min(crop.nw, crop.nh);   // cover the frame at zoom 1
      crop.zoom = 1;
      crop.ox = (FRAME - crop.nw * crop.base) / 2;        // centered
      crop.oy = (FRAME - crop.nh * crop.base) / 2;
      $('#cropImg').src = url;
      $('#cropZoom').value = 1;
      layoutCrop();
      $('#logoCropper').hidden = false;
    };
    img.onerror = () => { toast('Could not read that image.', 'error'); URL.revokeObjectURL(url); };
    img.src = url;
  }

  function closeCropper() {
    $('#logoCropper').hidden = true;
    if (crop.url) { URL.revokeObjectURL(crop.url); crop.url = null; crop.source = null; }
  }

  $('#cropZoom').addEventListener('input', (e) => {
    const old = dispScale();
    const cx = (FRAME / 2 - crop.ox) / old;   // keep frame centre stable while zooming
    const cy = (FRAME / 2 - crop.oy) / old;
    crop.zoom = parseFloat(e.target.value);
    const ns = dispScale();
    crop.ox = FRAME / 2 - cx * ns;
    crop.oy = FRAME / 2 - cy * ns;
    layoutCrop();
  });

  const frame = $('#cropFrame');
  frame.addEventListener('pointerdown', (e) => {
    crop.drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy };
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', (e) => {
    if (!crop.drag) return;
    crop.ox = crop.drag.ox + (e.clientX - crop.drag.x);
    crop.oy = crop.drag.oy + (e.clientY - crop.drag.y);
    layoutCrop();
  });
  const endDrag = () => { crop.drag = null; };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  $('#cropSave').addEventListener('click', () => {
    const c = document.createElement('canvas');
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext('2d');
    const ds = dispScale();
    const sx = (-crop.ox) / ds;
    const sy = (-crop.oy) / ds;
    const sSize = FRAME / ds;
    ctx.drawImage(crop.source, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    Store.setSetting('brandLogo', c.toDataURL('image/png'));
    applyBrand();
    closeCropper();
    toast('Logo updated everywhere.');
  });
  $('#cropCancel').addEventListener('click', closeCropper);
  $('#logoCropper').addEventListener('click', (e) => { if (e.target.id === 'logoCropper') closeCropper(); });

  $('#logoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) openCropper(file);
    e.target.value = '';
  });

  $('#logoReset').addEventListener('click', () => {
    Store.setSetting('brandLogo', null);
    applyBrand();
    toast('Logo reset.');
  });

  /* ══════════════ Drawer open/close ══════════════ */

  const drawer = $('#drawer');
  const scrim = $('#settingsScrim');

  function open() {
    drawer.classList.add('is-open');
    scrim.classList.add('is-visible');
    drawer.setAttribute('aria-hidden', 'false');
    const s = Store.state.settings;
    $('#currencySelect').value = s.currency;
    $('#weightUnitSelect').value = s.weightUnit;
    $('#nameInput').value = s.ownerName || '';
    $('#sheetsUrlInput').value = s.sheetsUrl || '';
    $('#brandNameInput').value = s.brandName || '';
    $('#brandTagInput').value = s.brandTag || '';
    $('#kpiSyncToggle').checked = s.kpiSync !== false;
    renderThemeGrid();
    renderSampleBtn();
  }
  function close() {
    if (drawer.contains(document.activeElement)) document.activeElement.blur();
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    drawer.setAttribute('aria-hidden', 'true');
  }

  const settingsBtn = $('#settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', open);
  $('#drawerClose').addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !(window.Tour && Tour.active) && !(window.HelpUI && HelpUI.anyOpen())) close();
  });

  /* ══════════════ Preferences ══════════════ */

  $('#currencySelect').addEventListener('change', (e) => {
    Store.setSetting('currency', e.target.value);
    toast(`Currency set to ${e.target.value}`);
  });
  $('#weightUnitSelect').addEventListener('change', (e) => {
    Store.setSetting('weightUnit', e.target.value);
    toast(`Weight unit set to ${e.target.value}`);
  });
  $('#nameInput').addEventListener('change', (e) => {
    Store.setSetting('ownerName', e.target.value.trim());
  });
  $('#kpiSyncToggle').addEventListener('change', (e) => {
    Store.setSetting('kpiSync', e.target.checked);
    toast(e.target.checked ? 'Leads & Clients now sync from your pipeline.' : 'Leads & Clients are manual again.');
  });

  /* ══════════════ Sheets sync ══════════════ */

  $('#sheetsUrlInput').addEventListener('change', (e) => {
    Store.setSetting('sheetsUrl', e.target.value.trim());
    toast(e.target.value.trim() ? 'Sheets URL saved (kept only in this browser).' : 'Sheets sync disabled.');
  });

  const sampleActive = () => { try { return localStorage.getItem('vaugn.sample') === '1'; } catch (e) { return false; } };

  async function runSync(kind) {
    if (sampleActive()) { toast('Sheets sync is disabled in sample mode.', 'error'); return; }
    const btn = kind === 'pull' ? $('#pullBtn') : $('#pushBtn');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      if (kind === 'pull') {
        const n = await SheetsSync.pull();
        toast(n ? `Pulled ${n} value${n === 1 ? '' : 's'} from your sheet.` : 'Sheet had no matching values yet — try Push first.');
      } else {
        const n = await SheetsSync.push();
        toast(`Pushed ${n} metrics to your sheet.`);
      }
    } catch (err) {
      toast(err.message || 'Sync failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  }
  $('#pullBtn').addEventListener('click', () => runSync('pull'));
  $('#pushBtn').addEventListener('click', () => runSync('push'));

  /* ══════════════ Backups ══════════════ */

  function markBackedUp() {
    Store.setSetting('backedUp', true);
    Store.setSetting('lastBackup', new Date().toISOString());
    dismissBackupReminder();
  }
  $('#exportBtn').addEventListener('click', () => {
    Store.exportJSON();
    markBackedUp();
    toast('Dashboard backup downloaded. 💾');
  });
  $('#exportCrmBtn').addEventListener('click', () => {
    if (window.CrmStore) { CrmStore.exportJSON(); markBackedUp(); toast('Pipeline backup downloaded. 💾'); }
  });
  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { Store.importJSON(await file.text()); applyBrand(); applyTheme(Store.state.settings.theme); toast('Dashboard backup restored.'); }
    catch (err) { toast(err.message || 'Could not import that file.', 'error'); }
    e.target.value = '';
  });
  $('#importCrmInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !window.CrmStore) return;
    try { toast(`Imported ${CrmStore.importJSON(await file.text())} leads.`); }
    catch (err) { toast(err.message || 'Could not import that file.', 'error'); }
    e.target.value = '';
  });

  /* ══════════════ Sample data + danger zone ══════════════ */

  function renderSampleBtn() {
    const btn = $('#sampleToggleBtn');
    if (sampleActive()) {
      btn.textContent = '↩ Exit sample & restore my data';
      $('#sampleBlurb').textContent = 'You are in sample mode. Exiting restores your real data exactly as it was — every change made here is discarded.';
    } else {
      btn.textContent = '✨ Explore with sample data';
      $('#sampleBlurb').textContent = 'Explore every feature with realistic demo data. Your real data is safely paused and restored exactly as it was when you exit.';
    }
  }
  $('#sampleToggleBtn').addEventListener('click', () => {
    if (!window.SampleData) return;
    if (sampleActive()) SampleData.clear();
    else SampleData.load();
  });

  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Reset ALL data (dashboard, pipeline, history) in this browser? This cannot be undone.')) {
      ['vaugn.dashboard.v1', 'vaugn.crm.v1', 'vaugn.history.v1', 'vaugn.sample',
       'vaugn.stash.dashboard', 'vaugn.stash.crm', 'vaugn.stash.history']
        .forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      location.reload();
    }
  });

  /* ══════════════ Backup reminder ══════════════ */

  const BACKUP_STALE_DAYS = 30;
  const SNOOZE_DAYS = 7;

  function hasRealData() {
    const leads = window.CrmStore && CrmStore.state && CrmStore.state.leads.length > 0;
    const metrics = METRICS.some((m) => Store.get(m.id).value > 0);
    return leads || metrics;
  }

  function backupDue() {
    if (sampleActive() || !hasRealData()) return false;
    const s = Store.state.settings;
    const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
    if (s.backupSnoozedAt && daysSince(s.backupSnoozedAt) < SNOOZE_DAYS) return false;
    if (!s.lastBackup) return true;                       // has data, never backed up
    return daysSince(s.lastBackup) > BACKUP_STALE_DAYS;   // overdue
  }

  function dismissBackupReminder() {
    document.querySelector('.backup-reminder')?.remove();
  }

  function showBackupReminder() {
    if (document.querySelector('.backup-reminder') || sampleActive()) return;
    const never = !Store.state.settings.lastBackup;
    const bar = document.createElement('div');
    bar.className = 'backup-reminder';
    bar.innerHTML = `
      <span>💾 <strong>${never ? 'Back up your data' : 'Time to back up again'}</strong> — Vaugn Studio keeps everything in this browser. One export keeps it safe if you clear your browser or switch devices.</span>
      <div class="backup-reminder__actions">
        <button class="btn btn--primary" id="backupNow">Export backup</button>
        <button class="backup-reminder__x" id="backupSnooze" aria-label="Remind me later">Later</button>
      </div>`;
    document.body.prepend(bar);
    bar.querySelector('#backupNow').addEventListener('click', () => {
      open();
      $('#drawerBackup').scrollIntoView({ block: 'center' });
      dismissBackupReminder();
    });
    bar.querySelector('#backupSnooze').addEventListener('click', () => {
      Store.setSetting('backupSnoozedAt', new Date().toISOString());
      dismissBackupReminder();
    });
  }

  /* ══════════════ Boot ══════════════ */

  window.SettingsUI = { open, close, toast, applyBrand, openDrawer: open, closeDrawer: close };
  applyBrand();
  renderThemeGrid();
  // Nudge once the page has settled (and CRM data is loaded).
  setTimeout(() => { if (backupDue()) showBackupReminder(); }, 2500);
})();
