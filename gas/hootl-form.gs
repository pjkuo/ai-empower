/**
 * hootl-form.gs — HOOTL 治理素養問卷（Google 表單）產生器＋送出處理
 * 屏東科技大學．AI empower evaluation（AEE）HOOTL 層｜2026-11-04 v1.0
 *
 * 一支獨立 Apps Script 專案：
 *   ① buildHootlForm()：建立問卷表單（完整學號、班級、施測階段＋13 題李克特＋2 題開放題）、
 *      回覆試算表、「計分」工作表與送出觸發器；執行紀錄印出前測／後測預填網址。
 *   ② onHootlFormSubmit(e)：學生送出後——
 *        ・反向題（6、13）以 6 − x 換算，事前規則（1–6）與事後評量（8–13）各取平均，換成 0–100；
 *        ・注意力檢核（第 7 題須選 2）與直線作答（12 題全同分）標記為無效，不納入個人分析；
 *        ・寫進「計分」工作表；
 *        ・推送 ai-empower 統一記錄（kind = hootl-survey，app = hootl-form）到「ai-empower 評量資料庫」。
 *
 * 【安裝】
 *   1. https://script.google.com → 新專案 → 命名「HOOTL 治理素養問卷_Google表單產生器」→ 貼上本檔。
 *   2. 上方函式選 buildHootlForm → 執行 → 依提示授權（表單、試算表、外部連線、觸發器）。
 *   3. 執行紀錄會印出：學生填答網址、前測／後測預填網址、表單編輯網址、回覆試算表網址。
 *   4. 把前測／後測網址填進 hootl.html 的 <meta name="ae-hootl-form-pre|post">。
 *   5. 只想檢查計分邏輯、不寫任何資料：執行 selfTest()。
 *
 * 【不計分】問卷不計入 AEE（自評與實作表現無相關，ρ = −.10），只作聚合效度與教學回饋；detail.graded = false。
 * 【隱私】完整學號只留在回覆試算表；評量資料庫只收學號後 4 碼與完整學號的 SHA-256 雜湊（前後測配對用）。
 */

// ===================== 設定 =====================
var CFG = {
  CLOUD_URL: 'https://script.google.com/macros/s/AKfycbz7wHWbc7go-OVR0Q_g_NBzDqwzV9-leqL1CRe1S9wGkLLjvJIAm-KrZj80s1KJ_VdGVg/exec',  // ai-empower 評量資料庫
  WEB_URL:   'https://pjkuo.github.io/ai-empower/hootl.html',
  TITLE:     'HOOTL 治理素養問卷',
  APP:       'hootl-form',
  KIND:      'hootl-survey',
  CLASSES:   ['資管一A 計算機概論', '車輛一A 數位科技與AI應用', '機械一A 數位科技與AI應用', '其他']
};

var Q = { SID: '完整學號', CLS: '班級', STAGE: '施測階段', O1: '14. 這次專題中，你訂的哪一條規則最有用？為什麼？', O2: '15. 你發現 AI 最難察覺的一個錯誤是什麼？你是怎麼發現的？' };
var STAGE = { pre: '前測（第 15 週）', post: '後測（第 16 週）' };

// 13 題：[題號, 分量表 R/E/C, 題目, 是否反向]
var ITEMS = [
  [1, 'R', '在讓 AI 彙整專題前，我會先寫下 AI 要完成的範圍與不可做的事。', false],
  [2, 'R', '我會為 AI 的產出訂出可以檢查的驗收條件。', false],
  [3, 'R', '我會設定明確的判斷門檻（例如數值上下限），而不是只寫「正確」或「合理」。', false],
  [4, 'R', '我會事先決定 AI 的產出不符合條件時要怎麼處理。', false],
  [5, 'R', '我能說明自己訂的每一條規則，是為了防止哪一種錯誤。', false],
  [6, 'R', '我通常直接讓 AI 開始彙整，有問題再說。', true],
  [7, 'C', '本題請選 2（不同意）。', false],
  [8, 'E', 'AI 彙整完成後，我會逐項對照驗收條件檢查。', false],
  [9, 'E', '我會實際執行程式或重算數據，確認 AI 的結果。', false],
  [10, 'E', '發現 AI 的錯誤時，我能指出錯在哪裡並加以修正。', false],
  [11, 'E', 'AI 的產出看起來正確時，我仍會找證據確認。', false],
  [12, 'E', '我能清楚說明成果中哪些部分由 AI 產生、哪些經我確認。', false],
  [13, 'E', '只要 AI 的成果看起來完整，我就會直接採用。', true]
];
function itemTitle_(it) { return it[0] + '. ' + it[2]; }

