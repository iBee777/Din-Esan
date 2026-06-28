function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body.events) return ok();

    body.events.forEach(handleEvent);
    return ok();
  } catch (err) {
    Logger.log(err);
    return ok();
  }
}

function ok() {
  return ContentService.createTextOutput("OK");
}

function handleEvent(event) {
  if (event.type !== "message") return;

  const userId = event.source.userId;
  const text = event.message.text;

  autoAdminDetect(userId);

  saveUser(userId, text);
  reply(userId, ai(text));
}

function autoAdminDetect(userId) {
  const props = PropertiesService.getScriptProperties();
  let admins = props.getProperty("ADMINS");

  if (!admins || admins.trim() === "") {
    props.setProperty("ADMINS", userId);
  }
}

function reply(to, msg) {
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + CONFIG.TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      to,
      messages: [{ type: "text", text: msg }]
    })
  });
}

function ai(text){
  text = text.toLowerCase();
  if(text.includes("ราคา")) return "เริ่มต้น 40 บาท";
  if(text.includes("เวลา")) return "08:00 - 18:00";
  return "พิมพ์: ราคา / เวลา";
}