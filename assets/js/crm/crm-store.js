/* ============================================================
   crm-store.js — Sales Pipeline state layer (localStorage)
   DOM-free: loaded by both index.html (for KPI sync) and crm.html.
   Emits 'crm:changed' on document after every save.
   ============================================================ */

const CRM_KEY = 'vaugn.crm.v1';

/** Local YYYY-MM-DD (avoids UTC off-by-one). */
function crmToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CrmStore = {
  state: null,

  defaults() {
    return {
      leads: [],
      view: { visibleColumns: [...CRM_DEFAULT_COLUMNS], sortBy: 'followUpDate', sortDir: 'asc' },
      updatedAt: null,
    };
  },

  load() {
    const base = this.defaults();
    try {
      const raw = localStorage.getItem(CRM_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.leads)) {
          // merge each lead over a blank so new fields appear on old records
          base.leads = saved.leads.map((l) => ({ ...crmBlankLead(), ...l }));
          if (saved.view) {
            base.view = { ...base.view, ...saved.view };
            base.view.visibleColumns = (saved.view.visibleColumns || CRM_DEFAULT_COLUMNS)
              .filter((id) => CRM_COLUMN_INDEX[id]);
            CRM_COLUMNS.filter((c) => c.locked).forEach((c) => {
              if (!base.view.visibleColumns.includes(c.id)) base.view.visibleColumns.unshift(c.id);
            });
          }
          base.updatedAt = saved.updatedAt || null;
        }
      }
    } catch (e) {
      console.warn('Could not read pipeline data, starting fresh.', e);
    }
    this.state = base;
    return base;
  },

  save() {
    this.state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(CRM_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not persist pipeline data.', e);
      document.dispatchEvent(new CustomEvent('crm:error', { detail: 'Storage is full — export a backup and archive old leads.' }));
    }
    document.dispatchEvent(new CustomEvent('crm:changed'));
  },

  hasData() { return this.state.leads.length > 0; },

  get(id) { return this.state.leads.find((l) => l.id === id); },

  create(patch = {}) {
    const lead = { ...crmBlankLead(), ...patch };
    this.state.leads.unshift(lead);
    this.save();
    return lead;
  },

  /** Patch a lead. Handles status side-effects (wonAt, activity log). */
  update(id, patch, { log } = {}) {
    const lead = this.get(id);
    if (!lead) return null;
    const oldStatus = lead.status;
    Object.assign(lead, patch);
    lead.updatedAt = new Date().toISOString();
    if (patch.status && patch.status !== oldStatus) {
      lead.wonAt = patch.status === 'won' ? new Date().toISOString() : (patch.status !== 'won' ? null : lead.wonAt);
      this.log(lead, `Status → ${CRM_STATUS_INDEX[patch.status].label}`);
    }
    if (log) this.log(lead, log);
    this.save();
    return lead;
  },

  log(lead, text) {
    lead.activity.unshift({ at: new Date().toISOString(), text });
    if (lead.activity.length > 50) lead.activity.length = 50;
  },

  /** Remove leads; returns snapshots for undo. */
  remove(ids) {
    const snaps = [];
    ids.forEach((id) => {
      const i = this.state.leads.findIndex((l) => l.id === id);
      if (i > -1) snaps.push({ lead: this.state.leads[i], index: i });
    });
    this.state.leads = this.state.leads.filter((l) => !ids.includes(l.id));
    this.save();
    return snaps;
  },

  restore(snaps) {
    snaps.sort((a, b) => a.index - b.index)
      .forEach((s) => this.state.leads.splice(Math.min(s.index, this.state.leads.length), 0, s.lead));
    this.save();
  },

  setArchived(ids, archived) {
    ids.forEach((id) => {
      const lead = this.get(id);
      if (lead) {
        lead.archived = archived;
        lead.updatedAt = new Date().toISOString();
        this.log(lead, archived ? 'Archived' : 'Restored from archive');
      }
    });
    this.save();
  },

  setView(patch) {
    Object.assign(this.state.view, patch);
    this.save();
  },

  /* ── Derived stats (shared by CRM stats bar + dashboard sync) ── */
  stats() {
    const today = crmToday();
    let openLeads = 0, activeClients = 0, pipelineValue = 0,
        won = 0, lost = 0, dueToday = 0, overdue = 0, wonThisMonth = 0;
    const month = today.slice(0, 7);
    this.state.leads.forEach((l) => {
      if (l.status === 'won') {
        won++;
        if (!l.archived) activeClients++;
        if (l.wonAt && l.wonAt.slice(0, 7) === month) wonThisMonth += l.dealValue || 0;
        return;
      }
      if (l.status === 'lost') { lost++; return; }
      if (l.archived) return;
      openLeads++;
      pipelineValue += l.dealValue || 0;
      if (l.followUpDate) {
        if (l.followUpDate === today) dueToday++;
        else if (l.followUpDate < today) overdue++;
      }
    });
    return {
      openLeads, activeClients, pipelineValue, dueToday, overdue, wonThisMonth,
      winRate: won + lost > 0 ? won / (won + lost) : null,
      total: this.state.leads.length,
    };
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pipeline-backup-${crmToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.leads)) throw new Error('Not a valid pipeline backup file.');
    const base = this.defaults();
    base.leads = parsed.leads.map((l) => ({ ...crmBlankLead(), ...l }));
    if (parsed.view) base.view = { ...base.view, ...parsed.view };
    this.state = base;
    this.save();
    return base.leads.length;
  },
};

// const bindings don't attach to window — expose explicitly for cross-file checks.
window.CrmStore = CrmStore;
