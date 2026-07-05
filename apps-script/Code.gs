/**
 * Studio OS — Google Sheets sync
 * ---------------------------------------------------------
 * Deploy this under YOUR OWN Google account. No keys, no secrets.
 * One deployment syncs BOTH the dashboard metrics and the pipeline.
 *
 * SETUP (≈2 minutes):
 * 1. Create a new Google Sheet (any name).
 * 2. Extensions → Apps Script. Delete the default code, paste this file.
 * 3. Deploy → New deployment → type "Web app".
 *      - Execute as:  Me
 *      - Who has access:  Anyone with the link
 * 4. Copy the Web App URL (ends in /exec).
 * 5. Paste it into the dashboard: Settings → Google Sheets sync.
 *
 * ALREADY DEPLOYED AN OLDER VERSION? Paste this file over the old code,
 * then Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.
 * (Same URL keeps working.)
 *
 * Tabs used:
 *   "Dashboard" — id | label | value | goal | updated
 *   "Pipeline"  — one row per lead, one column per field
 */

var SHEET_NAME = 'Dashboard';
var PIPELINE_NAME = 'Pipeline';

var LEAD_HEADERS = [
  'id', 'business', 'industry', 'country', 'website', 'social',
  'decisionMaker', 'email', 'problem', 'offer', 'channel',
  'dateContacted', 'followUpDate', 'status',
  'replied', 'callBooked', 'proposalSent',
  'dealValue', 'dealType', 'notes', 'lossReason', 'archived',
  'wonAt', 'createdAt', 'updatedAt', 'activity',
];

/* ── Dashboard tab ─────────────────────────────────────────── */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'label', 'value', 'goal', 'updated']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ── Pipeline tab ──────────────────────────────────────────── */

function getPipelineSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PIPELINE_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PIPELINE_NAME);
    sheet.appendRow(LEAD_HEADERS);
    sheet.setFrozenRows(1);
    // Plain-text format everywhere so dates/ids never get mangled.
    sheet.getRange(1, 1, sheet.getMaxRows(), LEAD_HEADERS.length).setNumberFormat('@');
  }
  return sheet;
}

function leadToRow_(lead) {
  return LEAD_HEADERS.map(function (key) {
    var v = lead[key];
    if (v === null || v === undefined) return '';
    if (key === 'activity') return JSON.stringify(v);
    return String(v);
  });
}

function rowToLead_(row) {
  var lead = {};
  LEAD_HEADERS.forEach(function (key, i) {
    var v = row[i];
    if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    v = String(v === null || v === undefined ? '' : v).trim();
    if (key === 'dealValue') lead[key] = Number(v) || 0;
    else if (key === 'replied' || key === 'callBooked' || key === 'proposalSent' || key === 'archived') {
      lead[key] = v.toLowerCase() === 'true';
    } else if (key === 'activity') {
      try { lead[key] = v ? JSON.parse(v) : []; } catch (e) { lead[key] = []; }
    } else {
      lead[key] = v === '' ? null : v;
    }
  });
  return lead;
}

/* ── HTTP handlers ─────────────────────────────────────────── */

/**
 * GET → ?action=crm returns pipeline leads, otherwise dashboard metrics.
 */
function doGet(e) {
  var out;
  if (e && e.parameter && e.parameter.action === 'crm') {
    var sheet = getPipelineSheet_();
    var rows = sheet.getDataRange().getValues();
    var leads = [];
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim()) leads.push(rowToLead_(rows[i]));
    }
    out = { ok: true, kind: 'crm', leads: leads };
  } else {
    var dsheet = getSheet_();
    var drows = dsheet.getDataRange().getValues();
    var metrics = {};
    for (var j = 1; j < drows.length; j++) {
      var id = String(drows[j][0]).trim();
      if (!id) continue;
      metrics[id] = { value: Number(drows[j][2]), goal: Number(drows[j][3]) };
    }
    out = { ok: true, metrics: metrics };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST → body { kind:'crm', leads:[…] } mirrors the pipeline;
 *        body { metrics:{…} } upserts dashboard metrics (unchanged).
 */
function doPost(e) {
  var out = { ok: true, updated: 0 };
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.kind === 'crm') {
      // Push = mirror: the Pipeline tab becomes exactly your current leads.
      var leads = body.leads || [];
      var sheet = getPipelineSheet_();
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, LEAD_HEADERS.length).clearContent();
      if (leads.length) {
        var rows = leads.map(leadToRow_);
        var range = sheet.getRange(2, 1, rows.length, LEAD_HEADERS.length);
        range.setNumberFormat('@');
        range.setValues(rows);
      }
      out.kind = 'crm';
      out.updated = leads.length;
    } else {
      var metrics = body.metrics || {};
      var dsheet = getSheet_();
      var drows = dsheet.getDataRange().getValues();
      var rowById = {};
      for (var i = 1; i < drows.length; i++) {
        rowById[String(drows[i][0]).trim()] = i + 1; // 1-based sheet row
      }
      var now = new Date();
      Object.keys(metrics).forEach(function (id) {
        var m = metrics[id];
        var rowValues = [id, m.label || id, Number(m.value) || 0, Number(m.goal) || 0, now];
        if (rowById[id]) {
          dsheet.getRange(rowById[id], 1, 1, 5).setValues([rowValues]);
        } else {
          dsheet.appendRow(rowValues);
        }
        out.updated++;
      });
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
