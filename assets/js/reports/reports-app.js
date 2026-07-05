/* ============================================================
   reports-app.js — Reports page orchestration.
   Period picker → chart data → insights → generated report.
   ============================================================ */

(function () {
  'use strict';

  Store.load();
  CrmStore.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const fmtMoney = (n) => new Intl.NumberFormat(undefined, {
    style: 'currency', currency: Store.state.settings.currency, maximumFractionDigits: 0,
  }).format(n || 0);
  const fmtMoneyShort = (n) => {
    if (n >= 1000) return new Intl.NumberFormat(undefined, { style: 'currency', currency: Store.state.settings.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
    return fmtMoney(n);
  };

  /* ── Periods ────────────────────────────────────────────── */

  const PERIODS = [
    { id: 'month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
    { id: 'quarter', label: 'This quarter' },
    { id: 'all', label: 'All time' },
  ];
  let period = 'month';

  function periodRange() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (period === 'month') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    if (period === 'last-month') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    if (period === 'quarter') { const qm = Math.floor(m / 3) * 3; return { from: iso(new Date(y, qm, 1)), to: iso(new Date(y, qm + 3, 0)) }; }
    return { from: '0000-01-01', to: '9999-12-31' };
  }
  const periodLabel = () => PERIODS.find((p) => p.id === period).label;

  /** Local YYYY-MM-DD for a Date or an ISO timestamp (avoids UTC boundary drift). */
  const localDay = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const inRange = (dateStr, r) => {
    if (!dateStr) return false;
    const day = dateStr.includes('T') ? localDay(dateStr) : dateStr.slice(0, 10);
    return day >= r.from && day <= r.to;
  };

  /* ── Data shaping ───────────────────────────────────────── */

  function wonInPeriod(r) {
    return CrmStore.state.leads.filter((l) => l.status === 'won' && l.wonAt && inRange(l.wonAt, r));
  }

  /** Revenue buckets: weekly inside a month, monthly for quarter/all. */
  function revenueBuckets(r) {
    const won = wonInPeriod(r);
    const buckets = [];
    if (period === 'month' || period === 'last-month') {
      const start = new Date(r.from + 'T00:00:00');
      const end = new Date(r.to + 'T00:00:00');
      let ws = new Date(start);
      let i = 1;
      while (ws <= end) {
        const we = new Date(Math.min(ws.getTime() + 6 * 86400000, end.getTime()));
        const total = won.filter((l) => localDay(l.wonAt) >= localDay(ws) && localDay(l.wonAt) <= localDay(we))
          .reduce((t, l) => t + (l.dealValue || 0), 0);
        buckets.push({ label: `W${i}`, value: total });
        ws = new Date(we.getTime() + 86400000);
        i++;
      }
    } else {
      const months = period === 'quarter' ? 3 : 12;
      const now = new Date();
      for (let k = months - 1; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const total = CrmStore.state.leads
          .filter((l) => l.status === 'won' && l.wonAt && localDay(l.wonAt).slice(0, 7) === ym)
          .reduce((t, l) => t + (l.dealValue || 0), 0);
        buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), value: total });
      }
    }
    return buckets;
  }

  function funnelStages(r) {
    const leads = period === 'all'
      ? CrmStore.state.leads
      : CrmStore.state.leads.filter((l) => inRange(l.createdAt, r));
    const order = CRM_STATUSES.map((s) => s.id);
    const beyond = (l, stage) => order.indexOf(l.status) >= order.indexOf(stage) && l.status !== 'lost';
    return {
      count: leads.length,
      stages: [
        { label: 'Leads', count: leads.length },
        { label: 'Contacted', count: leads.filter((l) => l.dateContacted || beyond(l, 'contacted')).length },
        { label: 'Replied', count: leads.filter((l) => l.replied || beyond(l, 'replied')).length },
        { label: 'Call booked', count: leads.filter((l) => l.callBooked || beyond(l, 'call-booked')).length },
        { label: 'Proposal', count: leads.filter((l) => l.proposalSent || beyond(l, 'proposal-sent')).length },
        { label: 'Won', count: leads.filter((l) => l.status === 'won').length },
      ],
    };
  }

  function channelRows(r) {
    const by = {};
    CrmStore.state.leads.forEach((l) => {
      const resolvedAt = l.status === 'won' ? l.wonAt : l.updatedAt;
      if (!['won', 'lost'].includes(l.status)) return;
      if (period !== 'all' && !inRange(resolvedAt, r)) return;
      const c = (by[l.channel] ??= { won: 0, lost: 0, revenue: 0 });
      if (l.status === 'won') { c.won++; c.revenue += l.dealValue || 0; }
      else c.lost++;
    });
    return Object.entries(by)
      .map(([id, c]) => ({
        label: CRM_CHANNEL_INDEX[id]?.label || id,
        value: c.won + c.lost > 0 ? c.won / (c.won + c.lost) : 0,
        text: `${Math.round((c.won / Math.max(c.won + c.lost, 1)) * 100)}% · ${fmtMoneyShort(c.revenue)}`,
        sub: `${c.won} won · ${c.lost} lost`,
        revenue: c.revenue,
      }))
      .sort((a, b) => b.value - a.value || b.revenue - a.revenue);
  }

  /* ── Renderers ──────────────────────────────────────────── */

  function renderPeriod() {
    $('#rptPeriods').innerHTML = PERIODS.map((p) =>
      `<button class="chip ${p.id === period ? 'is-active' : ''}" data-period="${p.id}">${p.label}</button>`).join('');
  }

  function renderInsights() {
    const list = Insights.generate();
    const card = (i) => `
      <article class="insight insight--${i.severity}" ${i.goto ? `data-goto="${i.goto}"` : ''} ${i.help ? `data-help="${i.help}"` : ''} ${i.goto || i.help ? 'role="link" tabindex="0"' : ''}>
        <span class="insight__icon">${i.icon}</span>
        <div>
          <h3 class="insight__title">${i.title}</h3>
          <p class="insight__detail">${i.detail}</p>
        </div>
        ${i.goto || i.help ? '<span class="insight__go">→</span>' : ''}
      </article>`;
    const top = list.slice(0, 5);
    const rest = list.slice(5);
    $('#rptInsights').innerHTML = top.map(card).join('') +
      (rest.length ? `<details class="insight-more"><summary>Show ${rest.length} more insight${rest.length === 1 ? '' : 's'}</summary>${rest.map(card).join('')}</details>` : '');
    $('#insightCount').textContent = `${list.length} insight${list.length === 1 ? '' : 's'} · computed privately from your data`;
    return list;
  }

  function renderCharts() {
    const r = periodRange();
    const won = wonInPeriod(r);
    const total = won.reduce((t, l) => t + (l.dealValue || 0), 0);

    // Revenue
    if (CrmStore.state.leads.some((l) => l.status === 'won')) {
      $('#chartRevenueHead').innerHTML = total > 0
        ? `You won <strong>${fmtMoney(total)}</strong> across ${won.length} deal${won.length === 1 ? '' : 's'} — ${periodLabel().toLowerCase()}.`
        : `No deals closed ${periodLabel().toLowerCase()} yet — the bars below show where you stand.`;
      $('#chartRevenue').innerHTML = Charts.barChart(revenueBuckets(r), fmtMoneyShort);
      $('#cardRevenue').classList.remove('is-empty');
    } else {
      $('#chartRevenueHead').textContent = 'Win your first deal to unlock the money chart.';
      $('#chartRevenue').innerHTML = '';
      $('#cardRevenue').classList.add('is-empty');
    }

    // Funnel
    const f = funnelStages(r);
    if (f.count > 0) {
      const wonPct = Math.round((f.stages[5].count / f.count) * 100);
      $('#chartFunnelHead').innerHTML = `${f.count} lead${f.count === 1 ? '' : 's'} entered ${periodLabel().toLowerCase()} — <strong>${wonPct}%</strong> became clients.`;
      $('#chartFunnel').innerHTML = Charts.funnelChart(f.stages);
      $('#cardFunnel').classList.remove('is-empty');
    } else {
      $('#chartFunnelHead').textContent = `No leads created ${periodLabel().toLowerCase()}. Add leads to see where deals drop off.`;
      $('#chartFunnel').innerHTML = '';
      $('#cardFunnel').classList.add('is-empty');
    }

    // Channels
    const rows = channelRows(r);
    if (rows.length) {
      $('#chartChannelHead').innerHTML = `<strong>${rows[0].label}</strong> is your best-closing channel ${periodLabel().toLowerCase()}.`;
      $('#chartChannel').innerHTML = Charts.hBarChart(rows);
      $('#cardChannel').classList.remove('is-empty');
    } else {
      $('#chartChannelHead').textContent = 'Close (or lose) a few deals and this chart shows which channel actually works.';
      $('#chartChannel').innerHTML = '';
      $('#cardChannel').classList.add('is-empty');
    }

    // Trends (gated on history)
    const days = History.days();
    if (days >= 7) {
      const series = [
        { label: 'MRR', points: History.series('mrr') },
        { label: 'Pipeline value', points: History.series('pipelineValue', 'pipeline') },
      ].filter((s) => s.points.length >= 2);
      if (series.length) {
        $('#chartTrendHead').innerHTML = `Your business over the last <strong>${days} day${days === 1 ? '' : 's'}</strong>.`;
        $('#chartTrend').innerHTML = Charts.lineChart(series, fmtMoneyShort);
        $('#cardTrend').classList.remove('is-empty');
        return;
      }
    }
    $('#chartTrendHead').innerHTML = `📈 Collecting your history — <strong>day ${Math.max(days, 1)} of 7</strong>. Trend lines for MRR and pipeline value unlock automatically as you keep using Vaugn Studio.`;
    $('#chartTrend').innerHTML = '';
    $('#cardTrend').classList.add('is-empty');
  }

  function renderAll() {
    renderPeriod();
    renderInsights();
    renderCharts();
    history.replaceState(null, '', period === 'month' ? location.pathname : `#period=${period}`);
  }

  /* ── Generated report ───────────────────────────────────── */

  function buildReport() {
    const r = periodRange();
    const s = CrmStore.stats();
    const won = wonInPeriod(r);
    const lost = CrmStore.state.leads.filter((l) => l.status === 'lost' && (period === 'all' || inRange(l.updatedAt, r)));
    const insights = Insights.generate();
    const totalWon = won.reduce((t, l) => t + (l.dealValue || 0), 0);
    const f = funnelStages(r);

    const sevLabel = { act: 'ACT', watch: 'WATCH', win: 'WIN' };
    $('#reportView').innerHTML = `
      <div class="report">
        <header class="report__head">
          <span class="brand__mark">S</span>
          <div>
            <h1>Business Report — ${periodLabel()}</h1>
            <p>Generated ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Vaugn Studio</p>
          </div>
        </header>
        <section class="report__stats">
          <div><strong>${fmtMoney(totalWon)}</strong><span>Won ${periodLabel().toLowerCase()}</span></div>
          <div><strong>${fmtMoney(s.pipelineValue)}</strong><span>Open pipeline</span></div>
          <div><strong>${s.openLeads}</strong><span>Open leads</span></div>
          <div><strong>${s.winRate === null ? '—' : Math.round(s.winRate * 100) + '%'}</strong><span>Win rate (all time)</span></div>
        </section>
        <section>
          <h2>What to do next</h2>
          ${insights.slice(0, 6).map((i) => `<p class="report__insight"><strong>[${sevLabel[i.severity]}]</strong> ${i.icon} <strong>${i.title}.</strong> ${i.detail}</p>`).join('')}
        </section>
        <section><h2>Revenue</h2>${$('#chartRevenue').innerHTML || '<p class="report__none">No revenue data for this period.</p>'}</section>
        <section><h2>Funnel</h2>${$('#chartFunnel').innerHTML || '<p class="report__none">No leads in this period.</p>'}</section>
        <section><h2>Channels</h2>${$('#chartChannel').innerHTML || '<p class="report__none">No decided deals in this period.</p>'}</section>
        <section class="report__cols">
          <div><h2>Won (${won.length})</h2>${won.map((l) => `<p>✅ ${CrmTableEsc(l.business)} — ${fmtMoney(l.dealValue)}${l.dealType === 'retainer' ? '/mo' : ''}</p>`).join('') || '<p class="report__none">None yet.</p>'}</div>
          <div><h2>Lost (${lost.length})</h2>${lost.map((l) => `<p>✖ ${CrmTableEsc(l.business)}${l.lossReason ? ` — ${CRM_LOSS_REASONS.find((x) => x.id === l.lossReason)?.label || ''}` : ''}</p>`).join('') || '<p class="report__none">None — keep it that way.</p>'}</div>
        </section>
        <footer class="report__foot">Funnel conversion: ${f.count ? Math.round((f.stages[5].count / f.count) * 100) : 0}% of ${f.count} leads → clients · Data stays on your device · studio-os</footer>
      </div>`;
    return { insights, totalWon, won, lost, s };
  }

  function CrmTableEsc(s) { return CrmTable.esc(s || 'Untitled'); }

  function reportAsText() {
    const r = buildReport();
    const lines = [
      `BUSINESS REPORT — ${periodLabel().toUpperCase()} · ${new Date().toLocaleDateString()}`,
      '',
      `Won ${periodLabel().toLowerCase()}: ${fmtMoney(r.totalWon)} (${r.won.length} deals)`,
      `Open pipeline: ${fmtMoney(r.s.pipelineValue)} across ${r.s.openLeads} leads`,
      `Win rate: ${r.s.winRate === null ? '—' : Math.round(r.s.winRate * 100) + '%'}`,
      '',
      'WHAT TO DO NEXT:',
      ...r.insights.slice(0, 6).map((i) => `• [${i.severity.toUpperCase()}] ${i.title} — ${i.detail}`),
      '',
      `Won: ${r.won.map((l) => `${l.business} (${fmtMoney(l.dealValue)})`).join(', ') || 'none'}`,
      `Lost: ${r.lost.map((l) => l.business).join(', ') || 'none'}`,
      '',
      '— Generated by Vaugn Studio',
    ];
    return lines.join('\n');
  }

  /* ── Toast ──────────────────────────────────────────────── */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast is-visible toast--ok';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  /* ── Events ─────────────────────────────────────────────── */

  $('#rptPeriods').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-period]');
    if (chip) { period = chip.dataset.period; renderAll(); }
  });

  $('#rptInsights').addEventListener('click', (e) => {
    const card = e.target.closest('.insight');
    if (!card) return;
    if (card.dataset.goto) location.href = card.dataset.goto;
    else if (card.dataset.help && window.HelpUI) HelpUI.openCenter(card.dataset.help);
  });
  $('#rptInsights').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.closest('.insight')?.click();
  });

  $('#rptPrint').addEventListener('click', () => {
    buildReport();
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing');
    }, 60);
  });

  $('#rptCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportAsText());
      toast('Report copied — paste it anywhere.');
    } catch (e) {
      toast('Could not access the clipboard.');
    }
  });

  document.addEventListener('crm:changed', renderAll);
  document.addEventListener('store:changed', renderAll);

  /* ── Boot ───────────────────────────────────────────────── */
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('period') && PERIODS.some((p) => p.id === hash.get('period'))) period = hash.get('period');
  renderAll();
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
})();
