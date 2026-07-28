/* ============================================================
   jobs-render.js — pure string-template renderers for the
   Career Pipeline. jobs-app.js / jobs-views.js own state+events.
   Every user-entered string passes through esc().
   ============================================================ */

const JobsRender = (() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* ── Formatting helpers ─────────────────────────────────── */

  function shortDate(d) {
    if (!d) return '—';
    const dt = new Date(d.slice(0, 10) + 'T00:00:00');
    const opts = { month: 'short', day: 'numeric' };
    if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return dt.toLocaleDateString(undefined, opts);
  }

  function shortDateTime(at) {
    if (!at) return '—';
    const dt = new Date(at);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  /** Salary range in the job's own currency. */
  function salary(job) {
    if (!job.salaryMin && !job.salaryMax) return '';
    const cur = job.salaryCurrency || 'USD';
    const per = JOBS_SALARY_PERIODS.find((p) => p.id === job.salaryPeriod)?.short || '/yr';
    const f = (n) => {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: n >= 10000 ? 1 : 0 }).format(n);
      } catch (e) { return `${cur} ${n}`; }
    };
    if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) return `${f(job.salaryMin)}–${f(job.salaryMax)}${per}`;
    return `${f(job.salaryMax || job.salaryMin)}${per}`;
  }

  function humanFollowUp(job) {
    const g = JobsStore.groupOf(job.status);
    if (g === 'won' || g === 'lost') return '<span class="date cell-dim">—</span>';
    const d = job.followUpDate;
    if (!d) return '<span class="date cell-dim">—</span>';
    const today = jobsToday();
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

  function humanDeadline(job) {
    if (!job.deadline) return '<span class="date cell-dim">—</span>';
    if (job.appliedDate) return `<span class="date cell-dim">${shortDate(job.deadline)}</span>`;
    const today = jobsToday();
    if (job.deadline < today) return '<span class="date date--overdue">Passed</span>';
    const days = Math.round((new Date(job.deadline) - new Date(today)) / 86400000);
    if (days === 0) return '<span class="date date--overdue">Today!</span>';
    if (days <= (JobsStore.state.settings.deadlineWarnDays || 3)) return `<span class="date date--today">${days}d left</span>`;
    return `<span class="date">${shortDate(job.deadline)}</span>`;
  }

  function avatar(job, lg) {
    const ch = (job.company || job.title || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span class="lead-avatar ${lg ? 'lead-avatar--lg' : ''}">${esc(ch)}</span>`;
  }

  function badge(statusId, clickable = true) {
    const s = JobsStore.status(statusId);
    return `<${clickable ? 'button' : 'span'} class="badge jbadge--${s.color}" ${clickable ? 'data-act="status" title="Change status"' : ''}>${esc(s.label)}</${clickable ? 'button' : 'span'}>`;
  }

  function priorityDot(job) {
    if (job.priority === 'medium') return '';
    return `<span class="jb-prio jb-prio--${job.priority}" title="${job.priority === 'high' ? 'High' : 'Low'} priority">${job.priority === 'high' ? '▲' : '▽'}</span>`;
  }

  function fitMeter(job, withLabel = true) {
    const v = job.fit.overall;
    if (v == null || v === '') return '<span class="cell-dim">—</span>';
    const pct = Math.max(0, Math.min(100, v * 10));
    const cls = v >= 7 ? 'is-good' : v >= 4 ? 'is-mid' : 'is-low';
    return `<span class="jb-fit ${cls}" title="Fit score ${v}/10"><span class="jb-fit__bar"><span style="width:${pct}%"></span></span>${withLabel ? `<span class="jb-fit__num">${esc(v)}</span>` : ''}</span>`;
  }

  function nextAction(job) {
    const openTask = job.tasks.filter((t) => !t.done).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')))[0];
    if (openTask) return `${esc(openTask.title || JOBS_TASK_TYPE_INDEX[openTask.type]?.label || 'Task')}${openTask.due ? ` · ${shortDate(openTask.due)}` : ''}`;
    const nextIv = job.interviews.filter((i) => i.outcome === 'pending' && i.at && i.at.slice(0, 10) >= jobsToday())
      .sort((a, b) => a.at.localeCompare(b.at))[0];
    if (nextIv) return `${esc(JOBS_INTERVIEW_TYPE_INDEX[nextIv.type]?.label || 'Interview')} · ${shortDateTime(nextIv.at)}`;
    if (job.followUpDate) return `Follow up · ${shortDate(job.followUpDate)}`;
    return '<span class="cell-dim">—</span>';
  }

  /* ── Table ──────────────────────────────────────────────── */

  function cell(col, job) {
    switch (col) {
      case 'role':
        return `<td class="col-business">${avatar(job)}<span class="lead-name">${esc(job.company) || '<span class="cell-dim">No company</span>'}<small>${esc(job.title) || '—'}</small></span></td>`;
      case 'status':       return `<td>${badge(job.status)}</td>`;
      case 'priority':     return `<td><span class="jb-prio-cell jb-prio-cell--${esc(job.priority)}">${priorityDot(job)}${esc(job.priority)}</span></td>`;
      case 'appliedDate':  return `<td data-act="edit-applied"><span class="cell-dim">${shortDate(job.appliedDate)}</span></td>`;
      case 'daysSince': {
        const d = JobsStore.daysSinceApplied(job);
        return `<td class="col-num">${d == null ? '<span class="cell-dim">—</span>' : `${d}d`}</td>`;
      }
      case 'followUpDate': return `<td data-act="edit-date">${humanFollowUp(job)}</td>`;
      case 'deadline':     return `<td>${humanDeadline(job)}</td>`;
      case 'fit':          return `<td class="col-rcp">${fitMeter(job)}</td>`;
      case 'salary':       return `<td class="col-num">${salary(job) || '<span class="cell-dim">—</span>'}</td>`;
      case 'location':     return `<td class="cell-dim">${esc(job.location) || '—'}${job.arrangement ? ` · ${JOBS_ARRANGEMENT_INDEX[job.arrangement]?.label || ''}` : ''}</td>`;
      case 'source':       return `<td><span class="cell-dim">${JOBS_SOURCE_INDEX[job.source]?.label || esc(job.source) || '—'}</span></td>`;
      case 'arrangement':  return `<td class="cell-dim">${JOBS_ARRANGEMENT_INDEX[job.arrangement]?.label || '—'}</td>`;
      case 'employmentType': return `<td class="cell-dim">${JOBS_EMPLOYMENT_INDEX[job.employmentType]?.label || '—'}</td>`;
      case 'nextAction':   return `<td class="col-notes cell-dim">${nextAction(job)}</td>`;
      case 'tags':         return `<td class="col-notes">${job.tags.map((t) => `<span class="jb-tag">${esc(t)}</span>`).join(' ') || '<span class="cell-dim">—</span>'}</td>`;
      case 'contacts':     return `<td class="cell-dim">${job.contacts.length ? esc(job.contacts[0].name) + (job.contacts.length > 1 ? ` +${job.contacts.length - 1}` : '') : '—'}</td>`;
      case 'notes':        return `<td class="col-notes cell-dim">${esc(job.notes)}</td>`;
      default:             return `<td class="cell-dim">${esc(job[col]) || '—'}</td>`;
    }
  }

  function renderHead(view) {
    const ths = view.visibleColumns.map((id) => {
      const c = JOBS_COLUMN_INDEX[id];
      const sorted = view.sortBy === id;
      const cls = [id === 'role' ? 'col-business' : '', c.num ? 'col-num' : ''].join(' ');
      const aria = sorted ? ` aria-sort="${view.sortDir === 'asc' ? 'ascending' : 'descending'}"` : '';
      const ind = sorted ? `<span class="sort-ind">${view.sortDir === 'asc' ? '↑' : '↓'}</span>` : '';
      const label = c.short || c.label;
      return `<th class="${cls}"${aria} title="${c.label}">${c.sortable ? `<button class="th-sort" data-sort="${id}">${label}${ind}</button>` : label}</th>`;
    }).join('');
    return `<tr><th class="col-check"><input type="checkbox" id="jobsCheckAll" aria-label="Select all" /></th>${ths}</tr>`;
  }

  function renderRows(jobs, view, selection, focusId) {
    return jobs.map((job) => {
      const g = JobsStore.groupOf(job.status);
      const cells = view.visibleColumns.map((id) => cell(id, job)).join('');
      const cls = [
        'lead-row',
        g === 'won' ? 'lead-row--won' : '',
        g === 'lost' ? 'lead-row--lost' : '',
        selection.has(job.id) ? 'is-selected' : '',
        job.id === focusId ? 'is-focused' : '',
      ].join(' ');
      return `<tr class="${cls}" data-id="${job.id}" tabindex="-1">
        <td class="col-check"><input type="checkbox" ${selection.has(job.id) ? 'checked' : ''} aria-label="Select ${esc(job.company) || 'application'}" /></td>${cells}</tr>`;
    }).join('');
  }

  function renderCards(jobs, selection) {
    return jobs.map((job) => {
      const g = JobsStore.groupOf(job.status);
      return `
      <article class="lead-card ${g === 'won' ? 'lead-row--won' : ''} ${g === 'lost' ? 'lead-row--lost' : ''}" data-id="${job.id}">
        <div class="lead-card__top">
          ${avatar(job)}
          <div><strong>${esc(job.company) || 'No company'}</strong><small>${esc(job.title) || '—'}${job.location ? ` · ${esc(job.location)}` : ''}</small></div>
          ${badge(job.status)}
        </div>
        <div class="lead-card__bottom">
          ${fitMeter(job, false)}
          ${humanFollowUp(job)}
          <strong>${salary(job) || '—'}</strong>
        </div>
      </article>`;
    }).join('');
  }

  /* ── Kanban card ────────────────────────────────────────── */

  function kanbanCard(job) {
    const days = JobsStore.daysInStage(job);
    const overdue = job.followUpDate && job.followUpDate < jobsToday() && JobsStore.isActive(job);
    return `
      <article class="jb-card" data-id="${job.id}" tabindex="0" role="button"
        aria-label="${esc(job.company) || 'Application'} — ${esc(JobsStore.status(job.status).label)}. Enter to change status, [ and ] to move.">
        <div class="jb-card__top">
          <strong>${esc(job.company) || 'No company'}</strong>
          ${priorityDot(job)}
        </div>
        <p class="jb-card__title">${esc(job.title) || '—'}</p>
        <div class="jb-card__meta">
          <span title="Days in this stage">${days}d in stage</span>
          ${overdue ? '<span class="jb-card__warn" title="Follow-up overdue">⚠</span>' : ''}
          ${fitMeter(job, false)}
        </div>
      </article>`;
  }

  /* ── Activity timeline ──────────────────────────────────── */

  function timeline(job, limit = 12) {
    return job.activity.slice(0, limit).map((a) =>
      `<li><span>${new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> ${esc(a.text)}</li>`).join('');
  }

  return {
    esc, shortDate, shortDateTime, salary, humanFollowUp, humanDeadline,
    avatar, badge, priorityDot, fitMeter, nextAction,
    renderHead, renderRows, renderCards, kanbanCard, timeline,
  };
})();
