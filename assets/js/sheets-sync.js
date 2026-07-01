/* ============================================================
   sheets-sync.js — optional two-way Google Sheets sync
   Talks to a Google Apps Script Web App the user deploys
   under their OWN account (see apps-script/Code.gs).
   The URL lives only in localStorage — never in this repo.
   ============================================================ */

const SheetsSync = {
  get url() {
    return (Store.state.settings.sheetsUrl || '').trim();
  },

  get isConfigured() {
    return /^https:\/\/script\.google(?:usercontent)?\.com\//.test(this.url);
  },

  /** Pull values from the sheet and apply them locally. */
  async pull() {
    if (!this.isConfigured) throw new Error('Add your Apps Script URL in Settings first.');
    const res = await fetch(this.url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error(`Sheet responded with ${res.status}`);
    const data = await res.json();
    if (!data || typeof data.metrics !== 'object') {
      throw new Error('Unexpected response — is the Web App deployed from Code.gs?');
    }
    return Store.applyRemote(data.metrics);
  },

  /** Push current local values up to the sheet. */
  async push() {
    if (!this.isConfigured) throw new Error('Add your Apps Script URL in Settings first.');
    const payload = { metrics: {} };
    METRICS.forEach((m) => {
      const s = Store.get(m.id);
      payload.metrics[m.id] = { label: m.label, value: s.value, goal: s.goal };
    });
    // text/plain avoids a CORS preflight, which Apps Script can't answer.
    const res = await fetch(this.url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Sheet responded with ${res.status}`);
    const data = await res.json().catch(() => ({}));
    if (data && data.ok === false) throw new Error(data.error || 'Sheet rejected the update.');
    return Object.keys(payload.metrics).length;
  },
};
