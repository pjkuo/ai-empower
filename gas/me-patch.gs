/* ============================================================
   ai-empower 後端 v3.6 追加：學生自查 API「action=me」（me-patch）
   2026-09-07 首版 · 2026-09-21 v3.3 班級正規化 · v3.4 得分率對齊 pctOf · v3.5 學號全碼→後4碼、無年級資管寫法歸大一
   · 2026-09-24 v3.6 學號為主、班級為輔（cls 改選填；自動對班／多班時要求指定）

   ── 安裝（一次，約 2 分鐘）──────────────────────────────
   1. 開啟 Apps Script 專案（試算表「ai-empower 評量資料庫」→ 擴充功能 → Apps Script）。
   2. 左側「＋」新增檔案 me.gs，貼上本檔全部內容（若已有舊版 me.gs，整檔覆蓋）。
   3. 在 Code.gs 的 doGet(e) 內、action 分派處加入一行（放在其他 action 判斷旁）：

        if (a === 'me') return meAction_(e);

      （若你的分派變數不是 a，改成對應變數即可；本檔無其他相依。）
   4. 部署 → 管理部署作業 → 編輯（鉛筆）→ 版本「新版本」→ 部署。網址不變。
   5. 驗證：瀏覽器開
        <exec 網址>?action=me&sid=6010&cls=MIS
      應回 {"ok":true,...}。前端 weekly.html 即可查詢。
      v3.6 另可驗：<exec 網址>?action=me&sid=6010（不帶 cls）→ 應回 resolvedBy:"sid" 且 records 非空。

   ── 行為 ────────────────────────────────────────────────
   GET ?action=me&sid=<學號後4碼>[&cls=<班級>]
   只回傳「該 sid＋該班」自己的紀錄（讀 records 長表；60 秒快取），
   外加同班各 kind 的去識別化統計（人數、中位數、平均得分率），
   以及 cfg 工作表的 semStart（若有設，格式 YYYY-MM-DD，週次基準）。

   ★ v3.6 學號為主、班級為輔：班級名並非密碼，也驗不了身分——它唯一的功能是「命名空間」：
     學號後 4 碼會跨年級重複（實測 6015/6045/6046/6052 同時出現在資管一A 與資管三A）。
     因此 cls 改為「選填」，比對順序：
       ① 有帶 cls 且該班桶有此學號的紀錄 → 照舊（resolvedBy:"cls"）。
       ② 沒帶 cls，或帶了但該班桶查無此學號 → 以學號掃全表，統計此學號出現在哪些班桶：
          ・只有 1 個班桶 → 直接用該班（resolvedBy:"sid"／"sid-fallback"），回 clsHint＝該班最常見的原始寫法，
            前端可提示學生把小卡班級改正；
          ・≥2 個班桶（後 4 碼撞號）→ 回 ambiguous:true＋classes:[{cls,n,last}]（只有班名與筆數，無任何明細），
            前端請學生指定班級後再查；
          ・0 個班桶 → records:[]＋reason:"no-sid"（整個資料庫沒有這個學號），前端可給出與「班級不符」不同的說明。
     未填班級（cls 為空）的紀錄不算一個班桶，但一律併入本人 records（不進全班統計）。
     隱私邊界不變：任何情況下都只回「該 sid」自己的明細；班級統計仍是去識別化。

   ★ v3.3 班級正規化：各子平台寫入的班級字串不一致（IOC 寫「資管一A 計算機概論」、
     專題 studio 寫「MIS」/「IM」、課前評量寫全名），導致同一位學生的紀錄散在不同 cls，
     任一 cls 都查不齊。meCanonCls_() 把同一實體班級的各種寫法收斂為同一「班級鍵」：
       ・資管一A（計算機概論）＝ MIS / IM / 資管一A / 資管1A / 資訊管理一A / 含「計算機概論」
       ・車輛‧機械一A（數位科技與AI應用）＝ 含 車輛 / 機械 / 數位科技 之各種寫法
     比對與全班統計都用 canonical 鍵，確保學生查得齊、且跨系仍分開（隱私不變）。
     只收斂「大一」兩門課的班級；資管4A/三A 等其他班級原樣保留、互不混入。

   ★ v3.4 得分率對齊：IOC 新制 kind（warm/subquiz/live/xr/vidq）上傳格式為「score＝百分比、max＝題數」
     （例 warm 67/6＝六題對四成）。舊版全班統計以 score/max*100 再夾 0–100，會把 67/6 算成 100，
     全班中位數被膨脹（實測 warm 全班中位 100 → 正確 63）。mePct_() 改與前端 weekly.html 的 pctOf 完全一致：
     score>max 時視為百分比（≤100 才採計），否則 score/max*100 夾 0–100。

   ★ v3.5 學號正規化：ct-practice／Moodle 匯入路徑把 sid 存成全碼（B11556002、11556002），
     與契約「sid＝學號後4碼」不符，學生身分 6002 永遠對不到。meNormSid_() 對 5 碼以上、
     尾端為 4 位數字者取「後 4 碼」；仍以 canonical 班級桶界定範圍（同末四碼跨年級如
     B11556046／B11356046 因班級桶不同不會互見）。班級正規化同步放寬：未寫年級的
     「資管／資管系／資訊管理(系)／資一A／四資管一A」歸大一資管；凡明示二/三/四(2/3/4)年級者一律原樣分開。

   detail 僅節錄前 400 字元；AI 協作紀錄（detail.action="ai"）只回旗標 ai:1，
   不回提示語內容。cls=LOADTEST 一律拒絕。緩衝區未落地的最新紀錄
   最多延遲約 1 分鐘（flushBuffer 節奏），前端已註明。
   ============================================================ */

