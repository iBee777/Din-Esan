function handleMessage(event) {
  const text = event.message.text;
  const userId = event.source.userId;
  const reply = aiEngine(text);
  pushLine(userId, reply);
  saveLog(userId, text);
}

function aiEngine(text) {
  const t = text.toLowerCase();
  if (t.includes("เปิด")) return "08:00-18:00";
  if (t.includes("ปิด")) return "18:00";
  if (t.includes("ราคา")) return "เริ่มต้น 40 บาท";
  return "พิมพ์: ราคา / เวลา / จอง";
}

function pushLine(to, msg) {
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + CONFIG.TOKEN,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      to: to,
      messages: [{ type: "text", text: msg }]
    })
  });
}

function notifyAdmins(msg) {
  CONFIG.ADMINS.forEach(id => {
    if (id) pushLine(id, msg);
  });
}