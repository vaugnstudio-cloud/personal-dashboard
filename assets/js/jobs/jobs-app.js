/* ============================================================
   jobs-app.js — Career Pipeline orchestration.
   View routing (dashboard/table/board/calendar/reports), filters,
   sort, selection, drawer editing (incl. contacts/interviews/
   tasks/fit), status menu, bulk actions, undo, shortcuts.
   ============================================================ */

(function () {
  'use strict';

  Store.load();       // dashboard store (settings / branding)
  JobsStore.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = JobsRender.esc;

  const VIEWS = ['dashboard', 'table', 'board', 'calendar', 'reports'];

  /* ── UI state (not persisted, except view prefs in JobsStore) ── */
  const ui = {
    view: 'dashboard',
    status: 'all',      // all | g-<group> | <status id> | due | archived
    source: 'all',
    priority: 'all',
    q: '',
    selection: new Set(),
    focusId: null,
    drawerId: null,
  };

  /* ── Toast (with optional action button) ────────────────── */
  let toastTimer;
  function toast(msg, kind = 'ok', action = null) {
    const el = $('#toast');
    el.innerHTML = esc(msg) + (action ? ` <button class="toast__act" id="toastAct">${esc(action.label)}</button>` : '');
    el.className = `toast is-visible toast--${kind}`;
    if (action) $('#toastAct').addEventListener('click', () => { action.fn(); el.classList.remove('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), action ? 6000 : 3200);
  }

  /* ── Filtering + sorting ────────────────────────────────── */

  function filtered() {
    const today = jobsToday();
    const q = ui.q.trim().toLowerCase();
    let list = JobsStore.state.jobs.filter((j) => {
      const g = JobsStore.groupOf(j.status);
      if (ui.status === 'archived') { if (!j.archived) return false; }
      else if (j.archived) return false;
      if (ui.status === 'due') {
        if (g === 'won' || g === 'lost') return false;
        const dueFollow = j.followUpDate && j.followUpDate <= today;
        const dueTask = j.tasks.some((t) => !t.done && t.due && t.due <= today);
        if (!dueFollow && !dueTask) return false;
      } else if (ui.status.startsWith('g-')) {
        if (g !== ui.status.slice(2)) return false;
      } else if (ui.status !== 'all' && ui.status !== 'archived' && j.status !== ui.status) return false;
      if (ui.source !== 'all' && j.source !== ui.source) return false;
      if (ui.priority !== 'all' && j.priority !== ui.priority) return false;
      if (q) {
        const hay = [j.title, j.company, j.location, j.notes, j.companyIndustry, j.tags.join(' '),
          j.skills.join(' '), j.contacts.map((c) => `${c.name} ${c.email}`).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const { sortBy, sortDir } = JobsStore.state.view;
    const dir = sortDir === 'desc' ? -1 : 1;
    const col = JOBS_COLUMN_INDEX[sortBy] || {};
    const statusOrder = Object.fromEntries(JobsStore.statuses().map((s, i) => [s.id, i]));
    const sortVal = (j) => {
      switch (sortBy) {
        case 'role': return `${j.company} ${j.title}`.trim().toLowerCase() || null;
        case 'status': return statusOrder[j.status] ?? 999;
        case 'priority': return { high: 0, medium: 1, low: 2 }[j.priority] ?? 1;
        case 'daysSince': return JobsStore.daysSinceApplied(j);
        case 'fit': return j.fit.overall;
        case 'salary': return j.salaryMax || j.salaryMin || null;
        default: return j[sortBy];
      }
    };
    list.sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (va == null || va === '') return 1;
      if (vb == null || vb === '') return -1;
      if (col.num || typeof va === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return list;
  }

  /* ── View routing ───────────────────────────────────────── */

  function setView(view, { skipHash = false } = {}) {
    if (!VIEWS.includes(view)) view = 'dashboard';
    ui.view = view;
    $$('.jobs-view').forEach((sec) => { sec.hidden = sec.dataset.view !== view; });
    $$('[data-jobs-tab]').forEach((t) => {
      const active = t.dataset.jobsTab === view;
      t.classList.toggle('is-active', active);
      if (active) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    JobsStore.state.view.mode = view; // remembered without an extra save-event churn
    renderView();
    if (!skipHash) writeHash();
  }

  function renderView() {
    renderSub();
    switch (ui.view) {
      case 'dashboard': JobsViews.renderDashboard(); break;
      case 'table': renderChips(); renderTable(); break;
      case 'board': JobsViews.renderBoard(); break;
      case 'calendar': JobsViews.renderCalendar(); break;
      case 'reports': JobsViews.renderReports(); break;
    }
    renderBulk();
  }

  function renderAll() { renderView(); writeHash(); }

  function renderSub() {
    const s = JobsStore.stats();
    const n = s.total;
    $('#jobsSub').textContent = n === 0
      ? 'Track every application — from saved listing to signed offer'
      : `${n} application${n === 1 ? '' : 's'} · ${s.active} active · ${s.offers ? `${s.offers} offer${s.offers === 1 ? '' : 's'} · ` : ''}updated ${JobsStore.state.updatedAt ? new Date(JobsStore.state.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'never'}`;
  }

  /* ── URL hash state ─────────────────────────────────────── */

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('view')) ui.view = VIEWS.includes(p.get('view')) ? p.get('view') : 'dashboard';
    else if (JobsStore.hasData() && VIEWS.includes(JobsStore.state.view.mode)) ui.view = JobsStore.state.view.mode;
    if (p.get('status')) ui.status = p.get('status');
    if (p.get('source')) ui.source = p.get('source');
    if (p.get('q')) { ui.q = p.get('q'); $('#jobsSearch').value = ui.q; }
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (ui.view !== 'dashboard') p.set('view', ui.view);
    if (ui.status !== 'all') p.set('status', ui.status);
    if (ui.source !== 'all') p.set('source', ui.source);
    if (ui.q) p.set('q', ui.q);
    const h = p.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname);
  }

  /* ── Table view ─────────────────────────────────────────── */

  function renderChips() {
    const counts = { all: 0, due: 0, archived: 0 };
    JOBS_GROUPS.forEach((g) => { counts['g-' + g.id] = 0; });
    const today = jobsToday();
    JobsStore.state.jobs.forEach((j) => {
      if (j.archived) { counts.archived++; return; }
      const g = JobsStore.groupOf(j.status);
      counts.all++;
      counts['g-' + g]++;
      if (g !== 'won' && g !== 'lost' &&
          ((j.followUpDate && j.followUpDate <= today) || j.tasks.some((t) => !t.done && t.due && t.due <= today))) counts.due++;
    });
    const chip = (id, label, extra = '') =>
      `<button class="chip ${extra} ${ui.status === id ? 'is-active' : ''}" data-chip="${id}">${label} <span>${counts[id] ?? 0}</span></button>`;
    $('#jobsChips').innerHTML = [
      chip('all', 'All'),
      ...JOBS_GROUPS.map((g) => chip('g-' + g.id, g.label, g.id === 'won' ? 'chip--won' : g.id === 'lost' ? 'chip--lost' : '')),
      chip('due', '⚠ Due', 'chip--due'),
      chip('archived', 'Archived'),
    ].join('');
  }

  function renderTable() {
    const list = filtered();
    const view = JobsStore.state.view;
    const hasAny = JobsStore.hasData();

    $('#jobsTableWrap').hidden = !hasAny || list.length === 0;
    $('#jobsCards').hidden = !hasAny || list.length === 0;
    $('#jobsEmpty').hidden = hasAny;
    $('#jobsNoMatch').hidden = !hasAny || list.length > 0;

    if (list.length) {
      $('#jobsThead').innerHTML = JobsRender.renderHead(view);
      $('#jobsTbody').innerHTML = JobsRender.renderRows(list, view, ui.selection, ui.focusId);
      $('#jobsCards').innerHTML = JobsRender.renderCards(list, ui.selection);
      const all = list.length > 0 && list.every((j) => ui.selection.has(j.id));
      const checkAll = $('#jobsCheckAll');
      if (checkAll) { checkAll.checked = all; checkAll.indeterminate = !all && list.some((j) => ui.selection.has(j.id)); }
    }
    renderBulk();
    return list;
  }

  function renderBulk() {
    const n = ui.selection.size;
    $('#jobsBulkBar').hidden = n === 0 || ui.view !== 'table';
    if (n) $('#jobsBulkCount').textContent = `${n} selected`;
  }

  /* ── Drawer (record editor — instant save on change) ────── */

  /* [elementId, path, type] — path supports one dot level (docs.x / fit.x). */
  const FIELD_MAP = [
    ['f-jtitle', 'title'], ['f-jcompany', 'company'], ['f-jlocation', 'location'],
    ['f-jarrangement', 'arrangement'], ['f-jemployment', 'employmentType'],
    ['f-jsalaryMin', 'salaryMin', 'number'], ['f-jsalaryMax', 'salaryMax', 'number'],
    ['f-jsalaryCur', 'salaryCurrency'], ['f-jsalaryPer', 'salaryPeriod'],
    ['f-jsource', 'source'], ['f-jurl', 'url'],
    ['f-jposted', 'postedDate', 'date'], ['f-jdeadline', 'deadline', 'date'],
    ['f-japplied', 'appliedDate', 'date'], ['f-jfollow', 'followUpDate', 'date'],
    ['f-jpriority', 'priority'], ['f-jstatus', 'status'],
    ['f-jdesc', 'description'],
    ['f-jresp', 'responsibilities', 'lines'], ['f-jreq', 'qualificationsRequired', 'lines'],
    ['f-jpref', 'qualificationsPreferred', 'lines'], ['f-jbenefits', 'benefits', 'lines'],
    ['f-jskills', 'skills', 'list'], ['f-jtools', 'tools', 'list'],
    ['f-jexp', 'experienceLevel'], ['f-jedu', 'education'],
    ['f-jschedule', 'schedule'], ['f-jtimezone', 'timezone'], ['f-jtravel', 'travel'],
    ['f-jcweb', 'companyWebsite'], ['f-jcindustry', 'companyIndustry'], ['f-jcsize', 'companySize'],
    ['f-jcloc', 'companyLocation'], ['f-jclinkedin', 'companyLinkedin'], ['f-jccareers', 'companyCareers'],
    ['f-jcdesc', 'companyDescription'], ['f-jcnotes', 'companyNotes'],
    ['f-jdresume', 'docs.resumeVersion'], ['f-jdcover', 'docs.coverLetter'],
    ['f-jdportfolio', 'docs.portfolioUrl'], ['f-jdcase', 'docs.caseStudies'],
    ['f-jdsubmitted', 'docs.submittedAt', 'date'], ['f-jdnotes', 'docs.notes'],
    ['f-fit-reasons', 'fit.reasons'], ['f-fit-concerns', 'fit.concerns'], ['f-fit-missing', 'fit.missing'],
    ['f-fit-strengths', 'fit.strengths'], ['f-fit-emphasize', 'fit.emphasize'], ['f-fit-talkingPoints', 'fit.talkingPoints'],
    ['f-jtags', 'tags', 'list'], ['f-jnotes', 'notes'],
  ];

  const FIT_SCORES = [
    ['overall', 'Overall Fit'], ['skills', 'Skills Match'], ['experience', 'Experience Match'],
    ['salary', 'Salary Match'], ['growth', 'Career Growth'], ['interest', 'Company Interest'],
    ['arrangement', 'Arrangement Fit'],
  ];

  function getPath(job, path) {
    const [a, b] = path.split('.');
    return b ? job[a]?.[b] : job[a];
  }

  function pathPatch(job, path, value) {
    const [a, b] = path.split('.');
    if (!b) return { [a]: value };
    return { [a]: { ...job[a], [b]: value } };
  }

  function populateStatusSelect() {
    $('#f-jstatus').innerHTML = JobsStore.statuses().map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  }

  function openDrawer(id) {
    const job = JobsStore.get(id);
    if (!job) return;
    ui.drawerId = id;
    populateStatusSelect();
    FIELD_MAP.forEach(([fid, path, type]) => {
      const el = $('#' + fid);
      if (!el) return;
      const v = getPath(job, path);
      if (type === 'lines') el.value = (v || []).join('\n');
      else if (type === 'list') el.value = (v || []).join(', ');
      else el.value = v ?? '';
    });
    // unknown status (deleted in Settings) still selectable-safe
    if ($('#f-jstatus').value !== job.status) {
      $('#f-jstatus').insertAdjacentHTML('beforeend', `<option value="${esc(job.status)}" selected>${esc(JobsStore.status(job.status).label)}</option>`);
    }
    renderFitSliders(job);
    renderDrawerHead(job);
    renderSubs(job);
    renderMeta(job);
    $('#jobsDrawer').classList.add('is-open');
    $('#jobsScrim').classList.add('is-visible');
    $('#jobsDrawer').setAttribute('aria-hidden', 'false');
    $('#f-jtitle').focus();
  }

  function renderDrawerHead(job) {
    const st = JobsStore.status(job.status);
    $('#jobsDrawerBadge').className = `badge jbadge--${st.color}`;
    $('#jobsDrawerBadge').textContent = st.label;
    $('#jobsDrawerName').textContent = job.company || job.title || 'New application';
    $('#jobsDrawerRole').textContent = job.title && job.company ? job.title : '';
    $('#jobsDrawerAvatar').textContent = (job.company || job.title || '?').charAt(0).toUpperCase();
    $('#jobsDrawerArchive').textContent = job.archived ? 'Unarchive' : 'Archive';
    const days = JobsStore.daysSinceApplied(job);
    $('#jobsDrawerMeta').textContent = [
      days != null ? `${days}d since applied` : null,
      `${JobsStore.daysInStage(job)}d in stage`,
    ].filter(Boolean).join(' · ');
  }

  function renderMeta(job) {
    $('#jobsActivity').innerHTML = JobsRender.timeline(job);
    const im = job.importMeta;
    $('#jobsImportMeta').innerHTML = im
      ? `Imported via <strong>${esc(im.provider)}</strong> on ${new Date(im.importedAt).toLocaleDateString()}${im.sourceUrl ? ` from <a href="${esc(im.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(JobsExtract.normalizeUrl(im.sourceUrl))}</a>` : ''}.`
      : '';
  }

  function renderFitSliders(job) {
    $('#jobsFitScores').innerHTML = FIT_SCORES.map(([key, label]) => {
      const v = job.fit[key];
      return `
        <div class="jb-score" data-fit="${key}">
          <span class="jb-score__label">${label}</span>
          <input type="range" min="0" max="10" step="1" value="${v ?? 0}" aria-label="${label} (0–10)" ${v == null ? 'data-unset="1"' : ''} />
          <output>${v == null ? '—' : v}</output>
          <button class="jb-score__clear" title="Clear score" ${v == null ? 'hidden' : ''}>✕</button>
        </div>`;
    }).join('');
  }

  /* Sub-entity editors: contacts, interviews, tasks. */

  function subField(kind, item, key, label, type = 'text', options = null, wide = false) {
    const base = `data-kind="${kind}" data-sub-id="${item.id}" data-sub-key="${key}"`;
    const v = item[key];
    if (type === 'select') {
      return `<label class="field ${wide ? 'field--wide' : ''}"><span>${label}</span><select ${base}>${options.map((o) => `<option value="${esc(o.id)}" ${v === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    }
    if (type === 'textarea') {
      return `<label class="field field--wide"><span>${label}</span><textarea rows="2" ${base}>${esc(v ?? '')}</textarea></label>`;
    }
    if (type === 'checkbox') {
      return `<label class="rcp-toggle"><input type="checkbox" ${base} ${v ? 'checked' : ''}/> ${label}</label>`;
    }
    return `<label class="field ${wide ? 'field--wide' : ''}"><span>${label}</span><input type="${type}" ${base} value="${esc(v ?? '')}" /></label>`;
  }

  function renderSubs(job) {
    // Contacts
    $('#jobsContacts').innerHTML = job.contacts.map((c) => `
      <details class="jb-sub" data-sub-box="${c.id}">
        <summary><strong>${esc(c.name) || 'New contact'}</strong> <span class="cell-dim">${JOBS_CONTACT_ROLE_INDEX[c.role]?.label || ''}</span>
          <button class="jb-sub__del" data-sub-del data-kind="contacts" data-sub-id="${c.id}" title="Remove contact">✕</button></summary>
        <div class="field-grid">
          ${subField('contacts', c, 'name', 'Full Name')}
          ${subField('contacts', c, 'role', 'Contact Type', 'select', JOBS_CONTACT_ROLES)}
          ${subField('contacts', c, 'title', 'Job Title')}
          ${subField('contacts', c, 'email', 'Email', 'email')}
          ${subField('contacts', c, 'phone', 'Phone')}
          ${subField('contacts', c, 'linkedin', 'LinkedIn / Profile URL')}
          ${subField('contacts', c, 'lastContact', 'Last Contact', 'date')}
          ${subField('contacts', c, 'nextFollowUp', 'Next Follow-Up', 'date')}
          ${subField('contacts', c, 'notes', 'Notes', 'textarea')}
        </div>
      </details>`).join('') || '<p class="jb-sub__none">No contacts yet — add the recruiter or hiring manager when you find them.</p>';

    // Interviews
    $('#jobsInterviews').innerHTML = job.interviews.map((iv) => `
      <details class="jb-sub" data-sub-box="${iv.id}">
        <summary><strong>${JOBS_INTERVIEW_TYPE_INDEX[iv.type]?.label || 'Interview'}</strong>
          <span class="cell-dim">${iv.at ? JobsRender.shortDateTime(iv.at) : 'unscheduled'} · ${JOBS_INTERVIEW_OUTCOMES.find((o) => o.id === iv.outcome)?.label || ''}</span>
          <button class="jb-sub__del" data-sub-del data-kind="interviews" data-sub-id="${iv.id}" title="Remove interview">✕</button></summary>
        <div class="field-grid">
          ${subField('interviews', iv, 'type', 'Type', 'select', JOBS_INTERVIEW_TYPES)}
          ${subField('interviews', iv, 'at', 'Date & Time', 'datetime-local')}
          ${subField('interviews', iv, 'platform', 'Platform (Zoom, Meet…)')}
          ${subField('interviews', iv, 'link', 'Meeting Link')}
          ${subField('interviews', iv, 'interviewer', 'Interviewer(s)')}
          ${subField('interviews', iv, 'outcome', 'Outcome', 'select', JOBS_INTERVIEW_OUTCOMES)}
          ${subField('interviews', iv, 'rating', 'My Performance (1–5)', 'number')}
          <div class="field"><span>&nbsp;</span>${subField('interviews', iv, 'thankYouSent', 'Thank-you sent', 'checkbox')}</div>
          ${subField('interviews', iv, 'prepNotes', 'Prep Notes', 'textarea')}
          ${subField('interviews', iv, 'questionsExpected', 'Questions Expected', 'textarea')}
          ${subField('interviews', iv, 'questionsToAsk', 'Questions To Ask', 'textarea')}
          ${subField('interviews', iv, 'notes', 'Notes / Outcome Details', 'textarea')}
        </div>
      </details>`).join('') || '<p class="jb-sub__none">No interviews yet — they’ll also appear on the Calendar automatically.</p>';

    // Tasks
    $('#jobsTasks').innerHTML = job.tasks.map((t) => `
      <div class="jb-task ${t.done ? 'is-done' : ''}" data-sub-box="${t.id}">
        <input type="checkbox" data-kind="tasks" data-sub-id="${t.id}" data-sub-key="done" ${t.done ? 'checked' : ''} aria-label="Done" />
        <input type="text" class="jb-task__title" data-kind="tasks" data-sub-id="${t.id}" data-sub-key="title" value="${esc(t.title)}" placeholder="${JOBS_TASK_TYPE_INDEX[t.type]?.label || 'Task'}…" />
        <select data-kind="tasks" data-sub-id="${t.id}" data-sub-key="type" aria-label="Task type">${JOBS_TASK_TYPES.map((x) => `<option value="${x.id}" ${t.type === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        <input type="date" data-kind="tasks" data-sub-id="${t.id}" data-sub-key="due" value="${esc(t.due ?? '')}" aria-label="Due date" />
        <select data-kind="tasks" data-sub-id="${t.id}" data-sub-key="priority" aria-label="Priority">${JOBS_PRIORITIES.map((p) => `<option value="${p.id}" ${t.priority === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        <button class="jb-sub__del" data-sub-del data-kind="tasks" data-sub-id="${t.id}" title="Remove task">✕</button>
      </div>`).join('') || '<p class="jb-sub__none">No tasks yet — “Customize resume”, “Send thank-you”, anything with a due date lands on the Calendar.</p>';
  }

  function closeDrawer() {
    ui.drawerId = null;
    if ($('#jobsDrawer').contains(document.activeElement)) document.activeElement.blur();
    $('#jobsDrawer').classList.remove('is-open');
    $('#jobsScrim').classList.remove('is-visible');
    $('#jobsDrawer').setAttribute('aria-hidden', 'true');
  }

  function drawerNav(dir) {
    const list = filtered();
    const i = list.findIndex((j) => j.id === ui.drawerId);
    const next = list[i + dir];
    if (next) openDrawer(next.id);
  }

  /* One change handler for the whole drawer. */
  $('#jobsDrawer').addEventListener('change', (e) => {
    if (!ui.drawerId) return;
    const el = e.target;
    const job = JobsStore.get(ui.drawerId);
    if (!job) return;

    // Sub-entity fields
    if (el.dataset.subId && el.dataset.subKey) {
      const kind = el.dataset.kind;
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.subKey === 'rating') value = value === '' ? null : Math.max(1, Math.min(5, parseInt(value, 10) || 1));
      if (el.type === 'date' && !value) value = null;
      const logs = {
        'tasks.done': value ? 'Task completed' : null,
        'interviews.outcome': value !== 'pending' ? `Interview outcome: ${JOBS_INTERVIEW_OUTCOMES.find((o) => o.id === value)?.label || value}` : null,
        'interviews.at': value ? 'Interview scheduled' : null,
        'interviews.thankYouSent': value ? 'Thank-you message sent' : null,
      };
      JobsStore.updateSub(job.id, kind, el.dataset.subId, { [el.dataset.subKey]: value },
        { log: logs[`${kind}.${el.dataset.subKey}`] || null });
      if (kind === 'tasks' && el.dataset.subKey === 'done') renderSubs(JobsStore.get(job.id));
      return;
    }

    const map = FIELD_MAP.find(([fid]) => fid === el.id);
    if (!map) return;
    const [, path, type] = map;
    let value = el.value;
    if (type === 'number') value = value === '' ? null : Math.max(0, parseFloat(value) || 0) || null;
    if (type === 'date' && !value) value = null;
    if (type === 'lines') value = value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (type === 'list') value = value.split(',').map((s) => s.trim()).filter(Boolean);

    if (path === 'status') { setStatus([job.id], value); return; }

    JobsStore.update(job.id, pathPatch(job, path, value));
    if (path === 'title' || path === 'company') renderDrawerHead(JobsStore.get(job.id));
    if (path === 'docs.submittedAt' && value) JobsStore.update(job.id, {}, { log: 'Application documents submitted' });
  });

  /* Fit sliders: live output on input, save on change. */
  $('#jobsFitScores').addEventListener('input', (e) => {
    const row = e.target.closest('[data-fit]');
    if (!row || e.target.type !== 'range') return;
    e.target.removeAttribute('data-unset');
    row.querySelector('output').textContent = e.target.value;
    row.querySelector('.jb-score__clear').hidden = false;
  });
  $('#jobsFitScores').addEventListener('change', (e) => {
    const row = e.target.closest('[data-fit]');
    if (!row || !ui.drawerId || e.target.type !== 'range') return;
    const job = JobsStore.get(ui.drawerId);
    JobsStore.update(job.id, { fit: { ...job.fit, [row.dataset.fit]: parseInt(e.target.value, 10) } });
  });
  $('#jobsFitScores').addEventListener('click', (e) => {
    const clear = e.target.closest('.jb-score__clear');
    if (!clear || !ui.drawerId) return;
    const row = clear.closest('[data-fit]');
    const job = JobsStore.get(ui.drawerId);
    JobsStore.update(job.id, { fit: { ...job.fit, [row.dataset.fit]: null } });
    renderFitSliders(JobsStore.get(ui.drawerId));
  });

  /* Sub-entity add/remove */
  $$('[data-sub-add]').forEach((btn) => btn.addEventListener('click', () => {
    if (!ui.drawerId) return;
    JobsStore.addSub(ui.drawerId, btn.dataset.subAdd);
    renderSubs(JobsStore.get(ui.drawerId));
    renderMeta(JobsStore.get(ui.drawerId));
    const boxes = $$(`#jobs${btn.dataset.subAdd[0].toUpperCase() + btn.dataset.subAdd.slice(1)} .jb-sub, #jobsTasks .jb-task`);
    const last = boxes[boxes.length - 1];
    if (last) { if (last.tagName === 'DETAILS') last.open = true; last.querySelector('input,select')?.focus(); }
  }));
  $('#jobsDrawer').addEventListener('click', (e) => {
    const del = e.target.closest('[data-sub-del]');
    if (del && ui.drawerId) {
      e.preventDefault();
      JobsStore.removeSub(ui.drawerId, del.dataset.kind, del.dataset.subId);
      renderSubs(JobsStore.get(ui.drawerId));
    }
  });

  /* Manual activity note */
  $('#jobsActivityAdd').addEventListener('click', () => {
    const input = $('#jobsActivityInput');
    const text = input.value.trim();
    if (!text || !ui.drawerId) return;
    JobsStore.update(ui.drawerId, {}, { log: text });
    input.value = '';
    renderMeta(JobsStore.get(ui.drawerId));
  });
  $('#jobsActivityInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#jobsActivityAdd').click(); });

  /* ── Status changes ─────────────────────────────────────── */

  function setStatus(ids, statusId) {
    ids.forEach((id) => {
      const job = JobsStore.get(id);
      if (!job || job.status === statusId) return;
      JobsStore.setStatus(id, statusId);
      const g = JobsStore.groupOf(statusId);
      if (g === 'won') toast(`${job.company || 'Offer'} accepted — congratulations! 🏆`);
    });
    if (ui.drawerId && ids.includes(ui.drawerId)) openDrawer(ui.drawerId);
  }

  let menuTargets = null;
  function openStatusMenu(anchor, ids) {
    menuTargets = ids;
    const menu = $('#jobsStatusMenu');
    menu.innerHTML = JobsStore.statuses().map((s) =>
      `<button class="badge jbadge--${s.color}" data-status="${esc(s.id)}">${esc(s.label)}</button>`).join('');
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 12)}px`;
    menu.style.left = `${Math.min(r.left, innerWidth - menu.offsetWidth - 12)}px`;
  }
  $('#jobsStatusMenu').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (btn && menuTargets) { setStatus(menuTargets, btn.dataset.status); ui.selection.clear(); }
    $('#jobsStatusMenu').hidden = true;
  });

  /* ── Table events (delegation) ──────────────────────────── */

  $('#jobsTableWrap').addEventListener('click', (e) => {
    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn) {
      const id = sortBtn.dataset.sort;
      const v = JobsStore.state.view;
      JobsStore.setView(v.sortBy === id ? { sortDir: v.sortDir === 'asc' ? 'desc' : 'asc' } : { sortBy: id, sortDir: 'asc' });
      return;
    }
    if (e.target.id === 'jobsCheckAll') {
      const list = filtered();
      const all = list.every((j) => ui.selection.has(j.id));
      list.forEach((j) => (all ? ui.selection.delete(j.id) : ui.selection.add(j.id)));
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
    const dateCell = e.target.closest('[data-act="edit-date"]');
    if (dateCell) return inlineEdit(dateCell, id, 'followUpDate', 'date');
    const appliedCell = e.target.closest('[data-act="edit-applied"]');
    if (appliedCell) return inlineEdit(appliedCell, id, 'appliedDate', 'date');
    openDrawer(id);
  });

  $('#jobsCards').addEventListener('click', (e) => {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    if (e.target.closest('[data-act="status"]')) return openStatusMenu(e.target, [card.dataset.id]);
    openDrawer(card.dataset.id);
  });

  function inlineEdit(cellEl, id, key, type) {
    if (cellEl.querySelector('input')) return;
    const job = JobsStore.get(id);
    const input = document.createElement('input');
    input.type = type;
    input.className = 'cell-input';
    input.value = job[key] ?? '';
    cellEl.innerHTML = '';
    cellEl.appendChild(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return; done = true;
      let v = input.value;
      if (type === 'date' && !v) v = null;
      JobsStore.update(id, { [key]: v });
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

  $('#jobsChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    ui.status = chip.dataset.chip;
    ui.selection.clear();
    renderAll();
  });

  let searchTimer;
  $('#jobsSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { ui.q = e.target.value; if (ui.view !== 'table') setView('table'); else renderAll(); }, 120);
  });

  $('#jobsSourceSel').addEventListener('change', (e) => { ui.source = e.target.value; renderAll(); });
  $('#jobsPrioritySel').addEventListener('change', (e) => { ui.priority = e.target.value; renderAll(); });

  /* Column manager */
  function renderColPop() {
    const visible = JobsStore.state.view.visibleColumns;
    $('#jobsColGrid').innerHTML = JOBS_COLUMNS.map((c) =>
      `<label><input type="checkbox" data-col="${c.id}" ${visible.includes(c.id) ? 'checked' : ''} ${c.locked ? 'disabled' : ''}/> ${c.label}</label>`).join('');
  }
  $('#jobsColBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    renderColPop();
    $('#jobsColPop').hidden = !$('#jobsColPop').hidden;
    $('#jobsMoreMenu').hidden = true;
  });
  $('#jobsColPop').addEventListener('change', (e) => {
    const cbx = e.target.closest('[data-col]');
    if (!cbx) return;
    const id = cbx.dataset.col;
    const cols = JOBS_COLUMNS.filter((c) =>
      c.id === id ? cbx.checked : (JobsStore.state.view.visibleColumns.includes(c.id) || c.locked)
    ).map((c) => c.id);
    JobsStore.setView({ visibleColumns: cols });
  });

  /* More menu */
  $('#jobsMoreBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#jobsMoreMenu').hidden = !$('#jobsMoreMenu').hidden;
    $('#jobsColPop').hidden = true;
  });
  $('#jobsExportJson').addEventListener('click', () => { JobsStore.exportJSON(); toast('Career pipeline backup downloaded. 💾'); $('#jobsMoreMenu').hidden = true; });
  $('#jobsImportJson').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { toast(`Imported ${JobsStore.importJSON(await file.text())} applications.`); }
    catch (err) { toast(err.message || 'Could not import that file.', 'error'); }
    e.target.value = '';
    $('#jobsMoreMenu').hidden = true;
  });
  $('#jobsExportCsvAll').addEventListener('click', () => { toast(`Exported ${JobsStore.exportCSV()} applications to CSV.`); $('#jobsMoreMenu').hidden = true; });
  $('#jobsExportCsvFiltered').addEventListener('click', () => {
    if (ui.view !== 'table') setView('table');
    toast(`Exported ${JobsStore.exportCSV(filtered())} filtered applications to CSV.`);
    $('#jobsMoreMenu').hidden = true;
  });
  $('#jobsImportCsvBtn').addEventListener('click', () => { $('#jobsCsvInput').click(); $('#jobsMoreMenu').hidden = true; });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#jobsColPop, #jobsColBtn')) $('#jobsColPop').hidden = true;
    if (!e.target.closest('#jobsMoreMenu, #jobsMoreBtn')) $('#jobsMoreMenu').hidden = true;
    if (!e.target.closest('#jobsStatusMenu, [data-act="status"]')) $('#jobsStatusMenu').hidden = true;
  });

  /* ── New / import / drawer buttons ──────────────────────── */

  function newJob() {
    const job = JobsStore.create();
    ui.status = 'all'; ui.source = 'all'; ui.priority = 'all';
    if (ui.view !== 'table' && ui.view !== 'board') setView('table');
    openDrawer(job.id);
  }
  $('#jobsNewBtn').addEventListener('click', newJob);
  $('#jobsFab').addEventListener('click', () => JobsImportUI.open());
  $('#jobsQuickGo').addEventListener('click', () => { JobsImportUI.openWithUrl($('#jobsQuickUrl').value); $('#jobsQuickUrl').value = ''; });
  $('#jobsQuickUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#jobsQuickGo').click(); });
  $('#jobsQuickPaste').addEventListener('click', () => JobsImportUI.open('paste'));
  $('#jobsQuickManual').addEventListener('click', newJob);
  $('#jobsImportBtn').addEventListener('click', () => JobsImportUI.open());
  $('#jobsEmptyImport').addEventListener('click', () => JobsImportUI.open());
  $('#jobsEmptyAdd').addEventListener('click', newJob);
  $('#jobsNoMatchClear').addEventListener('click', () => {
    ui.status = 'all'; ui.source = 'all'; ui.priority = 'all'; ui.q = '';
    $('#jobsSearch').value = ''; $('#jobsSourceSel').value = 'all'; $('#jobsPrioritySel').value = 'all';
    renderAll();
  });

  $('#jobsDrawerClose').addEventListener('click', closeDrawer);
  $('#jobsDrawerDone').addEventListener('click', closeDrawer);
  $('#jobsScrim').addEventListener('click', closeDrawer);
  $('#jobsDrawerPrev').addEventListener('click', () => drawerNav(-1));
  $('#jobsDrawerNext').addEventListener('click', () => drawerNav(1));

  $('#jobsDrawerDuplicate').addEventListener('click', () => {
    const copy = JobsStore.duplicate(ui.drawerId);
    if (copy) { toast('Duplicated as a template — dates and history reset.'); openDrawer(copy.id); }
  });

  $('#jobsDrawerArchive').addEventListener('click', () => {
    const id = ui.drawerId;
    const job = JobsStore.get(id);
    const wasArchived = job.archived;
    closeDrawer();
    JobsStore.setArchived([id], !wasArchived);
    toast(wasArchived ? 'Application restored.' : 'Application archived.', 'ok',
      { label: 'Undo', fn: () => JobsStore.setArchived([id], wasArchived) });
  });

  $('#jobsDrawerDelete').addEventListener('click', () => {
    const id = ui.drawerId;
    confirmBox('Delete this application permanently?', () => {
      closeDrawer();
      const snaps = JobsStore.remove([id]);
      toast('Application deleted.', 'ok', { label: 'Undo', fn: () => JobsStore.restore(snaps) });
    });
  });

  /* ── Bulk actions ───────────────────────────────────────── */

  const selIds = () => Array.from(ui.selection);
  $('#jobsBulkStatus').addEventListener('click', (e) => { e.stopPropagation(); openStatusMenu(e.target, selIds()); });
  $('#jobsBulkFollow').addEventListener('click', () => { $('#jobsFollowModal').hidden = false; $('#jobsFollowDate').value = jobsToday(); });
  $('#jobsFollowApply').addEventListener('click', () => {
    const d = $('#jobsFollowDate').value || null;
    selIds().forEach((id) => JobsStore.update(id, { followUpDate: d }));
    ui.selection.clear();
    $('#jobsFollowModal').hidden = true;
    toast('Follow-up date set.');
  });
  $('#jobsFollowCancel').addEventListener('click', () => { $('#jobsFollowModal').hidden = true; });
  $('#jobsBulkArchive').addEventListener('click', () => {
    const ids = selIds();
    ui.selection.clear();
    JobsStore.setArchived(ids, true);
    toast(`${ids.length} archived.`, 'ok', { label: 'Undo', fn: () => JobsStore.setArchived(ids, false) });
  });
  $('#jobsBulkDelete').addEventListener('click', () => {
    const ids = selIds();
    confirmBox(`Delete ${ids.length} application${ids.length === 1 ? '' : 's'} permanently?`, () => {
      ui.selection.clear();
      const snaps = JobsStore.remove(ids);
      toast(`${ids.length} deleted.`, 'ok', { label: 'Undo', fn: () => JobsStore.restore(snaps) });
    });
  });

  function confirmBox(msg, onYes) {
    $('#jobsConfirmMsg').textContent = msg;
    $('#jobsConfirmModal').hidden = false;
    $('#jobsConfirmYes').onclick = () => { $('#jobsConfirmModal').hidden = true; onYes(); };
    $('#jobsConfirmNo').onclick = () => { $('#jobsConfirmModal').hidden = true; };
  }

  /* ── View tabs ──────────────────────────────────────────── */

  $$('[data-jobs-tab]').forEach((t) => t.addEventListener('click', () => setView(t.dataset.jobsTab)));

  /* ── Keyboard shortcuts ─────────────────────────────────── */

  const anyModal = () => !$('#jobsConfirmModal').hidden || !$('#jobsFollowModal').hidden || JobsImportUI.anyOpen();

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (window.HelpUI && HelpUI.anyOpen()) return;
      if (JobsImportUI.anyOpen()) { JobsImportUI.closeAll(); return; }
      if (anyModal()) { $('#jobsConfirmModal').hidden = true; $('#jobsFollowModal').hidden = true; return; }
      if (!$('#jobsStatusMenu').hidden) { $('#jobsStatusMenu').hidden = true; return; }
      if (ui.drawerId) { closeDrawer(); return; }
      if (typing) { document.activeElement.blur(); return; }
      return;
    }
    if (typing || anyModal() || (window.HelpUI && HelpUI.anyOpen())) return;

    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newJob(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); JobsImportUI.open(); }
    else if (e.key === '/') { e.preventDefault(); $('#jobsSearch').focus(); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ui.view === 'table') {
      e.preventDefault();
      const list = filtered();
      if (!list.length) return;
      const i = list.findIndex((j) => j.id === ui.focusId);
      const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || list[0];
      ui.focusId = next.id;
      renderTable();
      $(`.lead-row[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && ui.focusId && ui.view === 'table') {
      if (ui.drawerId) return;
      e.preventDefault();
      openDrawer(ui.focusId);
    } else if ((e.key === 'j' || e.key === 'J') && ui.drawerId) drawerNav(1);
    else if ((e.key === 'k' || e.key === 'K') && ui.drawerId) drawerNav(-1);
  });

  /* ── Public API (used by tour.js, import UI, views) ─────── */

  function openFirstJob() {
    const first = filtered()[0] || JobsStore.state.jobs[0];
    if (first) openDrawer(first.id);
  }
  window.JobsUI = {
    openDrawer, closeDrawer, toast, openFirstJob, newJob,
    openImport: () => JobsImportUI.open(),
    setView,
  };

  /* ── Boot ───────────────────────────────────────────────── */

  JobsImportUI.bind();
  JobsViews.bind({
    openDrawer,
    openStatusMenu,
    toast,
    gotoTable(patch) {
      if (patch.status) ui.status = patch.status;
      ui.selection.clear();
      setView('table');
    },
    gotoView(view) { setView(view); },
  });

  document.addEventListener('jobs:changed', () => { renderView(); });
  document.addEventListener('jobs:error', (e) => toast(e.detail, 'error'));

  readHash();
  setView(ui.view, { skipHash: true });
  writeHash();

  // Morning digest: follow-ups + tasks needing attention.
  const s = JobsStore.stats();
  const due = s.dueToday + s.overdue;
  if (due > 0) {
    setTimeout(() => toast(`⚠ ${due} follow-up${due === 1 ? ' needs' : 's need'} attention`, 'ok',
      { label: 'View', fn: () => { ui.status = 'due'; setView('table'); } }), 600);
  }

  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
