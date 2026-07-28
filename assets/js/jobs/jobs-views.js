/* ============================================================
   jobs-views.js — Career Dashboard, Kanban board, Calendar and
   Reports views. jobs-app.js owns routing + the shared drawer;
   this file renders each view from JobsStore and wires its
   view-local interactions (drag-drop, calendar nav, periods).
   ============================================================ */

const JobsViews = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = JobsRender.esc;
  let cb = {};   // { openDrawer, openStatusMenu, gotoTable, toast }

  /* ══════════════ Career Pipeline Health (rule engine) ══════ */

  function health() {
    const out = [];
    const s = JobsStore.stats();
    const jobs = JobsStore.state.jobs;
    const today = jobsToday();

    if (!jobs.length) {
      out.push({
        severity: 'act', icon: '🧭', title: 'Start your career pipeline',
        detail: 'Import a job listing URL or add your first application manually — every metric, chart and reminder switches on from real records.',
        act: 'import',
      });
      return out;
    }

    if (s.overdue > 0) {
      out.push({
        severity: 'act', icon: '⚠️', title: `${s.overdue} follow-up${s.overdue === 1 ? ' is' : 's are'} overdue`,
        detail: 'Applications die from silence. Send the nudge, then set the next date — recruiters respond to persistence.',
        goto: { view: 'table', status: 'due' },
      });
    }
    if (s.deadlinesSoon > 0) {
      out.push({
        severity: 'act', icon: '⏳', title: `${s.deadlinesSoon} deadline${s.deadlinesSoon === 1 ? '' : 's'} closing soon`,
        detail: 'Saved roles you haven’t applied to yet close within days. Apply or consciously let them go.',
        goto: { view: 'calendar' },
      });
    }
    const offers = jobs.filter((j) => !j.archived && JobsStore.groupOf(j.status) === 'offer');
    if (offers.length) {
      out.push({
        severity: 'act', icon: '🎉', title: `${offers.length} offer${offers.length === 1 ? '' : 's'} on the table`,
        detail: `${esc(offers[0].company || 'One company')} is waiting on you. Review compensation against your fit notes before replying.`,
        goto: { view: 'table', status: offers[0].status },
      });
    }
    const noDate = jobs.filter((j) => JobsStore.isActive(j) && !j.followUpDate && JOBS_GROUP_ORDER[JobsStore.groupOf(j.status)] >= JOBS_GROUP_ORDER.applied);
    if (noDate.length) {
      out.push({
        severity: 'act', icon: '📅', title: `${noDate.length} active application${noDate.length === 1 ? ' has' : 's have'} no follow-up date`,
        detail: `Without a date they’re invisible to your routine. Start with ${esc(noDate[0].company || noDate[0].title || 'the first one')}.`,
        goto: { view: 'table' },
      });
    }
    if (s.stalled > 0) {
      out.push({
        severity: 'watch', icon: '🕸', title: `${s.stalled} application${s.stalled === 1 ? '' : 's'} stalled ${JobsStore.state.settings.stalledDays}+ days`,
        detail: 'No movement, no updates. Nudge the recruiter, or mark them Ghosted so your numbers stay honest.',
        goto: { view: 'table' },
      });
    }

    // Velocity — this week vs previous week
    const weekAgo = new Date(Date.now() - 7 * 86400000), twoWeeks = new Date(Date.now() - 14 * 86400000);
    const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const thisWeek = jobs.filter((j) => j.appliedDate && j.appliedDate >= dstr(weekAgo)).length;
    const lastWeek = jobs.filter((j) => j.appliedDate && j.appliedDate >= dstr(twoWeeks) && j.appliedDate < dstr(weekAgo)).length;
    if (thisWeek === 0 && lastWeek === 0 && s.active > 0 && s.appliedTotal > 0) {
      out.push({
        severity: 'watch', icon: '📉', title: 'No applications sent in 2 weeks',
        detail: 'Momentum compounds — even 2–3 tailored applications a week keeps the funnel alive.',
      });
    } else if (thisWeek > lastWeek && thisWeek >= 3) {
      out.push({
        severity: 'win', icon: '🚀', title: `${thisWeek} applications this week — up from ${lastWeek}`,
        detail: 'Volume is climbing. Keep tailoring the top of each resume to the Problem the role is hiring to solve.',
      });
    }

    // Response & conversion quality (only with enough data)
    if (s.appliedTotal >= 8 && s.responseRate !== null) {
      const pct = Math.round(s.responseRate * 100);
      if (s.responseRate < 0.1) {
        out.push({
          severity: 'watch', icon: '✉️', title: `Response rate is ${pct}%`,
          detail: 'Under 10% usually means generic applications. Mirror the job’s own language in your resume headline and first bullet.',
        });
      } else if (s.responseRate >= 0.25) {
        out.push({
          severity: 'win', icon: '💪', title: `${pct}% of applications get responses`,
          detail: 'Your targeting works. Spend the saved effort on interview prep for the ones in play.',
        });
      }
    }
    if (s.appliedTotal >= 10 && s.interviewRate !== null && s.interviewRate < 0.08) {
      out.push({
        severity: 'watch', icon: '🎤', title: `Only ${Math.round(s.interviewRate * 100)}% reach interviews`,
        detail: 'Screens aren’t converting. Review which resume version you send — the Documents section tracks it per application.',
      });
    }

    // Source intelligence
    const bySource = {};
    jobs.forEach((j) => {
      if (!j.appliedDate) return;
      const k = j.source || 'other';
      const b = (bySource[k] ??= { applied: 0, responded: 0 });
      b.applied++;
      if (JobsStore.reached(j, 'assessment')) b.responded++;
    });
    const sources = Object.entries(bySource).filter(([, b]) => b.applied >= 3);
    if (sources.length >= 2) {
      const rate = ([, b]) => b.responded / b.applied;
      const best = sources.reduce((a, b) => (rate(b) > rate(a) ? b : a));
      if (rate(best) > 0) {
        out.push({
          severity: 'watch', icon: '🎯', title: `${JOBS_SOURCE_INDEX[best[0]]?.label || best[0]} is your best source`,
          detail: `${Math.round(rate(best) * 100)}% of applications there get responses (${best[1].responded} of ${best[1].applied}). Prioritize it this week.`,
        });
      }
    }

    // Ghosted pattern
    const ghosted = jobs.filter((j) => j.status === 'ghosted').length;
    if (ghosted >= 3 && s.appliedTotal > 0 && ghosted / s.appliedTotal > 0.3) {
      out.push({
        severity: 'watch', icon: '👻', title: `${ghosted} applications ghosted`,
        detail: 'A high ghost rate is normal on big boards — balance with referral and direct-recruiter applications, which get answered far more often.',
      });
    }

    if (s.interviewsUpcoming > 0) {
      out.push({
        severity: 'win', icon: '🗓', title: `${s.interviewsUpcoming} interview${s.interviewsUpcoming === 1 ? '' : 's'} coming up`,
        detail: 'Prep notes and questions-to-ask live inside each interview entry. Fill them the day before, not the hour before.',
        goto: { view: 'calendar' },
      });
    }
    if (s.accepted > 0) {
      out.push({
        severity: 'win', icon: '🏆', title: 'Offer accepted!',
        detail: 'Archive the rest of the pipeline gracefully — and send thank-yous to every contact who helped.',
      });
    }

    if (out.length === 0) {
      out.push({
        severity: 'win', icon: '✅', title: 'Pipeline is healthy',
        detail: 'Nothing overdue, nothing stalled. Keep the weekly application rhythm going.',
      });
    }
    const order = { act: 0, watch: 1, win: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    return out;
  }

  function insightCard(i) {
    const link = i.goto || i.act;
    return `
      <article class="insight insight--${i.severity}" ${i.goto ? `data-goto-view='${esc(JSON.stringify(i.goto))}'` : ''} ${i.act ? `data-ins-act="${i.act}"` : ''} ${link ? 'role="link" tabindex="0"' : ''}>
        <span class="insight__icon">${i.icon}</span>
        <div>
          <h3 class="insight__title">${i.title}</h3>
          <p class="insight__detail">${i.detail}</p>
        </div>
        ${link ? '<span class="insight__go">→</span>' : ''}
      </article>`;
  }

  /* ══════════════ Career Dashboard ══════════════ */

  function renderDashboard() {
    const s = JobsStore.stats();
    const kpi = (id, label, value, extra = '', cls = '') => `
      <div class="crm-stat crm-stat--link ${cls}" data-kpi="${id}" role="button" tabindex="0">
        <p class="crm-stat__label">${label}</p>
        <p class="crm-stat__value">${value}${extra ? ` <span class="crm-stat__extra">${extra}</span>` : ''}</p>
      </div>`;
    $('#jobsKpis').innerHTML = [
      kpi('active', 'Active Applications', s.active),
      kpi('week', 'Applied This Week', s.appliedWeek),
      kpi('month', 'Applied This Month', s.appliedMonth),
      kpi('interviews', 'Interviews Upcoming', s.interviewsUpcoming, '', s.interviewsUpcoming ? 'crm-stat--won' : ''),
      kpi('offers', 'Offers', s.offers, '', s.offers ? 'crm-stat--won' : ''),
      kpi('due', 'Due Today', s.dueToday, s.overdue ? `+${s.overdue} overdue` : '', (s.dueToday + s.overdue) ? 'crm-stat--alert' : ''),
      kpi('rate', 'Interview Rate', s.interviewRate === null ? '—' : `${Math.round(s.interviewRate * 100)}%`),
      kpi('total', 'Total Tracked', s.total),
    ].join('');

    const list = health();
    $('#jobsAttention').innerHTML = list.slice(0, 5).map(insightCard).join('');

    // Funnel (ever-reached groups → honest even after rejections)
    const funnelWrap = $('#jdFunnel');
    if (s.appliedTotal > 0) {
      $('#jdFunnelHead').innerHTML = `${s.appliedTotal} application${s.appliedTotal === 1 ? '' : 's'} submitted — <strong>${s.responseRate === null ? 0 : Math.round(s.responseRate * 100)}%</strong> got a response.`;
      funnelWrap.innerHTML = Charts.funnelChart([
        { label: 'Applied', count: s.appliedTotal },
        { label: 'Screening', count: s.reachedAssessment },
        { label: 'Interviewing', count: s.reachedInterview },
        { label: 'Offer', count: s.reachedOffer },
        { label: 'Accepted', count: s.accepted },
      ]);
      $('#jdFunnelCard').classList.remove('is-empty');
    } else {
      $('#jdFunnelHead').textContent = 'Submit your first application to unlock the funnel.';
      funnelWrap.innerHTML = '';
      $('#jdFunnelCard').classList.add('is-empty');
    }

    // Applications over time (last 8 weeks)
    const buckets = [];
    for (let k = 7; k >= 0; k--) {
      const start = new Date(Date.now() - (k * 7 + 6) * 86400000);
      const end = new Date(Date.now() - k * 7 * 86400000);
      const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const n = JobsStore.state.jobs.filter((j) => j.appliedDate && j.appliedDate >= ds(start) && j.appliedDate <= ds(end)).length;
      buckets.push({ label: k === 0 ? 'Now' : `−${k}w`, value: n });
    }
    if (buckets.some((b) => b.value > 0)) {
      $('#jdVolumeHead').innerHTML = `Applications per week — last 8 weeks.`;
      $('#jdVolume').innerHTML = Charts.barChart(buckets, (n) => String(n));
      $('#jdVolumeCard').classList.remove('is-empty');
    } else {
      $('#jdVolumeHead').textContent = 'Apply to a few roles and your weekly rhythm shows up here.';
      $('#jdVolume').innerHTML = '';
      $('#jdVolumeCard').classList.add('is-empty');
    }

    // By status (current, active only)
    const byStatus = {};
    JobsStore.state.jobs.forEach((j) => { if (!j.archived) byStatus[j.status] = (byStatus[j.status] || 0) + 1; });
    const statusRows = JobsStore.statuses()
      .filter((st) => byStatus[st.id])
      .map((st) => ({ label: st.label, value: byStatus[st.id] / Math.max(s.total, 1), text: String(byStatus[st.id]), sub: '' }));
    if (statusRows.length) {
      $('#jdStatusHead').textContent = 'Where every application currently sits.';
      $('#jdStatus').innerHTML = Charts.hBarChart(statusRows.slice(0, 8));
      $('#jdStatusCard').classList.remove('is-empty');
    } else {
      $('#jdStatusHead').textContent = 'Add applications to see the status breakdown.';
      $('#jdStatus').innerHTML = '';
      $('#jdStatusCard').classList.add('is-empty');
    }
  }

  /* ══════════════ Kanban board ══════════════ */

  let dragState = null;

  function renderBoard() {
    const board = $('#jobsBoard');
    const statuses = JobsStore.statuses();
    const jobs = JobsStore.state.jobs.filter((j) => !j.archived);
    const byStatus = {};
    statuses.forEach((st) => { byStatus[st.id] = []; });
    jobs.forEach((j) => { (byStatus[j.status] ??= []).push(j); });

    board.innerHTML = statuses.map((st) => `
      <section class="jb-col" data-status="${esc(st.id)}">
        <header class="jb-col__head">
          <span class="badge jbadge--${st.color}">${esc(st.label)}</span>
          <span class="jb-col__count">${byStatus[st.id].length}</span>
        </header>
        <div class="jb-col__cards">${byStatus[st.id].map(JobsRender.kanbanCard).join('') || '<p class="jb-col__empty">Drop here</p>'}</div>
      </section>`).join('');
  }

  function bindBoard() {
    const board = $('#jobsBoard');

    board.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.jb-card');
      if (!card || e.button !== 0) return;
      dragState = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, started: false, clone: null, pid: e.pointerId };
    });

    board.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
      if (!dragState.started) {
        if (Math.hypot(dx, dy) < 6) return;
        dragState.started = true;
        const r = dragState.card.getBoundingClientRect();
        const clone = dragState.card.cloneNode(true);
        clone.className = 'jb-card jb-card--ghost';
        clone.style.width = `${r.width}px`;
        clone.style.left = `${r.left}px`;
        clone.style.top = `${r.top}px`;
        document.body.appendChild(clone);
        dragState.clone = clone;
        dragState.offX = e.clientX - r.left;
        dragState.offY = e.clientY - r.top;
        dragState.card.classList.add('is-dragging');
        try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        document.body.classList.add('jb-no-select');
      }
      dragState.clone.style.left = `${e.clientX - dragState.offX}px`;
      dragState.clone.style.top = `${e.clientY - dragState.offY}px`;
      // hit-test the column under the pointer
      dragState.clone.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const col = under && under.closest('.jb-col');
      board.querySelectorAll('.jb-col.is-over').forEach((c) => c.classList.remove('is-over'));
      if (col) { col.classList.add('is-over'); dragState.overStatus = col.dataset.status; }
      else dragState.overStatus = null;
      // edge auto-scroll
      const br = board.getBoundingClientRect();
      if (e.clientX > br.right - 60) board.scrollLeft += 14;
      else if (e.clientX < br.left + 60) board.scrollLeft -= 14;
    });

    const endDrag = (e) => {
      if (!dragState) return;
      const { started, clone, id, overStatus, card } = dragState;
      if (clone) clone.remove();
      card.classList.remove('is-dragging');
      board.querySelectorAll('.jb-col.is-over').forEach((c) => c.classList.remove('is-over'));
      document.body.classList.remove('jb-no-select');
      const wasDrag = started;
      dragState = null;
      if (wasDrag) {
        if (overStatus && JobsStore.get(id) && JobsStore.get(id).status !== overStatus) {
          JobsStore.setStatus(id, overStatus);
          cb.toast(`Moved to ${JobsStore.status(overStatus).label}.`);
        }
        // swallow the click that follows a drag
        board.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      }
    };
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', endDrag);

    board.addEventListener('click', (e) => {
      const card = e.target.closest('.jb-card');
      if (card) cb.openDrawer(card.dataset.id);
    });

    // Keyboard: Enter/Space opens the status menu; [ and ] move a column.
    board.addEventListener('keydown', (e) => {
      const card = e.target.closest('.jb-card');
      if (!card) return;
      const id = card.dataset.id;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cb.openStatusMenu(card, [id]);
      } else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const statuses = JobsStore.statuses();
        const job = JobsStore.get(id);
        const i = statuses.findIndex((st) => st.id === job.status);
        const ni = e.key === ']' ? Math.min(statuses.length - 1, i + 1) : Math.max(0, i - 1);
        if (ni !== i) {
          JobsStore.setStatus(id, statuses[ni].id);
          cb.toast(`Moved to ${statuses[ni].label}.`);
          requestAnimationFrame(() => {
            const moved = board.querySelector(`.jb-card[data-id="${id}"]`);
            if (moved) { moved.focus(); moved.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
          });
        }
      }
    });
  }

  /* ══════════════ Calendar / agenda ══════════════ */

  const cal = { mode: window.innerWidth <= 640 ? 'agenda' : 'month', year: null, month: null, selected: null };

  function calInit() {
    const now = new Date();
    if (cal.year === null) { cal.year = now.getFullYear(); cal.month = now.getMonth(); }
  }

  const EVENT_META = {
    interview: { dot: 'jb-ev--interview', label: 'Interview' },
    deadline: { dot: 'jb-ev--deadline', label: 'Deadline' },
    followup: { dot: 'jb-ev--followup', label: 'Follow-up' },
    task: { dot: 'jb-ev--task', label: 'Task' },
  };

  function renderCalendar() {
    calInit();
    $('#jobsCalModeMonth').classList.toggle('is-active', cal.mode === 'month');
    $('#jobsCalModeAgenda').classList.toggle('is-active', cal.mode === 'agenda');
    $('#jobsCalGridWrap').hidden = cal.mode !== 'month';
    $('#jobsCalNav').hidden = cal.mode !== 'month';
    if (cal.mode === 'month') renderMonth();
    renderAgenda();
  }

  function renderMonth() {
    const first = new Date(cal.year, cal.month, 1);
    const last = new Date(cal.year, cal.month + 1, 0);
    const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const events = JobsStore.agendaEvents(ds(first), ds(last));
    const byDay = {};
    events.forEach((ev) => { (byDay[ev.date] ??= []).push(ev); });

    $('#jobsCalTitle').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const today = jobsToday();
    const startPad = first.getDay(); // Sunday start
    const cells = [];
    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dows.forEach((d) => cells.push(`<div class="jb-cal__dow">${d}</div>`));
    for (let i = 0; i < startPad; i++) cells.push('<div class="jb-cal__cell jb-cal__cell--pad"></div>');
    for (let day = 1; day <= last.getDate(); day++) {
      const date = ds(new Date(cal.year, cal.month, day));
      const evs = byDay[date] || [];
      const isToday = date === today;
      const isSel = date === cal.selected;
      cells.push(`
        <button class="jb-cal__cell ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''} ${evs.length ? 'has-events' : ''}" data-cal-day="${date}">
          <span class="jb-cal__num">${day}</span>
          <span class="jb-cal__dots">${evs.slice(0, 3).map((ev) => `<i class="${EVENT_META[ev.type]?.dot || ''}" title="${esc(ev.label)}"></i>`).join('')}${evs.length > 3 ? `<em>+${evs.length - 3}</em>` : ''}</span>
        </button>`);
    }
    $('#jobsCalGrid').innerHTML = cells.join('');
  }

  function renderAgenda() {
    const today = jobsToday();
    let title, events;
    if (cal.mode === 'month' && cal.selected) {
      title = new Date(cal.selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      events = JobsStore.agendaEvents(cal.selected, cal.selected);
    } else {
      const horizon = new Date(Date.now() + 30 * 86400000);
      const hs = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, '0')}-${String(horizon.getDate()).padStart(2, '0')}`;
      title = cal.mode === 'agenda' ? 'Next 30 days' : 'Coming up';
      const overdue = JobsStore.agendaEvents(null, today).filter((ev) => ev.date < today && !ev.done);
      events = [...overdue.map((ev) => ({ ...ev, overdue: true })), ...JobsStore.agendaEvents(today, hs)];
    }
    $('#jobsCalAgendaTitle').textContent = title;
    if (!events.length) {
      $('#jobsCalAgenda').innerHTML = '<p class="jb-agenda__empty">Nothing scheduled — deadlines, interviews, follow-ups and tasks with dates all show up here.</p>';
      return;
    }
    let lastDate = null;
    $('#jobsCalAgenda').innerHTML = events.map((ev) => {
      const dateHead = ev.date !== lastDate
        ? `<p class="jb-agenda__day ${ev.overdue ? 'is-overdue' : ''}">${ev.overdue ? '⚠ Overdue · ' : ''}${new Date(ev.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>`
        : '';
      lastDate = ev.date;
      return `${dateHead}
        <button class="jb-agenda__item ${ev.done ? 'is-done' : ''}" data-open-job="${ev.jobId}">
          <i class="${EVENT_META[ev.type]?.dot || ''}"></i>
          <span class="jb-agenda__label">${esc(ev.label)}${ev.time ? ` · ${esc(ev.time)}` : ''}</span>
          <span class="jb-agenda__sub">${esc(ev.sub || '')}</span>
        </button>`;
    }).join('');
  }

  function bindCalendar() {
    $('#jobsCalModeMonth').addEventListener('click', () => { cal.mode = 'month'; renderCalendar(); });
    $('#jobsCalModeAgenda').addEventListener('click', () => { cal.mode = 'agenda'; cal.selected = null; renderCalendar(); });
    $('#jobsCalPrev').addEventListener('click', () => { cal.month--; if (cal.month < 0) { cal.month = 11; cal.year--; } cal.selected = null; renderCalendar(); });
    $('#jobsCalNext').addEventListener('click', () => { cal.month++; if (cal.month > 11) { cal.month = 0; cal.year++; } cal.selected = null; renderCalendar(); });
    $('#jobsCalToday').addEventListener('click', () => { const n = new Date(); cal.year = n.getFullYear(); cal.month = n.getMonth(); cal.selected = jobsToday(); renderCalendar(); });
    $('#jobsCalGrid').addEventListener('click', (e) => {
      const cell = e.target.closest('[data-cal-day]');
      if (!cell) return;
      cal.selected = cal.selected === cell.dataset.calDay ? null : cell.dataset.calDay;
      renderCalendar();
    });
    $('#jobsCalAgenda').addEventListener('click', (e) => {
      const item = e.target.closest('[data-open-job]');
      if (item) cb.openDrawer(item.dataset.openJob);
    });
  }

  /* ══════════════ Reports ══════════════ */

  const RPT_PERIODS = [
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
    { id: 'quarter', label: 'This quarter' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom…' },
  ];
  const rpt = { period: 'month', from: null, to: null };

  function rptRange() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    switch (rpt.period) {
      case 'week': { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return { from: iso(start), to: iso(now) }; }
      case 'month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
      case 'last-month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
      case 'quarter': { const qm = Math.floor(m / 3) * 3; return { from: iso(new Date(y, qm, 1)), to: iso(new Date(y, qm + 3, 0)) }; }
      case 'custom': return { from: rpt.from || '0000-01-01', to: rpt.to || '9999-12-31' };
      default: return { from: '0000-01-01', to: '9999-12-31' };
    }
  }
  const rptLabel = () => rpt.period === 'custom'
    ? `${rpt.from || 'start'} → ${rpt.to || 'today'}`
    : RPT_PERIODS.find((p) => p.id === rpt.period).label;

  const localDay = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const inRange = (dateStr, r) => {
    if (!dateStr) return false;
    const day = dateStr.includes('T') ? localDay(dateStr) : dateStr.slice(0, 10);
    return day >= r.from && day <= r.to;
  };

  /** First moment a job's history reached a group (ISO ts or null). */
  function reachedAt(job, groupId) {
    const target = JOBS_GROUP_ORDER[groupId];
    const hit = job.statusHistory.find((h) => {
      const g = JobsStore.groupOf(h.status);
      return g !== 'lost' && JOBS_GROUP_ORDER[g] >= target;
    });
    return hit ? hit.at : null;
  }

  function rptData() {
    const r = rptRange();
    const jobs = JobsStore.state.jobs;
    const applied = jobs.filter((j) => j.appliedDate && inRange(j.appliedDate, r));
    const responded = applied.filter((j) => JobsStore.reached(j, 'assessment'));
    const interviewed = applied.filter((j) => JobsStore.reached(j, 'interviewing'));
    const offered = applied.filter((j) => JobsStore.reached(j, 'offer'));
    const interviewsHeld = jobs.flatMap((j) => j.interviews.filter((iv) => iv.at && inRange(iv.at.slice(0, 10), r)));
    const rejected = jobs.filter((j) => j.status === 'rejected' && j.statusHistory.some((h) => h.status === 'rejected' && inRange(h.at, r)));
    const withdrawn = jobs.filter((j) => j.status === 'withdrawn' && j.statusHistory.some((h) => h.status === 'withdrawn' && inRange(h.at, r)));
    const active = jobs.filter((j) => JobsStore.isActive(j));
    return { r, applied, responded, interviewed, offered, interviewsHeld, rejected, withdrawn, active };
  }

  function rptVolumeBuckets(r, applied) {
    const from = new Date(r.from + 'T00:00:00');
    const to = new Date((r.to === '9999-12-31' ? jobsToday() : r.to) + 'T00:00:00');
    const start = r.from === '0000-01-01'
      ? new Date(Math.min(...JobsStore.state.jobs.filter((j) => j.appliedDate).map((j) => new Date(j.appliedDate + 'T00:00:00').getTime()), to.getTime()))
      : from;
    const spanDays = Math.max(1, Math.round((to - start) / 86400000));
    const buckets = [];
    if (spanDays <= 14) {
      for (let t = start.getTime(); t <= to.getTime(); t += 86400000) {
        const d = new Date(t);
        const day = localDay(d);
        buckets.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: applied.filter((j) => j.appliedDate === day).length });
      }
    } else if (spanDays <= 100) {
      let ws = new Date(start); let i = 1;
      while (ws <= to) {
        const we = new Date(Math.min(ws.getTime() + 6 * 86400000, to.getTime()));
        buckets.push({ label: `W${i}`, value: applied.filter((j) => j.appliedDate >= localDay(ws) && j.appliedDate <= localDay(we)).length });
        ws = new Date(we.getTime() + 86400000); i++;
      }
    } else {
      const months = Math.min(12, Math.ceil(spanDays / 30));
      const now = to;
      for (let k = months - 1; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), value: applied.filter((j) => j.appliedDate.slice(0, 7) === ym).length });
      }
    }
    return buckets;
  }

  function renderReports() {
    $('#jobsRptPeriods').innerHTML = RPT_PERIODS.map((p) =>
      `<button class="chip ${p.id === rpt.period ? 'is-active' : ''}" data-jobs-period="${p.id}">${p.label}</button>`).join('');
    $('#jobsRptCustom').hidden = rpt.period !== 'custom';

    const d = rptData();
    const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
    $('#jobsRptStats').innerHTML = [
      ['Submitted', d.applied.length], ['Responses', d.responded.length],
      ['Interviews held', d.interviewsHeld.length], ['Offers', d.offered.length],
      ['Rejections', d.rejected.length], ['Withdrawn', d.withdrawn.length],
      ['Still active', d.active.length],
      ['Response rate', pct(d.responded.length, d.applied.length)],
      ['Interview rate', pct(d.interviewed.length, d.applied.length)],
      ['Offer rate', pct(d.offered.length, d.applied.length)],
    ].map(([label, value]) => `<div class="crm-stat"><p class="crm-stat__label">${label}</p><p class="crm-stat__value">${value}</p></div>`).join('');

    $('#jobsRptHealth').innerHTML = health().map(insightCard).join('');

    // Volume
    if (d.applied.length) {
      $('#jrVolumeHead').innerHTML = `You submitted <strong>${d.applied.length}</strong> application${d.applied.length === 1 ? '' : 's'} — ${rptLabel().toLowerCase()}.`;
      $('#jrVolume').innerHTML = Charts.barChart(rptVolumeBuckets(d.r, d.applied), (n) => String(n));
      $('#jrVolumeCard').classList.remove('is-empty');
    } else {
      $('#jrVolumeHead').textContent = `No applications submitted ${rptLabel().toLowerCase()} — the chart unlocks with your first one.`;
      $('#jrVolume').innerHTML = '';
      $('#jrVolumeCard').classList.add('is-empty');
    }

    // Funnel for the period
    if (d.applied.length) {
      $('#jrFunnelHead').innerHTML = `Of ${d.applied.length} submitted, <strong>${d.interviewed.length}</strong> reached interviews and <strong>${d.offered.length}</strong> got offers.`;
      $('#jrFunnel').innerHTML = Charts.funnelChart([
        { label: 'Applied', count: d.applied.length },
        { label: 'Response', count: d.responded.length },
        { label: 'Interview', count: d.interviewed.length },
        { label: 'Offer', count: d.offered.length },
      ]);
      $('#jrFunnelCard').classList.remove('is-empty');
    } else {
      $('#jrFunnelHead').textContent = 'The funnel needs at least one submitted application in this period.';
      $('#jrFunnel').innerHTML = '';
      $('#jrFunnelCard').classList.add('is-empty');
    }

    // Source effectiveness (all-time within period)
    const bySource = {};
    d.applied.forEach((j) => {
      const k = j.source || 'other';
      const b = (bySource[k] ??= { applied: 0, responded: 0 });
      b.applied++;
      if (JobsStore.reached(j, 'assessment')) b.responded++;
    });
    const srcRows = Object.entries(bySource)
      .map(([id, b]) => ({
        label: JOBS_SOURCE_INDEX[id]?.label || id,
        value: b.applied ? b.responded / b.applied : 0,
        text: `${Math.round((b.responded / Math.max(b.applied, 1)) * 100)}% of ${b.applied}`,
        sub: `${b.responded} response${b.responded === 1 ? '' : 's'}`,
      }))
      .sort((a, b) => b.value - a.value);
    if (srcRows.length) {
      $('#jrSourceHead').innerHTML = `<strong>${esc(srcRows[0].label)}</strong> gets the best response rate ${rptLabel().toLowerCase()}.`;
      $('#jrSource').innerHTML = Charts.hBarChart(srcRows.slice(0, 7));
      $('#jrSourceCard').classList.remove('is-empty');
    } else {
      $('#jrSourceHead').textContent = 'Apply via a few different sources and this shows which ones actually answer.';
      $('#jrSource').innerHTML = '';
      $('#jrSourceCard').classList.add('is-empty');
    }

    // Stage timing (uses statusHistory timestamps — real data only)
    const timings = [];
    const avg = (arr) => (arr.length ? arr.reduce((t, n) => t + n, 0) / arr.length : null);
    const days = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 86400000);
    const dResp = avg(d.responded.map((j) => {
      const at = reachedAt(j, 'assessment');
      return at && j.appliedDate ? days(j.appliedDate + 'T00:00:00', at) : null;
    }).filter((n) => n !== null));
    const dIv = avg(d.interviewed.map((j) => {
      const at = reachedAt(j, 'interviewing');
      return at && j.appliedDate ? days(j.appliedDate + 'T00:00:00', at) : null;
    }).filter((n) => n !== null));
    const dOf = avg(d.offered.map((j) => {
      const iv = reachedAt(j, 'interviewing'), of = reachedAt(j, 'offer');
      return iv && of ? days(iv, of) : null;
    }).filter((n) => n !== null));
    if (dResp !== null) timings.push(`Applied → first response: <strong>${dResp.toFixed(1)} days</strong> on average.`);
    if (dIv !== null) timings.push(`Applied → interview: <strong>${dIv.toFixed(1)} days</strong> on average.`);
    if (dOf !== null) timings.push(`Interview → offer: <strong>${dOf.toFixed(1)} days</strong> on average.`);
    $('#jrTiming').innerHTML = timings.length
      ? timings.map((t) => `<p class="jr-timing__row">${t}</p>`).join('')
      : '<p class="jr-timing__row cell-dim">Stage timing unlocks once applications move through screening and interviews.</p>';
  }

  function bindReports() {
    $('#jobsRptPeriods').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-jobs-period]');
      if (!chip) return;
      rpt.period = chip.dataset.jobsPeriod;
      renderReports();
    });
    $('#jobsRptFrom').addEventListener('change', (e) => { rpt.from = e.target.value || null; renderReports(); });
    $('#jobsRptTo').addEventListener('change', (e) => { rpt.to = e.target.value || null; renderReports(); });
    $('#jobsRptPrint').addEventListener('click', () => {
      buildReport();
      document.body.classList.add('is-printing');
      setTimeout(() => { window.print(); document.body.classList.remove('is-printing'); }, 60);
    });
    $('#jobsRptCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(reportAsText());
        cb.toast('Report copied — paste it anywhere.');
      } catch (e) { cb.toast('Could not access the clipboard.', 'error'); }
    });
  }

  /* ── Print report ───────────────────────────────────────── */

  function buildReport() {
    const d = rptData();
    const insights = health();
    const sevLabel = { act: 'ACT', watch: 'WATCH', win: 'WIN' };
    const upcoming = JobsStore.agendaEvents(jobsToday(), localDay(new Date(Date.now() + 14 * 86400000)));
    $('#jobsReportView').innerHTML = `
      <div class="report">
        <header class="report__head">
          <span class="brand__mark">V</span>
          <div>
            <h1>Career Pipeline Report — ${esc(rptLabel())}</h1>
            <p>Generated ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Vaugn Studio</p>
          </div>
        </header>
        <section class="report__stats">
          <div><strong>${d.applied.length}</strong><span>Submitted</span></div>
          <div><strong>${d.interviewed.length}</strong><span>Reached interview</span></div>
          <div><strong>${d.offered.length}</strong><span>Offers</span></div>
          <div><strong>${d.active.length}</strong><span>Still active</span></div>
        </section>
        <section>
          <h2>Career pipeline health</h2>
          ${insights.slice(0, 6).map((i) => `<p class="report__insight"><strong>[${sevLabel[i.severity]}]</strong> ${i.icon} <strong>${i.title}.</strong> ${i.detail}</p>`).join('')}
        </section>
        <section><h2>Applications</h2>${$('#jrVolume').innerHTML || '<p class="report__none">No applications in this period.</p>'}</section>
        <section><h2>Funnel</h2>${$('#jrFunnel').innerHTML || '<p class="report__none">No submitted applications in this period.</p>'}</section>
        <section><h2>Sources</h2>${$('#jrSource').innerHTML || '<p class="report__none">No source data yet.</p>'}</section>
        <section class="report__cols">
          <div><h2>Offers (${d.offered.length})</h2>${d.offered.map((j) => `<p>🏆 ${esc(j.company || 'Company')} — ${esc(j.title || '')}</p>`).join('') || '<p class="report__none">None yet — keep going.</p>'}</div>
          <div><h2>Next 14 days</h2>${upcoming.slice(0, 8).map((ev) => `<p>${JobsRender.shortDate(ev.date)} — ${esc(ev.label)}</p>`).join('') || '<p class="report__none">Nothing scheduled.</p>'}</div>
        </section>
        <footer class="report__foot">Response rate ${d.applied.length ? Math.round((d.responded.length / d.applied.length) * 100) : 0}% · Interview rate ${d.applied.length ? Math.round((d.interviewed.length / d.applied.length) * 100) : 0}% · Data stays on your device</footer>
      </div>`;
    return { d, insights };
  }

  function reportAsText() {
    const { d, insights } = buildReport();
    return [
      `CAREER PIPELINE REPORT — ${rptLabel().toUpperCase()} · ${new Date().toLocaleDateString()}`,
      '',
      `Submitted: ${d.applied.length} · Responses: ${d.responded.length} · Interviews: ${d.interviewed.length} · Offers: ${d.offered.length}`,
      `Rejections: ${d.rejected.length} · Withdrawn: ${d.withdrawn.length} · Still active: ${d.active.length}`,
      '',
      'CAREER PIPELINE HEALTH:',
      ...insights.slice(0, 6).map((i) => `• [${i.severity.toUpperCase()}] ${i.title} — ${i.detail.replace(/<[^>]+>/g, '')}`),
      '',
      '— Generated by Vaugn Studio · Career Pipeline',
    ].join('\n');
  }

  /* ── Boot ───────────────────────────────────────────────── */

  function bind(callbacks) {
    cb = callbacks;
    bindBoard();
    bindCalendar();
    bindReports();

    // Dashboard interactions
    $('#jobsKpis').addEventListener('click', (e) => {
      const stat = e.target.closest('[data-kpi]');
      if (!stat) return;
      switch (stat.dataset.kpi) {
        case 'due': cb.gotoTable({ status: 'due' }); break;
        case 'interviews': cb.gotoView('calendar'); break;
        case 'week': case 'month': case 'rate': cb.gotoView('reports'); break;
        case 'offers': cb.gotoTable({ status: 'g-offer' }); break;
        default: cb.gotoTable({ status: 'all' });
      }
    });
    $('#jobsKpis').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('[data-kpi]')?.click(); });

    const insightsClick = (e) => {
      const card = e.target.closest('.insight');
      if (!card) return;
      if (card.dataset.insAct === 'import') { JobsImportUI.open(); return; }
      if (card.dataset.gotoView) {
        try {
          const g = JSON.parse(card.dataset.gotoView);
          if (g.status) cb.gotoTable({ status: g.status });
          else cb.gotoView(g.view || 'table');
        } catch (err) { /* ignore */ }
      }
    };
    $('#jobsAttention').addEventListener('click', insightsClick);
    $('#jobsRptHealth').addEventListener('click', insightsClick);
    [$('#jobsAttention'), $('#jobsRptHealth')].forEach((el) =>
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('.insight')?.click(); }));
  }

  return { renderDashboard, renderBoard, renderCalendar, renderReports, bind, health };
})();
