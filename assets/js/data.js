/* ============================================================
   data.js — metric definitions (single source of truth)
   Each metric: id, label, group, format, direction, defaults
   format: 'currency' | 'number' | 'hours' | 'weight'
   direction: 'up' (higher = better) | 'down' (lower = better)
   ============================================================ */

const ICONS = {
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trend: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  funnel: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
};

const GROUPS = [
  { id: 'finance',  label: 'Finance',             tag: '01', blurb: 'Cash in, cash out, cash kept.' },
  { id: 'business', label: 'Business',            tag: '02', blurb: 'Pipeline, revenue & recurring work.' },
  { id: 'content',  label: 'Content & Products',  tag: '03', blurb: 'Audience, output & digital shelf.' },
  { id: 'health',   label: 'Health & Learning',   tag: '04', blurb: 'The engine behind everything else.' },
];

const METRICS = [
  // ── Finance ──────────────────────────────────────────────
  { id: 'salary',         label: 'Current Salary',   group: 'finance',  format: 'currency', direction: 'up',   value: 0, goal: 5000,   per: '/mo', icon: 'wallet' },
  { id: 'sideIncome',     label: 'Side Income',      group: 'finance',  format: 'currency', direction: 'up',   value: 0, goal: 2000,   per: '/mo', icon: 'trend' },
  { id: 'savings',        label: 'Savings',          group: 'finance',  format: 'currency', direction: 'up',   value: 0, goal: 20000,  per: '',    icon: 'dollar' },
  { id: 'expenses',       label: 'Monthly Expenses', group: 'finance',  format: 'currency', direction: 'down', value: 0, goal: 1500,   per: '/mo', icon: 'activity', hint: 'Under budget = on track' },
  { id: 'emergencyFund',  label: 'Emergency Fund',   group: 'finance',  format: 'currency', direction: 'up',   value: 0, goal: 10000,  per: '',    icon: 'shield' },

  // ── Business ─────────────────────────────────────────────
  { id: 'mrr',            label: 'MRR',              group: 'business', format: 'currency', direction: 'up',   value: 0, goal: 3000,   per: '/mo', icon: 'repeat' },
  { id: 'clients',        label: 'Clients',          group: 'business', format: 'number',   direction: 'up',   value: 0, goal: 5,      per: '',    icon: 'users' },
  { id: 'leads',          label: 'Leads',            group: 'business', format: 'number',   direction: 'up',   value: 0, goal: 20,     per: '/mo', icon: 'funnel' },
  { id: 'retainers',      label: 'Retainers',        group: 'business', format: 'currency', direction: 'up',   value: 0, goal: 2500,   per: '/mo', icon: 'target' },
  { id: 'websiteIncome',  label: 'Website Income',   group: 'business', format: 'currency', direction: 'up',   value: 0, goal: 1000,   per: '/mo', icon: 'globe' },
  { id: 'affiliateIncome',label: 'Affiliate Income', group: 'business', format: 'currency', direction: 'up',   value: 0, goal: 500,    per: '/mo', icon: 'link' },

  // ── Content & Products ───────────────────────────────────
  { id: 'products',       label: 'Products',         group: 'content',  format: 'number',   direction: 'up',   value: 0, goal: 3,      per: '',    icon: 'box' },
  { id: 'templatesSold',  label: 'Templates Sold',   group: 'content',  format: 'number',   direction: 'up',   value: 0, goal: 50,     per: '',    icon: 'layers' },
  { id: 'subscribers',    label: 'Subscribers',      group: 'content',  format: 'number',   direction: 'up',   value: 0, goal: 1000,   per: '',    icon: 'users' },
  { id: 'views',          label: 'Views',            group: 'content',  format: 'number',   direction: 'up',   value: 0, goal: 100000, per: '',    icon: 'eye' },
  { id: 'watchHours',     label: 'Watch Hours',      group: 'content',  format: 'hours',    direction: 'up',   value: 0, goal: 4000,   per: '',    icon: 'play' },

  // ── Health & Learning ────────────────────────────────────
  { id: 'weight',         label: 'Weight',           group: 'health',   format: 'weight',   direction: 'down', value: 0, goal: 160,    per: '',    icon: 'activity', hint: 'At or below target = on track' },
  { id: 'hoursLearned',   label: 'Hours Learned',    group: 'health',   format: 'hours',    direction: 'up',   value: 0, goal: 100,    per: '',    icon: 'book' },
  { id: 'hoursWorked',    label: 'Hours Worked',     group: 'health',   format: 'hours',    direction: 'up',   value: 0, goal: 160,    per: '/mo', icon: 'briefcase' },
];

const METRIC_INDEX = Object.fromEntries(METRICS.map((m) => [m.id, m]));
