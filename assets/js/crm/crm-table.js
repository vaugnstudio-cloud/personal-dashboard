/* ============================================================
   crm-table.js — table, mobile cards & cell rendering
   Pure rendering; crm-app.js owns state + events.
   ============================================================ */

const CrmTable = (() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function money(n, lead) {
    const cur = (window.Store && Store.state.settings.currency) || 'USD';
    const s = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n || 0);
    return lead && lead.dealType === 'retainer' ? `${s}<span class="cell-dim">/mo</span>` : s;
  }

  function shortDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    const opts = { month: 'short', day: 'numeric' };
    if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return dt.toLocaleDateString(undefined, opts);
  }

  function humanFollowUp(lead) {
    if (lead.status === 'won' || lead.status === 'lost') return '<span class="date cell-dim">—</span>';
    const d = lead.followUpDate;
    if (!d) return '<span class="date cell-dim">—</span>';
    const today = crmToday();
    if (d === today) return '<span class="date date--today">Today</span>';
    if (d < today) {
      const days = Math.round((new Date(today) - new Date(d)) / 86400000);
      return `<span class="date date--overdue">${days}d overdue</span>`;
    }
    const t = new Date(today + 'T00:00:00');
    const dt = new Date(d + 'T00:00:00');
    if (dt - t === 86400000) return '<span class="date">Tomorrow</span>';
    return `<span class="date">${shortDate(d)}</span>`;
  }

  function avatar(lead, lg) {
    const ch = (lead.business || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span class="lead-avatar ${lg ? 'lead-avatar--lg' : ''}">${esc(ch)}</span>`;
  }

  function badge(status) {
    const s = CRM_STATUS_INDEX[status] || CRM_STATUS_INDEX.lead;
    return `<button class="badge badge--${s.id}" data-act="status" title="Change status">${s.label}</button>`;
  }

  function rcp(lead) {
    const dot = (key, label, on) =>
      `<i class="${on ? 'on' : ''}" data-rcp="${key}" title="${label}">${on ? '✓' : ''}</i>`;
    return `<span class="rcp">${dot('replied', 'Reply received', lead.replied)}${dot('callBooked', 'Call booked', lead.callBooked)}${dot('proposalSent', 'Proposal sent', lead.proposalSent)}</span>`;
  }

  function domain(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  /** Render one cell for a column id. */
  function cell(col, lead) {
    switch (col) {
      case 'business':
        return `<td class="col-business">${avatar(lead)}<span class="lead-name">${esc(lead.business) || '<span class="cell-dim">Untitled lead</span>'}<small>${esc(domain(lead.website))}</small></span></td>`;
      case 'decisionMaker': return `<td>${esc(lead.decisionMaker) || '<span class="cell-dim">—</span>'}</td>`;
      case 'channel':       return `<td><span class="cell-dim">${CRM_CHANNEL_INDEX[lead.channel]?.label || '—'}</span></td>`;
      case 'status':        return `<td>${badge(lead.status)}</td>`;
      case 'rcp':           return `<td class="col-rcp">${rcp(lead)}</td>`;
      case 'followUpDate':  return `<td data-act="edit-date">${humanFollowUp(lead)}</td>`;
      case 'dateContacted': return `<td><span class="cell-dim">${shortDate(lead.dateContacted)}</span></td>`;
      case 'dealValue':     return `<td class="col-num" data-act="edit-value">${lead.dealValue ? money(lead.dealValue, lead) : '<span class="cell-dim">—</span>'}</td>`;
      case 'notes':         return `<td class="col-notes cell-dim">${esc(lead.notes)}</td>`;
      case 'website':       return `<td class="cell-dim">${esc(domain(lead.website)) || '—'}</td>`;
      case 'social':        return `<td class="cell-dim">${esc(domain(lead.social)) || '—'}</td>`;
      case 'email':         return `<td class="cell-dim">${esc(lead.email) || '—'}</td>`;
      case 'problem':       return `<td class="col-notes cell-dim">${esc(lead.problem)}</td>`;
      case 'offer':         return `<td class="col-notes cell-dim">${esc(lead.offer)}</td>`;
      default:              return `<td class="cell-dim">${esc(lead[col]) || '—'}</td>`;
    }
  }

  function renderHead(view) {
    const ths = view.visibleColumns.map((id) => {
      const c = CRM_COLUMN_INDEX[id];
      const sorted = view.sortBy === id;
      const cls = [id === 'business' ? 'col-business' : '', c.num ? 'col-num' : '', id === 'rcp' ? 'col-rcp' : ''].join(' ');
      const aria = sorted ? ` aria-sort="${view.sortDir === 'asc' ? 'ascending' : 'descending'}"` : '';
      const ind = sorted ? `<span class="sort-ind">${view.sortDir === 'asc' ? '↑' : '↓'}</span>` : '';
      const label = c.short || c.label;
      return `<th class="${cls}"${aria} title="${c.label}">${c.sortable ? `<button class="th-sort" data-sort="${id}">${label}${ind}</button>` : label}</th>`;
    }).join('');
    return `<tr><th class="col-check"><input type="checkbox" id="checkAll" aria-label="Select all" /></th>${ths}</tr>`;
  }

  function renderRows(leads, view, selection, focusId) {
    return leads.map((lead) => {
      const cells = view.visibleColumns.map((id) => cell(id, lead)).join('');
      const cls = [
        'lead-row',
        lead.status === 'won' ? 'lead-row--won' : '',
        lead.status === 'lost' ? 'lead-row--lost' : '',
        selection.has(lead.id) ? 'is-selected' : '',
        lead.id === focusId ? 'is-focused' : '',
      ].join(' ');
      return `<tr class="${cls}" data-id="${lead.id}" tabindex="-1">
        <td class="col-check"><input type="checkbox" ${selection.has(lead.id) ? 'checked' : ''} aria-label="Select ${esc(lead.business) || 'lead'}" /></td>${cells}</tr>`;
    }).join('');
  }

  function renderCards(leads, selection) {
    return leads.map((lead) => `
      <article class="lead-card ${lead.status === 'won' ? 'lead-row--won' : ''} ${lead.status === 'lost' ? 'lead-row--lost' : ''}" data-id="${lead.id}">
        <div class="lead-card__top">
          ${avatar(lead)}
          <div><strong>${esc(lead.business) || 'Untitled lead'}</strong><small>${esc(lead.decisionMaker) || '—'} · ${CRM_CHANNEL_INDEX[lead.channel]?.label || ''}</small></div>
          ${badge(lead.status)}
        </div>
        <div class="lead-card__bottom">
          ${rcp(lead)}
          ${humanFollowUp(lead)}
          <strong>${lead.dealValue ? money(lead.dealValue, lead) : '—'}</strong>
        </div>
      </article>`).join('');
  }

  return { renderHead, renderRows, renderCards, money, shortDate, esc };
})();
