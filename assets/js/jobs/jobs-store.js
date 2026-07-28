/* ============================================================
   jobs-store.js — Career Pipeline state layer (localStorage)
   DOM-free. Namespaced key `vaugn.jobs.v1` with schemaVersion.
   Never touches vaugn.crm.* or vaugn.dashboard.* data.
   Emits 'jobs:changed' on document after every save.
   ============================================================ */

const JOBS_KEY = 'vaugn.jobs.v1';
const JOBS_SCHEMA_VERSION = 1;

/* Sequential migrations keyed by fromVersion. v1 is current — future
   shape changes add an entry here instead of breaking old data. */
const JOBS_MIGRATIONS = {
  // 1: (state) => { …mutate to v2…; state.schemaVersion = 2; },
};

const JobsStore = {
  state: null,

  defaults() {
    return {
      schemaVersion: JOBS_SCHEMA_VERSION,
      jobs: [],
      settings: {
        statuses: JOBS_DEFAULT_STATUSES.map((s) => ({ ...s })),
        stalledDays: 14,
        deadlineWarnDays: 3,
      },
      view: {
        mode: 'dashboard',
        visibleColumns: [...JOBS_DEFAULT_COLUMNS],
        sortBy: 'followUpDate',
        sortDir: 'asc',
      },
      updatedAt: null,
    };
  },

  load() {
    const base = this.defaults();
    try {
      const raw = localStorage.getItem(JOBS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.jobs)) {
          let v = Number(saved.schemaVersion) || 1;
          while (v < JOBS_SCHEMA_VERSION && JOBS_MIGRATIONS[v]) { JOBS_MIGRATIONS[v](saved); v = Number(saved.schemaVersion) || v + 1; }
          base.jobs = saved.jobs.map(jobsMergeJob);
          if (saved.settings) {
            base.settings = { ...base.settings, ...saved.settings };
            if (!Array.isArray(base.settings.statuses) || !base.settings.statuses.length) {
              base.settings.statuses = JOBS_DEFAULT_STATUSES.map((s) => ({ ...s }));
            }
            base.settings.statuses = base.settings.statuses
              .filter((s) => s && s.id && s.label)
              .map((s) => ({
                id: String(s.id), label: String(s.label),
                group: JOBS_GROUP_ORDER[s.group] !== undefined ? s.group : 'applied',
                color: JOBS_BADGE_COLORS.includes(s.color) ? s.color : 'slate',
              }));
          }
          if (saved.view) {
            base.view = { ...base.view, ...saved.view };
            base.view.visibleColumns = (saved.view.visibleColumns || JOBS_DEFAULT_COLUMNS)
              .filter((id) => JOBS_COLUMN_INDEX[id]);
            JOBS_COLUMNS.filter((c) => c.locked).forEach((c) => {
              if (!base.view.visibleColumns.includes(c.id)) base.view.visibleColumns.unshift(c.id);
            });
          }
          base.updatedAt = saved.updatedAt || null;
        }
      }
    } catch (e) {
      console.warn('Could not read career pipeline data, starting fresh.', e);
    }
    this.state = base;
    return base;
  },

  save() {
    this.state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist career pipeline data.', e);
      document.dispatchEvent(new CustomEvent('jobs:error', { detail: 'Storage is full — export a backup and archive old applications.' }));
    }
    document.dispatchEvent(new CustomEvent('jobs:changed'));
  },

  hasData() { return this.state.jobs.length > 0; },

  get(id) { return this.state.jobs.find((j) => j.id === id); },

  /* ── Status registry helpers ───────────────────────────── */

  statuses() { return this.state.settings.statuses; },

  status(id) {
    return this.state.settings.statuses.find((s) => s.id === id)
      || { id, label: 'Unknown', group: 'applied', color: 'slate' };
  },

  groupOf(statusId) { return this.status(statusId).group; },

  /* ── CRUD ──────────────────────────────────────────────── */

  create(patch = {}) {
    const job = jobsMergeJob({ ...jobsBlankJob(), ...patch });
    if (patch.description) job.description = jobsCleanText(patch.description);
    this.state.jobs.unshift(job);
    this.save();
    return job;
  },

  /** Patch a job. Status changes go through setStatus() for history. */
  update(id, patch, { log } = {}) {
    const job = this.get(id);
    if (!job) return null;
    patch = { ...patch };
    if (patch.description !== undefined) patch.description = jobsCleanText(patch.description);
    const statusPatch = patch.status;
    delete patch.status;
    Object.assign(job, patch);
    job.updatedAt = new Date().toISOString();
    if (log) this.log(job, log);
    if (statusPatch && statusPatch !== job.status) return this.setStatus(id, statusPatch);
    this.save();
    return job;
  },

  /** Change status: appends to statusHistory + activity, auto-fills
      appliedDate the first time an application reaches the applied group. */
  setStatus(id, statusId, { log } = {}) {
    const job = this.get(id);
    if (!job || job.status === statusId) return job;
    const now = new Date().toISOString();
    job.status = statusId;
    job.statusHistory.push({ status: statusId, at: now });
    if (job.statusHistory.length > 100) job.statusHistory = job.statusHistory.slice(-100);
    job.updatedAt = now;
    const st = this.status(statusId);
    const gi = JOBS_GROUP_ORDER[st.group];
    if (gi >= JOBS_GROUP_ORDER.applied && st.group !== 'lost' && !job.appliedDate) job.appliedDate = jobsToday();
    this.log(job, log || `Status → ${st.label}`);
    this.save();
    return job;
  },

  log(job, text) {
    job.activity.unshift({ at: new Date().toISOString(), text });
    if (job.activity.length > 50) job.activity.length = 50;
  },

  /** Remove jobs; returns snapshots for undo. */
  remove(ids) {
    const snaps = [];
    ids.forEach((id) => {
      const i = this.state.jobs.findIndex((j) => j.id === id);
      if (i > -1) snaps.push({ job: this.state.jobs[i], index: i });
    });
    this.state.jobs = this.state.jobs.filter((j) => !ids.includes(j.id));
    this.save();
    return snaps;
  },

  restore(snaps) {
    snaps.sort((a, b) => a.index - b.index)
      .forEach((s) => this.state.jobs.splice(Math.min(s.index, this.state.jobs.length), 0, s.job));
    this.save();
  },

  setArchived(ids, archived) {
    ids.forEach((id) => {
      const job = this.get(id);
      if (job) {
        job.archived = archived;
        job.updatedAt = new Date().toISOString();
        this.log(job, archived ? 'Archived' : 'Restored from archive');
      }
    });
    this.save();
  },

  /** Copy an application as a template: keeps job + company details,
      resets status, dates, interviews, tasks and history. */
  duplicate(id) {
    const src = this.get(id);
    if (!src) return null;
    const now = new Date().toISOString();
    const copy = jobsMergeJob(JSON.parse(JSON.stringify(src)));
    copy.id = jobsUid('job_');
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.archived = false;
    copy.status = 'saved';
    copy.statusHistory = [{ status: 'saved', at: now }];
    copy.appliedDate = null;
    copy.followUpDate = null;
    copy.interviews = [];
    copy.tasks = [];
    copy.contacts = copy.contacts.map((c) => ({ ...c, id: jobsUid('ct_') }));
    copy.docs = { ...copy.docs, submittedAt: null };
    copy.activity = [{ at: now, text: `Duplicated from “${src.title || 'application'}”` }];
    this.state.jobs.unshift(copy);
    this.save();
    return copy;
  },

  setView(patch) {
    Object.assign(this.state.view, patch);
    this.save();
  },

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.save();
  },

  /* ── Sub-entities (contacts / interviews / tasks) ──────── */

  addSub(jobId, kind) {
    const job = this.get(jobId);
    if (!job) return null;
    const item = kind === 'contacts' ? jobsBlankContact()
      : kind === 'interviews' ? jobsBlankInterview() : jobsBlankTask();
    job[kind].push(item);
    job.updatedAt = new Date().toISOString();
    const label = { contacts: 'Contact added', interviews: 'Interview added', tasks: 'Task added' }[kind];
    this.log(job, label);
    this.save();
    return item;
  },

  updateSub(jobId, kind, subId, patch, { log } = {}) {
    const job = this.get(jobId);
    const item = job && job[kind].find((s) => s.id === subId);
    if (!item) return null;
    Object.assign(item, patch);
    job.updatedAt = new Date().toISOString();
    if (log) this.log(job, log);
    this.save();
    return item;
  },

  removeSub(jobId, kind, subId) {
    const job = this.get(jobId);
    if (!job) return;
    job[kind] = job[kind].filter((s) => s.id !== subId);
    job.updatedAt = new Date().toISOString();
    this.save();
  },

  /* ── Smart-date helpers ────────────────────────────────── */

  daysSinceApplied(job) {
    if (!job.appliedDate) return null;
    return Math.max(0, Math.round((new Date(jobsToday()) - new Date(job.appliedDate)) / 86400000));
  },

  daysInStage(job) {
    const last = job.statusHistory[job.statusHistory.length - 1];
    if (!last) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(last.at).getTime()) / 86400000));
  },

  isActive(job) {
    const g = this.groupOf(job.status);
    return !job.archived && g !== 'won' && g !== 'lost';
  },

  isStalled(job) {
    if (!this.isActive(job)) return false;
    const days = (Date.now() - new Date(job.updatedAt).getTime()) / 86400000;
    return days >= (this.state.settings.stalledDays || 14);
  },

  /** Has this application ever reached the given group (progression-wise)? */
  reached(job, groupId) {
    const target = JOBS_GROUP_ORDER[groupId];
    return job.statusHistory.some((h) => {
      const g = this.groupOf(h.status);
      return g !== 'lost' && JOBS_GROUP_ORDER[g] >= target;
    });
  },

  /* ── Derived stats (KPIs + dashboard + history snapshots) ── */

  stats() {
    const today = jobsToday();
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
    const month = today.slice(0, 7);
    const warnDays = this.state.settings.deadlineWarnDays || 3;
    const warnLimit = new Date(Date.now() + warnDays * 86400000);
    const warnStr = `${warnLimit.getFullYear()}-${String(warnLimit.getMonth() + 1).padStart(2, '0')}-${String(warnLimit.getDate()).padStart(2, '0')}`;

    let total = 0, active = 0, appliedTotal = 0, appliedWeek = 0, appliedMonth = 0,
        interviewsUpcoming = 0, offers = 0, accepted = 0, rejected = 0,
        dueToday = 0, overdue = 0, stalled = 0, deadlinesSoon = 0,
        reachedAssessment = 0, reachedInterview = 0, reachedOffer = 0;

    this.state.jobs.forEach((j) => {
      total++;
      const g = this.groupOf(j.status);
      if (j.appliedDate) {
        appliedTotal++;
        if (j.appliedDate >= weekAgoStr) appliedWeek++;
        if (j.appliedDate.slice(0, 7) === month) appliedMonth++;
      }
      if (this.reached(j, 'assessment')) reachedAssessment++;
      if (this.reached(j, 'interviewing')) reachedInterview++;
      if (this.reached(j, 'offer')) reachedOffer++;
      if (g === 'won') { accepted++; return; }
      if (g === 'lost') { if (j.status === 'rejected') rejected++; return; }
      if (j.archived) return;
      active++;
      if (g === 'offer') offers++;
      j.interviews.forEach((iv) => {
        if (iv.outcome === 'pending' && iv.at && iv.at.slice(0, 10) >= today) interviewsUpcoming++;
      });
      if (j.followUpDate) {
        if (j.followUpDate === today) dueToday++;
        else if (j.followUpDate < today) overdue++;
      }
      j.tasks.forEach((t) => {
        if (t.done || !t.due) return;
        if (t.due === today) dueToday++;
        else if (t.due < today) overdue++;
      });
      if (j.deadline && !j.appliedDate && j.deadline >= today && j.deadline <= warnStr) deadlinesSoon++;
      if (this.isStalled(j)) stalled++;
    });

    return {
      total, active, appliedTotal, appliedWeek, appliedMonth,
      interviewsUpcoming, offers, accepted, rejected,
      dueToday, overdue, stalled, deadlinesSoon,
      reachedAssessment, reachedInterview, reachedOffer,
      interviewRate: appliedTotal > 0 ? reachedInterview / appliedTotal : null,
      offerRate: appliedTotal > 0 ? reachedOffer / appliedTotal : null,
      responseRate: appliedTotal > 0 ? reachedAssessment / appliedTotal : null,
    };
  },

  /** Flattened dated events for the calendar / agenda / dashboard.
      Returns [{date:'YYYY-MM-DD', time?, type, jobId, label, sub, done}] */
  agendaEvents(from, to) {
    const out = [];
    const inWin = (d) => d && (!from || d >= from) && (!to || d <= to);
    this.state.jobs.forEach((j) => {
      if (j.archived) return;
      const g = this.groupOf(j.status);
      const closed = g === 'won' || g === 'lost';
      const name = j.company || j.title || 'Application';
      if (!closed && j.followUpDate && inWin(j.followUpDate)) {
        out.push({ date: j.followUpDate, type: 'followup', jobId: j.id, label: `Follow up — ${name}`, sub: j.title });
      }
      if (!closed && j.deadline && !j.appliedDate && inWin(j.deadline)) {
        out.push({ date: j.deadline, type: 'deadline', jobId: j.id, label: `Deadline — ${name}`, sub: j.title });
      }
      j.interviews.forEach((iv) => {
        const d = iv.at ? iv.at.slice(0, 10) : null;
        if (d && inWin(d)) {
          out.push({
            date: d, time: iv.at.slice(11, 16), type: 'interview', jobId: j.id,
            label: `${JOBS_INTERVIEW_TYPE_INDEX[iv.type]?.label || 'Interview'} — ${name}`,
            sub: iv.interviewer || j.title, done: iv.outcome !== 'pending',
          });
        }
      });
      j.tasks.forEach((t) => {
        if (t.due && inWin(t.due) && !(closed && t.done)) {
          out.push({ date: t.due, type: 'task', jobId: j.id, label: t.title || JOBS_TASK_TYPE_INDEX[t.type]?.label || 'Task', sub: name, done: t.done });
        }
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  },

  /* ── Backup / export ───────────────────────────────────── */

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `career-pipeline-backup-${jobsToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.jobs)) throw new Error('Not a valid career pipeline backup file.');
    const base = this.defaults();
    let v = Number(parsed.schemaVersion) || 1;
    while (v < JOBS_SCHEMA_VERSION && JOBS_MIGRATIONS[v]) { JOBS_MIGRATIONS[v](parsed); v = Number(parsed.schemaVersion) || v + 1; }
    base.jobs = parsed.jobs.map(jobsMergeJob);
    if (parsed.settings) base.settings = { ...base.settings, ...parsed.settings };
    if (parsed.view) base.view = { ...base.view, ...parsed.view };
    this.state = base;
    this.save();
    return base.jobs.length;
  },

  /** RFC-4180 CSV of the (optionally filtered) applications. */
  exportCSV(jobs = this.state.jobs) {
    const cols = [
      ['id', (j) => j.id], ['title', (j) => j.title], ['company', (j) => j.company],
      ['location', (j) => j.location],
      ['arrangement', (j) => j.arrangement], ['employmentType', (j) => j.employmentType],
      ['salaryMin', (j) => j.salaryMin ?? ''], ['salaryMax', (j) => j.salaryMax ?? ''],
      ['salaryCurrency', (j) => j.salaryCurrency], ['salaryPeriod', (j) => j.salaryPeriod],
      ['status', (j) => this.status(j.status).label], ['priority', (j) => j.priority],
      ['source', (j) => j.source], ['url', (j) => j.url],
      ['postedDate', (j) => j.postedDate ?? ''], ['appliedDate', (j) => j.appliedDate ?? ''],
      ['deadline', (j) => j.deadline ?? ''], ['followUpDate', (j) => j.followUpDate ?? ''],
      ['fitOverall', (j) => j.fit.overall ?? ''],
      ['tags', (j) => j.tags.join('; ')],
      ['contactName', (j) => j.contacts[0]?.name || ''], ['contactEmail', (j) => j.contacts[0]?.email || ''],
      ['companyWebsite', (j) => j.companyWebsite], ['companyIndustry', (j) => j.companyIndustry],
      ['notes', (j) => j.notes],
    ];
    const q = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map(([h]) => h).join(',')];
    jobs.forEach((j) => lines.push(cols.map(([, fn]) => q(fn(j))).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `job-applications-${jobsToday()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    return jobs.length;
  },
};

// const bindings don't attach to window — expose explicitly for cross-file checks.
window.JobsStore = JobsStore;
