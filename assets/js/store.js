/* ============================================================
   store.js — state layer (localStorage primary store)
   ============================================================ */

const STORE_KEY = 'vaugn.dashboard.v1';

const DEFAULT_SETTINGS = {
  currency: 'USD',
  weightUnit: 'lbs',
  sheetsUrl: '',
  ownerName: 'Vaugn',
};

const Store = {
  state: null,

  /** Build a clean default state from metric definitions. */
  defaults() {
    const metrics = {};
    METRICS.forEach((m) => {
      metrics[m.id] = { value: m.value, goal: m.goal };
    });
    return { metrics, settings: { ...DEFAULT_SETTINGS }, updatedAt: null };
  },

  /** Hydrate from localStorage, merging with defaults so new metrics appear automatically. */
  load() {
    const base = this.defaults();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          Object.keys(base.metrics).forEach((id) => {
            const s = saved.metrics && saved.metrics[id];
            if (s) {
              if (Number.isFinite(s.value)) base.metrics[id].value = s.value;
              if (Number.isFinite(s.goal)) base.metrics[id].goal = s.goal;
            }
          });
          base.settings = { ...base.settings, ...(saved.settings || {}) };
          base.updatedAt = saved.updatedAt || null;
        }
      }
    } catch (e) {
      console.warn('Could not read saved dashboard state, using defaults.', e);
    }
    this.state = base;
    return base;
  },

  save() {
    this.state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist dashboard state.', e);
    }
    document.dispatchEvent(new CustomEvent('store:changed'));
  },

  get(id) {
    return this.state.metrics[id];
  },

  setValue(id, value) {
    if (!Number.isFinite(value) || value < 0) return false;
    this.state.metrics[id].value = value;
    this.save();
    return true;
  },

  setGoal(id, goal) {
    if (!Number.isFinite(goal) || goal <= 0) return false;
    this.state.metrics[id].goal = goal;
    this.save();
    return true;
  },

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.save();
  },

  /** Export state as a downloadable JSON backup. */
  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /** Import a previously exported backup (validated + merged). */
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.metrics) {
      throw new Error('Not a valid dashboard backup file.');
    }
    const base = this.defaults();
    Object.keys(base.metrics).forEach((id) => {
      const s = parsed.metrics[id];
      if (s) {
        if (Number.isFinite(s.value)) base.metrics[id].value = s.value;
        if (Number.isFinite(s.goal)) base.metrics[id].goal = s.goal;
      }
    });
    base.settings = { ...base.settings, ...(parsed.settings || {}) };
    this.state = base;
    this.save();
  },

  /** Merge metric values pulled from Google Sheets. */
  applyRemote(metrics) {
    let applied = 0;
    Object.keys(this.state.metrics).forEach((id) => {
      const r = metrics[id];
      if (r) {
        const value = Number(r.value);
        const goal = Number(r.goal);
        if (Number.isFinite(value) && value >= 0) { this.state.metrics[id].value = value; applied++; }
        if (Number.isFinite(goal) && goal > 0) this.state.metrics[id].goal = goal;
      }
    });
    if (applied) this.save();
    return applied;
  },

  resetAll() {
    this.state = this.defaults();
    this.save();
  },
};
