/**
 * ct-practice-patch.gs　—　運算思維四大技巧練習：表單回覆 → ai-empower 統一記錄
 * 屏東科技大學．計算機概論｜運算思維單元
 *
 * 作用：學生送出「日常生活裡的運算思維 — 練習單」Google 表單後，
 *       自動把該筆回覆轉成 ai-empower 的統一記錄（kind = ctpractice）並推送到
 *       「ai-empower 評量資料庫」，教師端 ct-practice.html／teacher.html 即可看到統計。
 *
 * 【安裝步驟】
 *   1. 開啟「運算思維練習單_Google表單產生器」Apps Script 專案（或表單的指令碼編輯器）
 *   2. 新增檔案 → 指令碼 → 命名 ct-practice-patch → 貼上本檔全部內容
 *   3. 確認下方 CLOUD_URL 與 FORM_ID 正確
 *   4. 執行一次 setupTrigger()（會要求授權），之後每次學生送出都會自動推送
 *   5. 想補推既有回覆，執行 backfillAll()
 *
 * 【不計評分】score 欄位存的是「填答完整度％」，不是成績；detail.graded = false。
 */

// ===================== 設定 =====================
var CFG = {
  CLOUD_URL: 'https://script.google.com/macros/s/AKfycbz7wHWbc7go-OVR0Q_g_NBzDqwzV9-leqL1CRe1S9wGkLLjvJIAm-KrZj80s1KJ_VdGVg/exec',
  FORM_ID:   '1zEFEd4_IeR82gJZnniNUlgd4MKLKh2iTmxQp8BaCK_0',   // 表單編輯 ID
  APP:       'ct-practice',
  KIND:      'ctpractice',
  UNIT:      'CT四大技巧練習'
};

// 題目標題 → 內部欄位（改題目時同步改這裡即可）
var MAP = {
  '系級':'cls', '姓名':'name', '學號':'sid', '組別':'team',
  'STEP 1':'s1', 'STEP 2':'s2', 'STEP 3':'s3', 'STEP 4':'s4',
  'IF（什麼情況發生）':'ifCond', 'THEN（你就立刻做什麼）':'thenAct',
  'C. 這四步裡，最不能省的是哪一步？':'critical', '為什麼這一步不能省？':'criticalWhy',
  '欄位 1':'f1', '欄位 2':'f2', '欄位 3':'f3',
  '每週星期幾':'weekday', '幾點左右':'hour', '大約要等幾分鐘':'mins',
  '要留下的資訊（1）':'keep1', '要留下的資訊（2）':'keep2',
  'TASK A':'tA', 'TASK B':'tB', 'TASK C':'tC', 'TASK D':'tD',
  'B. 哪一件「一定要先確定，別人才能動」？':'blocker',
  '為什麼它會卡住其他人？（相依關係）':'blockerWhy',
  'IF 當天下雨 → THEN':'ifRain', 'IF 有人臨時不去 → THEN':'ifDrop',
  '出發前幾天做最後確認？':'checkDays', '最後要確認的是什麼？':'checkWhat',
  '活動名稱':'bonusName', '我要拆解的是':'bonusDec', '我要記錄的規律是':'bonusPat',
  '我的備案 IF…THEN 是':'bonusAlg',
  '互評夥伴的姓名':'peerName', '你給對方的一句回饋':'peerNote',
  '我的自我檢核（可複選）':'selfCheck',
  '這次練習，你最有感的一句話是什麼？':'takeaway'
};

// 四大技巧各由哪些欄位構成（用於算「填答完整度」與「具體度」）
var SKILL_FIELDS = {
  decompose: ['s1','s2','s3','s4'],                       // 拆解
  pattern:   ['f1','f2','f3','weekday','hour','mins'],    // 找規律
  abstract:  ['keep1','keep2','bonusDec'],                // 抽象化
  algorithm: ['ifCond','thenAct','ifRain','ifDrop','checkDays','checkWhat','blockerWhy']  // 演算法／條件判斷
};

// ===================== 觸發器 =====================
function setupTrigger() {
  var form = FormApp.openById(CFG.FORM_ID);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onCtFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onCtFormSubmit').forForm(form).onFormSubmit().create();
  Logger.log('已建立提交觸發器：onCtFormSubmit');
}

function onCtFormSubmit(e) {
  try {
    var rec = toRecord(e.response);
    if (rec) push([rec]);
  } catch (err) {
    Logger.log('onCtFormSubmit 失敗：' + err);
  }
}

/** 補推所有既有回覆（可重複執行，後端以 id 去重） */
function backfillAll() {
  var rs = FormApp.openById(CFG.FORM_ID).getResponses();
  var batch = [], sent = 0;
  for (var i = 0; i < rs.length; i++) {
    var r = toRecord(rs[i]);
    if (r) batch.push(r);
    if (batch.length === 20) { push(batch); sent += batch.length; batch = []; }
  }
  if (batch.length) { push(batch); sent += batch.length; }
  Logger.log('補推完成，共 ' + sent + ' 筆');
  return sent;
}

