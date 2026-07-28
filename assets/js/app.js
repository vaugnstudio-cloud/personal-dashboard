/* ============================================================
   app.js — render, inline editing, hero math, settings, toasts
   ============================================================ */

(function () {
  'use strict';

  Store.load();
  if (window.CrmStore) CrmStore.load();
  if (window.JobsStore) JobsStore.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ── Pipeline (CRM) sync ────────────────────────────────── */

  function crmSynced() {
    return window.CrmStore && CrmStore.hasData() && Store.state.settings.kpiSync !== false;
  }

  /** Auto-sync Leads & Clients metric values from the pipeline (silent). */
  function syncFromCrm() {
    if (!crmSynced()) return;
    const s = CrmStore.stats();
    let changed = false;
    if (Store.state.metrics.leads.value !== s.openLeads) { Store.state.metrics.leads.value = s.openLeads; changed = true; }
    if (Store.state.metrics.clients.value !== s.activeClients) { Store.state.metrics.clients.value = s.activeClients; changed = true; }
    if (changed) {
      try { localStorage.setItem('vaugn.dashboard.v1', JSON.stringify(Store.state)); } catch (e) { /* ignore */ }
    }
  }

  /* ── Formatting ─────────────────────────────────────────── */

  function fmt(metric, n) {
    const { currency, weightUnit } = Store.state.settings;
    switch (metric.format) {
      case 'currency':
        return new Intl.NumberFormat(undefined, {
          style: 'currency', currency, maximumFractionDigits: 0,
        }).format(n);
      case 'hours':
        return `${new Intl.NumberFormat().format(n)} h`;
      case 'weight':
        return `${new Intl.NumberFormat().format(n)} ${weightUnit}`;
      default:
        return new Intl.NumberFormat(undefined, { notation: n >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
    }
  }

  function fmtMoney(n) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: Store.state.settings.currency, maximumFractionDigits: 0,
    }).format(n);
  }

  /** Progress toward goal, 0–1. 'down' metrics count being at/under goal as done. */
  function progress(metric) {
    const { value, goal } = Store.get(metric.id);
    if (!goal) return 0;
    if (metric.direction === 'down') {
      if (value <= 0) return 0;             // nothing tracked yet
      return Math.min(goal / value, 1);
    }
    return Math.min(value / goal, 1);
  }

  function progressLabel(metric) {
    const { value, goal } = Store.get(metric.id);
    if (metric.direction === 'down') {
      if (value <= 0) return 'Not tracked yet';
      return value <= goal ? 'On target' : `${fmt(metric, value - goal)} over target`;
    }
    const pct = Math.round(progress(metric) * 100);
    return pct >= 100 ? 'Goal reached 🎉' : `${pct}% of goal`;
  }

  /* ── Hero (computed) ────────────────────────────────────── */

  function v(id) { return Store.get(id).value; }

  const HERO = [
    {
      id: 'netIncome', label: 'Net Monthly Income', icon: 'trend',
      compute: () => v('salary') + v('sideIncome') + v('websiteIncome') + v('affiliateIncome') + v('retainers') + v('mrr') - v('expenses'),
      format: (n) => fmtMoney(n),
      sub: 'All income streams − expenses',
    },
    {
      id: 'warChest', label: 'Total Saved', icon: 'shield',
      compute: () => v('savings') + v('emergencyFund'),
      format: (n) => fmtMoney(n),
      sub: 'Savings + emergency fund',
    },
    {
      id: 'heroMrr', label: 'MRR', icon: 'repeat',
      compute: () => v('mrr'),
      format: (n) => fmtMoney(n),
      sub: 'Monthly recurring revenue',
    },
    {
      id: 'heroClients', label: 'Active Clients', icon: 'users',
      compute: () => v('clients'),
      format: (n) => new Intl.NumberFormat().format(n),
      sub: () => `${new Intl.NumberFormat().format(v('leads'))} leads in pipeline`,
    },
  ];

  function renderHero() {
    const wrap = $('#heroStats');
    wrap.innerHTML = HERO.map((h) => {
      const val = h.compute();
      const negative = h.id === 'netIncome' && val < 0;
      return `
        <article class="hero-stat" data-hero="${h.id}">
          <div class="hero-stat__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[h.icon]}</svg></div>
          <p class="hero-stat__label">${h.label}</p>
          <p class="hero-stat__value ${negative ? 'is-negative' : ''}">${h.format(val)}</p>
          <p class="hero-stat__sub">${typeof h.sub === 'function' ? h.sub() : h.sub}</p>
        </article>`;
    }).join('');
  }

  /* ── Metric cards ───────────────────────────────────────── */

  function cardHTML(metric) {
    const s = Store.get(metric.id);
    const pct = Math.round(progress(metric) * 100);
    const done = metric.direction === 'down' ? (s.value > 0 && s.value <= s.goal) : (s.goal > 0 && s.value >= s.goal);
    // Leads & Clients auto-sync from the pipeline: value becomes a link, not an editor.
    const synced = crmSynced() && (metric.id === 'leads' || metric.id === 'clients');
    const valueHTML = synced
      ? `<a class="card__value card__value--link" href="crm.html${metric.id === 'clients' ? '#status=won' : ''}" title="Computed from your pipeline — click to open">${fmt(metric, s.value)}</a>`
      : `<button class="card__value" data-edit="value" title="Click to edit value">${fmt(metric, s.value)}</button>`;
    return `
      <article class="card ${done ? 'is-done' : ''}" data-metric="${metric.id}">
        <header class="card__head">
          <span class="card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[metric.icon]}</svg></span>
          <h3 class="card__label">${metric.label}${metric.per ? `<span class="card__per">${metric.per}</span>` : ''}</h3>
          ${synced ? '<span class="card__auto" title="Computed from your Sales Pipeline">Auto · Pipeline</span>' : ''}
          ${done ? '<span class="card__badge" title="Goal reached">✓</span>' : ''}
        </header>
        ${valueHTML}
        <div class="card__goal">
          <span class="card__goal-label">${metric.direction === 'down' ? 'Target' : 'Goal'}</span>
          <button class="card__goal-value" data-edit="goal" title="Click to edit ${metric.direction === 'down' ? 'target' : 'goal'}">${fmt(metric, s.goal)}</button>
        </div>
        <div class="card__progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${metric.label} progress">
          <div class="card__progress-fill" style="width:${pct}%"></div>
        </div>
        <p class="card__status">${progressLabel(metric)}${metric.hint ? ` <span class="card__hint">· ${metric.hint}</span>` : ''}</p>
      </article>`;
  }

  function renderSections() {
    const wrap = $('#sections');
    const collapsed = Store.state.settings.collapsedSections || [];
    wrap.innerHTML = GROUPS.map((g) => {
      const cards = METRICS.filter((m) => m.group === g.id).map(cardHTML).join('');
      const isCollapsed = collapsed.includes(g.id);
      return `
        <section class="section ${isCollapsed ? 'is-collapsed' : ''}" id="section-${g.id}">
          <header class="section__head">
            <span class="section__tag">${g.tag}</span>
            <div>
              <h2 class="section__title">${g.label}</h2>
              <p class="section__blurb">${g.blurb}</p>
            </div>
            <button class="section__toggle" data-collapse="${g.id}" aria-expanded="${!isCollapsed}" title="${isCollapsed ? 'Expand' : 'Collapse'} ${g.label}">▾</button>
          </header>
          <div class="grid">${cards}</div>
        </section>`;
    }).join('');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-collapse]');
    if (!btn) return;
    const id = btn.dataset.collapse;
    const collapsed = new Set(Store.state.settings.collapsedSections || []);
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    Store.setSetting('collapsedSections', Array.from(collapsed));
  });

  /* ── Onboarding checklist (first-run momentum) ──────────── */

  function renderChecklist() {
    const wrap = $('#checklist');
    if (!wrap) return;
    let sample = false;
    try { sample = localStorage.getItem('vaugn.sample') === '1'; } catch (e) { /* ignore */ }
    if (Store.state.settings.checklistDismissed || sample) { wrap.innerHTML = ''; return; }

    const items = [
      { id: 'numbers', label: 'Add your real numbers', done: METRICS.filter((m) => Store.get(m.id).value > 0).length >= 3, act: 'numbers' },
      { id: 'lead', label: 'Add your first lead', done: window.CrmStore && CrmStore.hasData(), act: 'lead' },
      { id: 'tour', label: 'Take the 1-minute tour', done: (() => { try { return !!localStorage.getItem('vaugn.dashboard.welcomed'); } catch (e) { return false; } })(), act: 'tour' },
      { id: 'backup', label: 'Export a backup', done: !!Store.state.settings.backedUp, act: 'backup' },
    ];
    const doneCount = items.filter((i) => i.done).length;
    if (doneCount === items.length) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = `
      <div class="checklist">
        <div class="checklist__head">
          <h2 class="checklist__title">🚀 Get set up</h2>
          <div class="checklist__meta">
            <span class="checklist__count">${doneCount} of ${items.length}</span>
            <button class="checklist__dismiss" data-check-act="dismiss">Dismiss</button>
          </div>
        </div>
        <div class="checklist__items">
          ${items.map((i) => `
            <button class="check-item ${i.done ? 'is-done' : ''}" data-check-act="${i.done ? '' : i.act}">
              <i>${i.done ? '✓' : ''}</i> ${i.label}
            </button>`).join('')}
        </div>
      </div>`;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-check-act]');
    if (!el) return;
    const act = el.dataset.checkAct;
    if (act === 'dismiss') { Store.setSetting('checklistDismissed', true); }
    else if (act === 'numbers') { $('#section-finance')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('Click any value on a card, type your number, press Enter.'); }
    else if (act === 'lead') location.href = 'crm.html';
    else if (act === 'tour' && window.HelpUI) HelpUI.showTourPick();
    else if (act === 'backup') { openDrawer(); $('#drawerBackup')?.scrollIntoView({ block: 'center' }); }
  });

  /* ── Inline editing ─────────────────────────────────────── */

  function beginEdit(btn) {
    const card = btn.closest('[data-metric]');
    const metric = METRIC_INDEX[card.dataset.metric];
    const field = btn.dataset.edit; // 'value' | 'goal'
    const current = Store.get(metric.id)[field];

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = 'any';
    input.value = current || '';
    input.className = field === 'value' ? 'card__value card__value--input' : 'card__goal-value card__goal-value--input';
    input.setAttribute('aria-label', `Edit ${metric.label} ${field}`);
    btn.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const n = parseFloat(input.value);
      const ok = field === 'value' ? Store.setValue(metric.id, n) : Store.setGoal(metric.id, n);
      if (!ok && input.value.trim() !== '') {
        toast(field === 'goal' ? 'Goals must be greater than zero.' : 'Enter a valid number.', 'error');
      }
      renderAll(); // store:changed also fires, but re-render here covers the no-op case
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { committed = true; renderAll(); }
    });
    input.addEventListener('blur', commit);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (btn) beginEdit(btn);
  });

  /* ── Pipeline summary strip ─────────────────────────────── */

  function renderPipeline() {
    const wrap = $('#pipeStrip');
    if (!wrap) return;
    if (!window.CrmStore || !CrmStore.hasData()) { wrap.innerHTML = ''; return; }
    const s = CrmStore.stats();
    const due = s.dueToday + s.overdue;
    wrap.innerHTML = `
      <div class="pipe-strip">
        <a class="pipe-strip__title" href="crm.html">🧭 Sales Pipeline →</a>
        <div class="pipe-strip__stats">
          <span><strong>${fmtMoney(s.pipelineValue)}</strong> pipeline</span>
          <span><strong>${s.openLeads}</strong> open</span>
          <span><strong>${s.winRate === null ? '—' : Math.round(s.winRate * 100) + '%'}</strong> win rate</span>
          <a href="crm.html#status=due" class="${due ? 'pipe-strip__due' : ''}"><strong>${due}</strong> due</a>
        </div>
      </div>`;
  }

  /* ── Career summary strip ───────────────────────────────── */

  function renderCareer() {
    const wrap = $('#careerStrip');
    if (!wrap) return;
    if (!window.JobsStore || !JobsStore.hasData()) { wrap.innerHTML = ''; return; }
    const s = JobsStore.stats();
    const due = s.dueToday + s.overdue;
    wrap.innerHTML = `
      <div class="pipe-strip">
        <a class="pipe-strip__title" href="jobs.html">💼 Job Applications →</a>
        <div class="pipe-strip__stats">
          <span><strong>${s.active}</strong> active</span>
          <span><strong>${s.appliedWeek}</strong> this week</span>
          <a href="jobs.html#view=calendar"><strong>${s.interviewsUpcoming}</strong> interview${s.interviewsUpcoming === 1 ? '' : 's'}</a>
          ${s.offers ? `<span><strong>${s.offers}</strong> offer${s.offers === 1 ? '' : 's'} 🎉</span>` : ''}
          <a href="jobs.html#view=table&status=due" class="${due ? 'pipe-strip__due' : ''}"><strong>${due}</strong> due</a>
        </div>
      </div>`;
  }

  /* ── Header meta ────────────────────────────────────────── */

  function renderMeta() {
    const now = new Date();
    $('#todayLine').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greeting').textContent = Store.state.settings.ownerName ? `${greeting}, ${Store.state.settings.ownerName}.` : `${greeting} 👋`;

    const u = Store.state.updatedAt;
    $('#lastUpdated').textContent = u
      ? `Last updated ${new Date(u).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : 'No data yet — click any value to start tracking';

    const totalPct = METRICS.reduce((sum, m) => sum + progress(m), 0) / METRICS.length;
    $('#overallPct').textContent = `${Math.round(totalPct * 100)}%`;
    $('#overallRing').style.setProperty('--pct', totalPct);
  }

  /* ── Settings drawer (shared module — settings.js) ──────── */

  const openDrawer = () => window.SettingsUI && SettingsUI.open();
  const closeDrawer = () => window.SettingsUI && SettingsUI.close();

  /* ── Toasts ─────────────────────────────────────────────── */

  let toastTimer;
  function toast(msg, kind = 'ok') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast is-visible toast--${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  /* ── Render all ─────────────────────────────────────────── */

  function renderAll() {
    syncFromCrm();
    renderHero();
    renderChecklist();
    renderSections();
    renderPipeline();
    renderCareer();
    renderMeta();
  }

  document.addEventListener('store:changed', renderAll);

  // Live-refresh when the pipeline or career data changes in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'vaugn.crm.v1' && window.CrmStore) { CrmStore.load(); renderAll(); }
    if (e.key === 'vaugn.jobs.v1' && window.JobsStore) { JobsStore.load(); renderAll(); }
  });

  renderAll();

  // Minimal public API so help.js / tour.js can reuse UI plumbing.
  window.Dashboard = { openDrawer, closeDrawer, toast, renderAll };

  // Animate progress bars in on first paint.
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
