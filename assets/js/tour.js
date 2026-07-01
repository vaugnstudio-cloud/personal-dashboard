/* ============================================================
   tour.js — spotlight step-by-step tutorial engine
   Full tour (~12 steps) & Quick tour (~6 steps).
   Escape asks "Do you want to exit the tutorial?" Yes / No.
   ============================================================ */

(function () {
  'use strict';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const D = () => window.Dashboard;

  const openDrawerHook = async () => { D().openDrawer(); await wait(420); };
  const closeDrawerHook = async () => { D().closeDrawer(); await wait(320); };

  /* ── Step definitions ───────────────────────────────────── */

  const FULL_STEPS = [
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
      text: 'Deploy the included script under your own Google account, paste its URL here, then Push / Pull to sync between devices. Step-by-step setup is in the Read Me guide.',
    },
    {
      target: '#drawerBackup',
      title: 'Protect your data 💾',
      before: openDrawerHook,
      text: 'Your numbers live only in this browser. Export a JSON backup monthly — and use Import to restore or move to a new device. That’s the tour!',
    },
  ];

  const QUICK_STEPS = [
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

  /* ── Engine ─────────────────────────────────────────────── */

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
      if (!this._bound) { this.bind(); this._bound = true; }
      if (window.HelpUI) HelpUI.closeAll();
      this.steps = variant === 'quick' ? QUICK_STEPS : FULL_STEPS;
      this.active = true;
      this._dir = 1;
      const e = this.els();
      e.overlay.hidden = false;
      e.confirm.hidden = true;
      document.addEventListener('keydown', this._onKey, true); // capture: beats drawer's Escape
      document.addEventListener('scroll', this._onMove, true);
      window.addEventListener('resize', this._onMove);
      document.addEventListener('store:changed', this._onStore);
      await this.show(0);
    },

    async show(i) {
      this.i = i;
      this._celebrated = false;
      const step = this.steps[i];
      if (step.before) await step.before();
      let el = document.querySelector(step.target);
      // Skip steps whose target is hidden at this viewport (e.g. the ring on mobile)
      if (!el || el.getBoundingClientRect().width === 0) {
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
      const el = document.querySelector(this._currentTarget);
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
      const e = this.els();
      e.overlay.hidden = true;
      e.confirm.hidden = true;
      document.removeEventListener('keydown', this._onKey, true);
      document.removeEventListener('scroll', this._onMove, true);
      window.removeEventListener('resize', this._onMove);
      document.removeEventListener('store:changed', this._onStore);
      D().closeDrawer();
      try { localStorage.setItem('vaugn.dashboard.welcomed', '1'); } catch (err) { /* ignore */ }
      D().toast(finished
        ? 'You’re all set 🎉 Your dashboard is ready.'
        : 'Tutorial closed — reopen it anytime from Help.');
    },
  };

  window.Tour = Tour;
})();
