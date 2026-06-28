const CONFIG = {
  TOKEN: PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN"),
  SHEET_ID: PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"),
  ADMINS: (PropertiesService.getScriptProperties().getProperty("ADMINS") || "").split(",")
};