/**
 * Din-Esan shared database + LINE notification
 * 1) สร้าง Google Sheet ว่าง 1 ไฟล์
 * 2) Extensions > Apps Script แล้ววางโค้ดนี้
 * 3) Project Settings > Script Properties เพิ่ม:
 *      SPREADSHEET_ID = รหัส Google Sheet
 *      LINE_CHANNEL_ACCESS_TOKEN = Channel access token ของ LINE Messaging API
 *      LINE_TO = User ID หรือ Group ID ที่ต้องการรับแจ้งเตือน
 * 4) Deploy > Manage deployments > Edit > New version > Execute as Me > Anyone
 */

const SHEET_NAME = 'Customers';
const APPOINTMENT_SHEET_NAME = 'Appointments';
const HEADERS = ['id','firstname','lastname','phone','social','deed','district','province','price','areaRai','areaNgan','areaWah','coords','notes','marketing','marketingCost','hasFront','hasBack','createdAt','updatedAt','json'];
const APPOINTMENT_HEADERS = ['id','date','time','customerId','customerName','location','notes','calendarEventId','calendarHtmlLink','createdAt','updatedAt','json'];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list');
    if (action === 'list') return jsonOutput({ok:true, records:listRecords()});
    if (action === 'list_appointments') return jsonOutput({ok:true, appointments:listAppointments()});
    if (action === 'line_status') return jsonOutput(getLineStatus());
    if (action === 'line_notify') {
      const message = String((e && e.parameter && e.parameter.message) || '').trim();
      if (!message) throw new Error('Missing LINE message');
      const lineResult = sendLine(message);
      return jsonOutput({ok:true, line:lineResult});
    }
    return jsonOutput({ok:false, error:'Unknown action'});
  } catch (err) {
    return jsonOutput({ok:false, error:String(err && err.message || err)});
  }
}

function doPost(e) {
  try {
    // รองรับทั้ง JSON เดิม และ payload จาก application/x-www-form-urlencoded
    let raw = '';
    if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }
    const body = JSON.parse(raw || '{}');
    const action = String(body.action || body.type || '');
    if (action === 'upsert') {
      const record = body.data || body.customer;
      if (!record || !record.id) throw new Error('Missing customer id');
      upsertRecord(record);
      return jsonOutput({ok:true});
    }
    if (action === 'delete') {
      const id = body.data && body.data.id;
      if (!id) throw new Error('Missing customer id');
      deleteRecord(id);
      return jsonOutput({ok:true});
    }
    if (action === 'new_customer') {
      const record = body.customer || body.data || {};
      if (record.id) upsertRecord(record);
      const lineResult = sendLine(body.message || buildLineMessage(record));
      return jsonOutput({ok:true, line:lineResult});
    }
    if (action === 'upsert_appointment') {
      const appt = body.data || body.appointment;
      if (!appt || !appt.id) throw new Error('Missing appointment id');
      upsertAppointment(appt);
      return jsonOutput({ok:true});
    }
    if (action === 'delete_appointment') {
      const id = body.data && body.data.id;
      if (!id) throw new Error('Missing appointment id');
      deleteAppointmentRecord(id);
      return jsonOutput({ok:true});
    }
    return jsonOutput({ok:false, error:'Unknown action'});
  } catch (err) {
    return jsonOutput({ok:false, error:String(err && err.message || err)});
  }
}

function getSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน Script Properties');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function listRecords() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.map(row => {
    try { return JSON.parse(row[HEADERS.indexOf('json')] || '{}'); }
    catch (_) { return null; }
  }).filter(Boolean).sort((a,b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function upsertRecord(record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    let rowNumber = lastRow + 1;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
      const index = ids.indexOf(String(record.id));
      if (index >= 0) rowNumber = index + 2;
    }
    const row = HEADERS.map(h => h === 'json' ? JSON.stringify(record) : normalizeCell(record[h]));
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  } finally { lock.releaseLock(); }
}