// ===================== 轉換 =====================
function toRecord(response) {
  var a = {}, items = response.getItemResponses();
  for (var i = 0; i < items.length; i++) {
    var title = items[i].getItem().getTitle();
    var key = MAP[title];
    if (!key) continue;
    var v = items[i].getResponse();
    a[key] = (v instanceof Array) ? v.join('｜') : String(v == null ? '' : v).trim();
  }
  if (!a.sid) return null;

  var per = {}, doneAll = 0, totalAll = 0;
  Object.keys(SKILL_FIELDS).forEach(function (k) {
    var f = SKILL_FIELDS[k], done = 0;
    f.forEach(function (x) { if (a[x]) done++; });
    per[k] = { done: done, total: f.length, spec: specificity(k, a) };
    doneAll += done; totalAll += f.length;
  });

  var completion = totalAll ? Math.round(doneAll * 100 / totalAll) : 0;
  var chars = 0;
  Object.keys(a).forEach(function (k) { if (k !== 'sid' && k !== 'name' && k !== 'cls') chars += (a[k] || '').length; });

  return {
    v: 2,
    id: 'ctp_' + response.getId(),
    ts: response.getTimestamp().toISOString(),
    app: CFG.APP,
    kind: CFG.KIND,
    sid: a.sid,
    name: a.name || '',
    cls: a.cls || '',
    score: completion,      // 完成度％，非成績
    max: 100,
    detail: {
      unit: CFG.UNIT,
      graded: false,
      completion: completion,
      chars: chars,
      skills: per,
      choice: { critical: a.critical || '', blocker: a.blocker || '' },
      pattern: { weekday: a.weekday || '', hour: a.hour || '', mins: a.mins || '' },
      fields: [a.f1 || '', a.f2 || '', a.f3 || ''],
      keeps: [a.keep1 || '', a.keep2 || ''],
      steps: [a.s1 || '', a.s2 || '', a.s3 || '', a.s4 || ''],
      tasks: [a.tA || '', a.tB || '', a.tC || '', a.tD || ''],
      rules: { ifCond: a.ifCond || '', thenAct: a.thenAct || '', ifRain: a.ifRain || '', ifDrop: a.ifDrop || '' },
      bonus: { name: a.bonusName || '', dec: a.bonusDec || '', pat: a.bonusPat || '', alg: a.bonusAlg || '' },
      selfCheck: (a.selfCheck || '').split('｜').filter(String).length,
      peer: a.peerName ? 1 : 0,
      texts: {
        criticalWhy: a.criticalWhy || '', blockerWhy: a.blockerWhy || '',
        checkWhat: a.checkWhat || '', peerNote: a.peerNote || '', takeaway: a.takeaway || ''
      }
    }
  };
}

/** 具體度 0–100：不是成績，是「換別人照做，做得出來嗎」的可操作性指標 */
function specificity(skill, a) {
  var VERB = /(改|換|加|減|先|再|退|訂|填|寄|打|問|找|買|排|移|延|取消|通知|確認|備份|截圖|提前|延後|重|補|拍|傳|開|關|選|跳|等|記|寫|上傳|預約)/;
  var NUM  = /\d/;
  var s = 0;
  function txt(k) { return (a[k] || '').trim(); }
  function len(k) { return txt(k).length; }

  if (skill === 'decompose') {
    var n = ['s1','s2','s3','s4'].filter(function (k) { return len(k) >= 3; }).length;
    s = n * 20;                                                   // 四步都寫 → 80
    var avg = (len('s1') + len('s2') + len('s3') + len('s4')) / 4;
    if (avg >= 8) s += 10;                                        // 寫得夠細
    if (txt('criticalWhy').length >= 12) s += 10;                 // 說得出為什麼
  } else if (skill === 'pattern') {
    var f = ['f1','f2','f3'].filter(function (k) { return len(k) >= 2; }).length;
    s = f * 15;                                                   // 三欄位 → 45
    if (txt('weekday')) s += 15;
    if (NUM.test(txt('hour'))) s += 20;                           // 時間寫得出數字＝可驗證
    if (NUM.test(txt('mins'))) s += 20;
  } else if (skill === 'abstract') {
    if (len('keep1') >= 2) s += 30;
    if (len('keep2') >= 2) s += 30;
    if (txt('keep1') && txt('keep1') === txt('keep2')) s -= 20;    // 兩項重複＝沒真的取捨
    if (len('bonusDec') >= 4) s += 40;
  } else if (skill === 'algorithm') {
    if (len('ifCond') >= 3) s += 15;
    if (len('thenAct') >= 3) s += 15;
    if (VERB.test(txt('thenAct'))) s += 15;                        // THEN 是可執行動作
    if (VERB.test(txt('ifRain'))) s += 15;
    if (VERB.test(txt('ifDrop'))) s += 15;
    if (NUM.test(txt('checkDays'))) s += 10;
    if (len('checkWhat') >= 4) s += 10;
    if (txt('blockerWhy').length >= 12) s += 5;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

// ===================== 推送 =====================
function push(records) {
  var res = UrlFetchApp.fetch(CFG.CLOUD_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ action: 'push', records: records }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  Logger.log('push ' + records.length + ' 筆 → ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
}

/** 連線自我測試：不寫入資料，只確認雲端可達 */
function pingCloud() {
  var res = UrlFetchApp.fetch(CFG.CLOUD_URL + '?action=ping', { muteHttpExceptions: true });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
}
