/* ============================================================
   jobs-data.js — Career Pipeline definitions (single source of truth)
   Statuses (with analytics groups + badge colors), sources,
   column registry, blank-record factories.
   Completely separate from the Sales Pipeline (crm-data.js).
   ============================================================ */

/* Local YYYY-MM-DD (avoids UTC off-by-one). */
function jobsToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function jobsUid(prefix) {
  return prefix + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
}

/* Analytics groups — stats, funnels and reports key off the GROUP,
   so statuses can be renamed/added in Settings without breaking anything.
   Order here = progression order ("beyond" checks use the index). */
const JOBS_GROUPS = [
  { id: 'saved',        label: 'Saved' },
  { id: 'preparing',    label: 'Preparing' },
  { id: 'applied',      label: 'Applied' },
  { id: 'assessment',   label: 'Screening' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer',        label: 'Offer' },
  { id: 'won',          label: 'Accepted' },
  { id: 'lost',         label: 'Closed' },
];
const JOBS_GROUP_ORDER = Object.fromEntries(JOBS_GROUPS.map((g, i) => [g.id, i]));

/* Badge palette — theme-token driven, so custom statuses never need new CSS. */
const JOBS_BADGE_COLORS = ['slate', 'blue', 'cyan', 'violet', 'amber', 'orange', 'green', 'red', 'dim'];

const JOBS_DEFAULT_STATUSES = [
  { id: 'saved',           label: 'Saved',               group: 'saved',        color: 'slate' },
  { id: 'preparing',       label: 'Preparing',           group: 'preparing',    color: 'blue' },
  { id: 'ready',           label: 'Ready to Apply',      group: 'preparing',    color: 'cyan' },
  { id: 'applied',         label: 'Applied',             group: 'applied',      color: 'violet' },
  { id: 'assessment',      label: 'Assessment',          group: 'assessment',   color: 'amber' },
  { id: 'screening',       label: 'Recruiter Screening', group: 'assessment',   color: 'cyan' },
  { id: 'interview-1',     label: 'First Interview',     group: 'interviewing', color: 'violet' },
  { id: 'interview-2',     label: 'Second Interview',    group: 'interviewing', color: 'blue' },
  { id: 'interview-final', label: 'Final Interview',     group: 'interviewing', color: 'cyan' },
  { id: 'reference',       label: 'Reference Check',     group: 'interviewing', color: 'amber' },
  { id: 'offer',           label: 'Offer Received',      group: 'offer',        color: 'green' },
  { id: 'negotiating',     label: 'Negotiating',         group: 'offer',        color: 'orange' },
  { id: 'accepted',        label: 'Accepted',            group: 'won',          color: 'green' },
  { id: 'rejected',        label: 'Rejected',            group: 'lost',         color: 'red' },
  { id: 'withdrawn',       label: 'Withdrawn',           group: 'lost',         color: 'dim' },
  { id: 'ghosted',         label: 'Ghosted',             group: 'lost',         color: 'orange' },
];

const JOBS_SOURCES = [
  { id: 'linkedin',     label: 'LinkedIn' },
  { id: 'indeed',       label: 'Indeed' },
  { id: 'glassdoor',    label: 'Glassdoor' },
  { id: 'company-site', label: 'Company Site' },
  { id: 'job-board',    label: 'Job Board' },
  { id: 'referral',     label: 'Referral' },
  { id: 'recruiter',    label: 'Recruiter' },
  { id: 'other',        label: 'Other' },
];
const JOBS_SOURCE_INDEX = Object.fromEntries(JOBS_SOURCES.map((s) => [s.id, s]));

const JOBS_ARRANGEMENTS = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
];
const JOBS_ARRANGEMENT_INDEX = Object.fromEntries(JOBS_ARRANGEMENTS.map((a) => [a.id, a]));

const JOBS_EMPLOYMENT_TYPES = [
  { id: 'full-time',  label: 'Full-time' },
  { id: 'part-time',  label: 'Part-time' },
  { id: 'contract',   label: 'Contract' },
  { id: 'freelance',  label: 'Freelance' },
  { id: 'internship', label: 'Internship' },
];
const JOBS_EMPLOYMENT_INDEX = Object.fromEntries(JOBS_EMPLOYMENT_TYPES.map((t) => [t.id, t]));