function deleteRecord(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(String(id));
    if (index >= 0) sheet.deleteRow(index + 2);
  } finally { lock.releaseLock(); }
}


function getAppointmentSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน Script Properties');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(APPOINTMENT_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(APPOINTMENT_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(APPOINTMENT_HEADERS);
  return sheet;
}

function listAppointments() {
  const sheet = getAppointmentSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, APPOINTMENT_HEADERS.length).getValues();
  return values.map(row => {
    try { return JSON.parse(row[APPOINTMENT_HEADERS.indexOf('json')] || '{}'); }
    catch (_) { return null; }
  }).filter(Boolean).sort((a,b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function upsertAppointment(appt) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getAppointmentSheet();
    const lastRow = sheet.getLastRow();
    let rowNumber = lastRow + 1;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
      const index = ids.indexOf(String(appt.id));
      if (index >= 0) rowNumber = index + 2;
    }
    if (!appt.updatedAt) appt.updatedAt = Date.now();
    const row = APPOINTMENT_HEADERS.map(h => h === 'json' ? JSON.stringify(appt) : normalizeCell(appt[h]));
    sheet.getRange(rowNumber, 1, 1, APPOINTMENT_HEADERS.length).setValues([row]);
  } finally { lock.releaseLock(); }
}

function deleteAppointmentRecord(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getAppointmentSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(String(id));
    if (index >= 0) sheet.deleteRow(index + 2);
  } finally { lock.releaseLock(); }
}

function normalizeCell(value) {
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  if (value === null || value === undefined) return '';
  return String(value);
}

function sendLine(message) {
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '').trim();
  const to = String(props.getProperty('LINE_TO') || '').trim();
  const attemptedAt = Date.now();

  if (!token) {
    const error = 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน Script Properties';
    saveLineStatus(false, error, attemptedAt, 0);
    throw new Error(error);
  }
  if (!to) {
    const error = 'ยังไม่ได้ตั้งค่า LINE_TO ใน Script Properties';
    saveLineStatus(false, error, attemptedAt, 0);
    throw new Error(error);
  }

  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:'post',
    contentType:'application/json',
    muteHttpExceptions:true,
    headers:{Authorization:'Bearer ' + token},
    payload:JSON.stringify({to:to, messages:[{type:'text', text:String(message).slice(0,5000)}]})
  });
  const code = response.getResponseCode();
  const content = response.getContentText();
  if (code >= 300) {
    const error = 'LINE API ' + code + ': ' + content;
    saveLineStatus(false, error, attemptedAt, code);
    throw new Error(error);
  }
  saveLineStatus(true, '', attemptedAt, code);
  return {ok:true, responseCode:code, attemptedAt:attemptedAt};
}

function saveLineStatus(ok, error, attemptedAt, responseCode) {
  PropertiesService.getScriptProperties().setProperties({
    LAST_LINE_OK: ok ? 'true' : 'false',
    LAST_LINE_ERROR: String(error || ''),
    LAST_LINE_AT: String(attemptedAt || Date.now()),
    LAST_LINE_RESPONSE_CODE: String(responseCode || 0)
  });
}

function getLineStatus() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok:true,
    configured: Boolean(String(props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '').trim() && String(props.getProperty('LINE_TO') || '').trim()),
    lastOk: props.getProperty('LAST_LINE_OK') === 'true',
    lastError: props.getProperty('LAST_LINE_ERROR') || '',
    lastAt: Number(props.getProperty('LAST_LINE_AT') || 0),
    responseCode: Number(props.getProperty('LAST_LINE_RESPONSE_CODE') || 0)
  };
}

function buildLineMessage(r) {
  return ['🔔 มีลูกค้าใหม่ฝากขายที่ดิน',
    'ชื่อ: ' + ((r.firstname || '') + ' ' + (r.lastname || '')).trim(),
    'โทร: ' + (r.phone || '-'), 'เลขโฉนด: ' + (r.deed || '-'),
    'ทำเล: ' + [r.district,r.province].filter(Boolean).join(', ')
  ].join('\n');
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
