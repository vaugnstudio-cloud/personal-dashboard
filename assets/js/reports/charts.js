/* ============================================================
   charts.js — hand-rolled SVG charts. Zero dependencies.
   Every function returns an SVG string sized by viewBox and
   styled with the design-system tokens via CSS classes.
   ============================================================ */

const Charts = (() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Gradient stops are classed so themes recolor them via CSS variables.
  const GRAD = `
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">
        <stop class="gs-a" offset="0"/><stop class="gs-b" offset="1"/>
      </linearGradient>
      <linearGradient id="cgv" x1="0" y1="1" x2="0" y2="0">
        <stop class="gs-a" offset="0"/><stop class="gs-b" offset="1"/>
      </linearGradient>
      <linearGradient id="cga" x1="0" y1="0" x2="0" y2="1">
        <stop class="gs-fade-a" offset="0"/><stop class="gs-fade-b" offset="1"/>
      </linearGradient>
    </defs>`;

  /** Theme-aware series palette, read live from the active theme. */
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    return [
      cs.getPropertyValue('--accent-2').trim() || '#2dd4ff',
      cs.getPropertyValue('--accent-3').trim() || '#4ade80',
      cs.getPropertyValue('--accent-1').trim() || '#a78bfa',
    ];
  }

  /** Vertical bar chart: buckets = [{label, value}], fmt(value) → label. */
  function barChart(buckets, fmt) {
    const W = 720, H = 240, padB = 30, padT = 28, padX = 16;
    const max = Math.max(...buckets.map((b) => b.value), 1);
    const n = buckets.length;
    const slot = (W - padX * 2) / n;
    const barW = Math.min(64, slot * 0.55);
    const bars = buckets.map((b, i) => {
      const h = Math.round((b.value / max) * (H - padB - padT));
      const x = padX + slot * i + (slot - barW) / 2;
      const y = H - padB - h;
      return `
        <g class="ch-bar-g">
          <rect class="ch-bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 2)}" rx="6" fill="url(#cgv)" opacity="${b.value === 0 ? 0.18 : 1}"><title>${esc(b.label)}: ${esc(fmt(b.value))}</title></rect>
          ${b.value > 0 ? `<text class="ch-val" x="${x + barW / 2}" y="${y - 8}" text-anchor="middle">${esc(fmt(b.value))}</text>` : ''}
          <text class="ch-lbl" x="${x + barW / 2}" y="${H - 10}" text-anchor="middle">${esc(b.label)}</text>
        </g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${GRAD}
      <line x1="${padX}" y1="${H - padB}" x2="${W - padX}" y2="${H - padB}" class="ch-axis"/>${bars}</svg>`;
  }

  /** Funnel: stages = [{label, count}] (first = 100%). */
  function funnelChart(stages) {
    const W = 720, rowH = 44, gap = 10, padX = 16, labelW = 118;
    const H = stages.length * (rowH + gap) + 6;
    const max = Math.max(stages[0]?.count || 0, 1);
    const barMax = W - padX * 2 - labelW - 96;
    const rows = stages.map((s, i) => {
      const y = i * (rowH + gap);
      const w = Math.max((s.count / max) * barMax, s.count > 0 ? 8 : 3);
      const pct = Math.round((s.count / max) * 100);
      const drop = i > 0 && stages[i - 1].count > 0
        ? Math.round((1 - s.count / stages[i - 1].count) * 100) : null;
      return `
        <g>
          <text class="ch-lbl ch-lbl--row" x="${padX}" y="${y + rowH / 2 + 4}">${esc(s.label)}</text>
          <rect x="${padX + labelW}" y="${y + 7}" width="${barMax}" height="${rowH - 14}" rx="8" class="ch-track"/>
          <rect x="${padX + labelW}" y="${y + 7}" width="${w}" height="${rowH - 14}" rx="8" fill="url(#cg)" opacity="${s.count === 0 ? 0.15 : 0.9}"><title>${esc(s.label)}: ${s.count} (${pct}%)</title></rect>
          <text class="ch-val" x="${padX + labelW + barMax + 10}" y="${y + rowH / 2 + 4}">${s.count} · ${pct}%</text>
          ${drop !== null && drop > 0 ? `<text class="ch-drop" x="${padX + labelW + w + 10}" y="${y + rowH / 2 + 4}">−${drop}%</text>` : ''}
        </g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${GRAD}${rows}</svg>`;
  }

  /** Horizontal bars: rows = [{label, value(0–1), text, sub}] — e.g. channel win rates. */
  function hBarChart(rows, opts = {}) {
    const W = 720, rowH = 46, gap = 10, padX = 16, labelW = 128;
    const H = rows.length * (rowH + gap) + 4;
    const barMax = W - padX * 2 - labelW - 130;
    const body = rows.map((r, i) => {
      const y = i * (rowH + gap);
      const w = Math.max(r.value * barMax, r.value > 0 ? 6 : 3);
      return `
        <g>
          <text class="ch-lbl ch-lbl--row" x="${padX}" y="${y + rowH / 2 - 3}">${esc(r.label)}</text>
          ${r.sub ? `<text class="ch-sub" x="${padX}" y="${y + rowH / 2 + 13}">${esc(r.sub)}</text>` : ''}
          <rect x="${padX + labelW}" y="${y + 10}" width="${barMax}" height="${rowH - 20}" rx="7" class="ch-track"/>
          <rect x="${padX + labelW}" y="${y + 10}" width="${w}" height="${rowH - 20}" rx="7" fill="url(#cg)" opacity="${r.value === 0 ? 0.15 : 0.9}"><title>${esc(r.label)}: ${esc(r.text)}</title></rect>
          <text class="ch-val" x="${padX + labelW + barMax + 10}" y="${y + rowH / 2 + 4}">${esc(r.text)}</text>
        </g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${GRAD}${body}</svg>`;
  }

  /** Line chart with area fill: series = [{label, points:[{date, value}]}]. */
  function lineChart(seriesList, fmt) {
    const W = 720, H = 220, padX = 16, padT = 20, padB = 26;
    const all = seriesList.flatMap((s) => s.points.map((p) => p.value));
    if (!all.length) return '';
    const max = Math.max(...all, 1);
    const colors = palette();
    const n = Math.max(...seriesList.map((s) => s.points.length));
    const x = (i) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - padX * 2));
    const y = (v) => H - padB - (v / max) * (H - padT - padB);

    const lines = seriesList.map((s, si) => {
      const pts = s.points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
      const area = `${padX},${H - padB} ${pts} ${x(s.points.length - 1)},${H - padB}`;
      const last = s.points[s.points.length - 1];
      return `
        ${si === 0 ? `<polygon points="${area}" fill="url(#cga)"/>` : ''}
        <polyline points="${pts}" fill="none" stroke="${colors[si % 3]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(s.points.length - 1)}" cy="${y(last.value)}" r="4" fill="${colors[si % 3]}"/>
        <text class="ch-val" x="${Math.min(x(s.points.length - 1) + 8, W - 60)}" y="${y(last.value) - 8}">${esc(fmt(last.value))}</text>`;
    }).join('');

    const first = seriesList[0].points[0];
    const lastP = seriesList[0].points[seriesList[0].points.length - 1];
    const dateLbl = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const legend = seriesList.map((s, si) =>
      `<tspan fill="${colors[si % 3]}">● </tspan><tspan class="ch-leg">${esc(s.label)}  </tspan>`).join('');

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${GRAD}
      <line x1="${padX}" y1="${H - padB}" x2="${W - padX}" y2="${H - padB}" class="ch-axis"/>
      <text class="ch-lbl" x="${padX}" y="${H - 8}">${esc(dateLbl(first.date))}</text>
      <text class="ch-lbl" x="${W - padX}" y="${H - 8}" text-anchor="end">${esc(dateLbl(lastP.date))}</text>
      <text x="${padX}" y="${padT - 6}" class="ch-sub">${legend}</text>
      ${lines}</svg>`;
  }

  return { barChart, funnelChart, hBarChart, lineChart };
})();
