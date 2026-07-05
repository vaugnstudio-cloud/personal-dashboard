/* ============================================================
   history.js — daily snapshots that power trend charts.
   One entry per calendar day: metric values + pipeline stats.
   Loaded on every page after store.js / crm-store.js.
   ============================================================ */

const HISTORY_KEY = 'vaugn.history.v1';
const HISTORY_CAP = 400; // ≈13 months of daily entries

const History = {
  entries: [],

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  load() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      this.entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.entries)) this.entries = [];
    } catch (e) {
      this.entries = [];
    }
    return this.entries;
  },

  save() {
    if (this.entries.length > HISTORY_CAP) {
      this.entries = this.entries.slice(this.entries.length - HISTORY_CAP);
    }
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(this.entries)); } catch (e) { /* full — trends degrade gracefully */ }
  },

  /** Build a snapshot of right now. */
  capture() {
    const metrics = {};
    METRICS.forEach((m) => { metrics[m.id] = Store.get(m.id).value; });
    const snap = { date: this.today(), metrics };
    if (window.CrmStore && CrmStore.state) {
      const s = CrmStore.stats();
      snap.pipeline = {
        openLeads: s.openLeads,
        pipelineValue: s.pipelineValue,
        activeClients: s.activeClients,
        wonThisMonth: s.wonThisMonth,
      };
    }
    return snap;
  },

  /** Record/refresh today's entry. Called on load + after data changes. */
  snapshot() {
    const today = this.today();
    const snap = this.capture();
    const last = this.entries[this.entries.length - 1];
    if (last && last.date === today) this.entries[this.entries.length - 1] = snap;
    else this.entries.push(snap);
    this.save();
  },

  /** Number of distinct days recorded. */
  days() { return this.entries.length; },

  /** [{date, value}] series for a dashboard metric or a pipeline stat. */
  series(key, source = 'metrics') {
    return this.entries
      .map((e) => ({ date: e.date, value: source === 'pipeline' ? e.pipeline?.[key] : e.metrics?.[key] }))
      .filter((p) => Number.isFinite(p.value));
  },
};

window.History = History;

/* Boot: load, take today's snapshot, keep today's entry fresh on changes.
   Runs before the page apps, so make sure the stores are hydrated first
   (load() is a read-only hydrate — safe to call more than once). */
if (!Store.state) Store.load();
if (window.CrmStore && !CrmStore.state) CrmStore.load();
History.load();
History.snapshot();
let historyTimer;
const refreshToday = () => {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => History.snapshot(), 1500);
};
document.addEventListener('store:changed', refreshToday);
document.addEventListener('crm:changed', refreshToday);
