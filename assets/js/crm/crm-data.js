/* ============================================================
   crm-data.js — Sales Pipeline definitions (single source of truth)
   Statuses, channels, column registry, loss reasons.
   ============================================================ */

const CRM_STATUSES = [
  { id: 'lead',          label: 'Lead' },
  { id: 'contacted',     label: 'Contacted' },
  { id: 'replied',       label: 'Replied' },
  { id: 'call-booked',   label: 'Call Booked' },
  { id: 'proposal-sent', label: 'Proposal Sent' },
  { id: 'follow-up',     label: 'Follow Up' },
  { id: 'won',           label: 'Won' },
  { id: 'lost',          label: 'Lost' },
];
const CRM_STATUS_INDEX = Object.fromEntries(CRM_STATUSES.map((s) => [s.id, s]));

const CRM_CHANNELS = [
  { id: 'website',    label: 'Website' },
  { id: 'cold-email', label: 'Cold Email' },
  { id: 'linkedin',   label: 'LinkedIn' },
  { id: 'instagram',  label: 'Instagram' },
  { id: 'referral',   label: 'Referral' },
  { id: 'returning',  label: 'Returning Client' },
  { id: 'product',    label: 'Product Customer' },
];
const CRM_CHANNEL_INDEX = Object.fromEntries(CRM_CHANNELS.map((c) => [c.id, c]));

/* Column registry — order here = order in the table & column manager.
   locked columns can't be hidden. */
const CRM_COLUMNS = [
  { id: 'business',      label: 'Business Name',        locked: true, sortable: true },
  { id: 'decisionMaker', label: 'Decision Maker',       sortable: true },
  { id: 'channel',       label: 'Channel',              sortable: true },
  { id: 'status',        label: 'Status',               locked: true, sortable: true },
  { id: 'rcp',           label: 'Reply · Call · Proposal', short: 'R · C · P' },
  { id: 'followUpDate',  label: 'Follow-Up',            sortable: true },
  { id: 'dateContacted', label: 'Contacted',            sortable: true },
  { id: 'dealValue',     label: 'Deal Value',           sortable: true, num: true },
  { id: 'notes',         label: 'Notes' },
  { id: 'industry',      label: 'Industry',             sortable: true },
  { id: 'country',       label: 'Country',              sortable: true },
  { id: 'website',       label: 'Website' },
  { id: 'social',        label: 'Instagram / LinkedIn' },
  { id: 'email',         label: 'Email' },
  { id: 'problem',       label: 'Problem Noticed' },
  { id: 'offer',         label: 'Best Offer' },
];
const CRM_COLUMN_INDEX = Object.fromEntries(CRM_COLUMNS.map((c) => [c.id, c]));

const CRM_DEFAULT_COLUMNS = [
  'business', 'decisionMaker', 'channel', 'status', 'rcp',
  'followUpDate', 'dateContacted', 'dealValue', 'notes',
];

const CRM_LOSS_REASONS = [
  { id: 'no-reply',   label: 'No reply' },
  { id: 'budget',     label: 'Budget' },
  { id: 'timing',     label: 'Bad timing' },
  { id: 'competitor', label: 'Chose someone else' },
  { id: 'other',      label: 'Other' },
];

const CRM_DEAL_TYPES = [
  { id: 'one-off',  label: 'One-off project' },
  { id: 'retainer', label: 'Monthly retainer' },
  { id: 'product',  label: 'Product sale' },
];

/** A blank lead with every field the brief requires. */
function crmBlankLead() {
  const now = new Date().toISOString();
  return {
    id: 'ld_' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)),
    createdAt: now,
    updatedAt: now,
    archived: false,
    business: '', industry: '', country: '',
    website: '', social: '',
    decisionMaker: '', email: '',
    problem: '', offer: '',
    channel: 'cold-email',
    dateContacted: null, followUpDate: null,
    status: 'lead',
    replied: false, callBooked: false, proposalSent: false,
    dealValue: 0, dealType: 'one-off',
    notes: '',
    lossReason: null,
    wonAt: null,
    activity: [{ at: now, text: 'Lead created' }],
  };
}