function meAction_(e) {
  var p = (e && e.parameter) || {};
  var sid = String(p.sid || '').trim();
  var cls = String(p.cls || '').trim();
  if (!/^[0-9A-Za-z]{2,12}$/.test(sid)) return meJson_({ ok: false, error: 'bad sid' });
  // v3.6：cls 改為選填（不再回 need cls）；LOADTEST 仍拒絕
  if (cls.toUpperCase() === 'LOADTEST') return meJson_({ ok: false, error: 'bad cls' });

  var ck = 'me:' + meCanonCls_(cls) + ':' + meNormSid_(sid);  // 快取鍵改用 canonical，避免同班不同寫法各存一份（cls 空＝'me::sid'）
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

  var qSid = meNormSid_(sid), qCls = meCanonCls_(cls);

  /* ★ v3.6 對班：先掃「此學號出現在哪些班桶」（只讀 sid／cls 兩欄，不碰明細） */
  var buckets = meBuckets_(vals, col, qSid);           // {canon: {n, last, raw:{原始寫法:次數}}}
  var resolvedBy = 'cls', reason = '';
  if (!qCls || !buckets[qCls]) {
    var keys = Object.keys(buckets).filter(function (k) { return k !== ''; });   // 未填班級的紀錄不算一個班桶
    if (keys.length === 1) {                            // 唯一班桶 → 直接採用
      qCls = keys[0]; resolvedBy = cls ? 'sid-fallback' : 'sid';
    } else if (keys.length >= 2) {                      // 後 4 碼撞號 → 請學生指定（只回班名與筆數）
      var out2 = meEmpty_(sid, cls, ss);
      out2.ambiguous = true; out2.reason = 'ambiguous'; out2.resolvedBy = 'none';
      out2.classes = keys.map(function (k) {
        return { cls: meRawName_(buckets[k]), n: buckets[k].n, last: buckets[k].last };
      }).sort(function (a, b) { return b.n - a.n; });
      var b2 = JSON.stringify(out2);
      try { CacheService.getScriptCache().put(ck, b2, 60); } catch (eP2) {}
      return ContentService.createTextOutput(b2).setMimeType(ContentService.MimeType.JSON);
    } else if (buckets['']) {                           // 只有「未填班級」的紀錄 → 仍回本人明細，無班級統計
      qCls = ''; resolvedBy = 'sid'; reason = 'unclassed';
    } else {                                            // 整個資料庫沒有這個學號
      var out0 = meEmpty_(sid, cls, ss);
      out0.reason = 'no-sid'; out0.resolvedBy = 'none';
      var b0 = JSON.stringify(out0);
      try { CacheService.getScriptCache().put(ck, b0, 60); } catch (eP0) {}
      return ContentService.createTextOutput(b0).setMimeType(ContentService.MimeType.JSON);
    }
  }
  var clsHint = buckets[qCls] ? meRawName_(buckets[qCls]) : cls;

  var mine = [], agg = {}; // agg[kind] = {by:{sid:[..]}, all:[]}
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    var rCls = meCanonCls_(row[col.cls]);
    var rSid = meNormSid_(row[col.sid]);
    var unclassedMine = (rCls === '' && rSid === qSid);   // v3.6：本人「未填班級」的紀錄一律併入（不進全班統計）
    if (rCls !== qCls && !unclassedMine) continue;
    var kind = String(row[col.kind] || 'misc');
    var det = col.detail >= 0 ? String(row[col.detail] || '') : '';
    var isAI = det.indexOf('"action":"ai"') >= 0;
    var score = row[col.score], max = row[col.max];

    if (!isAI && rCls === qCls && qCls !== '') { // 全班去識別化統計（僅計分紀錄；未填班級者不計）
      var pct = mePct_(score, max);            // v3.4：與前端 pctOf 同一套規則
      if (pct !== null) {
        var a = agg[kind] || (agg[kind] = { by: {}, all: [] });
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
    resolvedBy: resolvedBy, clsHint: clsHint, reason: reason,   // v3.6：對班結果（cls 仍原樣回傳，舊前端不受影響）
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
/* ★ v3.6：此學號出現在哪些班桶（canonical）；每桶記筆數、最近時間、各原始寫法次數 */
function meBuckets_(vals, col, qSid) {
  var b = {};
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (meNormSid_(row[col.sid]) !== qSid) continue;
    var rawCls = String(row[col.cls] == null ? '' : row[col.cls]).trim();
    var k = meCanonCls_(rawCls);
    if (k.toUpperCase() === 'LOADTEST') continue;
    var e = b[k] || (b[k] = { n: 0, last: '', raw: {} });
    e.n++;
    var ts = col.ts >= 0 ? meISO_(row[col.ts]) : '';
    if (ts > e.last) e.last = ts;
    e.raw[rawCls] = (e.raw[rawCls] || 0) + 1;
  }
  return b;
}
/* 班桶最常見的原始寫法（給前端顯示／回填小卡用） */
function meRawName_(bucket) {
  var best = '', n = -1;
  Object.keys(bucket.raw).forEach(function (r) { if (bucket.raw[r] > n) { n = bucket.raw[r]; best = r; } });
  return best;
}
/* ★ v3.4 得分率（與 weekly.html 的 pctOf 逐字對齊）：
   score>max → 視為「百分比格式」（IOC warm/subquiz/live/xr/vidq：score＝%、max＝題數），≤100 才採計；
   否則 score/max*100 夾 0–100。score/max 非數值或 max≤0 → null（不計分）。 */
function mePct_(score, max) {
  var s = parseFloat(score), m = parseFloat(max);
  if (!isFinite(s) || !isFinite(m) || m <= 0) return null;
  if (s > m) return s <= 100 ? s : null;
  return Math.max(0, Math.min(100, s / m * 100));
}
function meNormSid_(v) { // 試算表把 0615 存成數字時補回前導零（與前端 cloud.js normRec 一致）；v3.5：全碼 → 後 4 碼
  var s = String(v == null ? '' : v).trim();
  if (/\.0+$/.test(s)) s = s.replace(/\.0+$/, '');            // 數值欄位偶見 6101.0
  if (/^\d+$/.test(s) && s.length < 4) s = ('0000' + s).slice(-4);
  var m = s.length >= 5 ? s.match(/(\d{4})$/) : null;         // B11556002 / 11556002 → 6002
  if (m) s = m[1];
  return s.toUpperCase();
}
/* 舊版逐字比對（保留備用；正式比對已改用 meCanonCls_） */
function meNormCls_(v) { return String(v == null ? '' : v).trim().toUpperCase(); }

/* ★ v3.3 班級正規化：把同一實體班級的各種寫法收斂為同一「班級鍵」。
   規則刻意保守——只收斂大一兩門課的已知寫法，其餘班級（資管4A/三A、其他系所）
   正規化後原樣保留、互不混入，跨系/跨年級不會彼此看到對方（隱私不變）。 */
function meCanonCls_(v) {
  var raw = String(v == null ? '' : v).trim();
  if (!raw) return '';
  // 去半形/全形空白、統一大寫；ㄧ(注音一)→一
  var s = raw.toUpperCase().replace(/[\s　]+/g, '').replace(/ㄧ/g, '一');
  // 明示非一年級（二/三/四、2/3/4 後接 A/年級/班/結尾）→ 一律原樣分開，不併入大一
  var otherYear = /(二|三|四|[234])(A|年級|班|$)/.test(s);
  // ── 資管一A（計算機概論）：MIS / IM / 含「計算機概論」/ 資管(系)[一|1][A] / 資訊管理(系)… / 資一A / 四資管一A（四技）──
  if (!otherYear && (s === 'MIS' || s === 'IM' || s.indexOf('計算機概論') >= 0 ||
      /(資管|資訊管理)/.test(s) || /^資(一|1)A$/.test(s))) {
    return 'MIS-1A';
  }
  // ── 車輛‧機械一A（數位科技與AI應用）：含 車輛 / 機械 / 機(一|1)A / 數位科技 ──
  if (!otherYear && (s.indexOf('車輛') >= 0 || s.indexOf('機械') >= 0 ||
      s.indexOf('數位科技') >= 0 || /^機(一|1|-)?A?/.test(s))) {
    return 'VME-1A';
  }
  return s; // 其他班級：正規化後原樣（例：資管4A → 資管4A）
}
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
