/* ============================================================
   help.js — Help modal (Read Me / Guide Me), in-app guide
   panel, and the one-time first-visit welcome card.
   ============================================================ */

(function () {
  'use strict';

  const WELCOME_KEY = 'vaugn.dashboard.welcomed';
  const $ = (sel) => document.querySelector(sel);

  /* ── Read Me guide content (styled, in-app) ─────────────── */

  const GUIDE_HTML = `
    <div class="guide__hero">
      <span class="guide__badge">Guide</span>
      <h2>How to use your dashboard</h2>
      <p>Everything you need — from daily edits to backups and Google Sheets sync. For the deep-dive version, read the <a href="https://github.com/vaugnstudio-cloud/personal-dashboard/blob/main/SOP.md" target="_blank" rel="noopener">full SOP on GitHub ↗</a>.</p>
    </div>

    <section class="guide__section">
      <h3><span class="guide__num">01</span> What is this?</h3>
      <p>A private dashboard tracking <strong>19 metrics</strong> across Finance, Business, Content &amp; Products, and Health &amp; Learning. The four hero stats up top — Net Monthly Income, Total Saved, MRR, Active Clients — are <strong>computed automatically</strong> from your cards, and the ring shows overall progress across every goal.</p>
    </section>

    <section class="guide__section">
      <h3><span class="guide__num">02</span> Daily use — the 60-second routine</h3>
      <ol>
        <li><strong>Click any big number</strong> on a card (e.g. <em>$0</em> under Side Income).</li>
        <li>Type the new value → press <kbd>Enter</kbd> (or click anywhere else). Saved instantly.</li>
        <li>To change a target, click the small <strong>Goal</strong> number under the value.</li>
      </ol>
      <p>No save button, no login. Progress bars, hero stats and the ring update by themselves.</p>
    </section>

    <section class="guide__section">
      <h3><span class="guide__num">03</span> How progress works</h3>
      <ul>
        <li><strong>Normal metrics</strong> (income, subscribers, hours…): progress = value ÷ goal. Hit the goal → green ✓ badge.</li>
        <li><strong>Lower-is-better metrics</strong> (Monthly Expenses, Weight): you're on track when <strong>at or under target</strong>; going over shows how much you're over.</li>
      </ul>
    </section>

    <section class="guide__section">
      <h3><span class="guide__num">04</span> Where your data lives ⚠️</h3>
      <p>Numbers are saved in <strong>this browser only</strong> (localStorage) — private, offline, never uploaded. That means each device starts at $0 until you enter numbers or sync. Clearing browser data erases them, so build one habit:</p>
      <p><strong>Monthly backup:</strong> Settings → Backup → <strong>Export JSON</strong> → store the file in OneDrive. Restore or move devices anytime with <strong>Import JSON</strong>.</p>
    </section>

    <section class="guide__section">
      <h3><span class="guide__num">05</span> Google Sheets sync (optional, ~5 min once)</h3>
      <ol>
        <li>Create a sheet at <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new ↗</a></li>
        <li>Extensions → Apps Script → paste in <a href="https://github.com/vaugnstudio-cloud/personal-dashboard/blob/main/apps-script/Code.gs" target="_blank" rel="noopener">Code.gs ↗</a> → Save.</li>
        <li>Deploy → New deployment → <strong>Web app</strong> → Execute as <strong>Me</strong>, access <strong>Anyone with the link</strong>.</li>
        <li>Copy the URL (ends in <code>/exec</code>) → paste it in Settings → Google Sheets sync.</li>
        <li><strong>Push to Sheet</strong> writes your numbers; <strong>Pull from Sheet</strong> reads them back — perfect for syncing your phone.</li>
      </ol>
      <p>🔒 The URL is your only key — it stays in this browser and must never be shared or committed anywhere public.</p>
    </section>

    <section class="guide__section">
      <h3><span class="guide__num">06</span> Links</h3>
      <ul class="guide__links">
        <li><a href="https://vaugnstudio-cloud.github.io/personal-dashboard/" target="_blank" rel="noopener">Live dashboard ↗</a></li>
        <li><a href="https://github.com/vaugnstudio-cloud/personal-dashboard" target="_blank" rel="noopener">GitHub repo (the code) ↗</a></li>
        <li><a href="https://github.com/vaugnstudio-cloud/personal-dashboard/blob/main/SOP.md" target="_blank" rel="noopener">Full SOP — editing the site, troubleshooting, FAQ ↗</a></li>
      </ul>
    </section>

    <div class="guide__cta">
      <p>Prefer to be shown around?</p>
      <div class="btn-row">
        <button class="btn btn--primary" data-tour="full">🧭 Full tour (~2 min)</button>
        <button class="btn" data-tour="quick">⚡ Quick tour (~1 min)</button>
      </div>
    </div>
  `;

  /* ── HelpUI ─────────────────────────────────────────────── */

  const HelpUI = {
    open() {
      this.closeAll();
      $('#helpModal').hidden = false;
      this.showChooser();
    },

    showChooser() {
      $('#helpChooser').hidden = false;
      $('#helpTourPick').hidden = true;
    },

    showTourPick() {
      $('#helpChooser').hidden = true;
      $('#helpTourPick').hidden = false;
    },

    openGuide() {
      this.closeAll();
      const panel = $('#guidePanel');
      if (!panel.dataset.filled) {
        $('#guideContent').innerHTML = GUIDE_HTML;
        panel.dataset.filled = '1';
      }
      panel.hidden = false;
      panel.scrollTop = 0;
    },

    closeAll() {
      $('#helpModal').hidden = true;
      $('#guidePanel').hidden = true;
      $('#welcomeModal').hidden = true;
    },

    anyOpen() {
      return !$('#helpModal').hidden || !$('#guidePanel').hidden || !$('#welcomeModal').hidden;
    },

    markWelcomed() {
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* ignore */ }
    },

    maybeShowWelcome() {
      let seen = null;
      try { seen = localStorage.getItem(WELCOME_KEY); } catch (e) { /* ignore */ }
      if (!seen) $('#welcomeModal').hidden = false;
    },
  };

  window.HelpUI = HelpUI;

  /* ── Wiring ─────────────────────────────────────────────── */

  const startTour = (variant) => {
    HelpUI.markWelcomed();
    HelpUI.closeAll();
    window.Tour.start(variant);
  };

  // Topbar + drawer entry points
  $('#helpBtn').addEventListener('click', () => HelpUI.open());
  $('#howtoReadBtn').addEventListener('click', () => HelpUI.openGuide());
  $('#howtoTourBtn').addEventListener('click', () => { HelpUI.open(); HelpUI.showTourPick(); });

  // Help modal
  $('#helpReadMe').addEventListener('click', () => HelpUI.openGuide());
  $('#helpGuideMe').addEventListener('click', () => HelpUI.showTourPick());
  $('#helpBack').addEventListener('click', () => HelpUI.showChooser());
  $('#helpClose').addEventListener('click', () => HelpUI.closeAll());

  // Guide panel
  $('#guideClose').addEventListener('click', () => HelpUI.closeAll());
  $('#guidePanel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tour]');
    if (btn) startTour(btn.dataset.tour);
  });

  // Tour pickers (help modal + welcome card share data-tour buttons)
  $('#helpModal').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tour]');
    if (btn) startTour(btn.dataset.tour);
  });
  $('#welcomeModal').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tour]');
    if (btn) { startTour(btn.dataset.tour); return; }
    if (e.target.closest('#welcomeLater')) { HelpUI.markWelcomed(); HelpUI.closeAll(); }
  });

  // Click the dimmed backdrop to close (modal surfaces only)
  ['helpModal', 'welcomeModal'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        if (id === 'welcomeModal') HelpUI.markWelcomed();
        HelpUI.closeAll();
      }
    });
  });

  // Escape closes the topmost help surface (tour handles its own Escape first)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || (window.Tour && Tour.active)) return;
    if (HelpUI.anyOpen()) {
      if (!$('#welcomeModal').hidden) HelpUI.markWelcomed();
      HelpUI.closeAll();
    }
  });

  HelpUI.maybeShowWelcome();
})();
