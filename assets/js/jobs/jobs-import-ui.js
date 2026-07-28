/* ============================================================
   jobs-import-ui.js — Import Job flow (URL → extract → review),
   paste-description parsing, and CSV import with column mapping.
   Markup skeleton lives in jobs.html; this file drives it.
   Nothing is saved until the user approves the review screen.
   ============================================================ */

const JobsImportUI = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = JobsRender.esc;

  let pending = null;   // { fields, confidence, provider, sourceUrl }

  /* ── Review field spec (grouped, all editable) ──────────── */

  const REVIEW_GROUPS = [
    {
      label: 'Job overview',
      fields: [
        { key: 'title', label: 'Job Title', required: true },
        { key: 'company', label: 'Company', required: true },
        { key: 'location', label: 'Location' },
        { key: 'arrangement', label: 'Work Arrangement', type: 'select', options: [{ id: '', label: '—' }, ...JOBS_ARRANGEMENTS] },
        { key: 'employmentType', label: 'Employment Type', type: 'select', options: [{ id: '', label: '—' }, ...JOBS_EMPLOYMENT_TYPES] },
        { key: 'experienceLevel', label: 'Seniority / Experience' },
        { key: 'salaryMin', label: 'Salary Min', type: 'number' },
        { key: 'salaryMax', label: 'Salary Max', type: 'number' },
        { key: 'salaryCurrency', label: 'Currency' },
        { key: 'salaryPeriod', label: 'Salary Period', type: 'select', options: JOBS_SALARY_PERIODS },
        { key: 'postedDate', label: 'Posted Date', type: 'date' },
        { key: 'deadline', label: 'Application Deadline', type: 'date' },
        { key: 'source', label: 'Source', type: 'select', options: [{ id: '', label: '—' }, ...JOBS_SOURCES] },
      ],
    },
    {
      label: 'Job details',
      fields: [
        { key: 'description', label: 'Full Description', type: 'textarea', rows: 6, wide: true },
        { key: 'responsibilities', label: 'Responsibilities (one per line)', type: 'lines', wide: true },
        { key: 'qualificationsRequired', label: 'Required Qualifications (one per line)', type: 'lines', wide: true },
        { key: 'qualificationsPreferred', label: 'Preferred Qualifications (one per line)', type: 'lines', wide: true },
        { key: 'benefits', label: 'Benefits (one per line)', type: 'lines', wide: true },
      ],
    },
    {
      label: 'Company',
      fields: [
        { key: 'companyWebsite', label: 'Company Website' },
        { key: 'companyIndustry', label: 'Industry' },
        { key: 'companyDescription', label: 'About the Company', type: 'textarea', rows: 3, wide: true },
      ],
    },
  ];

  /* ── Modal plumbing ─────────────────────────────────────── */

  function open(tab = 'url') {
    $('#jobsImportModal').hidden = false;
    showStage('input');
    setTab(tab);
    $('#jobsImportError').hidden = true;
    $('#jobsImportUrl').focus();
  }

  function close() {
    $('#jobsImportModal').hidden = true;
    pending = null;
    $('#jobsImportUrl').value = '';
    $('#jobsImportPaste').value = '';
    $('#jobsImportPasteUrl').value = '';
    $('#jobsImportError').hidden = true;
  }

  function setTab(tab) {
    $('#jobsImpTabUrl').classList.toggle('is-active', tab === 'url');
    $('#jobsImpTabPaste').classList.toggle('is-active', tab === 'paste');
    $('#jobsImportUrlPane').hidden = tab !== 'url';
    $('#jobsImportPastePane').hidden = tab !== 'paste';
  }

  function showStage(stage) { // input | busy | review
    $('#jobsImportInput').hidden = stage !== 'input';
    $('#jobsImportBusy').hidden = stage !== 'busy';
    $('#jobsImportReview').hidden = stage !== 'review';
  }

  function showError(message, { pivotToPaste = false, url = '' } = {}) {
    const box = $('#jobsImportError');
    box.hidden = false;
    box.innerHTML = `<strong>Couldn’t extract automatically.</strong> ${esc(message)}`;
    if (pivotToPaste) {
      setTab('paste');
      if (url) $('#jobsImportPasteUrl').value = url;
      $('#jobsImportPaste').focus();
    }
  }

  /* ── Review screen ──────────────────────────────────────── */

  function fieldValue(fields, key) {
    const v = fields[key];
    if (Array.isArray(v)) return v.join('\n');
    return v ?? '';
  }

  function renderReview() {
    const { fields, confidence, provider, sourceUrl } = pending;
    const dupes = JobsExtract.findDuplicates({ url: sourceUrl || fields.url, company: fields.company, title: fields.title });

    const fieldHTML = (f) => {
      const conf = confidence[f.key];
      const val = fieldValue(fields, f.key);
      const missing = f.required && !String(val).trim();
      const cls = ['field', f.wide ? 'field--wide' : '', conf === 'low' ? 'jb-conf' : '', missing ? 'jb-missing' : ''].join(' ');
      const hint = missing ? '<em class="jb-field-hint jb-field-hint--miss">Missing — fill this in</em>'
        : conf === 'low' ? '<em class="jb-field-hint">Auto-guessed — check this</em>' : '';
      let control;
      if (f.type === 'select') {
        control = `<select data-review="${f.key}">${f.options.map((o) => `<option value="${esc(o.id)}" ${String(val) === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea' || f.type === 'lines') {
        control = `<textarea data-review="${f.key}" rows="${f.rows || 4}">${esc(val)}</textarea>`;
      } else {
        control = `<input data-review="${f.key}" type="${f.type || 'text'}" value="${esc(val)}" />`;
      }
      return `<label class="${cls}"><span>${f.label} ${hint}</span>${control}</label>`;
    };

    $('#jobsReviewMeta').innerHTML = `
      Imported via <strong>${esc(provider)}</strong>${sourceUrl ? ` · <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(JobsExtract.normalizeUrl(sourceUrl))}</a>` : ''}
      · nothing is saved until you approve. Amber fields were guessed by heuristics; blank fields simply weren’t in the listing.`;

    $('#jobsReviewDupe').hidden = dupes.length === 0;
    if (dupes.length) {
      $('#jobsReviewDupe').innerHTML = `⚠ <strong>Possible duplicate.</strong> You already track ${dupes.map((d) =>
        `<button class="jb-dupe-link" data-open-job="${d.id}">${esc(d.company || 'an application')} — ${esc(d.title || 'untitled')}</button>`).join(', ')}. You can still save this one.`;
    }

    $('#jobsReviewFields').innerHTML = REVIEW_GROUPS.map((g) => `
      <div class="drawer__section">
        <h3>${g.label}</h3>
        <div class="field-grid">${g.fields.map(fieldHTML).join('')}</div>
      </div>`).join('');

    showStage('review');
    $('#jobsImportReview').scrollTop = 0;
  }

  function collectReview() {
    const out = {};
    document.querySelectorAll('[data-review]').forEach((el) => {
      const key = el.dataset.review;
      let v = el.value;
      const spec = REVIEW_GROUPS.flatMap((g) => g.fields).find((f) => f.key === key);
      if (spec?.type === 'lines') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (spec?.type === 'number') v = v === '' ? null : Math.max(0, parseFloat(v) || 0) || null;
      else if (spec?.type === 'date') v = v || null;
      else v = typeof v === 'string' ? v.trim() : v;
      out[key] = v;
    });
    return out;
  }

  function approve() {
    const fields = collectReview();
    if (!fields.title && !fields.company) {
      showToast('Add at least a job title or company before saving.', 'error');
      return;
    }
    const { provider, sourceUrl, confidence } = pending;
    const lowConfidence = Object.keys(confidence).filter((k) => confidence[k] === 'low');
    const job = JobsStore.create({
      ...fields,
      url: fields.url || sourceUrl || pending.fields.url || '',
      importMeta: { provider, importedAt: new Date().toISOString(), sourceUrl: sourceUrl || '', lowConfidence },
    });
    JobsStore.log(job, `Imported via ${provider}`);
    JobsStore.save();
    close();
    showToast('Application saved — review the record and set a follow-up date.');
    if (window.JobsUI) JobsUI.openDrawer(job.id);
  }

  function showToast(msg, kind) {
    if (window.JobsUI) JobsUI.toast(msg, kind);
  }

  /* ── URL + paste actions ────────────────────────────────── */

  async function runUrlImport(url) {
    if (!url.trim()) { showToast('Paste a job listing URL first.', 'error'); return; }
    showStage('busy');
    $('#jobsImportError').hidden = true;
    try {
      pending = await JobsExtract.fromUrl(url.trim());
      if (!pending.fields.url) pending.fields.url = url.trim();
      renderReview();
    } catch (err) {
      showStage('input');
      const kind = err.kind || 'network';
      const pivot = ['blocked', 'unsupported', 'cors'].includes(kind);
      showError(err.message || 'Something went wrong reading that page.', { pivotToPaste: pivot, url: url.trim() });
    }
  }

  function runPasteImport() {
    const text = $('#jobsImportPaste').value;
    if (text.trim().length < 40) { showToast('Paste the full job description first (a few lines at least).', 'error'); return; }
    const url = $('#jobsImportPasteUrl').value.trim();
    const parsed = JobsExtract.fromText(text);
    pending = { ...parsed, provider: 'Pasted description', sourceUrl: url };
    if (url && !pending.fields.url) pending.fields.url = url;
    renderReview();
  }

  /* ── CSV import (RFC-4180 parser + column mapping) ──────── */

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((v) => v !== '')) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((v) => v !== '')) rows.push(row);
    return rows;
  }

  const CSV_TARGETS = [
    { id: '', label: '— Skip —' },
    { id: 'title', label: 'Job Title', syn: ['title', 'job title', 'role', 'position', 'job'] },
    { id: 'company', label: 'Company', syn: ['company', 'employer', 'organization', 'org', 'business'] },
    { id: 'location', label: 'Location', syn: ['location', 'city', 'place'] },
    { id: 'arrangement', label: 'Work Arrangement', syn: ['arrangement', 'work arrangement', 'remote', 'workplace'] },
    { id: 'employmentType', label: 'Employment Type', syn: ['employment type', 'type', 'employment'] },
    { id: 'salaryMin', label: 'Salary Min', syn: ['salary min', 'salarymin', 'min salary', 'salary from'] },
    { id: 'salaryMax', label: 'Salary Max', syn: ['salary max', 'salarymax', 'max salary', 'salary to', 'salary'] },
    { id: 'salaryCurrency', label: 'Currency', syn: ['currency', 'salary currency'] },
    { id: 'status', label: 'Status', syn: ['status', 'stage', 'state'] },
    { id: 'priority', label: 'Priority', syn: ['priority'] },
    { id: 'source', label: 'Source', syn: ['source', 'platform', 'found via', 'via'] },
    { id: 'url', label: 'Listing URL', syn: ['url', 'link', 'job url', 'listing', 'href'] },
    { id: 'postedDate', label: 'Posted Date', syn: ['posted', 'posted date', 'date posted'] },
    { id: 'appliedDate', label: 'Date Applied', syn: ['applied', 'date applied', 'applied date', 'application date'] },
    { id: 'deadline', label: 'Deadline', syn: ['deadline', 'due', 'closes', 'closing date'] },
    { id: 'followUpDate', label: 'Follow-Up Date', syn: ['follow up', 'follow-up', 'followup', 'next follow up'] },
    { id: 'fitOverall', label: 'Fit Score', syn: ['fit', 'fit score', 'score', 'match'] },
    { id: 'tags', label: 'Tags (; separated)', syn: ['tags', 'labels'] },
    { id: 'contactName', label: 'Contact Name', syn: ['contact', 'contact name', 'recruiter', 'recruiter name'] },
    { id: 'contactEmail', label: 'Contact Email', syn: ['contact email', 'email', 'recruiter email'] },
    { id: 'companyWebsite', label: 'Company Website', syn: ['company website', 'website'] },
    { id: 'companyIndustry', label: 'Industry', syn: ['industry', 'company industry', 'sector'] },
    { id: 'notes', label: 'Notes', syn: ['notes', 'note', 'comments', 'remarks'] },
    { id: 'description', label: 'Job Description', syn: ['description', 'job description', 'details'] },
  ];

  let csvRows = null; // [header, ...rows]

  function autoMap(header) {
    const h = header.trim().toLowerCase().replace(/[_-]/g, ' ');
    const hit = CSV_TARGETS.find((t) => t.syn && (t.syn.includes(h) || t.syn.some((s) => h === s)));
    if (hit) return hit.id;
    const loose = CSV_TARGETS.find((t) => t.syn && t.syn.some((s) => h.includes(s)));
    return loose ? loose.id : '';
  }

  function openCsvModal(rows) {
    csvRows = rows;
    const header = rows[0];
    const sample = rows.slice(1, 4);
    $('#jobsCsvGrid').innerHTML = header.map((h, i) => `
      <div class="jb-csv-col">
        <p class="jb-csv-col__head">${esc(h) || `Column ${i + 1}`}</p>
        <select data-csv-col="${i}">${CSV_TARGETS.map((t) => `<option value="${t.id}" ${autoMap(h) === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
        <p class="jb-csv-col__sample">${sample.map((r) => esc(String(r[i] ?? '').slice(0, 44))).filter(Boolean).join('<br>') || '<span class="cell-dim">empty</span>'}</p>
      </div>`).join('');
    $('#jobsCsvCount').textContent = `${rows.length - 1} row${rows.length === 2 ? '' : 's'} found — map each column, then import.`;
    $('#jobsCsvModal').hidden = false;
  }

  function runCsvImport() {
    const mapping = {};
    document.querySelectorAll('[data-csv-col]').forEach((sel) => {
      if (sel.value) mapping[sel.dataset.csvCol] = sel.value;
    });
    if (!Object.values(mapping).includes('title') && !Object.values(mapping).includes('company')) {
      showToast('Map at least the Job Title or Company column.', 'error');
      return;
    }
    const statuses = JobsStore.statuses();
    const statusByLabel = Object.fromEntries(statuses.map((s) => [s.label.toLowerCase(), s.id]));
    const statusById = Object.fromEntries(statuses.map((s) => [s.id, s.id]));
    let imported = 0, skipped = 0;
    csvRows.slice(1).forEach((row) => {
      const rec = {};
      Object.entries(mapping).forEach(([col, key]) => {
        const raw = String(row[col] ?? '').trim();
        if (!raw) return;
        switch (key) {
          case 'salaryMin': case 'salaryMax': rec[key] = Math.max(0, parseFloat(raw.replace(/[^0-9.]/g, '')) || 0) || null; break;
          case 'fitOverall': rec.fit = { ...(rec.fit || {}), overall: Math.max(0, Math.min(10, parseFloat(raw) || 0)) }; break;
          case 'status': rec.status = statusById[raw.toLowerCase()] || statusByLabel[raw.toLowerCase()] || 'saved'; break;
          case 'priority': rec.priority = ['high', 'medium', 'low'].includes(raw.toLowerCase()) ? raw.toLowerCase() : 'medium'; break;
          case 'arrangement': { const a = raw.toLowerCase(); rec.arrangement = a.includes('hybrid') ? 'hybrid' : a.includes('remote') ? 'remote' : (a.includes('site') || a.includes('office')) ? 'onsite' : ''; break; }
          case 'employmentType': { const t = raw.toLowerCase(); rec.employmentType = t.includes('part') ? 'part-time' : t.includes('contract') ? 'contract' : t.includes('intern') ? 'internship' : t.includes('free') ? 'freelance' : 'full-time'; break; }
          case 'source': { const s = raw.toLowerCase(); rec.source = JOBS_SOURCE_INDEX[s] ? s : (JOBS_SOURCES.find((x) => x.label.toLowerCase() === s)?.id || 'other'); break; }
          case 'tags': rec.tags = raw.split(/[;|]/).map((t) => t.trim()).filter(Boolean); break;
          case 'contactName': rec._contactName = raw; break;
          case 'contactEmail': rec._contactEmail = raw; break;
          case 'postedDate': case 'appliedDate': case 'deadline': case 'followUpDate': {
            const d = new Date(raw);
            rec[key] = Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            break;
          }
          default: rec[key] = raw;
        }
      });
      if (!rec.title && !rec.company) { skipped++; return; }
      if (JobsExtract.findDuplicates({ url: rec.url, company: rec.company, title: rec.title }).length) { skipped++; return; }
      const contactName = rec._contactName, contactEmail = rec._contactEmail;
      delete rec._contactName; delete rec._contactEmail;
      const status = rec.status; delete rec.status;
      const job = JobsStore.create(rec);
      if (contactName || contactEmail) {
        job.contacts.push({ ...jobsBlankContact(), name: contactName || '', email: contactEmail || '' });
      }
      JobsStore.log(job, 'Imported from CSV');
      if (status && status !== 'saved') JobsStore.setStatus(job.id, status, { log: `Imported with status ${JobsStore.status(status).label}` });
      imported++;
    });
    JobsStore.save();
    $('#jobsCsvModal').hidden = true;
    csvRows = null;
    showToast(`Imported ${imported} application${imported === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped (duplicate or empty)` : ''}.`);
  }

  /* ── Wiring ─────────────────────────────────────────────── */

  function bind() {
    $('#jobsImpTabUrl').addEventListener('click', () => setTab('url'));
    $('#jobsImpTabPaste').addEventListener('click', () => setTab('paste'));
    $('#jobsImportGo').addEventListener('click', () => runUrlImport($('#jobsImportUrl').value));
    $('#jobsImportUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') runUrlImport($('#jobsImportUrl').value); });
    $('#jobsImportParse').addEventListener('click', runPasteImport);
    $('#jobsImportManual').addEventListener('click', () => { close(); if (window.JobsUI) JobsUI.newJob(); });
    $('#jobsImportClose').addEventListener('click', close);
    $('#jobsImportCancel').addEventListener('click', close);
    $('#jobsReviewSave').addEventListener('click', approve);
    $('#jobsReviewBack').addEventListener('click', () => showStage('input'));
    $('#jobsImportModal').addEventListener('click', (e) => {
      if (e.target === $('#jobsImportModal')) close();
      const dupe = e.target.closest('[data-open-job]');
      if (dupe) { close(); if (window.JobsUI) JobsUI.openDrawer(dupe.dataset.openJob); }
    });

    $('#jobsCsvInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const rows = parseCSV(await file.text());
        if (rows.length < 2) { showToast('That CSV has no data rows.', 'error'); return; }
        openCsvModal(rows);
      } catch (err) {
        showToast('Could not read that CSV file.', 'error');
      }
    });
    $('#jobsCsvImport').addEventListener('click', runCsvImport);
    $('#jobsCsvCancel').addEventListener('click', () => { $('#jobsCsvModal').hidden = true; csvRows = null; });
    $('#jobsCsvModal').addEventListener('click', (e) => { if (e.target === $('#jobsCsvModal')) { $('#jobsCsvModal').hidden = true; csvRows = null; } });
  }

  /** Open the modal with a URL pre-filled; runs the import immediately if given. */
  function openWithUrl(url) {
    open('url');
    $('#jobsImportUrl').value = url || '';
    if (url && url.trim()) runUrlImport(url);
  }

  const anyOpen = () => !$('#jobsImportModal').hidden || !$('#jobsCsvModal').hidden;
  const closeAll = () => { close(); $('#jobsCsvModal').hidden = true; };

  return { open, openWithUrl, close, bind, anyOpen, closeAll, parseCSV };
})();
