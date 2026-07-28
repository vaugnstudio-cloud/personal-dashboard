/* ============================================================
   sample-data.js — sandboxed "Explore with sample data" mode.
   Safe by design:
   • Entering STASHES your real data first (dashboard, pipeline,
     history) — settings/theme/branding stay yours.
   • The sample is regenerated fresh on every entry, so it always
     looks pristine no matter what you changed last time.
   • Exiting restores your real data byte-identical.
   ============================================================ */

(function () {
  'use strict';

  const FLAG = 'vaugn.sample';
  const DATA_KEYS = ['vaugn.dashboard.v1', 'vaugn.crm.v1', 'vaugn.jobs.v1', 'vaugn.history.v1'];
  const STASH_PREFIX = 'vaugn.stash.';

  const $ = (sel) => document.querySelector(sel);
  const dayISO = (ago) => new Date(Date.now() - ago * 86400000).toISOString();
  const dayStr = (ago) => {
    const d = new Date(Date.now() - ago * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  const SampleData = {
    isActive() { return lsGet(FLAG) === '1'; },

    isAppEmpty() {
      const noLeads = !window.CrmStore || !CrmStore.state || CrmStore.state.leads.length === 0;
      const noJobs = !window.JobsStore || !JobsStore.state || JobsStore.state.jobs.length === 0;
      const noMetrics = !METRICS.some((m) => Store.get(m.id).value > 0);
      return noLeads && noJobs && noMetrics;
    },

    /** Enter sample mode. Stashes real data first (if any), then writes
        a freshly generated sample and reloads. Re-entering regenerates. */
    load() {
      if (!this.isActive()) {
        // Stash whatever is real right now — restored exactly on exit.
        DATA_KEYS.forEach((k) => {
          const v = lsGet(k);
          if (v !== null) lsSet(STASH_PREFIX + k.replace('vaugn.', ''), v);
        });
      }
      this.writeSample();
      lsSet(FLAG, '1');
      // Exploring counts as welcomed — no tour modals over demo data.
      lsSet('vaugn.dashboard.welcomed', '1');
      lsSet('vaugn.crm.welcomed', '1');
      lsSet('vaugn.jobs.welcomed', '1');
      lsSet('vaugn.reports.welcomed', '1');
      location.reload();
    },

    /** Exit sample mode: discard the sandbox, restore the stash. */
    clear() {
      DATA_KEYS.forEach(lsDel);
      DATA_KEYS.forEach((k) => {
        const stashKey = STASH_PREFIX + k.replace('vaugn.', '');
        const v = lsGet(stashKey);
        if (v !== null) { lsSet(k, v); lsDel(stashKey); }
      });
      lsDel(FLAG);
      location.reload();
    },

    /** Deterministic demo dataset — dates relative to today. */
    writeSample() {
      // Preserve the user's settings (theme, branding, currency, name…)
      const keepSettings = { ...Store.state.settings };
      const dash = Store.defaults();
      dash.settings = keepSettings;

      const vals = {
        salary: 3200, sideIncome: 950, savings: 6500, expenses: 1900, emergencyFund: 4200,
        mrr: 1500, clients: 3, leads: 7, retainers: 1500, websiteIncome: 420, affiliateIncome: 150,
        products: 2, templatesSold: 34, subscribers: 860, views: 48000, watchHours: 2100,
        hoursLearned: 46, hoursWorked: 132, weight: 172,
      };
      Object.entries(vals).forEach(([id, v]) => { if (dash.metrics[id]) dash.metrics[id].value = v; });
      dash.updatedAt = new Date().toISOString();
      lsSet('vaugn.dashboard.v1', JSON.stringify(dash));

      const mk = (patch) => ({ ...crmBlankLead(), ...patch });
      const leads = [
        mk({ business: 'BrightSmile Dental', industry: 'Dentistry', country: 'USA', website: 'https://brightsmiledental.com', decisionMaker: 'Dr. Maya Chen', email: 'maya@brightsmiledental.com', channel: 'cold-email', status: 'won', wonAt: dayISO(0), dealValue: 4500, dealType: 'one-off', replied: true, callBooked: true, proposalSent: true, dateContacted: dayStr(26), createdAt: dayISO(30), problem: 'Dated website, no online booking', offer: 'Redesign + booking flow', notes: 'Loved the case study. Paid 50% upfront.' }),
        mk({ business: 'CoreFit Studio', industry: 'Fitness', country: 'Canada', website: 'https://corefitstudio.ca', decisionMaker: 'Jordan Reyes', email: 'jordan@corefit.ca', channel: 'instagram', status: 'won', wonAt: dayISO(11), dealValue: 1500, dealType: 'retainer', replied: true, callBooked: true, proposalSent: true, dateContacted: dayStr(34), createdAt: dayISO(40), problem: 'Inconsistent social content', offer: 'Monthly design retainer', notes: 'Retainer — first invoice sent.' }),
        mk({ business: 'Harbor & Vine Bistro', industry: 'Restaurant', country: 'USA', website: 'https://harborvine.com', decisionMaker: 'Sofia Marchetti', email: 'sofia@harborvine.com', channel: 'referral', status: 'won', wonAt: dayISO(58), dealValue: 2800, dealType: 'one-off', replied: true, callBooked: true, proposalSent: true, dateContacted: dayStr(75), createdAt: dayISO(80), problem: 'Menu & brand refresh before summer', offer: 'Brand refresh package' }),
        mk({ business: 'Sterling Law Group', industry: 'Legal', country: 'UK', website: 'https://sterlinglaw.co.uk', decisionMaker: 'Amelia Hart', email: 'a.hart@sterlinglaw.co.uk', channel: 'linkedin', status: 'proposal-sent', replied: true, callBooked: true, proposalSent: true, dateContacted: dayStr(12), followUpDate: dayStr(-2), dealValue: 6800, dealType: 'one-off', createdAt: dayISO(15), updatedAt: dayISO(16), problem: 'Site looks templated; low trust for high-ticket clients', offer: 'Premium rebrand + site', notes: 'Partners went quiet after proposal v2 — needs a nudge.' }),
        mk({ business: 'Nova Skincare', industry: 'E-commerce', country: 'Australia', website: 'https://novaskincare.com.au', decisionMaker: 'Chloe Nguyen', email: 'chloe@novaskin.com.au', channel: 'instagram', status: 'call-booked', replied: true, callBooked: true, dateContacted: dayStr(8), followUpDate: dayStr(-1), dealValue: 3200, createdAt: dayISO(10), problem: 'Product pages don’t convert', offer: 'CRO-focused redesign', notes: 'Call booked Thursday 2pm.' }),
        mk({ business: 'Peak Performance Coaching', industry: 'Coaching', country: 'USA', website: 'https://peakcoach.co', decisionMaker: 'Marcus Bell', email: 'marcus@peakcoach.co', channel: 'linkedin', status: 'replied', replied: true, dateContacted: dayStr(5), followUpDate: dayStr(0), dealValue: 2400, createdAt: dayISO(7), problem: 'No landing page for new program', offer: 'Launch page + email design' }),
        mk({ business: 'GreenLeaf Wellness', industry: 'Health', country: 'USA', website: 'https://greenleafwellness.com', decisionMaker: 'Dr. Priya Sharma', email: 'priya@greenleaf.com', channel: 'cold-email', status: 'contacted', dateContacted: dayStr(3), followUpDate: dayStr(-3), dealValue: 1900, createdAt: dayISO(4), problem: 'Brand feels clinical, not calming', offer: 'Brand identity refresh' }),
        mk({ business: 'Atlas Roofing Co', industry: 'Construction', country: 'USA', website: 'https://atlasroofing.us', decisionMaker: 'Dan Kowalski', email: 'dan@atlasroofing.us', channel: 'cold-email', status: 'contacted', dateContacted: dayStr(2), followUpDate: dayStr(1), dealValue: 1400, createdAt: dayISO(3), problem: 'No reviews or gallery on site', offer: 'Trust-building site update' }),
        mk({ business: 'Luna Petcare', industry: 'Pet services', country: 'Canada', website: 'https://lunapetcare.ca', decisionMaker: 'Emma Fournier', email: 'emma@lunapet.ca', channel: 'website', status: 'lead', followUpDate: dayStr(-1), dealValue: 900, createdAt: dayISO(1), problem: 'Came via contact form — wants a quote', offer: 'Starter brand kit' }),
        mk({ business: 'Vertex Accounting', industry: 'Finance', country: 'USA', website: 'https://vertexcpa.com', decisionMaker: 'Robert Lin', email: 'r.lin@vertexcpa.com', channel: 'referral', status: 'lead', followUpDate: dayStr(-4), dealValue: 2100, createdAt: dayISO(2), problem: 'Referred by BrightSmile — tax season site crunch', offer: 'Site refresh before Q4' }),
        mk({ business: 'Urban Thread Apparel', industry: 'Fashion', country: 'USA', website: 'https://urbanthread.shop', decisionMaker: 'Tasha Green', email: 'tasha@urbanthread.shop', channel: 'instagram', status: 'lost', lossReason: 'budget', replied: true, dateContacted: dayStr(30), createdAt: dayISO(35), updatedAt: dayISO(14), dealValue: 2600, problem: 'Lookbook design for fall drop', notes: 'Budget went to inventory. Revisit next season.' }),
        mk({ business: 'Summit Real Estate', industry: 'Real estate', country: 'USA', website: 'https://summitrealty.com', decisionMaker: 'Greg Palmer', email: 'greg@summitrealty.com', channel: 'cold-email', status: 'lost', lossReason: 'no-reply', dateContacted: dayStr(28), createdAt: dayISO(32), updatedAt: dayISO(12), dealValue: 1800, problem: 'Listings page is unusable on mobile' }),
      ];
      leads.forEach((l) => { l.updatedAt = l.updatedAt || l.createdAt; });
      const crm = { leads, view: { visibleColumns: [...CRM_DEFAULT_COLUMNS], sortBy: 'followUpDate', sortDir: 'asc' }, updatedAt: new Date().toISOString() };
      lsSet('vaugn.crm.v1', JSON.stringify(crm));

      // Career pipeline sample — a believable design-role search in motion.
      if (typeof jobsBlankJob === 'function') {
        /** history: [[statusId, daysAgo], …] oldest → newest; sets current status too. */
        const mkJob = (patch, history) => {
          const j = { ...jobsBlankJob(), ...patch };
          j.createdAt = dayISO(history[0][1]);
          j.statusHistory = history.map(([status, ago]) => ({ status, at: dayISO(ago) }));
          j.status = history[history.length - 1][0];
          j.updatedAt = dayISO(history[history.length - 1][1]);
          j.activity = [{ at: j.createdAt, text: 'Application created' }];
          return j;
        };
        const jobs = [
          mkJob({
            title: 'Senior Product Designer', company: 'Northwind Health', location: 'Remote — North America',
            arrangement: 'remote', employmentType: 'full-time', salaryMin: 110000, salaryMax: 135000,
            source: 'job-board', url: 'https://jobs.lever.co/northwind/senior-product-designer',
            appliedDate: dayStr(18), priority: 'high', followUpDate: dayStr(-2),
            skills: ['Figma', 'Design systems', 'Healthcare UX'], tags: ['dream-role'],
            fit: { ...jobsBlankJob().fit, overall: 9, skills: 9, experience: 8, salary: 8, interest: 9 },
            interviews: [{ ...jobsBlankInterview(), type: 'video', at: dayStr(-3) + 'T14:00', interviewer: 'Sara Kim (Design Dir.)', platform: 'Google Meet', prepNotes: 'Walk through Averis case study; ask about design maturity.' }],
            docs: { ...jobsBlankJob().docs, resumeVersion: 'resume-product-v3.pdf', portfolioUrl: 'https://vaugn-portfolio.vercel.app' },
          }, [['saved', 24], ['applied', 18], ['screening', 12], ['interview-1', 6]]),
          mkJob({
            title: 'Brand & Web Designer', company: 'Coastal Dental Group', location: 'Tampa, FL',
            arrangement: 'hybrid', employmentType: 'full-time', salaryMin: 78000, salaryMax: 92000,
            source: 'referral', appliedDate: dayStr(30), priority: 'medium', followUpDate: dayStr(3),
            fit: { ...jobsBlankJob().fit, overall: 7, skills: 9, salary: 6 },
            tags: ['healthcare'],
          }, [['saved', 34], ['applied', 30], ['screening', 21], ['interview-1', 14], ['interview-2', 7], ['offer', 1]]),
          mkJob({
            title: 'Product Designer, Growth', company: 'Lumen Labs', location: 'Remote — Worldwide',
            arrangement: 'remote', employmentType: 'full-time', salaryMin: 95000, salaryMax: 115000,
            source: 'linkedin', url: 'https://www.linkedin.com/jobs/view/3900000001', appliedDate: dayStr(9),
            priority: 'high', followUpDate: dayStr(0),
            fit: { ...jobsBlankJob().fit, overall: 8, skills: 8, interest: 8 },
            tasks: [{ ...jobsBlankTask(), title: 'Send portfolio walkthrough video', type: 'follow-up', due: dayStr(0), priority: 'high' }],
          }, [['saved', 12], ['applied', 9], ['assessment', 3]]),
          mkJob({
            title: 'UX/UI Designer', company: 'Meridian Fintech', location: 'Toronto, Canada',
            arrangement: 'hybrid', employmentType: 'full-time', salaryMin: 85000, salaryMax: 100000,
            source: 'company-site', appliedDate: dayStr(24), priority: 'medium',
          }, [['saved', 27], ['applied', 24], ['ghosted', 4]]),
          mkJob({
            title: 'Design Systems Designer', company: 'Atlas SaaS', location: 'Remote — US',
            arrangement: 'remote', employmentType: 'contract', salaryMin: 70, salaryMax: 85, salaryPeriod: 'hour',
            source: 'job-board', appliedDate: dayStr(13), priority: 'medium', followUpDate: dayStr(1),
            fit: { ...jobsBlankJob().fit, overall: 7 },
          }, [['saved', 15], ['applied', 13], ['screening', 5]]),
          mkJob({
            title: 'Senior Visual Designer', company: 'Brightline Agency', location: 'New York, NY',
            arrangement: 'onsite', employmentType: 'full-time', salaryMin: 90000, salaryMax: 105000,
            source: 'linkedin', appliedDate: dayStr(21), priority: 'low',
          }, [['saved', 23], ['applied', 21], ['rejected', 10]]),
          mkJob({
            title: 'Product Designer', company: 'Verdant Climate', location: 'Remote — EU overlap',
            arrangement: 'remote', employmentType: 'full-time',
            source: 'job-board', deadline: dayStr(-2), priority: 'high',
            fit: { ...jobsBlankJob().fit, overall: 8, interest: 9 },
            tasks: [{ ...jobsBlankTask(), title: 'Tailor resume for climate focus', type: 'customize-resume', due: dayStr(-1), priority: 'high' }],
          }, [['saved', 5], ['preparing', 2]]),
          mkJob({
            title: 'Web Designer (Webflow)', company: 'Halo Studios', location: 'Remote — Worldwide',
            arrangement: 'remote', employmentType: 'freelance',
            source: 'recruiter', priority: 'low',
          }, [['saved', 3]]),
          mkJob({
            title: 'Lead Product Designer', company: 'Pillar Health', location: 'Austin, TX',
            arrangement: 'hybrid', employmentType: 'full-time', salaryMin: 125000, salaryMax: 150000,
            source: 'referral', appliedDate: dayStr(40), priority: 'medium',
          }, [['saved', 44], ['applied', 40], ['screening', 33], ['interview-1', 26], ['withdrawn', 20]]),
        ];
        const jobsState = {
          schemaVersion: 1,
          jobs,
          settings: { statuses: JOBS_DEFAULT_STATUSES.map((s) => ({ ...s })), stalledDays: 14, deadlineWarnDays: 3 },
          view: { mode: 'dashboard', visibleColumns: [...JOBS_DEFAULT_COLUMNS], sortBy: 'followUpDate', sortDir: 'asc' },
          updatedAt: new Date().toISOString(),
        };
        lsSet('vaugn.jobs.v1', JSON.stringify(jobsState));
      }

      // 30 days of gently-growing history so Trends unlock immediately.
      const entries = Array.from({ length: 30 }, (_, i) => {
        const ago = 29 - i;
        const wobble = (n) => Math.round(n * (1 + Math.sin(i / 4) * 0.03));
        const metrics = {};
        METRICS.forEach((m) => { metrics[m.id] = vals[m.id] ?? 0; });
        metrics.mrr = wobble(900 + i * 20);
        metrics.savings = wobble(5200 + i * 45);
        return {
          date: dayStr(ago),
          metrics,
          pipeline: { openLeads: 5 + Math.round(i / 10), pipelineValue: wobble(11000 + i * 250), activeClients: i > 18 ? 3 : 2, wonThisMonth: i > 25 ? 6000 : 2800 },
        };
      });
      lsSet('vaugn.history.v1', JSON.stringify(entries));
    },
  };

  window.SampleData = SampleData;

  /* ── UI wiring ──────────────────────────────────────────── */

  if (SampleData.isActive()) {
    const banner = document.createElement('div');
    banner.className = 'sample-banner';
    banner.innerHTML = `<span>✨ <strong>Sample mode</strong> — your real data is paused and safe. Changes here are discarded on exit.</span><button id="sampleClear">↩ Exit &amp; restore my data</button>`;
    document.body.prepend(banner);
    banner.querySelector('#sampleClear').addEventListener('click', () => SampleData.clear());
  } else if (SampleData.isAppEmpty()) {
    const btn = () => {
      const b = document.createElement('button');
      b.className = 'btn btn--ghost';
      b.textContent = '✨ Explore with sample data';
      b.addEventListener('click', () => SampleData.load());
      return b;
    };
    const welcomeRow = document.querySelector('#welcomeModal .btn-row');
    if (welcomeRow) welcomeRow.appendChild(btn());
    const crmEmptyRow = document.querySelector('#crmEmpty .btn-row');
    if (crmEmptyRow) crmEmptyRow.appendChild(btn());
    const jobsEmptyRow = document.querySelector('#jobsEmpty .btn-row');
    if (jobsEmptyRow) jobsEmptyRow.appendChild(btn());
    if (document.body.dataset.page === 'reports') {
      const cta = document.createElement('div');
      cta.className = 'sample-cta';
      cta.innerHTML = '<span>Nothing to report yet — see what it looks like with a real pipeline.</span>';
      cta.appendChild(btn());
      document.querySelector('.rpt-toolbar')?.after(cta);
    }
  }
})();