// ===================== ① 建立表單 =====================
function buildHootlForm() {
  var form = FormApp.create(CFG.TITLE);
  form.setDescription(
    '這份問卷了解你在「AI 彙整專題」前後怎麼訂規則、怎麼檢查。共 13 題選擇＋2 題開放題，約 5 分鐘。\n' +
    '第 15 週填前測、第 16 週填後測，題目相同。請依真實情況作答，沒有標準答案，結果不影響成績。\n' +
    '1 = 非常不同意，2 = 不同意，3 = 普通，4 = 同意，5 = 非常同意。');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('已收到，謝謝你！回到 HOOTL 任務頁繼續下一步：' + CFG.WEB_URL);

  var sidVal = FormApp.createTextValidation().requireTextMatchesPattern('^[A-Za-z0-9]{6,12}$')
    .setHelpText('請輸入完整學號（6–12 碼英數字），前後測靠它配對。').build();
  form.addTextItem().setTitle(Q.SID).setHelpText('前後測靠完整學號配對；評量資料庫只存後 4 碼與雜湊碼。').setRequired(true).setValidation(sidVal);
  form.addListItem().setTitle(Q.CLS).setChoiceValues(CFG.CLASSES).setRequired(true);
  var stage = form.addMultipleChoiceItem().setTitle(Q.STAGE).setChoiceValues([STAGE.pre, STAGE.post]).setRequired(true);

  form.addSectionHeaderItem().setTitle('事前規則與事後評量').setHelpText('依你這次專題的實際做法作答。');
  ITEMS.forEach(function (it) {
    form.addScaleItem().setTitle(itemTitle_(it)).setBounds(1, 5).setLabels('非常不同意', '非常同意').setRequired(true);
  });
  form.addParagraphTextItem().setTitle(Q.O1).setRequired(false);
  form.addParagraphTextItem().setTitle(Q.O2).setRequired(false);

  var ss = SpreadsheetApp.create(CFG.TITLE + '（回覆）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var sh = ss.insertSheet('計分');
  sh.appendRow(['時間', '完整學號', '後4碼', '班級', '階段', '事前規則 R（0–100）', '事後評量 E（0–100）', '注意力檢核', '直線作答', '有效', '推送結果']);
  sh.setFrozenRows(1);

  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'onHootlFormSubmit') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onHootlFormSubmit').forForm(form).onFormSubmit().create();

  var pre = form.createResponse().withItemResponse(stage.createResponse(STAGE.pre)).toPrefilledUrl();
  var post = form.createResponse().withItemResponse(stage.createResponse(STAGE.post)).toPrefilledUrl();
  var shortPre = pre, shortPost = post, shortPub = form.getPublishedUrl();
  try { shortPre = form.shortenFormUrl(pre); shortPost = form.shortenFormUrl(post); shortPub = form.shortenFormUrl(form.getPublishedUrl()); } catch (err) { Logger.log('短網址失敗，改用原網址：' + err); }

  PropertiesService.getScriptProperties().setProperties({ FORM_ID: form.getId(), SS_ID: ss.getId(), PRE_URL: shortPre, POST_URL: shortPost });
  Logger.log('學生填答：' + shortPub);
  Logger.log('前測預填：' + shortPre);
  Logger.log('後測預填：' + shortPost);
  Logger.log('表單編輯：' + form.getEditUrl());
  Logger.log('回覆試算表：' + ss.getUrl());
  return { pub: shortPub, pre: shortPre, post: shortPost, edit: form.getEditUrl(), sheet: ss.getUrl() };
}

