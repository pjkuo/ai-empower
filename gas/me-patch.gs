/* ============================================================
   ai-empower 後端 v3.2 追加：學生自查 API「action=me」（me-patch）
   2026-09-07　配合前端 weekly.html（我的學習週報）

   ── 安裝（一次，約 2 分鐘）──────────────────────────────
   1. 開啟 Apps Script 專案（試算表「ai-empower 評量資料庫」→ 擴充功能 → Apps Script）。
   2. 左側「＋」新增檔案 me.gs，貼上本檔全部內容。
   3. 在 Code.gs 的 doGet(e) 內、action 分派處加入一行（放在其他 action 判斷旁）：

        if (a === 'me') return meAction_(e);

      （若你的分派變數不是 a，改成對應變數即可；本檔無其他相依。）
   4. 部署 → 管理部署作業 → 編輯（鉛筆）→ 版本「新版本」→ 部署。網址不變。
   5. 驗證：瀏覽器開
        <exec 網址>?action=me&sid=6010&cls=MIS
      應回 {"ok":true,...}。前端 weekly.html 即可查詢。

   ── 行為 ────────────────────────────────────────────────
   GET ?action=me&sid=<學號後4碼>&cls=<班級>
   只回傳「該 sid＋該班」自己的紀錄（讀 records 長表；60 秒快取），
   外加同班各 kind 的去識別化統計（人數、中位數、平均得分率），
   以及 cfg 工作表的 semStart（若有設，格式 YYYY-MM-DD，週次基準）。
   detail 僅節錄前 400 字元；AI 協作紀錄（detail.action="ai"）只回旗標 ai:1，
   不回提示語內容。cls=LOADTEST 一律拒絕。緩衝區未落地的最新紀錄
   最多延遲約 1 分鐘（flushBuffer 節奏），前端已註明。
   ============================================================ */

function meAction_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.sid || '').trim();
  var cls = String(p.cls || '').trim();
  var out = { ok: false };
  if (!/^[0-9A-Za-z]{2,8}$/.test(sid)) return meJson_({ ok: false, error: 'bad sid' });
  if (!cls) return meJson_({ ok: false, error: 'need cls' });
  if (cls.toUpperCase() === 'LOADTEST') return meJson_({ ok: false, error: 'bad cls' });

  var ck = 'me:' + cls + ':' + sid;
  try {
    var hit = CacheService.getScriptCache().get(ck);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  } catch (eC) {}

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('records');
  if (!sh) return meJson_({ ok: false, error: 'no records sheet' });

  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return meJson_(meEmpty_(sid, cls, ss));
  var head = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = {};
  ['id', 'ts', 'app', 'kind', 'sid', 'name', 'cls', 'score', 'max', 'detail'].forEach(function (k) {
    col[k] = head.indexOf(k);
  });
  if (col.sid < 0 || col.kind < 0) return meJson_({ ok: false, error: 'bad header' });

  var qSid = meNormSid_(sid), qCls = meNormCls_(cls);
  var mine = [], agg = {}; // agg[kind] = {pcts:{sid:[..]}, all:[]}
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    var rCls = meNormCls_(row[col.cls]);
    if (rCls !== qCls) continue;
    var rSid = meNormSid_(row[col.sid]);
    var kind = String(row[col.kind] || 'misc');
    var det = col.detail >= 0 ? String(row[col.detail] || '') : '';
    var isAI = det.indexOf('"action":"ai"') >= 0;
    var score = row[col.score], max = row[col.max];

    if (!isAI) { // 全班去識別化統計（僅計分紀錄）
      var s = parseFloat(score), m = parseFloat(max);
      if (isFinite(s) && isFinite(m) && m > 0) {
        var a = agg[kind] || (agg[kind] = { by: {}, all: [] });
        var pct = Math.max(0, Math.min(100, s / m * 100));
        a.all.push(pct);
        (a.by[rSid] = a.by[rSid] || []).push(pct);
      }
    }
    if (rSid === qSid) {
      mine.push({
        id: String(row[col.id] || ''), ts: meISO_(row[col.ts]),
        app: String(row[col.app] || ''), kind: kind,
        score: score === '' || score == null ? '' : score,
        max: max === '' || max == null ? '' : max,
        ai: isAI ? 1 : 0,
        d: isAI ? '' : det.slice(0, 400)
      });
    }
  }
  mine.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
  if (mine.length > 400) mine = mine.slice(mine.length - 400);

  var classStats = {};
  Object.keys(agg).forEach(function (k) {
    var a = agg[k];
    classStats[k] = {
      n: a.all.length,
      students: Object.keys(a.by).length,
      medianPct: Math.round(meMedian_(a.all) * 10) / 10,
      meanPct: Math.round(meMean_(a.all) * 10) / 10
    };
  });

  var out = {
    ok: true, sid: sid, cls: cls, records: mine, 'class': classStats,
    cfg: { semStart: meCfg_(ss, 'semStart') }, at: new Date().toISOString()
  };
  var body = JSON.stringify(out);
  try { CacheService.getScriptCache().put(ck, body, 60); } catch (eP) {}
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/* ---- helpers（me 專用，命名加前綴避免撞名） ---- */
function meJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function meEmpty_(sid, cls, ss) {
  return { ok: true, sid: sid, cls: cls, records: [], 'class': {}, cfg: { semStart: meCfg_(ss, 'semStart') }, at: new Date().toISOString() };
}
function meNormSid_(v) { // 試算表把 0615 存成數字時補回前導零（與前端 cloud.js normRec 一致）
  var s = String(v == null ? '' : v).trim();
  if (/^\d+$/.test(s) && s.length < 4) s = ('0000' + s).slice(-4);
  return s.toUpperCase();
}
function meNormCls_(v) { return String(v == null ? '' : v).trim().toUpperCase(); }
function meISO_(v) {
  if (v instanceof Date) return v.toISOString();
  var s = String(v || '');
  var d = new Date(s);
  return isNaN(d) ? s : d.toISOString();
}
function meMedian_(a) {
  if (!a.length) return 0;
  var b = a.slice().sort(function (x, y) { return x - y; });
  var i = Math.floor(b.length / 2);
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2;
}
function meMean_(a) {
  if (!a.length) return 0;
  var s = 0; for (var i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}
function meCfg_(ss, key) { // 讀 cfg 工作表 key/value；無則空字串
  try {
    var sh = ss.getSheetByName('cfg');
    if (!sh) return '';
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === key) return String(vals[i][1] || '').trim();
    }
  } catch (e) {}
  return '';
}