const JOBS_PRIORITIES = [
  { id: 'high',   label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low',    label: 'Low' },
];

const JOBS_CONTACT_ROLES = [
  { id: 'recruiter',      label: 'Recruiter' },
  { id: 'hiring-manager', label: 'Hiring Manager' },
  { id: 'referral',       label: 'Referral' },
  { id: 'interviewer',    label: 'Interviewer' },
  { id: 'employee',       label: 'Employee' },
  { id: 'agency',         label: 'Agency Recruiter' },
  { id: 'other',          label: 'Other' },
];
const JOBS_CONTACT_ROLE_INDEX = Object.fromEntries(JOBS_CONTACT_ROLES.map((r) => [r.id, r]));

const JOBS_INTERVIEW_TYPES = [
  { id: 'phone-screen',     label: 'Phone Screen' },
  { id: 'video',            label: 'Video Interview' },
  { id: 'technical',        label: 'Technical / Skills' },
  { id: 'portfolio-review', label: 'Portfolio Review' },
  { id: 'assessment',       label: 'Assessment / Task' },
  { id: 'panel',            label: 'Panel' },
  { id: 'onsite',           label: 'On-site' },
  { id: 'final',            label: 'Final Round' },
  { id: 'other',            label: 'Other' },
];
const JOBS_INTERVIEW_TYPE_INDEX = Object.fromEntries(JOBS_INTERVIEW_TYPES.map((t) => [t.id, t]));

const JOBS_INTERVIEW_OUTCOMES = [
  { id: 'pending',   label: 'Pending' },
  { id: 'passed',    label: 'Passed' },
  { id: 'failed',    label: 'Not passed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show',   label: 'No-show' },
];

const JOBS_TASK_TYPES = [
  { id: 'follow-up',     label: 'Follow up' },
  { id: 'customize-resume', label: 'Customize resume' },
  { id: 'cover-letter',  label: 'Write cover letter' },
  { id: 'submit',        label: 'Submit application' },
  { id: 'contact',       label: 'Contact recruiter' },
  { id: 'prepare',       label: 'Prepare for interview' },
  { id: 'thank-you',     label: 'Send thank-you' },
  { id: 'review-offer',  label: 'Review offer' },
  { id: 'negotiate',     label: 'Negotiate' },
  { id: 'other',         label: 'Other' },
];
const JOBS_TASK_TYPE_INDEX = Object.fromEntries(JOBS_TASK_TYPES.map((t) => [t.id, t]));

/* Column registry — order here = order in the table & column manager.
   locked columns can't be hidden. num columns sort numerically. */
const JOBS_COLUMNS = [
  { id: 'role',         label: 'Company & Role',   locked: true, sortable: true },
  { id: 'status',       label: 'Status',           locked: true, sortable: true },
  { id: 'priority',     label: 'Priority',         sortable: true },
  { id: 'appliedDate',  label: 'Applied',          sortable: true },
  { id: 'daysSince',    label: 'Days Since',       short: 'Days', sortable: true, num: true },
  { id: 'followUpDate', label: 'Follow-Up',        sortable: true },
  { id: 'deadline',     label: 'Deadline',         sortable: true },
  { id: 'fit',          label: 'Fit Score',        short: 'Fit', sortable: true, num: true },
  { id: 'salary',       label: 'Salary',           sortable: true, num: true },
  { id: 'location',     label: 'Location',         sortable: true },
  { id: 'source',       label: 'Source',           sortable: true },
  { id: 'arrangement',  label: 'Work Arrangement', sortable: true },
  { id: 'employmentType', label: 'Employment Type', sortable: true },
  { id: 'nextAction',   label: 'Next Action' },
  { id: 'tags',         label: 'Tags' },
  { id: 'contacts',     label: 'Contacts' },
  { id: 'notes',        label: 'Notes' },
];
const JOBS_COLUMN_INDEX = Object.fromEntries(JOBS_COLUMNS.map((c) => [c.id, c]));

const JOBS_DEFAULT_COLUMNS = [
  'role', 'status', 'priority', 'appliedDate', 'daysSince',
  'followUpDate', 'deadline', 'fit', 'salary', 'location', 'source',
];

const JOBS_SALARY_PERIODS = [
  { id: 'year',  label: '/year',  short: '/yr' },
  { id: 'month', label: '/month', short: '/mo' },
  { id: 'hour',  label: '/hour',  short: '/hr' },
];

/* ── Blank record factories ─────────────────────────────────── */

function jobsBlankContact() {
  return {
    id: jobsUid('ct_'),
    name: '', role: 'recruiter', title: '',
    email: '', phone: '', linkedin: '',
    lastContact: null, nextFollowUp: null,
    notes: '',
  };
}

function jobsBlankInterview() {
  return {
    id: jobsUid('iv_'),
    type: 'phone-screen',
    at: null,                 // 'YYYY-MM-DDTHH:MM' local datetime
    platform: '', link: '', interviewer: '',
    prepNotes: '', questionsExpected: '', questionsToAsk: '',
    outcome: 'pending',
    thankYouSent: false,
    rating: null,             // 1–5 personal performance
    notes: '',
  };
}

function jobsBlankTask() {
  return {
    id: jobsUid('tk_'),
    title: '', type: 'follow-up',
    due: null,                // 'YYYY-MM-DD'
    priority: 'medium',
    done: false,
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

/** A blank application with every field the brief requires. */
function jobsBlankJob() {
  const now = new Date().toISOString();
  return {
    id: jobsUid('job_'),
    createdAt: now,
    updatedAt: now,
    archived: false,

    // ── Overview ──
    title: '', company: '', location: '',
    arrangement: '',            // remote | hybrid | onsite | ''
    employmentType: '',         // full-time | … | ''
    salaryMin: null, salaryMax: null,
    salaryCurrency: 'USD', salaryPeriod: 'year',
    source: '', url: '',
    postedDate: null, appliedDate: null, deadline: null,
    followUpDate: null,
    priority: 'medium',

    // ── Status ──
    status: 'saved',
    statusHistory: [{ status: 'saved', at: now }],

    // ── Job details ──
    description: '',
    responsibilities: [],
    qualificationsRequired: [],
    qualificationsPreferred: [],
    skills: [], tools: [], benefits: [],
    experienceLevel: '', education: '',
    schedule: '', timezone: '', travel: '',

    // ── Company ──
    companyWebsite: '', companyIndustry: '', companySize: '',
    companyLocation: '', companyLinkedin: '', companyCareers: '',
    companyDescription: '', companyNotes: '',

    // ── Sub-entities ──
    contacts: [],
    interviews: [],
    tasks: [],

    // ── Documents ──
    docs: {
      resumeVersion: '', coverLetter: '',
      portfolioUrl: '', caseStudies: '',
      submittedAt: null, notes: '',
    },

    // ── Fit evaluation (0–10, null = unscored) ──
    fit: {
      overall: null, skills: null, experience: null, salary: null,
      growth: null, interest: null, arrangement: null,
      reasons: '', concerns: '', missing: '',
      strengths: '', emphasize: '', talkingPoints: '',
    },

    tags: [],
    notes: '',

    // ── Import provenance ──
    importMeta: null,   // { provider, importedAt, sourceUrl, lowConfidence: [] }

    activity: [{ at: now, text: 'Application created' }],
  };
}

/** Deep-merge a saved job over a blank one (nested objects merged one level). */
function jobsMergeJob(saved) {
  const blank = jobsBlankJob();
  const job = { ...blank, ...saved };
  job.docs = { ...blank.docs, ...(saved.docs || {}) };
  job.fit = { ...blank.fit, ...(saved.fit || {}) };
  job.contacts = Array.isArray(saved.contacts) ? saved.contacts.map((c) => ({ ...jobsBlankContact(), ...c })) : [];
  job.interviews = Array.isArray(saved.interviews) ? saved.interviews.map((i) => ({ ...jobsBlankInterview(), ...i })) : [];
  job.tasks = Array.isArray(saved.tasks) ? saved.tasks.map((t) => ({ ...jobsBlankTask(), ...t })) : [];
  ['responsibilities', 'qualificationsRequired', 'qualificationsPreferred', 'skills', 'tools', 'benefits', 'tags']
    .forEach((k) => { if (!Array.isArray(job[k])) job[k] = []; });
  if (!Array.isArray(job.statusHistory) || !job.statusHistory.length) {
    job.statusHistory = [{ status: job.status || 'saved', at: job.createdAt }];
  }
  if (!Array.isArray(job.activity)) job.activity = [];
  return job;
}

/* Cap pasted/imported long text so localStorage stays healthy. */
const JOBS_DESC_CAP = 15000;
function jobsCleanText(s, cap = JOBS_DESC_CAP) {
  const t = String(s ?? '').replace(/\r\n/g, '\n').trim();
  return t.length > cap ? t.slice(0, cap) + '\n… [trimmed]' : t;
}
