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
const HEADERS = ['id','firstname','lastname','phone','social','deed','district','province','price','areaRai','areaNgan','areaWah','coords','notes','marketing','marketingCost','hasFront','hasBack','createdAt','updatedAt','json'];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list');
    if (action === 'list') return jsonOutput({ok:true, records:listRecords()});
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
      sendLine(body.message || buildLineMessage(record));
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

function normalizeCell(value) {
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  if (value === null || value === undefined) return '';
  return String(value);
}

function sendLine(message) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const to = props.getProperty('LINE_TO');
  if (!token || !to) return;
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:'post', contentType:'application/json', muteHttpExceptions:true,
    headers:{Authorization:'Bearer ' + token},
    payload:JSON.stringify({to:to, messages:[{type:'text', text:String(message).slice(0,5000)}]})
  });
  if (response.getResponseCode() >= 300) throw new Error('LINE API: ' + response.getContentText());
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
