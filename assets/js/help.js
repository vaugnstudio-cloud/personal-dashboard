/* ============================================================
   help.js — Help Center v2 (shared by index.html + crm.html)
   Injects its own DOM. Docs with interactive TOC, live search,
   Quick Guide / Complete Guide tabs, expandable sections.
   Keeps Guide Me tours (dashboard page only).
   ============================================================ */

(function () {
  'use strict';

  const PAGE = document.body.dataset.page || 'dashboard';
  const WELCOME_KEYS = {
    dashboard: 'vaugn.dashboard.welcomed',
    crm: 'vaugn.crm.welcomed',
    jobs: 'vaugn.jobs.welcomed',
    reports: 'vaugn.reports.welcomed',
  };
  const WELCOME_KEY = WELCOME_KEYS[PAGE] || WELCOME_KEYS.dashboard;
  const WELCOME = {
    crm: { title: 'Welcome to your Sales Pipeline 🧭', sub: 'Every lead — from first touch to Won — tracked in one place. Want a walkthrough first?' },
    jobs: { title: 'Welcome to your Career Pipeline 💼', sub: 'Import job listings from a link, track every application to the offer, and let the reports tell you what works. Want a walkthrough first?' },
    reports: { title: 'Your numbers, explained 📈', sub: 'Charts, your funnel, and a private advisor that tells you what to fix next. Want the quick walkthrough?' },
    dashboard: { title: 'Welcome to your dashboard 👋', sub: 'Track your money, business, content and health — all in one place. Want a quick walkthrough first?' },
  }[PAGE] || { title: 'Welcome 👋', sub: 'Want a quick walkthrough?' };
  const TOUR_FULL_DESC = {
    crm: '~2 min · every feature, incl. the lead drawer',
    jobs: '~2 min · import, views, kanban &amp; reports',
    reports: '~1.5 min · insights, every chart &amp; the report',
    dashboard: '~2 min · every feature, incl. Settings &amp; sync',
  }[PAGE] || '~2 min';
  const $ = (sel) => document.querySelector(sel);

  /* ══════════════════════ DOCS CONTENT ═════════════════════ */

  const HELP_GROUPS = [
    { id: 'start',     label: 'Start Here' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'crm',       label: 'Sales Pipeline' },
    { id: 'jobs',      label: 'Job Applications' },
    { id: 'reports',   label: 'Reports' },
    { id: 'sop',       label: 'SOPs & Playbooks' },
    { id: 'ref',       label: 'Reference' },
  ];

  const HELP_DOCS = [
    {
      id: 'quick-start', group: 'start', quick: true, title: 'Quick Start',
      tags: 'begin overview 5 minute intro',
      html: `
        <p><strong>Your Personal Dashboard in 60 seconds:</strong></p>
        <ol>
          <li><strong>Dashboard</strong> tracks 19 life &amp; business metrics. Click any number → type → <kbd>Enter</kbd>. Saved instantly.</li>
          <li><strong>Sales Pipeline</strong> tracks every lead. Press <kbd>N</kbd> to add one, click a row to open its full record.</li>
          <li>The two stay in sync: <em>Leads</em> and <em>Active Clients</em> on the dashboard update automatically from the pipeline, and winning a deal offers to update your income metrics.</li>
          <li><strong>Reports</strong> reads it all and tells you what to do next — charts, funnel and personalized tips, computed privately on this device.</li>
          <li>Everything lives in <strong>this browser</strong> — private and offline. Export a JSON backup monthly (Settings → Backup / Pipeline → ⋯ menu).</li>
        </ol>
        <p>That's genuinely all you need. The rest of this Help Center is depth, not requirement.</p>`,
    },
    {
      id: 'getting-started', group: 'start', quick: false, title: 'Getting Started',
      tags: 'setup first time onboarding new',
      html: `
        <p>Welcome to your Business Operating System. It has two surfaces:</p>
        <p><strong>📊 Dashboard</strong> — the scoreboard. Finance, Business KPIs, Content &amp; Products, Health &amp; Learning. Each card has a value, a goal, and a progress bar; the hero row and progress ring are computed automatically.</p>
        <p><strong>🧭 Sales Pipeline</strong> — the engine. Every lead from every channel (website, cold email, LinkedIn, Instagram, referrals, returning clients, product customers) tracked from first touch to Won or Lost.</p>
        <details><summary>Recommended first session (10 min)</summary>
          <ol>
            <li>On the Dashboard, enter your real numbers: salary, expenses, savings, weight. Set goals you actually want.</li>
            <li>Open Sales Pipeline and add your 3 warmest opportunities with <kbd>N</kbd>.</li>
            <li>Give each a follow-up date — tomorrow if unsure. The pipeline runs on follow-up dates.</li>
            <li>Export both backups once so you know where that lives.</li>
          </ol>
        </details>
        <p>Data is per-browser. To use another device, export/import JSON or set up Google Sheets sync (see Dashboard → Google Sheets Sync).</p>`,
    },
    {
      id: 'appearance', group: 'start', quick: true, title: 'Make It Yours — Themes & Branding',
      tags: 'theme dark light creme ink gold color logo brand name white label personalize appearance',
      html: `
        <p>Open <strong>Settings → Appearance</strong> (the gear icon, on every page):</p>
        <p><strong>🎨 Themes — three, curated:</strong></p>
        <ul>
          <li><strong>Midnight</strong> — the signature dark look. Violet-to-cyan, quiet and focused.</li>
          <li><strong>Crème</strong> — warm paper light. Easy on the eyes in bright rooms; everything re-tuned for readability.</li>
          <li><strong>Ink &amp; Gold</strong> ★ — deep navy with a gold-to-sky gradient. The premium one.</li>
        </ul>
        <p>Your choice is remembered on this device and applies everywhere — charts, badges, reports included.</p>
        <p><strong>🎭 Branding:</strong> change the <em>app name</em> and <em>tagline</em> shown in the top bar, and upload your own <em>logo</em>. When you pick an image, a quick crop dialog opens — <em>drag to position, slide to zoom</em> — so it always locks to a clean square. The logo is stored only in this browser and also becomes the tab icon. One click resets to the default mark.</p>
        <p>Everything here is cosmetic and instant — no data is affected.</p>`,
    },
    {
      id: 'dashboard-basics', group: 'dashboard', quick: true, title: 'Dashboard Basics',
      tags: 'metrics cards goals progress ring hero edit values',
      html: `
        <p><strong>Edit anything by clicking it.</strong> Click a card's big value or its goal → type → <kbd>Enter</kbd> (or click away). No save button exists because none is needed.</p>
        <ul>
          <li><strong>Hero stats</strong> are computed: Net Monthly Income = all income streams − expenses; Total Saved = savings + emergency fund.</li>
          <li><strong>The ring</strong> averages progress across all 19 goals.</li>
          <li><strong>Lower-is-better metrics</strong> (Monthly Expenses, Weight): at or under target = on track.</li>
          <li><strong>Leads &amp; Active Clients</strong> show an <em>Auto · Pipeline</em> badge once you use the CRM — they're computed from your pipeline and link straight to it. Turn this off in Settings if you prefer manual control.</li>
        </ul>
        <p>Settings (gear icon): currency, weight unit, your name, backups, Google Sheets sync.</p>`,
    },
    {
      id: 'data-backups', group: 'dashboard', quick: true, title: 'Where Data Lives & Backups',
      tags: 'localstorage save export import json lost data restore',
      html: `
        <p>⚠️ <strong>Read this once — it's the single most important thing to know.</strong></p>
        <p>All your data is stored in your browser's <strong>localStorage</strong> — private, offline, never uploaded. That privacy has one trade-off you must respect:</p>
        <ul>
          <li>Each browser/device starts empty until you enter numbers or import a backup.</li>
          <li><strong>Clearing your browser history/data erases everything.</strong> So can uninstalling the browser or some "cleaner" tools.</li>
          <li>Your phone and laptop are separate unless you sync them.</li>
        </ul>
        <p><strong>👉 The habit that protects you:</strong> once a month, open <strong>Settings → Backup</strong> and export both JSON files into a safe folder (OneDrive, Google Drive, wherever). Vaugn Studio will also nudge you with a reminder if it's been a while.</p>
        <p><strong>Even better — sync:</strong> set up Google Sheets sync (Settings → Google Sheets sync) for automatic two-way backup that also lets you use your phone. See that Help article.</p>
        <p>Restore or move devices anytime with the matching <em>Import</em> buttons.</p>`,
    },
    {
      id: 'sheets-sync', group: 'dashboard', quick: false, title: 'Google Sheets Sync',
      tags: 'google sheets apps script sync push pull pipeline leads devices phone',
      html: `
        <p>Optional two-way sync to a private Google Sheet — <strong>both your dashboard metrics and your pipeline leads</strong> — via a script you deploy under <strong>your own</strong> Google account. No API keys, nothing sensitive anywhere public. One deployment handles everything.</p>
        <ol>
          <li>Create a sheet at <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a>.</li>
          <li>Extensions → Apps Script → paste in the contents of <code>apps-script/Code.gs</code> (included in your download) → save.</li>
          <li>Deploy → New deployment → <strong>Web app</strong> → Execute as <strong>Me</strong> · access <strong>Anyone with the link</strong>.</li>
          <li>Copy the <code>/exec</code> URL → paste into Dashboard Settings → Google Sheets sync.</li>
        </ol>
        <p><strong>Dashboard:</strong> Push / Pull buttons live in Settings → Google Sheets sync (writes the <em>Dashboard</em> tab).</p>
        <p><strong>Pipeline:</strong> Push / Pull live in the pipeline's <strong>⋯ menu</strong> (writes the <em>Pipeline</em> tab — one row per lead, every field editable in the sheet).</p>
        <details><summary>How pipeline Push and Pull behave</summary>
          <ul>
            <li><strong>Push</strong> mirrors: the Pipeline tab becomes exactly your current leads.</li>
            <li><strong>Pull</strong> merges: leads from the sheet win per lead, sheet-only leads are added, local-only leads are kept.</li>
            <li><strong>New device / phone:</strong> paste the same URL in Dashboard Settings there, then Pull on both pages. Done.</li>
          </ul>
        </details>
        <details><summary>Deployed an older version of the script?</summary>
          <p>Paste the latest <code>apps-script/Code.gs</code> (from your download) over your old code, then <strong>Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy</strong>. Your URL stays the same.</p>
        </details>
        <p>🔒 The URL is the only key. It stays in this browser — never share or publish it.</p>`,
    },
    {
      id: 'add-leads', group: 'crm', quick: true, title: 'How to Add Leads',
      tags: 'new lead create add pipeline crm',
      html: `
        <p>Three ways, all equal: press <kbd>N</kbd>, click <strong>＋ New Lead</strong>, or the button on the empty state.</p>
        <p>The lead drawer opens with Business Name focused. Fill what you know — <strong>every field saves automatically as you type</strong>. Close with <kbd>Esc</kbd> or Done.</p>
        <details><summary>What each field is for</summary>
          <ul>
            <li><strong>Problem Noticed</strong> — the specific thing wrong with their current presence. This becomes your outreach hook.</li>
            <li><strong>Best Offer</strong> — what you'd pitch, with a rough price. Decide before you reach out.</li>
            <li><strong>Deal Value + Type</strong> — expected value; <em>retainer</em> vs <em>one-off</em> matters because winning a retainer offers to update MRR.</li>
            <li><strong>Follow-Up Date</strong> — the engine of the pipeline. A lead without one is invisible to your daily routine.</li>
          </ul>
        </details>
        <p><strong>Minimum viable lead:</strong> Business Name + Channel + Follow-Up Date. Add the rest as you learn it.</p>`,
    },
    {
      id: 'update-status', group: 'crm', quick: true, title: 'How to Update Status',
      tags: 'status badge won lost stages change pipeline move',
      html: `
        <p>Click any <strong>status badge</strong> (in the table or a card) → pick from the menu. Or use the Status dropdown inside the lead drawer.</p>
        <p>The 8 stages: <em>Lead → Contacted → Replied → Call Booked → Proposal Sent → Follow Up → Won / Lost</em>.</p>
        <ul>
          <li><strong>Smart nudges:</strong> marking <em>Contacted</em> auto-fills today's date and suggests a follow-up in 3 days. Ticking <em>Reply received</em> advances the status for you.</li>
          <li><strong>Won</strong> 🎉 — you'll be asked (never forced) to add the deal value to MRR or income on your dashboard. Active Clients updates automatically.</li>
          <li><strong>Lost</strong> — pick a loss reason (10 seconds now = pattern insight later).</li>
          <li>The <strong>R · C · P dots</strong> on each row are clickable toggles for Reply / Call / Proposal.</li>
          <li>Inline editing: click a row's <strong>Follow-Up</strong> or <strong>Deal Value</strong> cell to edit it right there.</li>
        </ul>`,
    },
    {
      id: 'pipeline-filters', group: 'crm', quick: false, title: 'Search, Filters, Columns & Bulk',
      tags: 'filter sort search columns bulk select archive',
      html: `
        <p><strong>Search:</strong> press <kbd>/</kbd> — matches business, contact, email, industry, country, notes, problem and offer.</p>
        <p><strong>Filter chips:</strong> one click filters by status; <em>⚠ Due</em> shows everything due today or overdue; <em>Archived</em> reveals archived leads. Combine with the channel dropdown. Filters live in the URL, so a filtered view can be bookmarked.</p>
        <p><strong>Sort:</strong> click a column header to toggle ascending/descending. Default is Follow-Up date — most urgent first.</p>
        <p><strong>Columns:</strong> the Columns button shows all fields from the full record — tick any to add it to the table. Your choice is remembered.</p>
        <p><strong>Bulk:</strong> tick row checkboxes → a floating bar appears: Set Status, Set Follow-Up, Archive, Delete. Destructive actions offer <em>Undo</em>.</p>
        <p><strong>Archive vs Delete:</strong> archive hides a lead but keeps its history (win rate still counts it). Delete removes it permanently — you get one Undo toast.</p>`,
    },
    {
      id: 'dashboard-sync', group: 'crm', quick: false, title: 'Dashboard Sync Explained',
      tags: 'kpi sync auto pipeline leads clients mrr money',
      html: `
        <p>The pipeline feeds the dashboard two ways:</p>
        <p><strong>1. Automatic (badged “Auto · Pipeline”):</strong> the <em>Leads</em> card = your open leads; <em>Active Clients</em> = won, non-archived deals. Recomputed on every dashboard load. Clicking those cards jumps to the matching pipeline view. Disable in Dashboard Settings → Preferences if you prefer manual numbers.</p>
        <p><strong>2. Confirm-first money prompts:</strong> when you mark a deal <em>Won</em> with a deal value, you're asked once: retainers offer to add to <strong>MRR</strong>; one-off deals offer <strong>Website Income</strong> (website channel) or <strong>Side Income</strong>. Money never changes silently.</p>
        <p>A <strong>Pipeline strip</strong> also appears on the dashboard under the hero once you have leads: Pipeline Value · Win Rate · Due Today — each links here.</p>`,
    },
    {
      id: 'jobs-import', group: 'jobs', quick: true, title: 'Importing Jobs from a Link',
      tags: 'import url link job listing extract linkedin indeed greenhouse lever paste description',
      html: `
        <p>The fastest way to add an application: paste the job listing URL into <strong>Import Job</strong> (or press <kbd>I</kbd>).</p>
        <p><strong>What imports automatically:</strong> links from <em>Greenhouse, Lever, Ashby, Workable and SmartRecruiters</em> — the boards most tech and startup jobs actually live on. The app calls their public job APIs directly from your browser; nothing is sent to any middleman server.</p>
        <p><strong>What doesn't (and why):</strong> LinkedIn, Indeed, Glassdoor and most company career sites actively block automated reading. The app will never pretend otherwise or invent data — instead it keeps your link and switches to the <em>paste tab</em>: copy the whole job description, paste it, and it's parsed into structured fields (responsibilities, requirements, benefits, salary, remote/hybrid…).</p>
        <p><strong>The review screen:</strong> nothing is saved until you approve. Amber fields were <em>guessed</em> by heuristics — check them. Blank fields simply weren't in the listing. Duplicates (same URL, or same company + title) are flagged before saving.</p>
        <p>Full manual entry is always available with <kbd>N</kbd>.</p>`,
    },
    {
      id: 'jobs-statuses', group: 'jobs', quick: true, title: 'Application Stages & Kanban',
      tags: 'status stage pipeline kanban board drag drop customize applied interview offer',
      html: `
        <p>Applications move through 16 default stages — from <em>Saved</em> and <em>Preparing</em>, through <em>Applied</em>, screening and interviews, to <em>Offer Received</em>, <em>Accepted</em>, <em>Rejected</em>, <em>Withdrawn</em> or <em>Ghosted</em>.</p>
        <ul>
          <li><strong>Change status anywhere:</strong> click a status badge, use the drawer's Status dropdown, or drag cards on the <em>Pipeline</em> board. Every change is stamped into the record's history — that history powers the funnel and “days in stage”.</li>
          <li><strong>Keyboard on the board:</strong> focus a card, <kbd>Enter</kbd> opens the status menu, <kbd>[</kbd> and <kbd>]</kbd> move it a column. Works great on mobile via tap → badge menu too.</li>
          <li><strong>Customize stages</strong> in Settings → Job Applications: rename, recolor, reorder, add your own. Each stage belongs to an <em>analytics group</em> (Applied, Interviewing, Offer…) so stats and reports keep working no matter what you call things. Deleting a stage asks where its applications should move — records never break.</li>
          <li><strong>Archive</strong> hides an application without deleting it (Archived chip reveals them). Reaching the Applied group auto-fills the Date Applied if empty.</li>
        </ul>`,
    },
    {
      id: 'jobs-tracking', group: 'jobs', quick: true, title: 'Follow-Ups, Interviews & Calendar',
      tags: 'follow up interview calendar agenda task deadline reminder overdue',
      html: `
        <p>Four kinds of dates drive your routine, and all of them land on the <strong>Calendar</strong> automatically:</p>
        <ul>
          <li><strong>Follow-up dates</strong> — the engine. Every active application should have one; overdue ones show in red and in the ⚠ Due chip.</li>
          <li><strong>Application deadlines</strong> — warned about a few days ahead (configurable in Settings) while you haven't applied yet.</li>
          <li><strong>Interviews</strong> — add them inside the record with date/time, platform, meeting link, prep notes, questions to ask, outcome and your own performance rating.</li>
          <li><strong>Tasks</strong> — “Customize resume”, “Send thank-you”… anything with a due date.</li>
        </ul>
        <p>The <em>Agenda</em> view lists the next 30 days with overdue items pinned on top. Each morning: open ⚠ Due, clear it, set the next dates. Same habit as the Sales Pipeline — different game.</p>`,
    },
    {
      id: 'jobs-fit', group: 'jobs', quick: false, title: 'Fit Scores & Preparation',
      tags: 'fit score evaluate match priority prepare talking points concerns',
      html: `
        <p>Each application has a <strong>Fit &amp; Opportunity</strong> section with seven 0–10 sliders: overall fit, skills, experience, salary, growth, company interest and arrangement fit. <strong>They are your judgment, not the app's</strong> — nothing is auto-scored, and every score stays editable.</p>
        <p>Below the sliders, write the things that win interviews while they're fresh: reasons to apply, concerns, missing qualifications, transferable strengths, skills to emphasize and talking points. The overall score shows up in the table and on kanban cards so you can prioritize the high-fit roles first.</p>
        <p><strong>Documents:</strong> track which resume version, cover letter and portfolio URL went to each company — when a recruiter calls back three weeks later, you'll know exactly what they're looking at.</p>`,
    },
    {
      id: 'jobs-data', group: 'jobs', quick: false, title: 'Career Data: CSV, Backups & Privacy',
      tags: 'csv export import backup json career data privacy separate',
      html: `
        <p><strong>Completely separate from your freelance pipeline.</strong> Job applications live under their own storage key (<code>vaugn.jobs.v1</code>) — nothing is ever mixed with Sales Pipeline leads or dashboard metrics.</p>
        <ul>
          <li><strong>JSON backup</strong> — Applications view → ⋯ menu, or Settings → Backup → Career JSON. Import restores it anywhere.</li>
          <li><strong>CSV export</strong> — all applications or just the filtered view, ready for Sheets/Excel.</li>
          <li><strong>CSV import</strong> — bring records from any other tracker: a mapping screen matches your columns to fields (with sensible auto-guesses), previews rows, and skips duplicates.</li>
          <li><strong>Reports → Print / Save PDF</strong> — a clean one-page career report for weekly reviews.</li>
        </ul>
        <p>Everything is computed and stored in this browser. Job applications contain personal data — nothing is uploaded anywhere.</p>`,
    },
    {
      id: 'sales-sop', group: 'sop', quick: false, title: 'Sales SOP',
      tags: 'outreach playbook sell process close',
      html: `
        <p>The end-to-end play, from stranger to client:</p>
        <ol>
          <li><strong>Prospect</strong> — find a business in your niche. Before adding it, identify one concrete <em>Problem Noticed</em> (broken mobile site, no booking, dated brand). No problem = no lead.</li>
          <li><strong>Add the lead</strong> (<kbd>N</kbd>) with problem + best offer + follow-up date.</li>
          <li><strong>First touch</strong> — short, specific, about <em>their</em> problem, one clear CTA. Set status → Contacted (date auto-fills).</li>
          <li><strong>They reply?</strong> Tick Reply → aim for a call, not a pitch thread. Status → Call Booked when scheduled.</li>
          <li><strong>The call</strong> — diagnose, don't demo. End with a concrete next step and a date.</li>
          <li><strong>Proposal</strong> — send within 24h of the call while you're still in their head. Status → Proposal Sent, follow-up in 3–5 days.</li>
          <li><strong>Close</strong> — Won 🎉 (accept the dashboard prompt) or Lost (log the reason and move on — the pattern data is the consolation prize).</li>
        </ol>`,
    },
    {
      id: 'follow-up-sop', group: 'sop', quick: false, title: 'Follow-Up SOP',
      tags: 'follow up cadence reminder due today overdue',
      html: `
        <p>Deals die from silence, not rejection. The system: <strong>every open lead always has a follow-up date.</strong></p>
        <ul>
          <li><strong>Cadence:</strong> after first touch +3 days · second +4 · third +7. After 3 touches with zero response → Lost (“No reply”), archive.</li>
          <li><strong>Each morning:</strong> click the <em>⚠ Due</em> chip. Work through every lead: send the follow-up, then set the <em>next</em> date before moving on. The chip should read 0 when you're done.</li>
          <li><strong>Vary the angle:</strong> nudge → new value (a relevant example or idea) → graceful close (“I'll leave it here — door's open”). Never send the same message twice.</li>
          <li>Overdue dates show in red. More than 3 red rows means the cadence is too ambitious — fix the dates, not your guilt.</li>
        </ul>`,
    },
    {
      id: 'proposal-sop', group: 'sop', quick: false, title: 'Proposal SOP',
      tags: 'proposal send pricing offer deal',
      html: `
        <ol>
          <li><strong>Only after a call.</strong> A proposal without a conversation is a brochure.</li>
          <li><strong>Within 24 hours</strong> of the call. Speed signals competence.</li>
          <li><strong>Structure:</strong> their problem in their words → the outcome (not deliverables) → scope → one price (two options max) → timeline → one CTA.</li>
          <li>In the pipeline: status → Proposal Sent, tick the P dot, set Deal Value to the real quoted number and Deal Type (retainer vs one-off — this drives the Won prompt), follow-up +3 to 5 days.</li>
          <li>No answer after two nudges → “Should I close the file on this?” — the magic un-sticker. Then Won or Lost, never limbo.</li>
        </ol>`,
    },
    {
      id: 'operating-rhythm', group: 'sop', quick: false, title: 'Operating Rhythm — Daily · Weekly · Monthly · Quarterly',
      tags: 'daily weekly monthly quarterly routine sop morning friday',
      html: `
        <details open><summary><strong>☀️ Daily (morning · 10 min)</strong></summary>
          <ol>
            <li>Open Pipeline → <em>⚠ Due</em> chip → send every follow-up, set next dates.</li>
            <li>Log yesterday's replies (tick R, statuses update themselves).</li>
            <li>Book calls from warm replies.</li>
            <li>Add new leads found yesterday (<kbd>N</kbd>).</li>
            <li>10-second scan: any deal stuck without a next step? Give it one.</li>
          </ol>
        </details>
        <details><summary><strong>📅 Weekly (Friday · 20 min)</strong></summary>
          <ol>
            <li>Review Lost this week — the reasons picker pays off here. One pattern? Fix it.</li>
            <li>Review Won — what actually moved them? Do more of that.</li>
            <li>Check Win Rate and Pipeline Value on the stats bar; note direction, not absolutes.</li>
            <li>Nudge every deal untouched for 14+ days — advance it or archive it.</li>
            <li>Set next week's target: <em>n</em> new leads (write it in the dashboard's Leads goal).</li>
          </ol>
        </details>
        <details><summary><strong>🗓 Monthly (1st · 30 min)</strong></summary>
          <ol>
            <li>Archive dead leads; dedupe anything double-entered.</li>
            <li>Update your Best Offer templates from what won this month.</li>
            <li>Dashboard review: revenue vs goals, raise anything you've outgrown.</li>
            <li>Export both JSON backups (dashboard + pipeline).</li>
          </ol>
        </details>
        <details><summary><strong>🧭 Quarterly (60 min)</strong></summary>
          <ol>
            <li>Pricing review — raise it if your win rate is over ~60%.</li>
            <li>Channel ROI: which outreach channel wins most? Double down; cut the worst.</li>
            <li>Reset dashboard goals for the new quarter.</li>
            <li>Prune: hide table columns you never look at, delete templates you never use.</li>
          </ol>
        </details>`,
    },
    {
      id: 'definitions', group: 'ref', quick: false, title: 'Definitions',
      tags: 'glossary meaning formula metric term what is',
      html: `
        <p><strong>Pipeline metrics</strong></p>
        <ul>
          <li><strong>Pipeline Value</strong> — Σ deal value of open leads (not Won/Lost/archived). Potential, not promised.</li>
          <li><strong>Win Rate</strong> — Won ÷ (Won + Lost), all-time, archived included. “—” until you've closed something either way.</li>
          <li><strong>Won This Month</strong> — Σ deal value of deals marked Won in the current calendar month.</li>
          <li><strong>Due Today / Overdue</strong> — open leads whose follow-up date is today / has passed.</li>
          <li><strong>Open Lead</strong> — any non-archived lead that isn't Won or Lost.</li>
          <li><strong>Active Client</strong> — a Won deal that isn't archived. Archive a Won deal when the engagement ends.</li>
          <li><strong>R · C · P</strong> — Reply received · Call booked · Proposal sent.</li>
        </ul>
        <p><strong>Dashboard metrics</strong></p>
        <ul>
          <li><strong>Net Monthly Income</strong> — salary + side + website + affiliate + retainers + MRR − expenses.</li>
          <li><strong>MRR</strong> — monthly recurring revenue (retainers won here flow in via the Won prompt).</li>
          <li><strong>Total Saved</strong> — savings + emergency fund.</li>
        </ul>`,
    },
    {
      id: 'shortcuts', group: 'ref', quick: true, title: 'Keyboard Shortcuts',
      tags: 'keys keyboard hotkeys fast',
      html: `
        <p><strong>Sales Pipeline</strong></p>
        <ul>
          <li><kbd>N</kbd> — new lead</li>
          <li><kbd>/</kbd> — focus search</li>
          <li><kbd>↑</kbd> <kbd>↓</kbd> — move row focus · <kbd>Enter</kbd> — open focused lead</li>
          <li><kbd>J</kbd> / <kbd>K</kbd> — next / previous lead while the drawer is open</li>
          <li><kbd>Esc</kbd> — close drawer / menu / clear focus</li>
        </ul>
        <p><strong>Job Applications</strong></p>
        <ul>
          <li><kbd>I</kbd> — import a job from a URL · <kbd>N</kbd> — add manually</li>
          <li><kbd>/</kbd> — search · <kbd>↑</kbd> <kbd>↓</kbd> + <kbd>Enter</kbd> — open from the table</li>
          <li>On the Pipeline board: <kbd>Enter</kbd> — status menu · <kbd>[</kbd> / <kbd>]</kbd> — move a stage</li>
          <li><kbd>J</kbd> / <kbd>K</kbd> — next / previous application while the drawer is open</li>
        </ul>
        <p><strong>Dashboard</strong></p>
        <ul>
          <li>Click any value or goal → type → <kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels</li>
        </ul>`,
    },
    {
      id: 'reports-insights', group: 'reports', quick: true, title: 'Reports & Insights',
      tags: 'reports charts graphs insights tips ai advisor funnel revenue trends print pdf',
      html: `
        <p>The <strong>Reports</strong> tab turns your data into answers. It's organized top-down: <em>what to do</em>, then <em>the evidence</em>.</p>
        <p><strong>📌 What to do next</strong> — a built-in advisor that reads your real pipeline and dashboard numbers and writes specific tips: overdue follow-ups, whether your pipeline can reach your income goal, which channel closes best, expense ratio, savings runway and more. Colored by urgency: red = act, amber = watch, green = win. Click a tip to jump to the fix.</p>
        <details><summary>How are insights computed? (transparency)</summary>
          <p>Pure rules, running locally — for example: <em>pipeline needed = income goal gap ÷ your win rate</em>, or <em>runway = savings ÷ monthly expenses</em>. No AI service, no network, nothing uploaded. Your numbers never leave this browser.</p>
        </details>
        <p><strong>The charts:</strong></p>
        <ul>
          <li><strong>💰 Revenue</strong> — deal value won per week/month for the selected period.</li>
          <li><strong>🔻 Pipeline funnel</strong> — where leads drop between Lead → Contacted → Replied → Call → Proposal → Won.</li>
          <li><strong>🎯 Channel performance</strong> — win rate and revenue per outreach channel. Double down on the winner.</li>
          <li><strong>📈 Trends</strong> — MRR and pipeline value over time. Unlocks automatically after 7 days of use (Vaugn Studio snapshots your numbers once a day, locally).</li>
        </ul>
        <p><strong>📄 Print / Save PDF</strong> generates a clean one-page business report — stats, tips, charts, wins &amp; losses — great as a weekly review ritual. <strong>Copy as text</strong> gives you the same as plain text for notes or messages.</p>
        <p>The period picker (This month · Last month · Quarter · All time) drives every chart; insights always describe <em>right now</em>.</p>`,
    },
    {
      id: 'faq', group: 'ref', quick: false, title: 'FAQ',
      tags: 'questions answers common',
      html: `
        <details><summary>Can I install Vaugn Studio like a real app?</summary><p>Yes — it's a PWA. In Chrome/Edge: menu → <strong>Install Vaugn Studio</strong> (or the install icon in the address bar). On iPhone: Share → <strong>Add to Home Screen</strong>. It opens in its own window and works fully offline.</p></details>
        <details><summary>What is sample data? Is it safe with my real data?</summary><p>A realistic demo dataset (12 leads, filled metrics, 30 days of history) you can enter anytime from <strong>Settings → Sample data</strong>. It's a sandbox: your real data is <em>stashed safely first</em> and restored exactly as it was when you exit. Anything you change inside sample mode is discarded — re-entering always shows the same pristine demo.</p></details>
        <details><summary>Is my data public because the site is public?</summary><p>No. The public repo contains only code. Your numbers and leads exist solely in your browser (and optionally your private Google Sheet).</p></details>
        <details><summary>Why do Leads/Clients on the dashboard refuse to be edited?</summary><p>They're auto-synced from the pipeline (see the badge). Turn off <em>Auto-sync from Pipeline</em> in Dashboard Settings to edit manually.</p></details>
        <details><summary>Can I use this on my phone?</summary><p>Yes — the pipeline becomes a card list on small screens. Data is per-device: set up Google Sheets sync once (see the article), then Pull on your phone to get everything.</p></details>
        <details><summary>What's the difference between the Follow Up status and follow-up dates?</summary><p>The date drives the ⚠ Due chip and daily routine — every open lead should have one. The status is a label for leads whose <em>current stage</em> is “circling back later”.</p></details>
        <details><summary>I deleted a lead by mistake.</summary><p>Click <strong>Undo</strong> in the toast within a few seconds. After that, restore from your latest JSON backup.</p></details>
        <details><summary>Can I add custom statuses or fields?</summary><p>Not yet from the UI — it's on the roadmap. (If you're comfortable editing code: <code>assets/js/crm/crm-data.js</code>.)</p></details>`,
    },
    {
      id: 'troubleshooting', group: 'ref', quick: false, title: 'Troubleshooting',
      tags: 'broken fix problem error not working',
      html: `
        <details><summary>Everything shows zero / my leads are gone</summary><p>You're likely in a different browser or profile, or browser data was cleared. Import your JSON backups (Dashboard Settings → Backup; Pipeline → ⋯ menu).</p></details>
        <details><summary>Dashboard Leads number looks wrong</summary><p>It counts <em>open</em> leads — Won, Lost and archived are excluded on purpose. Check the Archived chip if something seems missing.</p></details>
        <details><summary>Sheets Push/Pull fails</summary><p>Re-check the deployment: Execute as <strong>Me</strong>, access <strong>Anyone with the link</strong>, and use the fresh <code>/exec</code> URL after re-deploying.</p></details>
        <details><summary>A date shows one day off</summary><p>Dates are stored timezone-naive (YYYY-MM-DD) and rendered locally — if you spot an off-by-one, report the exact case; it's likely an import from another tool.</p></details>
        <details><summary>The site didn't update after a code push</summary><p>GitHub Pages takes 1–2 minutes; hard-refresh with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.</p></details>`,
    },
    {
      id: 'best-practices', group: 'ref', quick: false, title: 'Best Practices',
      tags: 'tips advice habits discipline',
      html: `
        <ul>
          <li><strong>The follow-up date is sacred.</strong> An open lead without one is a deal you've silently abandoned.</li>
          <li><strong>Notes beat memory.</strong> Two lines after every interaction — future-you closes deals with them.</li>
          <li><strong>Problem first, pitch second.</strong> If the Problem Noticed field is empty, you're not ready to contact them.</li>
          <li><strong>Kill deals kindly but quickly.</strong> A fat pipeline of dead leads feels productive and predicts nothing. Archive aggressively; win rate will thank you.</li>
          <li><strong>Real deal values only.</strong> Pipeline Value is a decision-making number — inflating it only lies to yourself.</li>
          <li><strong>Trust the digest.</strong> The “follow-ups need attention” toast each morning is the whole system tapping your shoulder. Clear it before anything else.</li>
        </ul>`,
    },
    {
      id: 'roadmap', group: 'ref', quick: false, title: 'Future Features',
      tags: 'roadmap coming soon planned upcoming',
      html: `
        <p><strong>Next up (v1.5):</strong> per-lead activity timeline view · saved filter views · duplicate detection · CSV export · deal-aging indicators.</p>
        <p><strong>Then:</strong> kanban board view · outreach template library · pipeline health score · weighted revenue forecasting · browser notifications for due follow-ups · command palette (<kbd>Ctrl</kbd>+<kbd>K</kbd>).</p>
        <p><strong>Integrations horizon:</strong> Google Calendar (call booked → event) · Gmail logging · Apollo/Clay enrichment · Claude-drafted outreach from Problem Noticed + Best Offer · Notion/Zapier bridge.</p>`,
    },
  ];

  const plain = document.createElement('div');
  HELP_DOCS.forEach((d) => { plain.innerHTML = d.html; d.text = plain.textContent.toLowerCase(); });

  /* ══════════════════════ INJECTED DOM ═════════════════════ */

  const host = document.createElement('div');
  host.innerHTML = `
    <div class="modal" id="helpModal" hidden role="dialog" aria-modal="true" aria-label="How to use">
      <div class="modal__card">
        <button class="modal__close" id="helpClose" aria-label="Close">✕</button>
        <div id="helpChooser">
          <h2 class="modal__title">How to use</h2>
          <p class="modal__sub">Pick the way you like to learn.</p>
          <div class="help-options">
            <button class="help-option" id="helpReadMe">
              <span class="help-option__emoji">📖</span>
              <span class="help-option__name">Help Center</span>
              <span class="help-option__desc">Searchable docs, guides &amp; SOPs</span>
            </button>
            <button class="help-option" id="helpGuideMe">
              <span class="help-option__emoji">🧭</span>
              <span class="help-option__name">Guide Me</span>
              <span class="help-option__desc">Interactive step-by-step tour</span>
            </button>
          </div>
        </div>
        <div id="helpTourPick" hidden>
          <h2 class="modal__title">Choose your tour</h2>
          <p class="modal__sub">${PAGE === 'crm' ? 'A guided walk through your pipeline, step by step.' : "Both are interactive — you'll even edit a real value."}</p>
          <div class="help-options">
            <button class="help-option" data-tour="full">
              <span class="help-option__emoji">🧭</span>
              <span class="help-option__name">Full tour</span>
              <span class="help-option__desc">${TOUR_FULL_DESC}</span>
            </button>
            <button class="help-option" data-tour="quick">
              <span class="help-option__emoji">⚡</span>
              <span class="help-option__name">Quick tour</span>
              <span class="help-option__desc">~1 min · just the essentials</span>
            </button>
          </div>
          <button class="modal__back" id="helpBack">← Back</button>
        </div>
      </div>
    </div>

    <div class="modal" id="welcomeModal" hidden role="dialog" aria-modal="true" aria-label="Welcome">
      <div class="modal__card modal__card--welcome">
        <span class="modal__mark">V</span>
        <h2 class="modal__title">${WELCOME.title}</h2>
        <p class="modal__sub">${WELCOME.sub}</p>
        <div class="btn-row btn-row--stack">
          <button class="btn btn--primary" data-tour="full">🧭 Full tour (~2 min)</button>
          <button class="btn" data-tour="quick">⚡ Quick tour (~1 min)</button>
          <button class="btn btn--ghost" id="welcomeLater">Maybe later</button>
        </div>
      </div>
    </div>

    <div class="hc" id="helpCenter" hidden role="dialog" aria-modal="true" aria-label="Help Center">
      <div class="hc__panel">
        <header class="hc__head">
          <span class="guide__badge">Help Center</span>
          <label class="crm-search hc__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="search" id="hcSearch" placeholder="Search the docs…" />
          </label>
          <div class="hc__tabs">
            <button class="chip is-active" id="hcTabAll">Complete Guide</button>
            <button class="chip" id="hcTabQuick">⚡ Quick Guide</button>
          </div>
          <button class="modal__close" id="hcClose" aria-label="Close help center">✕</button>
        </header>
        <div class="hc__body">
          <nav class="hc__toc" id="hcToc" aria-label="Documentation"></nav>
          <main class="hc__content" id="hcContent"></main>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);

  /* ══════════════════════ HELP CENTER ══════════════════════ */

  let hcMode = 'all';       // all | quick
  let hcActive = PAGE === 'crm' ? 'add-leads' : PAGE === 'jobs' ? 'jobs-import' : 'quick-start';

  function tocHTML(filterIds = null) {
    return HELP_GROUPS.map((g) => {
      const docs = HELP_DOCS.filter((d) => d.group === g.id && (!filterIds || filterIds.includes(d.id)));
      if (!docs.length) return '';
      return `<p class="hc__group">${g.label}</p>` + docs.map((d) =>
        `<button class="hc__link ${d.id === hcActive ? 'is-active' : ''}" data-doc="${d.id}">${d.title}${d.quick ? ' <span class="hc__quick">⚡</span>' : ''}</button>`).join('');
    }).join('');
  }

  function renderHC() {
    const q = $('#hcSearch').value.trim().toLowerCase();
    const content = $('#hcContent');

    if (hcMode === 'quick' && !q) {
      $('#hcToc').innerHTML = tocHTML(HELP_DOCS.filter((d) => d.quick).map((d) => d.id));
      content.innerHTML = `<div class="guide__hero"><h2>⚡ Quick Guide</h2><p>The five-minute read — everything essential, nothing else.</p></div>` +
        HELP_DOCS.filter((d) => d.quick).map((d) =>
          `<section class="guide__section" id="hc-${d.id}"><h3>${d.title}</h3>${d.html}</section>`).join('');
      return;
    }
    if (q) {
      const hits = HELP_DOCS.filter((d) =>
        d.title.toLowerCase().includes(q) || d.tags.includes(q) || d.text.includes(q));
      $('#hcToc').innerHTML = tocHTML(hits.map((d) => d.id)) || '<p class="hc__group">No matches</p>';
      content.innerHTML = hits.length
        ? `<div class="guide__hero"><h2>${hits.length} result${hits.length === 1 ? '' : 's'} for “${CrmEsc(q)}”</h2></div>` +
          hits.map((d) => `<section class="guide__section"><h3><button class="hc__jump" data-doc="${d.id}">${d.title} →</button></h3><p class="cell-dim">${snippet(d, q)}</p></section>`).join('')
        : `<div class="guide__hero"><h2>Nothing found</h2><p>Try a different word — or browse the sections on the left.</p></div>`;
      return;
    }
    const doc = HELP_DOCS.find((d) => d.id === hcActive) || HELP_DOCS[0];
    $('#hcToc').innerHTML = tocHTML();
    content.innerHTML = `<div class="guide__hero"><h2>${doc.title}</h2></div><section class="guide__section hc__article">${doc.html}</section>`;
    content.scrollTop = 0;
  }

  function CrmEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function snippet(doc, q) {
    const i = doc.text.indexOf(q);
    if (i < 0) return doc.text.slice(0, 120) + '…';
    const start = Math.max(0, i - 50);
    return (start ? '…' : '') + CrmEsc(doc.text.slice(start, i + q.length + 70)) + '…';
  }

  /* ══════════════════════ HelpUI API ═══════════════════════ */

  const HelpUI = {
    open() {
      this.closeAll();
      $('#helpModal').hidden = false;
      $('#helpChooser').hidden = false;
      $('#helpTourPick').hidden = true;
    },
    openCenter(docId) {
      this.closeAll();
      if (docId) hcActive = docId;
      $('#helpCenter').hidden = false;
      $('#hcSearch').value = '';
      renderHC();
    },
    openGuide() { this.openCenter(); },   // back-compat for dashboard drawer button
    showTourPick() {
      this.closeAll();
      $('#helpModal').hidden = false;
      $('#helpChooser').hidden = true;
      $('#helpTourPick').hidden = false;
    },
    closeAll() {
      ['#helpModal', '#helpCenter', '#welcomeModal'].forEach((s) => { $(s).hidden = true; });
    },
    anyOpen() {
      return !$('#helpModal').hidden || !$('#helpCenter').hidden || !$('#welcomeModal').hidden;
    },
    markWelcomed() { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* ignore */ } },
    maybeShowWelcome() {
      let seen = null;
      try { seen = localStorage.getItem(WELCOME_KEY); } catch (e) { /* ignore */ }
      if (!seen) $('#welcomeModal').hidden = false;
    },
  };
  window.HelpUI = HelpUI;

  /* ══════════════════════ Wiring ═══════════════════════════ */

  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };

  on('#helpBtn', 'click', () => HelpUI.open());
  on('#howtoReadBtn', 'click', () => HelpUI.openCenter());
  on('#howtoTourBtn', 'click', () => HelpUI.showTourPick());

  on('#helpReadMe', 'click', () => HelpUI.openCenter());
  on('#helpGuideMe', 'click', () => {
    $('#helpChooser').hidden = true;
    $('#helpTourPick').hidden = false;
  });
  on('#helpBack', 'click', () => { $('#helpChooser').hidden = false; $('#helpTourPick').hidden = true; });
  on('#helpClose', 'click', () => HelpUI.closeAll());
  on('#hcClose', 'click', () => HelpUI.closeAll());

  on('#hcSearch', 'input', renderHC);
  on('#hcTabAll', 'click', () => { hcMode = 'all'; $('#hcTabAll').classList.add('is-active'); $('#hcTabQuick').classList.remove('is-active'); renderHC(); });
  on('#hcTabQuick', 'click', () => { hcMode = 'quick'; $('#hcTabQuick').classList.add('is-active'); $('#hcTabAll').classList.remove('is-active'); renderHC(); });

  $('#helpCenter').addEventListener('click', (e) => {
    const link = e.target.closest('[data-doc]');
    if (link) {
      hcActive = link.dataset.doc;
      hcMode = 'all';
      $('#hcTabAll').classList.add('is-active');
      $('#hcTabQuick').classList.remove('is-active');
      $('#hcSearch').value = '';
      renderHC();
    }
    if (e.target === $('#helpCenter')) HelpUI.closeAll();
  });

  const startTour = (variant) => {
    HelpUI.markWelcomed();
    HelpUI.closeAll();
    if (window.Tour) Tour.start(variant);
  };
  ['helpModal', 'welcomeModal'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tour]');
      if (btn) { startTour(btn.dataset.tour); return; }
      if (e.target.closest('#welcomeLater')) { HelpUI.markWelcomed(); HelpUI.closeAll(); }
      if (e.target === document.getElementById(id)) {
        if (id === 'welcomeModal') HelpUI.markWelcomed();
        HelpUI.closeAll();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (window.Tour && Tour.active) return;
    // `?` opens the keyboard shortcuts article (discoverability)
    if (e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !HelpUI.anyOpen()) {
      e.preventDefault();
      HelpUI.openCenter('shortcuts');
      return;
    }
    if (e.key !== 'Escape') return;
    if (HelpUI.anyOpen()) {
      if (!$('#welcomeModal').hidden) HelpUI.markWelcomed();
      HelpUI.closeAll();
    }
  });

  HelpUI.maybeShowWelcome();
})();
