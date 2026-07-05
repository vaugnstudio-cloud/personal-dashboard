/* ============================================================
   tour.js — spotlight step-by-step tutorial engine
   Page-aware: Dashboard + Sales Pipeline each get Full & Quick
   tours. Injects its own DOM. Escape asks "Do you want to exit
   the tutorial?" Yes / No.
   ============================================================ */

(function () {
  'use strict';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const PAGE = document.body.dataset.page || 'dashboard';
  const API = () => window.Dashboard || window.CrmUI || window.SettingsUI;   // page UI adapter

  const openDrawerHook = async () => { API().openDrawer(); await wait(420); };
  const closeDrawerHook = async () => { API().closeDrawer(); await wait(320); };

  /* ── Dashboard steps ────────────────────────────────────── */

  const DASH_FULL = [
    {
      target: '.hero__title',
      title: 'Welcome to your dashboard 👋',
      text: 'This is your personal command center — money, business, content and health in one place. Let’s take a quick look around.',
    },
    {
      target: '#heroStats',
      title: 'Headline numbers',
      text: 'These four stats are computed automatically: Net Monthly Income (all income − expenses), Total Saved, MRR and Active Clients. You never edit these — they update themselves.',
    },
    {
      target: '#overallRing',
      title: 'Overall progress',
      text: 'This ring averages your progress across all 19 goals. Watch it climb through the year.',
    },
    {
      target: '#section-finance .section__head',
      title: 'Grouped sections',
      text: 'Metrics are organized into four sections: Finance, Business, Content & Products, and Health & Learning.',
    },
    {
      target: '[data-metric="salary"]',
      title: 'Anatomy of a card',
      text: 'Every card shows the current value (big number), a goal, a progress bar and a status line. A green ✓ badge appears when a goal is reached.',
    },
    {
      target: '[data-metric="sideIncome"]',
      title: 'Try it yourself ✏️',
      text: 'Click the big value on this card, type any number, then press Enter. Go ahead — this is your real dashboard, and you can change it back anytime.',
      tryIt: true,
    },
    {
      target: '[data-metric="salary"] .card__goal',
      title: 'Goals are editable too',
      text: 'Click the small goal number to change your target. Progress bars and the overall ring recalculate instantly.',
    },
    {
      target: '[data-metric="expenses"]',
      title: 'Lower is better here',
      text: 'For Monthly Expenses and Weight, staying at or under target counts as on track — going over shows exactly how much you’re over.',
    },
    {
      target: '#settingsBtn',
      title: 'Settings',
      before: closeDrawerHook,
      text: 'Currency, weight unit, your name, backups and Google Sheets sync all live behind this button. Let me show you inside.',
    },
    {
      target: '#drawerPrefs',
      title: 'Preferences',
      before: openDrawerHook,
      text: 'Switch currency (USD, EUR, GBP, PHP…), pick lbs or kg for weight, and set the name used in your greeting.',
    },
    {
      target: '#drawerSheets',
      title: 'Google Sheets sync (optional)',
      before: openDrawerHook,
      text: 'Deploy the included script under your own Google account, paste its URL here, then Push / Pull to sync between devices. Step-by-step setup is in the Help Center.',
    },
    {
      target: '#drawerBackup',
      title: 'Protect your data 💾',
      before: openDrawerHook,
      text: 'Your numbers live only in this browser. Export a JSON backup monthly — and use Import to restore or move to a new device.',
    },
    {
      target: '.nav__link[href="reports.html"]',
      title: 'One more thing: Reports 📈',
      before: closeDrawerHook,
      text: 'Charts, your pipeline funnel, and a built-in advisor that reads your numbers and tells you what to fix next. Check it weekly. That’s the tour!',
    },
  ];

  const DASH_QUICK = [
    {
      target: '#heroStats',
      title: 'Welcome 👋',
      text: 'These four headline stats — Net Monthly Income, Total Saved, MRR, Active Clients — are computed automatically from the metric cards below.',
    },
    {
      target: '[data-metric="salary"]',
      title: 'Metric cards',
      text: 'Each card shows a value, a goal and a progress bar. A green ✓ appears when you hit a goal.',
    },
    {
      target: '[data-metric="sideIncome"]',
      title: 'Try it yourself ✏️',
      text: 'Click the big value, type any number, press Enter. It saves instantly — no save button anywhere.',
      tryIt: true,
    },
    {
      target: '[data-metric="expenses"]',
      title: 'Lower is better here',
      text: 'Monthly Expenses and Weight count as on track when you’re at or under target.',
    },
    {
      target: '#settingsBtn',
      title: 'Settings',
      before: closeDrawerHook,
      text: 'Currency, units, Google Sheets sync and backups live here.',
    },
    {
      target: '#drawerBackup',
      title: 'One habit: backup 💾',
      before: openDrawerHook,
      text: 'Data lives only in this browser — export a JSON backup monthly. That’s everything you need!',
    },
  ];

  /* ── Sales Pipeline steps ───────────────────────────────── */

  // If the pipeline is empty, the tour adds a demo lead so every
  // step has something real to point at — removed when it ends.
  let demoLeadId = null;
  const crmOnStart = async () => {
    if (window.CrmStore && !CrmStore.hasData()) {
      const lead = CrmStore.create({
        business: 'Acme Dental (demo)', decisionMaker: 'Dr. Jane Doe',
        industry: 'Dentistry', country: 'USA', website: 'https://acmedental.com',
        channel: 'cold-email', status: 'contacted', replied: true,
        dealValue: 3500, followUpDate: crmToday(),
        problem: 'Outdated site, no online booking', offer: 'Redesign + booking flow',
        notes: 'Demo lead — removed automatically when the tour ends.',
      });
      demoLeadId = lead.id;
      await wait(250);
    }
  };
  const crmOnEnd = () => {
    if (demoLeadId) { CrmStore.remove([demoLeadId]); demoLeadId = null; }
  };
  const openLeadHook = async () => { window.CrmUI.openFirstLead(); await wait(450); };

  const CRM_FULL = [
    {
      target: '.crm-head',
      title: 'Welcome to your Sales Pipeline 🧭',
      text: 'Every lead from every channel — website, cold email, LinkedIn, Instagram, referrals — tracked from first touch to Won. This is the engine of your business; let’s walk it.',
    },
    {
      target: '.crm-stats',
      title: 'Pipeline health at a glance',
      text: 'Pipeline Value is what open deals are worth. Due Today drives your morning routine. Win Rate = won ÷ (won + lost). Won This Month is the payoff.',
    },
    {
      target: '#newLeadBtn, #crmFab',
      title: 'Adding leads',
      text: 'Click here — or just press N from anywhere. Fill Business Name, Channel and a Follow-Up Date; everything saves automatically as you type.',
    },
    {
      target: '#crmTbody .lead-row, .lead-card',
      title: 'Every row is an opportunity',
      text: 'Avatar and name, decision maker, channel, status badge, the R·C·P dots, follow-up date and deal value. Overdue follow-ups turn red so nothing slips.',
    },
    {
      target: '#crmTbody .badge, .lead-card .badge',
      title: 'Move deals with one click',
      text: 'Click any status badge → pick the new stage. Marking Won asks (never forces) to add the money to your dashboard; marking Lost asks for a reason so patterns emerge.',
    },
    {
      target: '#crmTbody .rcp, .lead-card .rcp',
      title: 'R · C · P',
      text: 'Reply received · Call booked · Proposal sent. Click a dot to toggle it — the status advances automatically when it makes sense.',
    },
    {
      target: '#leadDrawer',
      title: 'The full record',
      before: openLeadHook,
      text: 'Click any row to open all 19 fields — company, contact, problem noticed, best offer, deal, notes and the activity log. Use J / K to flip between leads.',
    },
    {
      target: '.crm-search',
      title: 'Find anything instantly',
      before: closeDrawerHook,
      text: 'Press / and type — searches names, contacts, emails, industries, countries and notes at once.',
    },
    {
      target: '#crmChips',
      title: 'Your daily routine lives here',
      text: 'One click filters by stage. The ⚠ Due chip is the important one: open it every morning and clear your follow-ups. Archived leads hide here too.',
    },
    {
      target: '#colBtn',
      title: 'Your table, your columns',
      text: 'Show or hide any of the 19 columns — email, country, problem noticed, best offer and more. Your layout is remembered.',
    },
    {
      target: '#moreBtn',
      title: 'Protect your pipeline 💾',
      text: 'Export a JSON backup monthly from this menu (Import restores it anywhere). The Help button has the full Sales, Follow-Up and Proposal SOPs.',
    },
    {
      target: '.nav__link[href="reports.html"]',
      title: 'Then let Reports coach you 📈',
      text: 'Charts, funnel, channel win rates — and personalized tips computed from your real pipeline. That’s the tour — go win something!',
    },
  ];

  const CRM_QUICK = [
    {
      target: '.crm-stats',
      title: 'Welcome to your pipeline 🧭',
      text: 'Pipeline Value, follow-ups Due Today, open leads, Win Rate and Won This Month — all computed live from your leads.',
    },
    {
      target: '#newLeadBtn, #crmFab',
      title: 'Adding leads',
      text: 'Press N anytime. Business Name + Channel + Follow-Up Date is enough to start — everything saves as you type.',
    },
    {
      target: '#crmTbody .lead-row, .lead-card',
      title: 'Every row is an opportunity',
      text: 'Click a row for the full 19-field record. Click the status badge to move it through the stages — Won asks before touching your dashboard money.',
    },
    {
      target: '#crmTbody .rcp, .lead-card .rcp',
      title: 'R · C · P dots',
      text: 'Reply · Call · Proposal — click to toggle; statuses advance automatically.',
    },
    {
      target: '#crmChips',
      title: 'The ⚠ Due chip is your morning',
      text: 'Open it daily, clear every follow-up, set the next dates. That habit is the whole sales system.',
    },
    {
      target: '#moreBtn',
      title: 'One habit: backup 💾',
      text: 'Export a JSON backup monthly from this menu. Full SOPs live under Help. Done — go add a real lead!',
    },
  ];

  /* ── Reports steps ──────────────────────────────────────── */

  const REPORTS_FULL = [
    {
      target: '.crm-head',
      title: 'Your numbers, explained 📈',
      text: 'Reports reads your dashboard and pipeline together and turns them into answers — computed privately on this device, nothing uploaded.',
    },
    {
      target: '#rptPeriods',
      title: 'Pick a period',
      text: 'This month, last month, quarter or all time — every chart below follows it. Insights always describe right now.',
    },
    {
      target: '#rptInsights',
      title: 'What to do next',
      text: 'Your built-in advisor. Red border = act today, amber = worth watching, green = a win. Most tips are clickable — they jump straight to the fix.',
    },
    {
      target: '#cardRevenue',
      title: 'The money chart 💰',
      text: 'Deal value won over time. The headline sentence above it tells you the story without reading the bars.',
    },
    {
      target: '#cardFunnel',
      title: 'Where deals drop 🔻',
      text: 'Lead → Contacted → Replied → Call → Proposal → Won, with the drop-off at every stage. Your biggest leak is your biggest opportunity.',
    },
    {
      target: '#cardChannel',
      title: 'Double down on what works 🎯',
      text: 'Win rate and revenue per outreach channel. When one channel clearly outperforms, shift next week’s effort there.',
    },
    {
      target: '#rptPrint',
      title: 'Your weekly ritual 📄',
      text: 'One click generates a clean business report — print it, save as PDF, or Copy as text. Trends unlock automatically after 7 days of use. That’s the tour!',
    },
  ];

  const REPORTS_QUICK = [
    {
      target: '#rptInsights',
      title: 'What to do next 📌',
      text: 'A private advisor reads your real data: red = act, amber = watch, green = win. Click a tip to jump to the fix.',
    },
    {
      target: '#cardRevenue',
      title: 'The money chart 💰',
      text: 'Deal value won over the selected period, explained in a sentence above the bars.',
    },
    {
      target: '#cardFunnel',
      title: 'Where deals drop 🔻',
      text: 'Your conversion funnel with drop-offs per stage — find the leak, fix the leak.',
    },
    {
      target: '#rptPrint',
      title: 'Print it weekly 📄',
      text: 'Generate a clean PDF business report or copy it as text. Done — go check your insights!',
    },
  ];

  const TOURS = {
    dashboard: { full: DASH_FULL, quick: DASH_QUICK, welcomeKey: 'vaugn.dashboard.welcomed' },
    crm:       { full: CRM_FULL,  quick: CRM_QUICK,  welcomeKey: 'vaugn.crm.welcomed', onStart: crmOnStart, onEnd: crmOnEnd },
    reports:   { full: REPORTS_FULL, quick: REPORTS_QUICK, welcomeKey: 'vaugn.reports.welcomed' },
  };

  /* ── Injected DOM (identical IDs on every page) ─────────── */

  const host = document.createElement('div');
  host.innerHTML = `
    <div class="tour" id="tour" hidden>
      <div class="tour__blocker" id="tourBlocker"></div>
      <div class="tour__spotlight" id="tourSpotlight"></div>
      <div class="tour__tip" id="tourTip" role="dialog" aria-live="polite">
        <button class="tour__x" id="tourClose" aria-label="Exit tutorial">✕</button>
        <p class="tour__count" id="tourCount"></p>
        <h3 class="tour__title" id="tourTitle"></h3>
        <p class="tour__text" id="tourText"></p>
        <div class="tour__controls">
          <button class="btn btn--ghost" id="tourExit">Exit</button>
          <button class="btn" id="tourPrev" hidden>← Previous</button>
          <button class="btn btn--primary" id="tourNext">Next →</button>
        </div>
      </div>
    </div>
    <div class="tour-confirm" id="tourConfirm" hidden role="alertdialog" aria-label="Exit tutorial confirmation">
      <div class="tour-confirm__card">
        <p class="tour-confirm__msg">Do you want to exit the tutorial?</p>
        <div class="btn-row">
          <button class="btn btn--primary" id="tourConfirmNo">No, continue</button>
          <button class="btn" id="tourConfirmYes">Yes, exit</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);

  /* ── Engine ─────────────────────────────────────────────── */

  /** First visible element matching a (possibly comma-separated) selector. */
  function findTarget(sel) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }

  const Tour = {
    active: false,
    steps: [],
    i: 0,
    _dir: 1,
    _currentTarget: null,
    _celebrated: false,

    els() {
      return {
        overlay: document.getElementById('tour'),
        blocker: document.getElementById('tourBlocker'),
        spot: document.getElementById('tourSpotlight'),
        tip: document.getElementById('tourTip'),
        count: document.getElementById('tourCount'),
        title: document.getElementById('tourTitle'),
        text: document.getElementById('tourText'),
        prev: document.getElementById('tourPrev'),
        next: document.getElementById('tourNext'),
        exit: document.getElementById('tourExit'),
        close: document.getElementById('tourClose'),
        confirm: document.getElementById('tourConfirm'),
        confirmYes: document.getElementById('tourConfirmYes'),
        confirmNo: document.getElementById('tourConfirmNo'),
      };
    },

    bind() {
      const e = this.els();
      e.next.addEventListener('click', () => this.next());
      e.prev.addEventListener('click', () => this.prev());
      e.exit.addEventListener('click', () => this.confirmExit(true));
      e.close.addEventListener('click', () => this.confirmExit(true));
      e.confirmYes.addEventListener('click', () => this.end(false));
      e.confirmNo.addEventListener('click', () => this.confirmExit(false));

      this._onKey = (ev) => {
        if (!this.active) return;
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          this.confirmExit(this.els().confirm.hidden); // toggle: open confirm, or treat as "No"
        }
      };
      this._onMove = () => {
        if (this.active) requestAnimationFrame(() => this.reposition());
      };
      this._onStore = () => {
        if (!this.active) return;
        requestAnimationFrame(() => this.reposition());
        const step = this.steps[this.i];
        if (step && step.tryIt && !this._celebrated) {
          this._celebrated = true;
          const e2 = this.els();
          e2.title.textContent = 'Nice! 🎉';
          e2.text.textContent = 'Saved instantly — the hero totals and progress bars updated too. That’s all it takes.';
          setTimeout(() => {
            if (this.active && this.steps[this.i] === step) this.next();
          }, 1800);
        }
      };
    },

    async start(variant) {
      if (this.active) return;
      const cfg = TOURS[PAGE];
      if (!cfg || !API()) return;
      if (!this._bound) { this.bind(); this._bound = true; }
      if (window.HelpUI) HelpUI.closeAll();
      this.steps = variant === 'quick' ? cfg.quick : cfg.full;
      this.active = true;
      this._dir = 1;
      const e = this.els();
      e.overlay.hidden = false;
      e.confirm.hidden = true;
      document.addEventListener('keydown', this._onKey, true); // capture: beats page Escape handlers
      document.addEventListener('scroll', this._onMove, true);
      window.addEventListener('resize', this._onMove);
      document.addEventListener('store:changed', this._onStore);
      document.addEventListener('crm:changed', this._onMove);
      if (cfg.onStart) await cfg.onStart();
      await this.show(0);
    },

    async show(i) {
      this.i = i;
      this._celebrated = false;
      const step = this.steps[i];
      if (step.before) await step.before();
      let el = findTarget(step.target);
      // Skip steps whose target is hidden at this viewport (e.g. the ring on mobile)
      if (!el) {
        const ni = i + (this._dir >= 0 ? 1 : -1);
        if (ni < 0 || ni >= this.steps.length) return this.end(false);
        return this.show(ni);
      }
      this._currentTarget = step.target;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(380);
      if (!this.active) return;

      const e = this.els();
      e.count.textContent = `${i + 1} / ${this.steps.length}`;
      e.title.textContent = step.title;
      e.text.textContent = step.text;
      e.prev.hidden = i === 0;
      e.exit.hidden = i !== 0;
      e.next.textContent = i === this.steps.length - 1 ? 'Finish ✓' : 'Next →';
      e.blocker.style.pointerEvents = step.tryIt ? 'none' : 'auto';
      this.reposition();
    },

    reposition() {
      if (!this.active || !this._currentTarget) return;
      const el = findTarget(this._currentTarget);
      if (!el) return;
      const e = this.els();
      const r = el.getBoundingClientRect();
      const pad = 8;
      Object.assign(e.spot.style, {
        top: `${r.top - pad}px`,
        left: `${r.left - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      if (window.innerWidth <= 560) return; // CSS bottom-sheet handles tip position
      const tw = e.tip.offsetWidth;
      const th = e.tip.offsetHeight;
      let top = r.bottom + pad + 16;
      if (top + th > window.innerHeight - 12) top = r.top - pad - th - 16;
      if (top < 12) top = Math.min(Math.max(12, r.bottom + pad + 16), window.innerHeight - th - 12);
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
      e.tip.style.top = `${top}px`;
      e.tip.style.left = `${left}px`;
    },

    next() {
      this._dir = 1;
      if (this.i >= this.steps.length - 1) return this.end(true);
      this.show(this.i + 1);
    },

    prev() {
      this._dir = -1;
      if (this.i > 0) this.show(this.i - 1);
    },

    /** show=true → open the exit confirmation; show=false → resume the tour. */
    confirmExit(show) {
      this.els().confirm.hidden = !show;
    },

    end(finished) {
      this.active = false;
      const cfg = TOURS[PAGE];
      const e = this.els();
      e.overlay.hidden = true;
      e.confirm.hidden = true;
      document.removeEventListener('keydown', this._onKey, true);
      document.removeEventListener('scroll', this._onMove, true);
      window.removeEventListener('resize', this._onMove);
      document.removeEventListener('store:changed', this._onStore);
      document.removeEventListener('crm:changed', this._onMove);
      if (API()) API().closeDrawer();
      if (cfg && cfg.onEnd) cfg.onEnd();
      try { localStorage.setItem(cfg.welcomeKey, '1'); } catch (err) { /* ignore */ }
      const doneMsg = { crm: 'You’re all set 🧭 Go add your first real lead.', reports: 'You’re all set 📈 Check your insights weekly.' };
      API().toast(finished
        ? (doneMsg[PAGE] || 'You’re all set 🎉 Your dashboard is ready.')
        : 'Tutorial closed — reopen it anytime from Help.');
    },
  };

  window.Tour = Tour;
})();
