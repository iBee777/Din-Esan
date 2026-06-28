function saveUser(userId, text) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName("logs");

  if (!sheet) {
    sheet = ss.insertSheet("logs");
    sheet.appendRow(["time","userId","text"]);
  }

  sheet.appendRow([new Date(), userId, text]);
}

function getUsers() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName("logs");
  return sheet.getDataRange().getValues();
}

function getAdmins() {
  return PropertiesService.getScriptProperties().getProperty("ADMINS") || "";
}