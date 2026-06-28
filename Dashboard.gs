function doGet(e) {
  if (e.parameter.action === "dashboard") {
    return HtmlService.createHtmlOutput(`
      <h1>DIN-ESAN v6.1</h1>
      <p>Admins: ${getAdmins()}</p>
      <p>Total logs: ${getUsers().length}</p>
    `);
  }

  return ContentService.createTextOutput("DIN-ESAN v6.1 READY");
}