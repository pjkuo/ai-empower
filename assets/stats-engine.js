/* ============================================================
   ai-empower — 統計引擎  v1.0
   stats.html 與 paper.html 共用。純前端、無相依。
   數值方法（lnGamma / 正則化不完全 Beta / t 分配）已對照 SciPy
   驗證至小數第 6 位（見 repo 內 tests/verify-stats.md）。
============================================================ */
(function (root) {
  "use strict";

  /* ---------------- 基礎統計 ---------------- */
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function variance(a) {              // 樣本變異數（n-1）
    if (a.length < 2) return NaN;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - m; s += d * d; }
    return s / (a.length - 1);
  }
  function sd(a) { return Math.sqrt(variance(a)); }

  /* ---------------- Gamma / Beta ---------------- */
  var LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  function lnGamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    var x = 0.99999999999980993;
    for (var i = 0; i < 8; i++) x += LANCZOS[i] / (z + i + 1);
    var t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betacf(a, b, x) {          // 連分數（Numerical Recipes）
    var MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {           // 正則化不完全 Beta I_x(a,b)
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /* ---------------- t 分配 ---------------- */
  function tTwoTailedP(t, df) {       // 雙尾 p 值
    if (!isFinite(t)) return 0;
    return ibeta(df / 2, 0.5, df / (df + t * t));
  }
  function tCritical(alpha2, df) {    // 雙尾臨界值（如 alpha2=.05 → t.975）；二分法
    var lo = 0, hi = 1000;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (tTwoTailedP(mid, df) > alpha2) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------------- 配對 t 檢定 ---------------- */
  /* pre / post 為對齊後的成對陣列。回傳完整報表所需的一切。 */
  function pairedTest(pre, post) {
    var n = Math.min(pre.length, post.length);
    if (n < 2) return null;
    var diff = [];
    for (var i = 0; i < n; i++) diff.push(post[i] - pre[i]);
    var md = mean(diff), sdd = sd(diff), df = n - 1;
    var se = sdd / Math.sqrt(n);
    var t = sdd === 0 ? (md === 0 ? 0 : Infinity) : md / se;
    var p = sdd === 0 ? (md === 0 ? 1 : 0) : tTwoTailedP(t, df);
    var dz = sdd === 0 ? NaN : md / sdd;
    var gz = isNaN(dz) ? NaN : dz * (1 - 3 / (4 * df - 1));   // Hedges 校正
    var tc = tCritical(0.05, df);
    return {
      n: n, df: df,
      preMean: mean(pre), preSD: sd(pre),
      postMean: mean(post), postSD: sd(post),
      meanDiff: md, sdDiff: sdd, seDiff: se,
      t: t, p: p, dz: dz, gz: gz,
      ciLow: md - tc * se, ciHigh: md + tc * se,      // 平均差之 95% CI
      dzCiLow: isNaN(dz) ? NaN : dz - tc / Math.sqrt(n),   // dz 近似 95% CI
      dzCiHigh: isNaN(dz) ? NaN : dz + tc / Math.sqrt(n)
    };
  }

  /* ---------------- Cronbach's α ---------------- */
  /* rows: 每人一列、每題一欄（需完整作答，呼叫端先做 listwise 刪除） */
  function cronbach(rows) {
    if (!rows.length || rows[0].length < 2) return null;
    var k = rows[0].length, n = rows.length;
    if (n < 2) return null;
    var itemVarSum = 0;
    for (var j = 0; j < k; j++) {
      var col = rows.map(function (r) { return r[j]; });
      itemVarSum += variance(col);
    }
    var totals = rows.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
    var tv = variance(totals);
    if (tv === 0) return null;
    return { alpha: (k / (k - 1)) * (1 - itemVarSum / tv), k: k, n: n };
  }

  /* ---------------- 資料剖析 ---------------- */
  /* 接受三種格式，統一輸出 [{sid, stage:'pre'|'post', ts, scores:[..], se, group, bg}]：
       1. 4C 平台匯出 JSON：[{sid, stage:'前測'/'後測', ts, scores, se, group, bg}]
       2. 運算思維 HISTORY JSON：[{s, g:'前'/'後', t, c:[..], e}]
       3. CSV：欄名含 sid/學號、stage/階段/組別，其後的數值欄視為題項 */
  var STAGE_MAP = { '前測': 'pre', '後測': 'post', '前': 'pre', '後': 'post', 'pre': 'pre', 'post': 'post', 'PRE': 'pre', 'POST': 'post' };
  function normStage(v) { return STAGE_MAP[String(v).trim()] || null; }

  function parseRecords(text) {
    text = String(text || '').trim();
    if (!text) return { records: [], errors: ['沒有資料'] };
    var errors = [], records = [];
    if (text[0] === '[' || text[0] === '{') {
      var obj;
      try { obj = JSON.parse(text); } catch (e) { return { records: [], errors: ['JSON 解析失敗：' + e.message] }; }
      var arr = Array.isArray(obj) ? obj : (obj.records || obj.data || []);
      arr.forEach(function (r, i) {
        var sid = r.sid !== undefined ? r.sid : r.s;
        var stage = normStage(r.stage !== undefined ? r.stage : r.g);
        var scores = r.scores !== undefined ? r.scores : r.c;
        if (sid === undefined || !stage || !Array.isArray(scores)) { errors.push('第 ' + (i + 1) + ' 筆缺 sid/stage/scores，已略過'); return; }
        records.push({
          sid: String(sid), stage: stage, ts: r.ts || r.t || '',
          scores: scores.map(function (v) { return (v === '' || v === null || v === undefined) ? NaN : Number(v); }),
          se: (r.se !== undefined ? r.se : r.e), group: r.group || '', bg: r.bg || ''
        });
      });
      return { records: records, errors: errors };
    }
    /* CSV */
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return { records: [], errors: ['CSV 至少需要標題列與一列資料'] };
    function splitCSV(line) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
        else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    }
    var head = splitCSV(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
    function findCol(names) {
      for (var i = 0; i < head.length; i++) for (var j = 0; j < names.length; j++)
        if (head[i].indexOf(names[j]) >= 0) return i;
      return -1;
    }
    var ci = { sid: findCol(['sid', '學號']), stage: findCol(['stage', '階段', '前後']), ts: findCol(['ts', '時間', 'time']) };
    if (ci.sid < 0 || ci.stage < 0) return { records: [], errors: ['CSV 找不到 sid/學號 或 stage/階段 欄'] };
    var meta = [ci.sid, ci.stage, ci.ts].filter(function (x) { return x >= 0; });
    var scoreCols = [];
    head.forEach(function (h, i) { if (meta.indexOf(i) < 0 && !/group|組別|bg|背景|se|效能|備註/.test(h)) scoreCols.push(i); });
    for (var li = 1; li < lines.length; li++) {
      var row = splitCSV(lines[li]);
      var stage = normStage(row[ci.stage]);
      if (!stage) { errors.push('第 ' + (li + 1) + ' 列 stage 無法辨識（' + row[ci.stage] + '），已略過'); continue; }
      records.push({
        sid: String(row[ci.sid]).trim(), stage: stage, ts: ci.ts >= 0 ? row[ci.ts] : '',
        scores: scoreCols.map(function (c) { var v = (row[c] || '').trim(); return v === '' ? NaN : Number(v); }),
        se: undefined, group: '', bg: ''
      });
    }
    return { records: records, errors: errors };
  }

  /* ---------------- 量表結構 ---------------- */
  var SCHEMES = {
    'fourc': {
      name: '4C 核心素養（12 題＋4 題教學效能）', items: 12,
      subs: [
        { key: 'crit',   name: '批判思考', en: 'Critical Thinking', idx: [0, 4, 8] },
        { key: 'comm',   name: '溝通協調', en: 'Communication',     idx: [1, 5, 9] },
        { key: 'collab', name: '團隊合作', en: 'Collaboration',     idx: [2, 6, 10] },
        { key: 'create', name: '創新創造', en: 'Creativity',        idx: [3, 7, 11] }
      ]
    },
    'ct': {
      name: '運算思維（16 題）', items: 16,
      subs: [
        { key: 'de', name: '問題拆解', en: 'Decomposition',        idx: [0, 1, 2, 3] },
        { key: 'pa', name: '模式辨識', en: 'Pattern Recognition',  idx: [4, 5, 6, 7] },
        { key: 'ab', name: '抽象化',   en: 'Abstraction',          idx: [8, 9, 10, 11] },
        { key: 'db', name: '除錯修正', en: 'Debugging',            idx: [12, 13, 14, 15] }
      ]
    },
    'presurvey': {
      name: '課前評量 T＋C（11 題，答對=1）', items: 11, range: [0, 1],
      subs: [
        { key: 'T', name: '運算思維',       en: 'Computational Thinking', idx: [0, 1, 2, 3, 4, 5] },
        { key: 'C', name: '電腦與網路常識', en: 'Computer Literacy',      idx: [6, 7, 8, 9, 10] }
      ]
    },
    'generic': { name: '自訂量表（整體平均）', items: 0, subs: [] }
  };
  function guessScheme(records) {
    var len = 0;
    records.forEach(function (r) { len = Math.max(len, r.scores.length); });
    if (len === 16) {
      // 4C 匯出也是 16（12 核心＋4 教學）；有 se 欄位視為 4C
      var hasSE = records.some(function (r) { return r.se !== undefined && r.se !== '' && r.se !== null; });
      return hasSE ? 'fourc' : 'ct';
    }
    if (len === 12) return 'fourc';
    if (len === 11) return 'presurvey';
    return 'generic';
  }

  /* ---------------- 配對整理 ---------------- */
  /* 同一 sid 同一 stage 取最後一筆（以 ts 排序，缺 ts 則取出現順序最後）。
     回傳 {pairs, preOnly, postOnly, matrixPre, matrixPost} */
  function buildPairs(records, itemCount) {
    var by = {};
    records.forEach(function (r, i) {
      if (!r.sid) return;
      var scores = itemCount > 0 ? r.scores.slice(0, itemCount) : r.scores.slice();
      if (scores.some(function (v) { return isNaN(v); })) return;   // listwise
      var key = r.sid;
      if (!by[key]) by[key] = {};
      var prev = by[key][r.stage];
      var ord = r.ts ? String(r.ts) : ('~' + i);   // '~' 排在數字/日期之後 → 無 ts 者視為較新
      if (!prev || ord >= prev.ord) by[key][r.stage] = { scores: scores, ord: ord };
    });
    var pairs = [], preOnly = 0, postOnly = 0, matrixPre = [], matrixPost = [];
    Object.keys(by).forEach(function (sid) {
      var e = by[sid];
      if (e.pre) matrixPre.push(e.pre.scores);
      if (e.post) matrixPost.push(e.post.scores);
      if (e.pre && e.post) pairs.push({ sid: sid, pre: e.pre.scores, post: e.post.scores });
      else if (e.pre) preOnly++;
      else if (e.post) postOnly++;
    });
    pairs.sort(function (a, b) { return a.sid < b.sid ? -1 : 1; });
    return { pairs: pairs, preOnly: preOnly, postOnly: postOnly, matrixPre: matrixPre, matrixPost: matrixPost };
  }

  /* 對每個分析單位（整體＋各構面）做配對檢定 */
  function analyse(records, schemeKey) {
    var scheme = SCHEMES[schemeKey] || SCHEMES.generic;
    var itemCount = scheme.items;
    if (itemCount === 0) {
      var maxLen = 0;
      records.forEach(function (r) { maxLen = Math.max(maxLen, r.scores.length); });
      itemCount = maxLen;
    }
    var built = buildPairs(records, itemCount);
    function subMeans(scores, idx) {
      if (!idx) { return mean(scores); }
      return mean(idx.map(function (i) { return scores[i]; }));
    }
    var units = [{ key: 'overall', name: '整體', en: 'Overall', idx: null }].concat(scheme.subs);
    var results = units.map(function (u) {
      var pre = built.pairs.map(function (p) { return subMeans(p.pre, u.idx); });
      var post = built.pairs.map(function (p) { return subMeans(p.post, u.idx); });
      var test = pairedTest(pre, post);
      return { unit: u, test: test };
    });
    var alphaPre = cronbach(built.matrixPre);
    var alphaPost = cronbach(built.matrixPost);
    return {
      scheme: scheme, schemeKey: schemeKey, itemCount: itemCount,
      pairs: built.pairs.length, preOnly: built.preOnly, postOnly: built.postOnly,
      nPre: built.matrixPre.length, nPost: built.matrixPost.length,
      results: results, alphaPre: alphaPre, alphaPost: alphaPost
    };
  }

  /* ---------------- 格式化（APA） ---------------- */
  function fnum(v, d) { return isNaN(v) || v === null ? '—' : Number(v).toFixed(d === undefined ? 2 : d); }
  function fp(p) {
    if (p === null || isNaN(p)) return 'p = —';
    if (p < 0.001) return 'p < .001';
    return 'p = ' + p.toFixed(3).replace(/^0/, '');
  }
  function falpha(a) { return a === null ? '—' : ('α = ' + a.toFixed(2).replace(/^0/, '')); }
  function magnitude(dz, lang) {
    var a = Math.abs(dz);
    if (isNaN(a)) return lang === 'en' ? 'indeterminate' : '無法判定';
    if (a < 0.2) return lang === 'en' ? 'negligible' : '極小';
    if (a < 0.5) return lang === 'en' ? 'small' : '小';
    if (a < 0.8) return lang === 'en' ? 'medium' : '中';
    return lang === 'en' ? 'large' : '大';
  }

  /* ---------------- 示範資料 ---------------- */
  function demoData() {
    var recs = [];
    var seedState = 42;
    function rnd() { seedState = (seedState * 1103515245 + 12345) % 2147483648; return seedState / 2147483648; }
    function likert(base) { var v = Math.round(base + (rnd() * 2 - 1) * 1.2); return Math.max(1, Math.min(5, v)); }
    for (var s = 0; s < 26; s++) {
      var sid = String(1001 + s);
      // 個人能力因子讓題項間有相關，Cronbach α 才會是合理的正值
      var ability = (rnd() - 0.5) * 1.6;
      var gain = 0.7 + rnd() * 0.7;
      var pre = [], post = [];
      for (var i = 0; i < 16; i++) { pre.push(likert(2.9 + ability)); post.push(likert(2.9 + ability + gain)); }
      recs.push({ sid: sid, stage: '前測', ts: '2026/02/20 10:0' + (s % 10), scores: pre, se: s % 3 });
      if (s < 24) recs.push({ sid: sid, stage: '後測', ts: '2026/06/10 10:0' + (s % 10), scores: post, se: s % 3 });
    }
    return JSON.stringify(recs, null, 1);
  }

  root.AE = {
    mean: mean, sd: sd, variance: variance,
    lnGamma: lnGamma, ibeta: ibeta,
    tTwoTailedP: tTwoTailedP, tCritical: tCritical,
    pairedTest: pairedTest, cronbach: cronbach,
    parseRecords: parseRecords, buildPairs: buildPairs, analyse: analyse,
    SCHEMES: SCHEMES, guessScheme: guessScheme,
    fnum: fnum, fp: fp, falpha: falpha, magnitude: magnitude,
    demoData: demoData,
    DATASET_KEY: 'ae.dataset.v1'    // stats.html ↔ paper.html 交接用
  };
})(typeof window !== 'undefined' ? window : globalThis);
