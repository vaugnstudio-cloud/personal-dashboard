/* ============================================================
   jobs-extract.js — URL import pipeline for the Career Pipeline.

   Provider registry: each provider = { id, label, detect(url),
   extract(url, match) → Promise<JobExtract> }. Providers call
   PUBLIC, CORS-enabled ATS APIs directly from the browser — no
   backend, no keys, nothing fabricated. Anything a provider can't
   read is simply omitted; anything inferred by heuristics is
   marked low-confidence for the review screen.

   JobExtract = { fields: {…subset of jobsBlankJob()}, confidence:
   {field: 'high'|'low'}, provider, sourceUrl }

   Sites that block reading (LinkedIn, Indeed, most company career
   pages) throw JobsExtractError with an honest `kind` — the import
   UI then pivots to the paste-description parser / manual entry.
   ============================================================ */

const JobsExtract = (() => {
  'use strict';

  class JobsExtractError extends Error {
    constructor(kind, message) { super(message); this.kind = kind; } // 'unsupported'|'cors'|'blocked'|'notfound'|'network'|'parse'
  }

  /* ── Shared helpers ─────────────────────────────────────── */

  /** Inert HTML → readable plain text (DOMParser: no scripts, no network). */
  function htmlToText(html) {
    const withBreaks = String(html || '')
      .replace(/<\s*(?:br|\/p|\/div|\/h[1-6]|\/tr)\s*\/?\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n• ')
      .replace(/<\s*\/(?:ul|ol|li)\s*>/gi, '\n');
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    return (doc.body.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Greenhouse double-encodes its content field. */
  function decodeEntities(s) {
    const doc = new DOMParser().parseFromString(String(s || ''), 'text/html');
    return doc.documentElement.textContent || '';
  }

  async function getJSON(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new JobsExtractError('cors', 'The site blocked the request from your browser.');
    }
    if (res.status === 404) throw new JobsExtractError('notfound', 'That job posting was not found — it may have been closed.');
    if (res.status === 403 || res.status === 429) throw new JobsExtractError('blocked', 'The site refused automated reading.');
    if (!res.ok) throw new JobsExtractError('network', `The site responded with an error (${res.status}).`);
    try { return await res.json(); } catch (e) { throw new JobsExtractError('parse', 'The site returned data in an unexpected format.'); }
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(String(url).trim());
      let host = u.hostname.toLowerCase().replace(/^www\./, '');
      let path = u.pathname.replace(/\/+$/, '').toLowerCase();
      return `${host}${path}`;
    } catch (e) {
      return String(url).trim().toLowerCase();
    }
  }

  function findDuplicates({ url, company, title }, excludeId = null) {
    const norm = url ? normalizeUrl(url) : null;
    const key = (s) => String(s || '').trim().toLowerCase();
    return JobsStore.state.jobs.filter((j) => {
      if (excludeId && j.id === excludeId) return false;
      if (norm && j.url && normalizeUrl(j.url) === norm) return true;
      if (key(company) && key(title) && key(j.company) === key(company) && key(j.title) === key(title)) return true;
      return false;
    });
  }

  /* ── Description → structured sections (heuristic parser) ── */

  const SECTION_PATTERNS = [
    ['responsibilities',        /^(what you('|’)?ll (do|be doing)|what you will (do|be doing)|responsibilit|your (role|mission|impact)|the role|key duties|duties|day.to.day|in this role)/i],
    ['qualificationsRequired',  /^(requirements?|qualifications?|what we('|’)?re looking for|what you('|’)?ll need|who you are|must.have|about you|skills?( and| &)? (experience|qualifications)|what you bring|minimum qualifications|you (have|should have))/i],
    ['qualificationsPreferred', /^(nice.to.have|preferred( qualifications)?|bonus( points)?|plus(es)?|great if|it('|’)?s a plus|even better if|extra credit)/i],
    ['benefits',                /^(benefits?|perks|what we offer|why (join|work)|we offer|compensation (and|&) benefits)/i],
    ['companyDescription',      /^(about (us|the (company|team|studio|agency))|who we are|our (story|company|mission))/i],
    ['salaryText',              /^(compensation|salary|pay( range)?)/i],
  ];

  const SALARY_RE = /(?:[$€£₱]|USD|EUR|GBP|CAD|AUD|PHP)\s?(\d{1,3}(?:[,. ]\d{3})*(?:\.\d+)?)(\s?[kK])?(?:\s?(?:-|–|—|to)\s?(?:[$€£₱]|USD|EUR|GBP|CAD|AUD|PHP)?\s?(\d{1,3}(?:[,. ]\d{3})*(?:\.\d+)?)(\s?[kK])?)?/;
  const CUR_MAP = { $: 'USD', '€': 'EUR', '£': 'GBP', '₱': 'PHP' };

  function parseSalary(text) {
    const m = SALARY_RE.exec(text);
    if (!m) return null;
    const num = (raw, k) => {
      let n = parseFloat(String(raw).replace(/[,. ](?=\d{3}\b)/g, '').replace(/ /g, ''));
      if (k) n *= 1000;
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const min = num(m[1], m[2]);
    const max = m[3] ? num(m[3], m[4] || m[2]) : null;
    if (!min) return null;
    const curSym = (m[0].match(/[$€£₱]|USD|EUR|GBP|CAD|AUD|PHP/) || [])[0];
    const currency = CUR_MAP[curSym] || (['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'PHP'].includes(curSym) ? curSym : 'USD');
    const around = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 40);
    let period = /per\s*hour|\/\s*(hour|hr)|hourly/i.test(around) ? 'hour'
      : /per\s*month|\/\s*(month|mo)\b|monthly/i.test(around) ? 'month'
      : /per\s*(year|annum)|\/\s*(year|yr)|annual|p\.?a\.?\b/i.test(around) ? 'year'
      : null;
    if (!period) period = min < 500 ? 'hour' : 'year';
    return { salaryMin: min, salaryMax: max && max >= min ? max : null, salaryCurrency: currency, salaryPeriod: period };
  }

  function detectArrangement(text) {
    const t = ` ${text.toLowerCase()} `;
    if (/\bhybrid\b/.test(t)) return 'hybrid';
    if (/\bfully remote\b|\bremote.first\b|\bremote\b/.test(t) && !/\bno remote\b|\bnot remote\b/.test(t)) return 'remote';
    if (/\bon.?site\b|\bin.?office\b|\bin.person\b/.test(t)) return 'onsite';
    return null;
  }

  function detectEmployment(text) {
    const t = text.toLowerCase();
    if (/\bintern(ship)?\b/.test(t)) return 'internship';
    if (/\bpart.time\b/.test(t)) return 'part-time';
    if (/\bcontract(or)?\b|\bfixed.term\b/.test(t)) return 'contract';
    if (/\bfreelance\b/.test(t)) return 'freelance';
    if (/\bfull.time\b|\bpermanent\b/.test(t)) return 'full-time';
    return null;
  }

  const isBullet = (line) => /^(\s*)([•·▪‣●○–—*-]|\d{1,2}[.)])\s+/.test(line);
  const stripBullet = (line) => line.replace(/^(\s*)([•·▪‣●○–—*-]|\d{1,2}[.)])\s+/, '').trim();
  const looksLikeHeading = (line) => line.length > 0 && line.length < 64 && !isBullet(line) && !/[.!?]\s*\S/.test(line.slice(0, -1));

  /** Parse a pasted (or extracted) job description into structured fields.
      Everything inferred here is LOW confidence — review before saving. */
  function parseDescription(text, { guessTitle = false } = {}) {
    const clean = jobsCleanText(text);
    const fields = { description: clean };
    const confidence = {};
    if (!clean) return { fields: {}, confidence: {} };

    const lines = clean.split('\n').map((l) => l.trim());
    const buckets = { responsibilities: [], qualificationsRequired: [], qualificationsPreferred: [], benefits: [] };
    let section = null;
    let companyDesc = [];
    let salaryLines = [];

    lines.forEach((line) => {
      if (!line) return;
      const bare = line.replace(/[:：]\s*$/, '');
      if (looksLikeHeading(bare)) {
        const hit = SECTION_PATTERNS.find(([, re]) => re.test(bare));
        if (hit) { section = hit[0]; return; }
        if (bare.length < 40 && section) section = null; // unknown heading ends the section
      }
      if (section === 'companyDescription') { companyDesc.push(line); return; }
      if (section === 'salaryText') { salaryLines.push(line); return; }
      if (section && buckets[section] !== undefined) {
        if (isBullet(line)) buckets[section].push(stripBullet(line));
        else if (line.length > 3 && buckets[section].length < 40) buckets[section].push(line);
      }
    });

    Object.entries(buckets).forEach(([k, v]) => {
      if (v.length) { fields[k] = v.slice(0, 40); confidence[k] = 'low'; }
    });
    if (companyDesc.length) { fields.companyDescription = jobsCleanText(companyDesc.join('\n'), 2000); confidence.companyDescription = 'low'; }

    const sal = parseSalary(salaryLines.join(' ') || clean);
    if (sal) { Object.assign(fields, sal); ['salaryMin', 'salaryMax', 'salaryCurrency', 'salaryPeriod'].forEach((k) => { confidence[k] = 'low'; }); }

    const arr = detectArrangement(clean);
    if (arr) { fields.arrangement = arr; confidence.arrangement = 'low'; }
    const emp = detectEmployment(clean);
    if (emp) { fields.employmentType = emp; confidence.employmentType = 'low'; }

    if (guessTitle) {
      const first = lines.find((l) => l && l.length < 80);
      if (first && !isBullet(first)) { fields.title = first; confidence.title = 'low'; }
      const atMatch = clean.slice(0, 300).match(/\bat\s+([A-Z][\w&.' -]{1,40})(?:\n|,|\.|$)/);
      if (atMatch) { fields.company = atMatch[1].trim(); confidence.company = 'low'; }
    }
    return { fields, confidence };
  }

  /* ── ATS providers (public JSON APIs, CORS-enabled) ─────── */

  function host(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }
  function parts(url) { try { return new URL(url).pathname.split('/').filter(Boolean); } catch (e) { return []; } }

  /** Merge parsed sections under provider fields (provider wins). */
  function withSections(fields, confidence, provider, sourceUrl) {
    if (fields.description) {
      const parsed = parseDescription(fields.description);
      Object.entries(parsed.fields).forEach(([k, v]) => {
        if (fields[k] === undefined || fields[k] === null || fields[k] === '' || (Array.isArray(fields[k]) && !fields[k].length)) {
          fields[k] = v;
          confidence[k] = parsed.confidence[k] || 'low';
        }
      });
    }
    Object.keys(fields).forEach((k) => { if (!confidence[k]) confidence[k] = 'high'; });
    return { fields, confidence, provider, sourceUrl };
  }

  const PROVIDERS = [
    {
      id: 'greenhouse', label: 'Greenhouse',
      detect(url) {
        const h = host(url), p = parts(url);
        if (!/(^|\.)greenhouse\.io$/.test(h)) return null;
        const i = p.indexOf('jobs');
        if (i > 0 && p[i + 1]) return { board: p[i - 1], jobId: p[i + 1] };
        return null;
      },
      async extract(url, m) {
        const data = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(m.board)}/jobs/${encodeURIComponent(m.jobId)}?questions=true`);
        const fields = {};
        const confidence = {};
        if (data.title) fields.title = data.title;
        if (data.company_name) fields.company = data.company_name;
        else { fields.company = m.board.replace(/[-_]/g, ' '); confidence.company = 'low'; }
        if (data.location?.name) fields.location = data.location.name;
        if (data.absolute_url) fields.url = data.absolute_url;
        if (data.updated_at) fields.postedDate = String(data.updated_at).slice(0, 10);
        if (data.content) fields.description = htmlToText(decodeEntities(data.content));
        fields.source = 'job-board';
        if (Array.isArray(data.departments) && data.departments[0]?.name) fields.companyIndustry = '';
        return withSections(fields, confidence, 'Greenhouse', url);
      },
    },
    {
      id: 'lever', label: 'Lever',
      detect(url) {
        const h = host(url), p = parts(url);
        if (!/(^|\.)lever\.co$/.test(h) || !h.startsWith('jobs.')) return null;
        if (p.length >= 2) return { company: p[0], jobId: p[1] };
        return null;
      },
      async extract(url, m) {
        const data = await getJSON(`https://api.lever.co/v0/postings/${encodeURIComponent(m.company)}/${encodeURIComponent(m.jobId)}`);
        const fields = {};
        const confidence = {};
        if (data.text) fields.title = data.text;
        fields.company = m.company.replace(/[-_]/g, ' ');
        confidence.company = 'low';
        if (data.categories?.location) fields.location = data.categories.location;
        if (data.categories?.commitment) {
          const emp = detectEmployment(data.categories.commitment);
          if (emp) fields.employmentType = emp;
        }
        if (data.workplaceType === 'remote') fields.arrangement = 'remote';
        else if (data.workplaceType === 'hybrid') fields.arrangement = 'hybrid';
        else if (data.workplaceType === 'on-site' || data.workplaceType === 'onsite') fields.arrangement = 'onsite';
        if (data.hostedUrl) fields.url = data.hostedUrl;
        if (data.createdAt) fields.postedDate = new Date(data.createdAt).toISOString().slice(0, 10);
        if (data.salaryRange?.min) {
          fields.salaryMin = data.salaryRange.min;
          fields.salaryMax = data.salaryRange.max || null;
          if (data.salaryRange.currency) fields.salaryCurrency = data.salaryRange.currency;
          if (data.salaryRange.interval) fields.salaryPeriod = /hour/i.test(data.salaryRange.interval) ? 'hour' : /month/i.test(data.salaryRange.interval) ? 'month' : 'year';
        }
        const bodyBits = [data.descriptionPlain || htmlToText(data.description || '')];
        (data.lists || []).forEach((l) => { bodyBits.push(`${l.text}\n${htmlToText(l.content || '')}`); });
        if (data.additionalPlain) bodyBits.push(data.additionalPlain);
        fields.description = bodyBits.filter(Boolean).join('\n\n');
        fields.source = 'job-board';
        return withSections(fields, confidence, 'Lever', url);
      },
    },
    {
      id: 'ashby', label: 'Ashby',
      detect(url) {
        const h = host(url), p = parts(url);
        if (!/(^|\.)ashbyhq\.com$/.test(h)) return null;
        if (p.length >= 2) return { org: p[0], jobId: p[1] };
        return null;
      },
      async extract(url, m) {
        const data = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(m.org)}?includeCompensation=true`);
        const job = (data.jobs || []).find((j) => j.id === m.jobId || (j.jobUrl || '').includes(m.jobId));
        if (!job) throw new JobsExtractError('notfound', 'That posting was not found on the company’s Ashby board — it may have closed.');
        const fields = {};
        const confidence = {};
        if (job.title) fields.title = job.title;
        fields.company = m.org.replace(/[-_]/g, ' ');
        confidence.company = 'low';
        if (job.location) fields.location = job.location;
        if (job.isRemote) fields.arrangement = 'remote';
        if (job.employmentType) { const e = detectEmployment(job.employmentType); if (e) fields.employmentType = e; }
        if (job.publishedAt) fields.postedDate = String(job.publishedAt).slice(0, 10);
        if (job.jobUrl) fields.url = job.jobUrl;
        fields.description = job.descriptionPlain || htmlToText(job.descriptionHtml || '');
        if (job.compensation?.compensationTierSummary) {
          const sal = parseSalary(job.compensation.compensationTierSummary);
          if (sal) { Object.assign(fields, sal); ['salaryMin', 'salaryMax', 'salaryCurrency', 'salaryPeriod'].forEach((k) => { confidence[k] = 'low'; }); }
        }
        fields.source = 'job-board';
        return withSections(fields, confidence, 'Ashby', url);
      },
    },
    {
      id: 'workable', label: 'Workable',
      detect(url) {
        const h = host(url), p = parts(url);
        if (!/(^|\.)workable\.com$/.test(h) || !h.startsWith('apply.')) return null;
        const i = p.indexOf('j');
        if (i > 0 && p[i + 1]) return { company: p[0], shortcode: p[i + 1] };
        return null;
      },
      async extract(url, m) {
        const data = await getJSON(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(m.company)}?details=true`);
        const job = (data.jobs || []).find((j) => j.shortcode === m.shortcode || (j.url || '').includes(m.shortcode));
        if (!job) throw new JobsExtractError('notfound', 'That posting was not found on the company’s Workable board — it may have closed.');
        const fields = {};
        const confidence = {};
        if (job.title) fields.title = job.title;
        if (data.name) fields.company = data.name;
        else { fields.company = m.company.replace(/[-_]/g, ' '); confidence.company = 'low'; }
        const loc = [job.city, job.state, job.country].filter(Boolean).join(', ');
        if (loc) fields.location = loc;
        if (job.telecommuting) fields.arrangement = 'remote';
        if (job.employment_type) { const e = detectEmployment(job.employment_type); if (e) fields.employmentType = e; }
        if (job.published_on) fields.postedDate = String(job.published_on).slice(0, 10);
        if (job.url) fields.url = job.url;
        fields.description = htmlToText(job.description || '');
        fields.source = 'job-board';
        return withSections(fields, confidence, 'Workable', url);
      },
    },
    {
      id: 'smartrecruiters', label: 'SmartRecruiters',
      detect(url) {
        const h = host(url), p = parts(url);
        if (!/(^|\.)smartrecruiters\.com$/.test(h)) return null;
        if (p.length >= 2) {
          const idMatch = p[1].match(/^(\d{9,})/);
          if (idMatch) return { company: p[0], jobId: idMatch[1] };
        }
        return null;
      },
      async extract(url, m) {
        const data = await getJSON(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(m.company)}/postings/${encodeURIComponent(m.jobId)}`);
        const fields = {};
        const confidence = {};
        if (data.name) fields.title = data.name;
        if (data.company?.name) fields.company = data.company.name;
        else { fields.company = m.company; confidence.company = 'low'; }
        const loc = [data.location?.city, data.location?.country?.toUpperCase()].filter(Boolean).join(', ');
        if (loc) fields.location = loc;
        if (data.location?.remote) fields.arrangement = 'remote';
        if (data.typeOfEmployment?.label) { const e = detectEmployment(data.typeOfEmployment.label); if (e) fields.employmentType = e; }
        if (data.experienceLevel?.label) fields.experienceLevel = data.experienceLevel.label;
        if (data.releasedDate) fields.postedDate = String(data.releasedDate).slice(0, 10);
        if (data.industry?.label) fields.companyIndustry = data.industry.label;
        const ad = data.jobAd?.sections || {};
        const bits = [];
        if (ad.companyDescription?.text) fields.companyDescription = jobsCleanText(htmlToText(ad.companyDescription.text), 2000);
        if (ad.jobDescription?.text) bits.push(htmlToText(ad.jobDescription.text));
        if (ad.qualifications?.text) bits.push('Requirements\n' + htmlToText(ad.qualifications.text));
        if (ad.additionalInformation?.text) bits.push(htmlToText(ad.additionalInformation.text));
        fields.description = bits.join('\n\n');
        fields.url = url;
        fields.source = 'job-board';
        return withSections(fields, confidence, 'SmartRecruiters', url);
      },
    },
    {
      /* Optional generic extractor endpoint (advanced). Off unless the user
         sets one in Settings → Job Applications — the provider contract lets a
         serverless JSON-LD/LLM extractor plug in later with no UI changes. */
      id: 'remote', label: 'Custom extractor',
      detect(url) {
        const endpoint = window.JobsStore && JobsStore.state?.settings?.extractorEndpoint;
        return endpoint && /^https:\/\//.test(endpoint) ? { endpoint } : null;
      },
      async extract(url, m) {
        const data = await getJSON(`${m.endpoint}${m.endpoint.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`);
        if (data.error) throw new JobsExtractError(data.error === 'blocked' ? 'blocked' : 'network', data.message || 'The extractor could not read that page.');
        const fields = data.fields && typeof data.fields === 'object' ? data.fields : {};
        const confidence = data.confidence && typeof data.confidence === 'object' ? data.confidence : {};
        if (fields.description) fields.description = jobsCleanText(fields.description);
        return withSections(fields, confidence, data.provider || 'Custom extractor', url);
      },
    },
  ];

  /* Known-blocked hosts get an honest, specific message up front instead of a
     misleading network error. */
  const BLOCKED_HOSTS = [
    { re: /(^|\.)linkedin\.com$/, name: 'LinkedIn' },
    { re: /(^|\.)indeed\.com$/, name: 'Indeed' },
    { re: /(^|\.)glassdoor\./, name: 'Glassdoor' },
    { re: /(^|\.)ziprecruiter\.com$/, name: 'ZipRecruiter' },
  ];

  async function fromUrl(url) {
    let u;
    try {
      u = new URL(String(url).trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
    } catch (e) {
      throw new JobsExtractError('parse', 'That doesn’t look like a valid link — paste the full job listing URL (starting with https://).');
    }
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    const blocked = BLOCKED_HOSTS.find((b) => b.re.test(h));
    for (const p of PROVIDERS) {
      const m = p.detect(u.href);
      if (m) {
        if (p.id === 'remote' && blocked) break; // even the custom endpoint rarely gets through these
        return p.extract(u.href, m);
      }
    }
    if (blocked) {
      throw new JobsExtractError('blocked',
        `${blocked.name} blocks automated reading of its pages, so nothing could be extracted. The link is saved — paste the job description below and it will be structured for you.`);
    }
    throw new JobsExtractError('unsupported',
      'This site doesn’t offer a public job API this app can read directly (works: Greenhouse, Lever, Ashby, Workable, SmartRecruiters links). The link is saved — paste the job description below and it will be structured for you.');
  }

  function fromText(text) {
    return parseDescription(text, { guessTitle: true });
  }

  return { fromUrl, fromText, parseDescription, parseSalary, normalizeUrl, findDuplicates, JobsExtractError, PROVIDERS };
})();
