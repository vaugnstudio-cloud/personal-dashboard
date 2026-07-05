/* ============================================================
   insights.js — the built-in business advisor.
   Reads your real pipeline + dashboard data and produces
   specific, actionable tips. Pure rules, zero network — your
   data never leaves the browser.

   Insight: { severity: 'act'|'watch'|'win', icon, title, detail,
              goto?: url, help?: helpArticleId }
   ============================================================ */

const Insights = (() => {
  'use strict';

  // Insight text is rendered with innerHTML — every user-entered string
  // (lead names etc.) MUST pass through esc() to prevent XSS.
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const fmtMoney = (n) => new Intl.NumberFormat(undefined, {
    style: 'currency', currency: Store.state.settings.currency, maximumFractionDigits: 0,
  }).format(n || 0);

  const INCOME_METRICS = ['sideIncome', 'mrr', 'retainers', 'websiteIncome', 'affiliateIncome'];

  const LOSS_TIPS = {
    'no-reply': 'Most losses are silence. Tighten your follow-up cadence (3 touches, varied angles) and lead with the Problem Noticed, not your services.',
    budget: 'Price objections usually mean the value wasn’t framed. Anchor proposals to the cost of their problem, or add a smaller entry offer.',
    timing: '“Bad timing” deals aren’t dead — set a 60–90 day follow-up instead of archiving, and stay lightly in touch.',
    competitor: 'Losing to competitors means the shortlist is reachable. Ask one thing in your close-out message: “What made the difference?”',
    other: 'Review your lost-deal notes for a pattern — the reasons picker only helps if it matches reality.',
  };

  function generate() {
    const out = [];
    const leads = CrmStore.state.leads;
    const s = CrmStore.stats();
    const today = crmToday();

    /* ── No data yet → onboarding guidance instead of blanks ── */
    if (!leads.length) {
      out.push({
        severity: 'act', icon: '🧭', title: 'Your pipeline is empty',
        detail: 'Add your 3 warmest opportunities — even rough ones. Insights, charts and win rates all switch on from real leads.',
        goto: 'crm.html',
      });
    }
    const anyMetric = METRICS.some((m) => Store.get(m.id).value > 0);
    if (!anyMetric) {
      out.push({
        severity: 'act', icon: '📊', title: 'Fill in your dashboard numbers',
        detail: 'Money insights (expense ratio, runway, goal pacing) unlock once your Finance metrics have real values.',
        goto: 'index.html',
      });
    }

    /* ── Pipeline discipline ─────────────────────────────────── */
    if (s.overdue > 0) {
      out.push({
        severity: 'act', icon: '⚠️', title: `${s.overdue} follow-up${s.overdue === 1 ? ' is' : 's are'} overdue`,
        detail: 'Deals die from silence, not rejection. Clear these first — send the follow-up, then set the next date.',
        goto: 'crm.html#status=due',
      });
    }
    const noDate = leads.filter((l) => !l.archived && !['won', 'lost'].includes(l.status) && !l.followUpDate);
    if (noDate.length) {
      out.push({
        severity: 'act', icon: '📅', title: `${noDate.length} open lead${noDate.length === 1 ? ' has' : 's have'} no follow-up date`,
        detail: `A lead without a follow-up date is invisible to your daily routine. Start with ${esc(noDate[0].business) || 'the first one'}.`,
        goto: 'crm.html',
      });
    }
    const staleCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
    const stale = leads.filter((l) => !l.archived && !['won', 'lost'].includes(l.status) && l.updatedAt < staleCutoff);
    if (stale.length) {
      out.push({
        severity: 'watch', icon: '🕸', title: `${stale.length} deal${stale.length === 1 ? '' : 's'} untouched for 14+ days`,
        detail: `${esc(stale[0].business) || 'One'} and others are going cold. Advance them or archive them — a stale pipeline hides the real number.`,
        goto: 'crm.html',
      });
    }

    /* ── Pipeline coverage vs income goals (the killer one) ──── */
    const incomeGoal = INCOME_METRICS.reduce((t, id) => t + Store.get(id).goal, 0);
    const incomeNow = INCOME_METRICS.reduce((t, id) => t + Store.get(id).value, 0);
    const gap = incomeGoal - incomeNow;
    if (gap > 0 && s.winRate !== null && s.winRate > 0) {
      const needed = Math.round(gap / s.winRate);
      const decidedDeals = leads.filter((l) => l.dealValue > 0);
      const avgDeal = decidedDeals.length
        ? decidedDeals.reduce((t, l) => t + l.dealValue, 0) / decidedDeals.length : 0;
      if (s.pipelineValue < needed) {
        const missing = needed - s.pipelineValue;
        const nLeads = avgDeal > 0 ? Math.ceil(missing / avgDeal) : null;
        out.push({
          severity: 'act', icon: '🎯', title: 'Your pipeline can’t reach your income goal yet',
          detail: `Goal gap: ${fmtMoney(gap)}/mo. At your ${Math.round(s.winRate * 100)}% win rate you need ~${fmtMoney(needed)} in pipeline — you have ${fmtMoney(s.pipelineValue)}.${nLeads ? ` That's roughly ${nLeads} more lead${nLeads === 1 ? '' : 's'} at your average deal size.` : ''}`,
          goto: 'crm.html',
        });
      } else {
        out.push({
          severity: 'win', icon: '💪', title: 'Pipeline covers your income goal',
          detail: `You have ${fmtMoney(s.pipelineValue)} in play against a ${fmtMoney(gap)}/mo gap — now it's about follow-through, not volume.`,
        });
      }
    }

    /* ── Channel intelligence ────────────────────────────────── */
    const chStats = {};
    leads.forEach((l) => {
      const c = (chStats[l.channel] ??= { won: 0, lost: 0, contacted: 0, replied: 0, revenue: 0 });
      if (l.status === 'won') { c.won++; c.revenue += l.dealValue || 0; }
      if (l.status === 'lost') c.lost++;
      if (l.dateContacted) { c.contacted++; if (l.replied) c.replied++; }
    });
    const decided = Object.entries(chStats)
      .map(([id, c]) => ({ id, ...c, decided: c.won + c.lost, rate: c.won + c.lost > 0 ? c.won / (c.won + c.lost) : null }))
      .filter((c) => c.decided >= 2 && c.rate !== null);
    if (decided.length >= 2) {
      const best = decided.reduce((a, b) => (b.rate > a.rate ? b : a));
      const worst = decided.reduce((a, b) => (b.rate < a.rate ? b : a));
      if (best.rate >= worst.rate * 2 && best.rate > 0) {
        out.push({
          severity: 'watch', icon: '📣', title: `${CRM_CHANNEL_INDEX[best.id].label} closes ${worst.rate > 0 ? Math.round(best.rate / worst.rate) + '×' : 'far'} better than ${CRM_CHANNEL_INDEX[worst.id].label}`,
          detail: `${Math.round(best.rate * 100)}% vs ${Math.round(worst.rate * 100)}% win rate. Shift next week's outreach toward ${CRM_CHANNEL_INDEX[best.id].label.toLowerCase()} — same effort, more clients.`,
        });
      }
    }

    /* ── Conversion quality ──────────────────────────────────── */
    const proposals = leads.filter((l) => l.proposalSent);
    const proposalWins = proposals.filter((l) => l.status === 'won');
    if (proposals.length >= 3 && proposalWins.length / proposals.length < 0.3) {
      out.push({
        severity: 'watch', icon: '📄', title: `Only ${proposalWins.length} of ${proposals.length} proposals closed`,
        detail: 'Proposals are leaking. Send within 24h of the call, one price, outcome-first framing — the Proposal SOP has the structure.',
        help: 'proposal-sop',
      });
    }
    const contactedCount = leads.filter((l) => l.dateContacted).length;
    const repliedCount = leads.filter((l) => l.dateContacted && l.replied).length;
    if (contactedCount >= 5 && repliedCount / contactedCount < 0.15) {
      out.push({
        severity: 'watch', icon: '✉️', title: `Reply rate is ${Math.round((repliedCount / contactedCount) * 100)}%`,
        detail: 'Under 15% usually means the hook is generic. Make the first line about *their* specific problem (the Problem Noticed field exists for this).',
        help: 'sales-sop',
      });
    }
    const lossCounts = {};
    leads.filter((l) => l.status === 'lost' && l.lossReason).forEach((l) => {
      lossCounts[l.lossReason] = (lossCounts[l.lossReason] || 0) + 1;
    });
    const topLoss = Object.entries(lossCounts).sort((a, b) => b[1] - a[1])[0];
    if (topLoss && topLoss[1] >= 2) {
      const label = CRM_LOSS_REASONS.find((r) => r.id === topLoss[0])?.label || topLoss[0];
      out.push({
        severity: 'watch', icon: '🔍', title: `Most common loss reason: “${label}” (${topLoss[1]}×)`,
        detail: LOSS_TIPS[topLoss[0]] || LOSS_TIPS.other,
      });
    }

    /* ── Money health ────────────────────────────────────────── */
    const expenses = Store.get('expenses').value;
    const totalIncome = Store.get('salary').value + incomeNow;
    if (expenses > 0 && totalIncome > 0 && expenses / totalIncome > 0.8) {
      out.push({
        severity: 'act', icon: '💸', title: `Expenses eat ${Math.round((expenses / totalIncome) * 100)}% of your income`,
        detail: 'Above 80% leaves no room to save or absorb a slow month. Trim the two biggest recurring costs, or push one retainer to close.',
      });
    }
    const fund = Store.get('emergencyFund').value + Store.get('savings').value;
    if (expenses > 0 && fund > 0) {
      const months = fund / expenses;
      if (months < 3) {
        out.push({
          severity: 'watch', icon: '🛟', title: `Runway: ${months.toFixed(1)} months`,
          detail: `Your savings cover ${months.toFixed(1)} months of expenses. Freelancers sleep at 6+. Route the next won deal straight to the fund.`,
        });
      } else if (months >= 6) {
        out.push({
          severity: 'win', icon: '🛡', title: `${months.toFixed(1)} months of runway`,
          detail: 'A 6-month cushion means you can say no to bad clients. That is negotiating power.',
        });
      }
    }
    const mrr = Store.get('mrr').value;
    if (expenses > 0 && mrr >= expenses) {
      out.push({
        severity: 'win', icon: '🔁', title: 'Recurring revenue covers your bills',
        detail: `MRR (${fmtMoney(mrr)}) ≥ monthly expenses (${fmtMoney(expenses)}). Every project on top is pure growth.`,
      });
    }

    /* ── Momentum & celebration ──────────────────────────────── */
    if (s.wonThisMonth > 0) {
      out.push({
        severity: 'win', icon: '🎉', title: `${fmtMoney(s.wonThisMonth)} closed this month`,
        detail: 'Momentum is real. Note *why* these deals closed while it’s fresh — that’s next month’s playbook.',
      });
    }
    const almost = METRICS.filter((m) => {
      const st = Store.get(m.id);
      return m.direction === 'up' && st.goal > 0 && st.value / st.goal >= 0.9 && st.value / st.goal < 1;
    })[0];
    if (almost) {
      out.push({
        severity: 'win', icon: '🏁', title: `${almost.label} is at ${Math.round((Store.get(almost.id).value / Store.get(almost.id).goal) * 100)}% of goal`,
        detail: 'One push and it’s done — then raise the target while the momentum is hot.',
        goto: 'index.html',
      });
    }

    const order = { act: 0, watch: 1, win: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    return out;
  }

  return { generate };
})();
