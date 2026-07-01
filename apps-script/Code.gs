/**
 * Personal Dashboard — Google Sheets sync (Google Apps Script)
 * ------------------------------------------------------------
 * Deploy this under YOUR OWN Google account. No keys, no secrets.
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
 * The dashboard's "Push to Sheet" writes rows; "Pull from Sheet" reads them.
 * Sheet layout (tab "Dashboard"): id | label | value | goal | updated
 */

var SHEET_NAME = 'Dashboard';

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

/** GET → returns all metrics as JSON: { metrics: { id: { value, goal } } } */
function doGet() {
  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var metrics = {};
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][0]).trim();
    if (!id) continue;
    metrics[id] = { value: Number(rows[i][2]), goal: Number(rows[i][3]) };
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, metrics: metrics }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST → upserts metrics from JSON body: { metrics: { id: { label, value, goal } } } */
function doPost(e) {
  var out = { ok: true, updated: 0 };
  try {
    var body = JSON.parse(e.postData.contents);
    var metrics = body.metrics || {};
    var sheet = getSheet_();
    var rows = sheet.getDataRange().getValues();
    var rowById = {};
    for (var i = 1; i < rows.length; i++) {
      rowById[String(rows[i][0]).trim()] = i + 1; // 1-based sheet row
    }
    var now = new Date();
    Object.keys(metrics).forEach(function (id) {
      var m = metrics[id];
      var rowValues = [id, m.label || id, Number(m.value) || 0, Number(m.goal) || 0, now];
      if (rowById[id]) {
        sheet.getRange(rowById[id], 1, 1, 5).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
      out.updated++;
    });
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