// ===================== ② 送出處理 =====================
function onHootlFormSubmit(e) {
  var a = {}, raw = [];
  e.response.getItemResponses().forEach(function (ir) { a[ir.getItem().getTitle()] = ir.getResponse(); });
  ITEMS.forEach(function (it) { raw.push(Number(a[itemTitle_(it)]) || 0); });
  var sc = score_(raw);
  var sidFull = String(a[Q.SID] || '').trim().toUpperCase();
  var sid4 = sidFull.slice(-4), cls = String(a[Q.CLS] || ''), phase = String(a[Q.STAGE] || '').indexOf('後測') === 0 ? 'post' : 'pre';
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sidFull, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');

  var pushed = '';
  try {
    pushed = push_([{
      v: 2, id: 'hsf_' + e.response.getId(), ts: e.response.getTimestamp().toISOString(),
      app: CFG.APP, kind: CFG.KIND, sid: sid4, name: '', cls: cls,
      score: sc.valid ? Math.round((sc.R + sc.E) / 2) : '', max: 100,
      detail: { graded: false, unit: 'hootl', layer: 'HOOTL', source: 'google-form', label: 'HOOTL 治理素養問卷（不計分）',
        phase: phase, R: sc.R, E: sc.E, attention: sc.attention, straight: sc.straight, valid: sc.valid,
        items: raw, open1: String(a[Q.O1] || ''), open2: String(a[Q.O2] || ''), sidHash: hash }
    }]);
  } catch (err) { pushed = '失敗：' + err; }

  try {
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SS_ID'));
    ss.getSheetByName('計分').appendRow([e.response.getTimestamp(), sidFull, sid4, cls, phase === 'pre' ? '前測' : '後測',
      sc.R, sc.E, sc.attention ? '通過' : '未通過', sc.straight ? '是' : '否', sc.valid ? '是' : '否', pushed]);
  } catch (err2) { Logger.log('寫入計分表失敗：' + err2); }
}

/** raw：13 題原始分數（1–5），依 ITEMS 順序 */
function score_(raw) {
  var R = [], E = [], content = [];
  ITEMS.forEach(function (it, i) {
    var x = raw[i];
    if (it[1] === 'C') return;
    content.push(x);
    var v = it[3] ? 6 - x : x;
    (it[1] === 'R' ? R : E).push(v);
  });
  var mean = function (xs) { return xs.reduce(function (s, x) { return s + x; }, 0) / xs.length; };
  var to100 = function (m) { return Math.round(25 * (m - 1) * 10) / 10; };
  var attention = raw[6] === 2;
  var straight = content.every(function (x) { return x === content[0]; });
  return { R: to100(mean(R)), E: to100(mean(E)), attention: attention, straight: straight, valid: attention && !straight };
}

function push_(records) {
  var res = UrlFetchApp.fetch(CFG.CLOUD_URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'push', records: records })
  });
  var t = res.getContentText().slice(0, 120);
  Logger.log('push → ' + res.getResponseCode() + ' ' + t);
  return res.getResponseCode() + ' ' + t;
}

// ===================== 工具 =====================
/** 只驗算計分邏輯，不寫任何資料 */
function selfTest() {
  var cases = [
    { raw: [5, 5, 5, 5, 5, 1, 2, 5, 5, 5, 5, 5, 1], want: { R: 100, E: 100, valid: true } },
    { raw: [3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3], want: { R: 50, E: 50, valid: false } },
    { raw: [4, 4, 3, 4, 3, 2, 4, 4, 5, 4, 4, 3, 2], want: { R: 66.7, E: 75, valid: false } }
  ];
  cases.forEach(function (c, i) {
    var s = score_(c.raw);
    Logger.log('case ' + (i + 1) + ' → R=' + s.R + ' E=' + s.E + ' valid=' + s.valid + '（預期 R=' + c.want.R + ' E=' + c.want.E + ' valid=' + c.want.valid + '）');
  });
}

/** 確認評量資料庫連線 */
function pingCloud() {
  var r = UrlFetchApp.fetch(CFG.CLOUD_URL + '?action=ping', { muteHttpExceptions: true, followRedirects: true });
  Logger.log('ping → ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 120));
}

/** 重新印出已建立的網址 */
function showLinks() {
  var p = PropertiesService.getScriptProperties().getProperties();
  Logger.log(JSON.stringify(p, null, 2));
}
