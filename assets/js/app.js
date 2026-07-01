/* ============================================================
   app.js — render, inline editing, hero math, settings, toasts
   ============================================================ */

(function () {
  'use strict';

  Store.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
      sub: `${new Intl.NumberFormat().format(v('leads'))} leads in pipeline`,
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
          <p class="hero-stat__sub">${h.sub}</p>
        </article>`;
    }).join('');
  }

  /* ── Metric cards ───────────────────────────────────────── */

  function cardHTML(metric) {
    const s = Store.get(metric.id);
    const pct = Math.round(progress(metric) * 100);
    const done = metric.direction === 'down' ? (s.value > 0 && s.value <= s.goal) : (s.goal > 0 && s.value >= s.goal);
    return `
      <article class="card ${done ? 'is-done' : ''}" data-metric="${metric.id}">
        <header class="card__head">
          <span class="card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[metric.icon]}</svg></span>
          <h3 class="card__label">${metric.label}${metric.per ? `<span class="card__per">${metric.per}</span>` : ''}</h3>
          ${done ? '<span class="card__badge" title="Goal reached">✓</span>' : ''}
        </header>
        <button class="card__value" data-edit="value" title="Click to edit value">${fmt(metric, s.value)}</button>
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
    wrap.innerHTML = GROUPS.map((g) => {
      const cards = METRICS.filter((m) => m.group === g.id).map(cardHTML).join('');
      return `
        <section class="section" id="section-${g.id}">
          <header class="section__head">
            <span class="section__tag">${g.tag}</span>
            <div>
              <h2 class="section__title">${g.label}</h2>
              <p class="section__blurb">${g.blurb}</p>
            </div>
          </header>
          <div class="grid">${cards}</div>
        </section>`;
    }).join('');
  }

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

  /* ── Header meta ────────────────────────────────────────── */

  function renderMeta() {
    const now = new Date();
    $('#todayLine').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    $('#greeting').textContent = `${greeting}, ${Store.state.settings.ownerName}.`;

    const u = Store.state.updatedAt;
    $('#lastUpdated').textContent = u
      ? `Last updated ${new Date(u).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : 'No data yet — click any value to start tracking';

    const totalPct = METRICS.reduce((sum, m) => sum + progress(m), 0) / METRICS.length;
    $('#overallPct').textContent = `${Math.round(totalPct * 100)}%`;
    $('#overallRing').style.setProperty('--pct', totalPct);
  }

  /* ── Settings drawer ────────────────────────────────────── */

  const drawer = $('#drawer');
  const scrim = $('#scrim');

  function openDrawer() {
    drawer.classList.add('is-open');
    scrim.classList.add('is-visible');
    drawer.setAttribute('aria-hidden', 'false');
    $('#currencySelect').value = Store.state.settings.currency;
    $('#weightUnitSelect').value = Store.state.settings.weightUnit;
    $('#nameInput').value = Store.state.settings.ownerName;
    $('#sheetsUrlInput').value = Store.state.settings.sheetsUrl;
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    drawer.setAttribute('aria-hidden', 'true');
  }

  $('#settingsBtn').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    // Defer to the tour / help surfaces — they own Escape while open.
    if (e.key === 'Escape' && !(window.Tour && Tour.active) && !(window.HelpUI && HelpUI.anyOpen())) closeDrawer();
  });

  $('#currencySelect').addEventListener('change', (e) => {
    Store.setSetting('currency', e.target.value);
    toast(`Currency set to ${e.target.value}`);
  });
  $('#weightUnitSelect').addEventListener('change', (e) => {
    Store.setSetting('weightUnit', e.target.value);
    toast(`Weight unit set to ${e.target.value}`);
  });
  $('#nameInput').addEventListener('change', (e) => {
    Store.setSetting('ownerName', e.target.value.trim() || 'there');
  });
  $('#sheetsUrlInput').addEventListener('change', (e) => {
    Store.setSetting('sheetsUrl', e.target.value.trim());
    toast(e.target.value.trim() ? 'Sheets URL saved (kept only in this browser).' : 'Sheets sync disabled.');
  });

  async function runSync(kind) {
    const btn = kind === 'pull' ? $('#pullBtn') : $('#pushBtn');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      if (kind === 'pull') {
        const n = await SheetsSync.pull();
        toast(n ? `Pulled ${n} value${n === 1 ? '' : 's'} from your sheet.` : 'Sheet had no matching values yet — try Push first.');
      } else {
        const n = await SheetsSync.push();
        toast(`Pushed ${n} metrics to your sheet.`);
      }
    } catch (err) {
      toast(err.message || 'Sync failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  }
  $('#pullBtn').addEventListener('click', () => runSync('pull'));
  $('#pushBtn').addEventListener('click', () => runSync('push'));

  $('#exportBtn').addEventListener('click', () => {
    Store.exportJSON();
    toast('Backup downloaded.');
  });
  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      Store.importJSON(await file.text());
      toast('Backup restored.');
    } catch (err) {
      toast(err.message || 'Could not import that file.', 'error');
    }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Reset every value and goal back to defaults? Your data in this browser will be erased.')) {
      Store.resetAll();
      toast('Dashboard reset.');
    }
  });

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
    renderHero();
    renderSections();
    renderMeta();
  }

  document.addEventListener('store:changed', renderAll);
  renderAll();

  // Minimal public API so help.js / tour.js can reuse UI plumbing.
  window.Dashboard = { openDrawer, closeDrawer, toast, renderAll };

  // Animate progress bars in on first paint.
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
