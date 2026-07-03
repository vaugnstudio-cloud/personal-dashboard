/* ============================================================
   crm-app.js — Sales Pipeline orchestration
   Filters, sort, search, selection, drawer editing, status menu,
   won/lost flows, bulk actions, shortcuts, stats, undo, digest.
   ============================================================ */

(function () {
  'use strict';

  Store.load();      // dashboard store: currency + money-sync targets
  CrmStore.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ── UI state (not persisted, except view in CrmStore) ──── */
  const ui = {
    status: 'all',        // all | <status id> | due | archived
    channel: 'all',
    q: '',
    selection: new Set(),
    focusId: null,
    drawerId: null,
    undo: null,           // { snaps, msg }
  };

  /* ── Toast (with optional action button) ────────────────── */
  let toastTimer;
  function toast(msg, kind = 'ok', action = null) {
    const el = $('#toast');
    el.innerHTML = CrmTable.esc(msg) + (action ? ` <button class="toast__act" id="toastAct">${CrmTable.esc(action.label)}</button>` : '');
    el.className = `toast is-visible toast--${kind}`;
    if (action) $('#toastAct').addEventListener('click', () => { action.fn(); el.classList.remove('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), action ? 6000 : 3200);
  }

  function fmtMoney(n) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: Store.state.settings.currency, maximumFractionDigits: 0,
    }).format(n || 0);
  }

  /* ── Filtering + sorting ────────────────────────────────── */

  function filtered() {
    const today = crmToday();
    const q = ui.q.trim().toLowerCase();
    let list = CrmStore.state.leads.filter((l) => {
      if (ui.status === 'archived') { if (!l.archived) return false; }
      else if (l.archived) return false;
      if (ui.status === 'due') {
        if (l.status === 'won' || l.status === 'lost') return false;
        if (!l.followUpDate || l.followUpDate > today) return false;
      } else if (ui.status !== 'all' && ui.status !== 'archived' && l.status !== ui.status) return false;
      if (ui.channel !== 'all' && l.channel !== ui.channel) return false;
      if (q) {
        const hay = [l.business, l.decisionMaker, l.email, l.industry, l.country, l.notes, l.problem, l.offer]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const { sortBy, sortDir } = CrmStore.state.view;
    const dir = sortDir === 'desc' ? -1 : 1;
    const col = CRM_COLUMN_INDEX[sortBy] || {};
    list.sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === 'status') { va = CRM_STATUSES.findIndex((s) => s.id === va); vb = CRM_STATUSES.findIndex((s) => s.id === vb); }
      if (va == null || va === '') return 1;      // empties last, regardless of direction
      if (vb == null || vb === '') return -1;
      if (col.num) return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return list;
  }

  /* ── Renderers ──────────────────────────────────────────── */

  function renderStats() {
    const s = CrmStore.stats();
    $('#statPipeline').textContent = fmtMoney(s.pipelineValue);
    $('#statDue').innerHTML = `${s.dueToday}${s.overdue ? ` <span class="crm-stat__extra">+${s.overdue} overdue</span>` : ''}`;
    $('#statOpen').textContent = s.openLeads;
    $('#statWin').textContent = s.winRate === null ? '—' : `${Math.round(s.winRate * 100)}%`;
    $('#statWon').textContent = fmtMoney(s.wonThisMonth);
    const n = CrmStore.state.leads.length;
    $('#crmSub').textContent = n === 0 ? 'No leads yet — add your first one'
      : `${n} lead${n === 1 ? '' : 's'} · ${s.openLeads} open · updated ${CrmStore.state.updatedAt ? new Date(CrmStore.state.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'never'}`;
  }

  function renderChips() {
    const counts = { all: 0, due: 0, archived: 0 };
    CRM_STATUSES.forEach((s) => { counts[s.id] = 0; });
    const today = crmToday();
    CrmStore.state.leads.forEach((l) => {
      if (l.archived) { counts.archived++; return; }
      counts.all++;
      counts[l.status]++;
      if (l.status !== 'won' && l.status !== 'lost' && l.followUpDate && l.followUpDate <= today) counts.due++;
    });
    const chip = (id, label, extra = '') =>
      `<button class="chip ${extra} ${ui.status === id ? 'is-active' : ''}" data-chip="${id}">${label} <span>${counts[id] ?? 0}</span></button>`;
    $('#crmChips').innerHTML = [
      chip('all', 'All'),
      ...CRM_STATUSES.map((s) => chip(s.id, s.label, s.id === 'won' ? 'chip--won' : s.id === 'lost' ? 'chip--lost' : '')),
      chip('due', '⚠ Due', 'chip--due'),
      chip('archived', 'Archived'),
    ].join('');
  }

  function renderTable() {
    const list = filtered();
    const view = CrmStore.state.view;
    const hasAny = CrmStore.hasData();

    $('#crmTableWrap').hidden = !hasAny || list.length === 0;
    $('#crmCards').hidden = !hasAny || list.length === 0;
    $('#crmEmpty').hidden = hasAny;
    $('#crmNoMatch').hidden = !hasAny || list.length > 0;

    if (list.length) {
      $('#crmThead').innerHTML = CrmTable.renderHead(view);
      $('#crmTbody').innerHTML = CrmTable.renderRows(list, view, ui.selection, ui.focusId);
      $('#crmCards').innerHTML = CrmTable.renderCards(list, ui.selection);
      const all = list.length > 0 && list.every((l) => ui.selection.has(l.id));
      const checkAll = $('#checkAll');
      if (checkAll) { checkAll.checked = all; checkAll.indeterminate = !all && list.some((l) => ui.selection.has(l.id)); }
    }
    renderBulk();
    return list;
  }

  function renderBulk() {
    const n = ui.selection.size;
    $('#bulkBar').hidden = n === 0;
    if (n) $('#bulkCount').textContent = `${n} selected`;
  }

  function renderAll() {
    renderStats();
    renderChips();
    renderTable();
    writeHash();
  }

  /* ── URL hash state ─────────────────────────────────────── */

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('status')) ui.status = p.get('status');
    if (p.get('channel')) ui.channel = p.get('channel');
    if (p.get('q')) { ui.q = p.get('q'); $('#crmSearch').value = ui.q; }
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (ui.status !== 'all') p.set('status', ui.status);
    if (ui.channel !== 'all') p.set('channel', ui.channel);
    if (ui.q) p.set('q', ui.q);
    const h = p.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname);
  }

  /* ── Drawer (primary editor — instant save on change) ───── */

  const FIELD_MAP = [
    ['f-business', 'business'], ['f-industry', 'industry'], ['f-country', 'country'],
    ['f-website', 'website'], ['f-social', 'social'], ['f-decisionMaker', 'decisionMaker'],
    ['f-email', 'email'], ['f-problem', 'problem'], ['f-offer', 'offer'],
    ['f-channel', 'channel'], ['f-dateContacted', 'dateContacted'], ['f-followUpDate', 'followUpDate'],
    ['f-status', 'status'], ['f-dealValue', 'dealValue'], ['f-dealType', 'dealType'], ['f-notes', 'notes'],
  ];

  function openDrawer(id) {
    const lead = CrmStore.get(id);
    if (!lead) return;
    ui.drawerId = id;
    FIELD_MAP.forEach(([fid, key]) => {
      const el = $('#' + fid);
      if (el.type === 'checkbox') el.checked = !!lead[key];
      else el.value = lead[key] ?? '';
    });
    ['replied', 'callBooked', 'proposalSent'].forEach((k) => { $('#f-' + k).checked = !!lead[k]; });
    $('#drawerBadge').className = `badge badge--${lead.status}`;
    $('#drawerBadge').textContent = CRM_STATUS_INDEX[lead.status].label;
    $('#drawerName').textContent = lead.business || 'Untitled lead';
    $('#drawerAvatar').textContent = (lead.business || '?').charAt(0).toUpperCase();
    $('#drawerArchive').textContent = lead.archived ? 'Unarchive' : 'Archive';
    $('#drawerActivity').innerHTML = lead.activity.slice(0, 8).map((a) =>
      `<li><span>${new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> ${CrmTable.esc(a.text)}</li>`).join('');
    $('#leadDrawer').classList.add('is-open');
    $('#scrim').classList.add('is-visible');
    $('#leadDrawer').setAttribute('aria-hidden', 'false');
    $('#f-business').focus();
  }

  function closeDrawer() {
    ui.drawerId = null;
    if ($('#leadDrawer').contains(document.activeElement)) document.activeElement.blur();
    $('#leadDrawer').classList.remove('is-open');
    $('#scrim').classList.remove('is-visible');
    $('#leadDrawer').setAttribute('aria-hidden', 'true');
  }

  function drawerNav(dir) {
    const list = filtered();
    const i = list.findIndex((l) => l.id === ui.drawerId);
    const next = list[i + dir];
    if (next) openDrawer(next.id);
  }

  /* One change handler for the whole drawer form. */
  $('#leadDrawer').addEventListener('change', (e) => {
    if (!ui.drawerId) return;
    const el = e.target;
    const lead = CrmStore.get(ui.drawerId);
    if (!lead) return;

    if (['f-replied', 'f-callBooked', 'f-proposalSent'].includes(el.id)) {
      const key = el.id.slice(2);
      CrmStore.update(lead.id, { [key]: el.checked });
      nudgeFromToggle(lead, key, el.checked);
      return;
    }
    const map = FIELD_MAP.find(([fid]) => fid === el.id);
    if (!map) return;
    const key = map[1];
    let value = el.value;
    if (key === 'dealValue') value = Math.max(0, parseFloat(value) || 0);
    if ((key === 'dateContacted' || key === 'followUpDate') && !value) value = null;

    if (key === 'status') return setStatus([lead.id], value);

    CrmStore.update(lead.id, { [key]: value });
    if (key === 'business') {
      $('#drawerName').textContent = value || 'Untitled lead';
      $('#drawerAvatar').textContent = (value || '?').charAt(0).toUpperCase();
    }
  });

  /* ── Status changes + Won/Lost flows + smart nudges ─────── */

  function setStatus(ids, status) {
    ids.forEach((id) => {
      const lead = CrmStore.get(id);
      if (!lead || lead.status === status) return;
      const patch = { status };
      if (status === 'contacted' && !lead.dateContacted) {
        patch.dateContacted = crmToday();
        if (!lead.followUpDate) {
          const d = new Date(); d.setDate(d.getDate() + 3);
          patch.followUpDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
      if (status === 'replied') patch.replied = true;
      if (status === 'call-booked') { patch.replied = true; patch.callBooked = true; }
      if (status === 'proposal-sent') patch.proposalSent = true;
      CrmStore.update(id, patch);
      if (status === 'won') onWon(CrmStore.get(id));
      if (status === 'lost') openLostModal(id);
    });
    if (ui.drawerId && ids.includes(ui.drawerId)) openDrawer(ui.drawerId); // refresh drawer
  }

  function nudgeFromToggle(lead, key, on) {
    if (!on) return;
    const suggest = { replied: 'replied', callBooked: 'call-booked', proposalSent: 'proposal-sent' }[key];
    const order = CRM_STATUSES.map((s) => s.id);
    if (suggest && order.indexOf(lead.status) < order.indexOf(suggest) && lead.status !== 'won') {
      setStatus([lead.id], suggest);
      toast(`Status moved to ${CRM_STATUS_INDEX[suggest].label}.`);
    }
  }

  /* Won → confirm-first money prompt (never silent). */
  function onWon(lead) {
    if (!lead.dealValue) { toast('Deal won 🎉'); return; }
    const retainer = lead.dealType === 'retainer';
    const target = retainer ? 'mrr' : (lead.channel === 'website' ? 'websiteIncome' : 'sideIncome');
    const label = METRIC_INDEX[target].label;
    $('#wonMsg').innerHTML = `<strong>${CrmTable.esc(lead.business || 'Deal')} — won! 🎉</strong><br>Add <strong>${fmtMoney(lead.dealValue)}${retainer ? '/mo' : ''}</strong> to <strong>${label}</strong> on your dashboard?`;
    $('#wonModal').hidden = false;
    $('#wonYes').onclick = () => {
      Store.setValue(target, (Store.get(target).value || 0) + lead.dealValue);
      $('#wonModal').hidden = true;
      toast(`Added ${fmtMoney(lead.dealValue)} to ${label} — dashboard updated.`);
    };
    $('#wonNo').onclick = () => { $('#wonModal').hidden = true; toast('Deal won 🎉'); };
  }

  function openLostModal(id) {
    $('#lostModal').hidden = false;
    $('#lostReasons').innerHTML = CRM_LOSS_REASONS.map((r) =>
      `<button class="btn" data-reason="${r.id}">${r.label}</button>`).join('');
    $('#lostReasons').onclick = (e) => {
      const btn = e.target.closest('[data-reason]');
      if (!btn) return;
      CrmStore.update(id, { lossReason: btn.dataset.reason }, { log: `Lost — ${btn.textContent}` });
      $('#lostModal').hidden = true;
    };
    $('#lostSkip').onclick = () => { $('#lostModal').hidden = true; };
  }

  /* ── Status menu popover (table badge + bulk) ───────────── */

  let menuTargets = null;
  function openStatusMenu(anchor, ids) {
    menuTargets = ids;
    const menu = $('#statusMenu');
    menu.innerHTML = CRM_STATUSES.map((s) =>
      `<button class="badge badge--${s.id}" data-status="${s.id}">${s.label}</button>`).join('');
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 12)}px`;
    menu.style.left = `${Math.min(r.left, innerWidth - menu.offsetWidth - 12)}px`;
  }
  $('#statusMenu').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (btn && menuTargets) { setStatus(menuTargets, btn.dataset.status); ui.selection.clear(); }
    $('#statusMenu').hidden = true;
  });

  /* ── Table events (delegation) ──────────────────────────── */

  $('#crmTableWrap').addEventListener('click', (e) => {
    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn) {
      const id = sortBtn.dataset.sort;
      const v = CrmStore.state.view;
      CrmStore.setView(v.sortBy === id ? { sortDir: v.sortDir === 'asc' ? 'desc' : 'asc' } : { sortBy: id, sortDir: 'asc' });
      return;
    }
    if (e.target.id === 'checkAll') {
      const list = filtered();
      const all = list.every((l) => ui.selection.has(l.id));
      list.forEach((l) => all ? ui.selection.delete(l.id) : ui.selection.add(l.id));
      renderTable();
      return;
    }
    const row = e.target.closest('.lead-row');
    if (!row) return;
    const id = row.dataset.id;
    ui.focusId = id;

    if (e.target.matches('input[type=checkbox]')) {
      e.target.checked ? ui.selection.add(id) : ui.selection.delete(id);
      renderTable();
      return;
    }
    if (e.target.closest('[data-act="status"]')) return openStatusMenu(e.target, [id]);
    const rcpDot = e.target.closest('[data-rcp]');
    if (rcpDot) {
      const key = rcpDot.dataset.rcp;
      const lead = CrmStore.get(id);
      const turningOn = !lead[key];
      CrmStore.update(id, { [key]: turningOn });
      if (turningOn) nudgeFromToggle(CrmStore.get(id), key, true);
      return;
    }
    const dateCell = e.target.closest('[data-act="edit-date"]');
    if (dateCell) return inlineEdit(dateCell, id, 'followUpDate', 'date');
    const valCell = e.target.closest('[data-act="edit-value"]');
    if (valCell) return inlineEdit(valCell, id, 'dealValue', 'number');

    openDrawer(id);
  });

  $('#crmCards').addEventListener('click', (e) => {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    if (e.target.closest('[data-act="status"]')) return openStatusMenu(e.target, [card.dataset.id]);
    openDrawer(card.dataset.id);
  });

  /* Inline cell editing (date + deal value). */
  function inlineEdit(cellEl, id, key, type) {
    if (cellEl.querySelector('input')) return;
    const lead = CrmStore.get(id);
    const input = document.createElement('input');
    input.type = type;
    input.className = 'cell-input';
    input.value = lead[key] ?? '';
    if (type === 'number') { input.min = '0'; input.step = 'any'; }
    cellEl.innerHTML = '';
    cellEl.appendChild(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      let v = input.value;
      if (type === 'number') v = Math.max(0, parseFloat(v) || 0);
      if (type === 'date' && !v) v = null;
      CrmStore.update(id, { [key]: v });
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { done = true; renderTable(); }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  /* ── Toolbar ────────────────────────────────────────────── */

  $('#crmChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    ui.status = chip.dataset.chip;
    ui.selection.clear();
    renderAll();
  });

  let searchTimer;
  $('#crmSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { ui.q = e.target.value; renderAll(); }, 120);
  });

  $('#crmChannel').addEventListener('change', (e) => { ui.channel = e.target.value; renderAll(); });

  /* Column manager */
  function renderColPop() {
    const visible = CrmStore.state.view.visibleColumns;
    $('#colPopGrid').innerHTML = CRM_COLUMNS.map((c) =>
      `<label><input type="checkbox" data-col="${c.id}" ${visible.includes(c.id) ? 'checked' : ''} ${c.locked ? 'disabled' : ''}/> ${c.label}</label>`).join('');
  }
  $('#colBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    renderColPop();
    $('#colPop').hidden = !$('#colPop').hidden;
    $('#moreMenu').hidden = true;
  });
  $('#colPop').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-col]');
    if (!cb) return;
    const id = cb.dataset.col;
    const cols = CRM_COLUMNS.filter((c) =>
      c.id === id ? cb.checked : (CrmStore.state.view.visibleColumns.includes(c.id) || c.locked)
    ).map((c) => c.id);
    CrmStore.setView({ visibleColumns: cols });
  });

  /* More menu: export / import */
  $('#moreBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#moreMenu').hidden = !$('#moreMenu').hidden;
    $('#colPop').hidden = true;
  });
  $('#crmExport').addEventListener('click', () => { CrmStore.exportJSON(); toast('Pipeline backup downloaded.'); $('#moreMenu').hidden = true; });
  $('#crmImport').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { toast(`Imported ${CrmStore.importJSON(await file.text())} leads.`); }
    catch (err) { toast(err.message || 'Could not import that file.', 'error'); }
    e.target.value = '';
    $('#moreMenu').hidden = true;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#colPop, #colBtn')) $('#colPop').hidden = true;
    if (!e.target.closest('#moreMenu, #moreBtn')) $('#moreMenu').hidden = true;
    if (!e.target.closest('#statusMenu, [data-act="status"]')) $('#statusMenu').hidden = true;
  });

  /* ── New lead / drawer buttons ──────────────────────────── */

  function newLead() {
    const lead = CrmStore.create();
    ui.status = 'all'; ui.channel = 'all';
    openDrawer(lead.id);
  }
  $('#newLeadBtn').addEventListener('click', newLead);
  $('#crmFab').addEventListener('click', newLead);
  $('#emptyAdd').addEventListener('click', newLead);
  $('#emptyImport').addEventListener('click', () => $('#crmImport').click());
  $('#noMatchClear').addEventListener('click', () => { ui.status = 'all'; ui.channel = 'all'; ui.q = ''; $('#crmSearch').value = ''; renderAll(); });

  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerDone').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  $('#drawerPrev').addEventListener('click', () => drawerNav(-1));
  $('#drawerNext').addEventListener('click', () => drawerNav(1));

  $('#drawerArchive').addEventListener('click', () => {
    const id = ui.drawerId;
    const lead = CrmStore.get(id);
    const wasArchived = lead.archived;
    closeDrawer();
    CrmStore.setArchived([id], !wasArchived);
    toast(wasArchived ? 'Lead restored.' : 'Lead archived.', 'ok',
      { label: 'Undo', fn: () => CrmStore.setArchived([id], wasArchived) });
  });

  $('#drawerDelete').addEventListener('click', () => {
    const id = ui.drawerId;
    confirmBox('Delete this lead permanently?', () => {
      closeDrawer();
      const snaps = CrmStore.remove([id]);
      toast('Lead deleted.', 'ok', { label: 'Undo', fn: () => CrmStore.restore(snaps) });
    });
  });

  /* ── Bulk actions ───────────────────────────────────────── */

  const selIds = () => Array.from(ui.selection);
  $('#bulkStatus').addEventListener('click', (e) => { e.stopPropagation(); openStatusMenu(e.target, selIds()); });
  $('#bulkFollow').addEventListener('click', () => { $('#followModal').hidden = false; $('#followDate').value = crmToday(); });
  $('#followApply').addEventListener('click', () => {
    const d = $('#followDate').value || null;
    selIds().forEach((id) => CrmStore.update(id, { followUpDate: d }));
    ui.selection.clear();
    $('#followModal').hidden = true;
    toast('Follow-up date set.');
  });
  $('#followCancel').addEventListener('click', () => { $('#followModal').hidden = true; });
  $('#bulkArchive').addEventListener('click', () => {
    const ids = selIds();
    ui.selection.clear();
    CrmStore.setArchived(ids, true);
    toast(`${ids.length} archived.`, 'ok', { label: 'Undo', fn: () => CrmStore.setArchived(ids, false) });
  });
  $('#bulkDelete').addEventListener('click', () => {
    const ids = selIds();
    confirmBox(`Delete ${ids.length} lead${ids.length === 1 ? '' : 's'} permanently?`, () => {
      ui.selection.clear();
      const snaps = CrmStore.remove(ids);
      toast(`${ids.length} deleted.`, 'ok', { label: 'Undo', fn: () => CrmStore.restore(snaps) });
    });
  });

  /* ── Generic confirm ────────────────────────────────────── */

  function confirmBox(msg, onYes) {
    $('#confirmMsg').textContent = msg;
    $('#confirmModal').hidden = false;
    $('#confirmYes').onclick = () => { $('#confirmModal').hidden = true; onYes(); };
    $('#confirmNo').onclick = () => { $('#confirmModal').hidden = true; };
  }

  /* ── Keyboard shortcuts ─────────────────────────────────── */

  const anyModal = () => !$('#wonModal').hidden || !$('#lostModal').hidden || !$('#confirmModal').hidden || !$('#followModal').hidden;

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (window.HelpUI && HelpUI.anyOpen()) return;      // HelpUI handles its own Escape
      if (anyModal()) { $$('#wonModal,#lostModal,#confirmModal,#followModal').forEach((m) => { m.hidden = true; }); return; }
      if (!$('#statusMenu').hidden) { $('#statusMenu').hidden = true; return; }
      if (ui.drawerId) { closeDrawer(); return; }
      if (typing) { document.activeElement.blur(); return; }
      return;
    }
    if (typing || anyModal() || (window.HelpUI && HelpUI.anyOpen())) return;

    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newLead(); }
    else if (e.key === '/') { e.preventDefault(); $('#crmSearch').focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = filtered();
      if (!list.length) return;
      const i = list.findIndex((l) => l.id === ui.focusId);
      const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || list[0];
      ui.focusId = next.id;
      renderTable();
      $(`.lead-row[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && ui.focusId) {
      if (ui.drawerId) return;
      e.preventDefault();
      openDrawer(ui.focusId);
    } else if ((e.key === 'j' || e.key === 'J') && ui.drawerId) drawerNav(1);
    else if ((e.key === 'k' || e.key === 'K') && ui.drawerId) drawerNav(-1);
  });

  /* ── Public API (used by tour.js) ───────────────────────── */

  function openFirstLead() {
    const first = filtered()[0];
    if (first) openDrawer(first.id);
  }
  window.CrmUI = { openDrawer: openFirstLead, closeDrawer, toast, openFirstLead };

  /* ── Boot ───────────────────────────────────────────────── */

  document.addEventListener('crm:changed', renderAll);
  document.addEventListener('crm:error', (e) => toast(e.detail, 'error'));

  readHash();
  renderAll();

  // Follow-up digest (automation #1)
  const s = CrmStore.stats();
  const due = s.dueToday + s.overdue;
  if (due > 0) {
    setTimeout(() => toast(`⚠ ${due} follow-up${due === 1 ? ' needs' : 's need'} attention`, 'ok',
      { label: 'View', fn: () => { ui.status = 'due'; renderAll(); } }), 600);
  }

  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
