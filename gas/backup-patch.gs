/**
 * backup-patch v1 — 「ai-empower 評量資料庫」每日自動備份（R2）
 *
 * 部署（一次、約 2 分鐘）：
 *   1. 開 Apps Script 專案（收評量資料那支，含 SHEET_ID 的「程式碼.gs」）。
 *   2. 把本檔全文貼到「程式碼.gs」最下方（與 me-patch 同法），存檔。
 *   3. 在編輯器上方函式選單選 setupDailyBackup → 執行 → 授權（Drive 權限）。
 *      跑完會立刻先備份一次，Drive 出現「DB-backup」資料夾即成功。
 *   4. 完成。之後每天 03:00（台北）自動備份，滾動保留最近 30 份。
 *
 * 還原：Drive「DB-backup」找到該日複本 → 開啟即是完整試算表（records 長表＋全部 kind 分表）。
 * 不動前端、不動 doGet/doPost；重複執行 setupDailyBackup 只會重建觸發器，不會疊加。
 */

var BK_FOLDER = 'DB-backup';   // Drive 備份資料夾名稱
var BK_KEEP   = 30;            // 滾動保留份數

function setupDailyBackup() {
  // 清掉舊觸發器，避免重複
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyBackup_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyBackup_')
    .timeBased().atHour(3).everyDays(1).inTimezone('Asia/Taipei').create();
  dailyBackup_(); // 立刻先跑一次以驗證授權與資料夾
}

function dailyBackup_() {
  var ss = SpreadsheetApp.openById(SHEET_ID); // SHEET_ID 沿用主程式常數
  var folder = bkFolder_();
  var name = ss.getName() + '-' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');

  // 同日重跑：先移除同名舊檔
  var dup = folder.getFilesByName(name);
  while (dup.hasNext()) dup.next().setTrashed(true);

  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);

  // 滾動保留 BK_KEEP 份（其餘移到垃圾桶，30 天內仍可救回）
  var files = [], it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = BK_KEEP; i < files.length; i++) files[i].setTrashed(true);
}

function bkFolder_() {
  var it = DriveApp.getFoldersByName(BK_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BK_FOLDER);
}
