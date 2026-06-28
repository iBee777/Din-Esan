
const SHEET_NAME = "Data";

function doGet(e) {
  const action = e?.parameter?.action || "list";
  if (action === "list") return listData();
  return ContentService.createTextOutput("OK");
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents || "{}");
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  sh.appendRow([
    new Date(),
    data.name || "",
    data.phone || "",
    data.note || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function listData() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const values = sh.getDataRange().getValues();

  const records = values.slice(1).map(r => ({
    time: r[0],
    name: r[1],
    phone: r[2],
    note: r[3]
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ok:true, records}))
    .setMimeType(ContentService.MimeType.JSON);
}
