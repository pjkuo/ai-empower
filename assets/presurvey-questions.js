/* ============================================================
   課前評量（高中資訊背景 × 大學銜接）— 題庫、計分與判準  v2.0
   零後端；presurvey.html（學生）與 presurvey-teacher.html（教師）共用。
   回覆碼格式：PS1.<base64(JSON)>
============================================================ */
(function (global) {
  "use strict";

  var VERSION = 2;
  var CODE_PREFIX = "PS1.";
  var STORE_KEY = "ae.presurvey.v1";        // 同裝置作答自動納入
  var TEACHER_KEY = "ae.presurvey.teacher.v1"; // 教師端已匯入資料

  var CLASSES = [
    { key: "IM1A",  name: "資管一A 計算機概論" },
    { key: "VE1A",  name: "車輛一A 數位科技與AI應用" },
    { key: "VE1",   name: "車輛工程系一年級" },
    { key: "OTHER", name: "其他（自填）" }
  ];

  var DIMS = [
    { key: "D", name: "裝置與生活應用", en: "Devices",            weight: 0.10, color: "#0D9488" },
    { key: "H", name: "高中資訊經歷",   en: "HS Experience",      weight: 0.20, color: "#3B82F6" },
    { key: "T", name: "運算思維",       en: "Computational Thinking", weight: 0.30, color: "#7C3AED" },
    { key: "C", name: "電腦與網路常識", en: "Computer Literacy",  weight: 0.25, color: "#1E3A8A" },
    { key: "A", name: "AI 工具使用",    en: "AI Usage",           weight: 0.15, color: "#DB2777" },
    { key: "L", name: "學習偏好",       en: "Learning Preference", weight: 0,    color: "#D97706" }
  ];

  /* type: single / multi / scale / text
     score: single → 每個選項的分數（0–100）；multi → 每勾一項加分（上限 100）；
            scale → (v-1)/(max-1)*100；answer → 有正解題（答對 100，答錯 0） */
  var QUESTIONS = [
    /* ---------- D 裝置與生活應用 ---------- */
    { id: "D1", dim: "D", type: "single", text: "你平常最常用來上網、做作業的裝置是？",
      opts: ["只有手機", "手機＋平板", "手機＋筆電或桌機", "手機、平板、電腦都有"], score: [25, 50, 100, 100] },
    { id: "D2", dim: "D", type: "single", text: "家裡（或宿舍）有沒有你可以長時間使用的電腦？",
      opts: ["沒有", "有，但要跟家人共用", "有，自己專用"], score: [0, 60, 100] },
    { id: "D3", dim: "D", type: "multi", text: "下列哪些你曾經自己操作過？（可複選）",
      opts: ["Google 文件／Word 寫報告", "雲端硬碟分享檔案", "剪輯影片", "試算表（Excel／Sheets）", "線上會議（Meet／Teams）", "繪圖或簡報製作"], each: 20 },
    { id: "D4", dim: "D", type: "scale", text: "整體來說，我對電腦操作（檔案管理、安裝軟體、打字）很熟練。", min: 1, max: 5,
      labels: ["非常不同意", "不同意", "普通", "同意", "非常同意"] },

    /* ---------- H 高中資訊經歷 ---------- */
    { id: "H1", dim: "H", type: "single", text: "高中（職）時上過多久的資訊科技相關課程？",
      opts: ["沒有上過", "約 1 學期", "約 1 年", "2 年以上"], score: [0, 40, 70, 100] },
    { id: "H2", dim: "H", type: "single", text: "你有沒有寫過程式？",
      opts: ["完全沒有", "只用過積木式（Scratch／mBlock／micro:bit）", "寫過文字程式（Python／C／JavaScript）", "做過完整的小專案或參加過程式競賽"], score: [0, 40, 80, 100] },
    { id: "H3", dim: "H", type: "multi", text: "高中（職）時學過哪些主題？（可複選）",
      opts: ["演算法與流程圖", "試算表／資料處理", "網頁（HTML／CSS）", "資料庫", "AI 與機器學習概念", "資訊倫理與資安", "電腦硬體組裝"], each: 15 },
    { id: "H4", dim: "H", type: "single", text: "你畢業的學校類型是？",
      opts: ["普通高中", "高職／技高 資訊相關科（資處、資訊、電子…）", "高職／技高 非資訊相關科", "綜合高中／其他"], score: [60, 100, 40, 60] },

    /* ---------- T 運算思維（有正解） ---------- */
    { id: "T1", dim: "T", type: "single", answer: 1, text: "「點一杯珍奶」可以看成 輸入（Input）→ 處理（Process）→ 輸出（Output）。下列哪一項是「處理」？",
      opts: ["客人說：珍奶半糖少冰", "店員煮茶、加珍珠、裝杯封膜", "一杯做好的珍奶", "列印出來的發票"] },
    { id: "T2", dim: "T", type: "single", answer: 1, text: "排隊買飲料「先來的先買到」，這種「先進先出」的資料安排方式，在程式裡叫做？",
      opts: ["堆疊（Stack）", "佇列（Queue）", "樹（Tree）", "雜湊表（Hash）"] },
    { id: "T3", dim: "T", type: "single", answer: 1, text: "規則：「如果 溫度 > 28 就開冷氣，否則 開電扇」。現在溫度剛好 28 度，會發生什麼？",
      opts: ["開冷氣", "開電扇", "冷氣和電扇都開", "什麼都不開"] },
    { id: "T4", dim: "T", type: "single", answer: 2, text: "依序執行：x = 5；x = x + 3；x = x × 2。最後 x 是多少？",
      opts: ["10", "13", "16", "26"] },
    { id: "T5", dim: "T", type: "single", answer: 1, text: "猜 1～100 之間的一個數字，每猜一次會被告知「太大」或「太小」。最有效率的第一猜是？",
      opts: ["1", "50", "100", "隨便猜一個"] },
    { id: "T6", dim: "T", type: "single", answer: 2, text: "泡泡麵的步驟：①倒熱水 ②加調味包 ③等 3 分鐘 ④打開包裝放麵 ⑤開吃。哪個順序才對？",
      opts: ["① ④ ② ③ ⑤", "④ ① ③ ② ⑤", "④ ② ① ③ ⑤", "② ① ④ ③ ⑤"] },

    /* ---------- C 電腦與網路常識（有正解） ---------- */
    { id: "C1", dim: "C", type: "single", answer: 0, text: "瀏覽器開了 30 個分頁，電腦明顯變卡。最直接相關的零件是？",
      opts: ["記憶體（RAM）", "螢幕", "鍵盤", "網路線"] },
    { id: "C2", dim: "C", type: "single", answer: 0, text: "你輸入 www.npust.edu.tw，是誰把這個網址「翻譯」成電腦看得懂的 IP 位址？",
      opts: ["DNS", "USB", "CPU", "HDMI"] },
    { id: "C3", dim: "C", type: "single", answer: 2, text: "下列哪個密碼最安全？",
      opts: ["123456", "password", "Npust@2026!mis", "0912345678"] },
    { id: "C4", dim: "C", type: "single", answer: 1, text: "1 GB 大約等於？",
      opts: ["1024 KB", "1024 MB", "1024 TB", "1024 bit"] },
    { id: "C5", dim: "C", type: "single", answer: 1, text: "電動機車 App 能顯示車子的剩餘電量。資料最可能是怎麼流到你手機的？",
      opts: ["App 依照你的騎乘習慣自己估算", "車上感測器 → 透過網路上傳雲端 → App 讀取", "手機鏡頭掃描儀表板", "電池直接用電線把數字傳進手機"] },

    /* ---------- A AI 工具使用 ---------- */
    { id: "A1", dim: "A", type: "single", text: "你使用生成式 AI（ChatGPT、Gemini、Copilot…）的頻率？",
      opts: ["從來沒用過", "偶爾（一個月幾次）", "每週都用", "幾乎每天"], score: [0, 40, 75, 100] },
    { id: "A2", dim: "A", type: "multi", text: "你用 AI 做過哪些事？（可複選）",
      opts: ["寫作業／報告", "翻譯或修改文句", "寫或看懂程式", "查資料、整理重點", "聊天、娛樂", "生成圖片／影片"], each: 20 },
    { id: "A3", dim: "A", type: "single", text: "AI 跟你說：「阿里山是台灣最高峰。」你通常會？",
      opts: ["相信它，AI 講的應該沒錯", "覺得怪怪的，但沒有去查", "去查一下，發現最高峰其實是玉山", "不知道怎麼判斷"], score: [0, 50, 100, 20], flag: "trust" },
    { id: "A4", dim: "A", type: "scale", text: "AI 是學習的好幫手，但它的答案需要我自己驗證。", min: 1, max: 5,
      labels: ["非常不同意", "不同意", "普通", "同意", "非常同意"] },

    /* ---------- L 學習偏好（不計分） ---------- */
    { id: "L1", dim: "L", type: "single", text: "你最喜歡的上課方式是？",
      opts: ["聽老師講解", "看老師示範操作", "自己動手做", "小組討論與分享"] },
    { id: "L2", dim: "L", type: "single", text: "上課聽不懂時，你通常會？",
      opts: ["當場舉手問", "下課私下問老師或同學", "自己上網或問 AI", "不發問，先放著"] },
    { id: "L3", dim: "L", type: "single", text: "你希望這門課的進度？",
      opts: ["慢一點，多練習", "普通就好", "快一點，多學一些"] },
    { id: "L4", dim: "L", type: "text", text: "這門課你最希望學到什麼？或最擔心什麼？（一句話即可，可留空）", placeholder: "例：希望學會用 Python 做小工具；擔心英文專有名詞太多…" }
  ];

  /* ---------------- 計分 ---------------- */
  function itemScore(q, v) {
    if (v === undefined || v === null || v === "") return null;
    if (q.answer !== undefined) return Number(v) === q.answer ? 100 : 0;
    if (q.type === "single") return q.score ? (q.score[Number(v)] ?? null) : null;
    if (q.type === "multi") { var n = Array.isArray(v) ? v.length : 0; return Math.min(100, n * (q.each || 20)); }
    if (q.type === "scale") return (Number(v) - q.min) / (q.max - q.min) * 100;
    return null;
  }

  /* 回傳 {dims:{D:..,H:..}, R, level, levelName} */
  function scoreResponse(ans) {
    var dims = {}, cnt = {};
    QUESTIONS.forEach(function (q) {
      if (q.dim === "L") return;
      var s = itemScore(q, ans[q.id]);
      if (s === null) return;
      dims[q.dim] = (dims[q.dim] || 0) + s; cnt[q.dim] = (cnt[q.dim] || 0) + 1;
    });
    var R = 0, wsum = 0;
    DIMS.forEach(function (d) {
      if (d.weight === 0) return;
      dims[d.key] = cnt[d.key] ? Math.round(dims[d.key] / cnt[d.key]) : null;
      if (dims[d.key] !== null) { R += dims[d.key] * d.weight; wsum += d.weight; }
    });
    R = wsum ? Math.round(R / wsum) : null;
    return { dims: dims, R: R, level: levelOf(R), levelName: LEVELS[levelOf(R)].name };
  }

  var LEVELS = {
    starter:  { name: "起步型", color: "#D97706", bg: "#FEF3C7", desc: "資訊基礎較薄弱，需要先鞏固概念與操作。" },
    steady:   { name: "穩健型", color: "#3B82F6", bg: "#DBEAFE", desc: "具備基本概念，可依標準節奏學習。" },
    advanced: { name: "進階型", color: "#059669", bg: "#D1FAE5", desc: "已有程式或資訊經驗，可加速進入專題。" }
  };
  function levelOf(R) { if (R === null || R === undefined) return "steady"; return R < 40 ? "starter" : R <= 65 ? "steady" : "advanced"; }

  /* ---------------- 回覆碼 ---------------- */
  function b64e(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64d(str) { return decodeURIComponent(escape(atob(str))); }
  function encodeResponse(rec) { return CODE_PREFIX + b64e(JSON.stringify(rec)); }
  function decodeResponse(code) {
    code = String(code || "").trim();
    if (code.indexOf(CODE_PREFIX) !== 0) throw new Error("不是有效的回覆碼（需以 " + CODE_PREFIX + " 開頭）");
    var rec = JSON.parse(b64d(code.slice(CODE_PREFIX.length)));
    if (!rec || !rec.ans) throw new Error("回覆碼內容不完整");
    return rec;
  }
  /* 從任意文字中撈出所有回覆碼（支援整段 LINE／Moodle 貼文） */
  function extractCodes(text) {
    var re = /PS1\.[A-Za-z0-9+/=]+/g, m, out = [];
    while ((m = re.exec(String(text || "")))) out.push(m[0]);
    return out;
  }

  /* ---------------- 判準（12 條） ---------------- */
  /* stats = aggregate() 的輸出。回傳 [{id, text, mode?}] */
  var CRITERIA = [
    { id: "K1", test: function (s) { return s.levelPct.starter >= 40; }, mode: "basic",
      text: function (s) { return "起步型達 " + s.levelPct.starter + "% → 前 4 週採「基礎鞏固」：放慢硬體／軟體概念，每週安排一次操作練習。"; } },
    { id: "K2", test: function (s) { return s.levelPct.advanced >= 30 && s.levelPct.starter >= 20; }, mode: "tiered",
      text: function (s) { return "進階型 " + s.levelPct.advanced + "%、起步型 " + s.levelPct.starter + "% 並存 → 採「分層差異化」：同一主題提供基礎／挑戰兩種任務單。"; } },
    { id: "K3", test: function (s) { return s.levelPct.advanced >= 50; }, mode: "accel",
      text: function (s) { return "進階型過半（" + s.levelPct.advanced + "%）→ 採「加速專題」：第 6 週起即進入心智圖→IPO→Python 專題流程。"; } },
    { id: "K4", test: function (s) { return s.R.sd > 18; },
      text: function (s) { return "準備度標準差 " + s.R.sd + " > 18，起點差異大 → 建議異質分組（每組混合起步／進階），並準備補充教材連結。"; } },
    { id: "K5", test: function (s) { return s.dimMean.T < 50; },
      text: function (s) { return "運算思維平均 " + s.dimMean.T + " < 50 → 程式教學前先用「心智圖 → IPO → 流程圖」建立拆解習慣（AI 賦能平台步驟①②）。"; } },
    { id: "K6", test: function (s) { return s.dimMean.C < 50; },
      text: function (s) { return "電腦與網路常識平均 " + s.dimMean.C + " < 50 → 以「拆解一台電腦／一支手機」模組開場（IOC 3C 拆解），建立硬體與網路的具象理解。"; } },
    { id: "K7", test: function (s) { return s.optPct("H2", 0) >= 50; },
      text: function (s) { return s.optPct("H2", 0) + "% 完全沒寫過程式 → Python 之前先安排 1 週積木式程式（Scratch／mBlock）銜接。"; } },
    { id: "K8", test: function (s) { return s.optPct("D1", 0) >= 20; },
      text: function (s) { return s.optPct("D1", 0) + "% 只有手機 → 課堂與作業任務須確保可在手機完成（平台皆為響應式），並公告電腦教室開放時段。"; } },
    { id: "K9", test: function (s) { return s.optPct("A3", 0) >= 30; },
      text: function (s) { return s.optPct("A3", 0) + "% 對 AI 答案照單全收 → 加入「抓 AI 錯誤」活動：每週給一段含錯誤的 AI 回答讓學生查證。"; } },
    { id: "K10", test: function (s) { return s.optPct("L1", 2) >= 50; },
      text: function (s) { return s.optPct("L1", 2) + "% 偏好動手做 → 講授時間壓在 40% 以內，其餘以模擬平台操作與任務單進行。"; } },
    { id: "K11", test: function (s) { return s.optPct("L2", 3) >= 40; },
      text: function (s) { return s.optPct("L2", 3) + "% 聽不懂也不發問 → 開設匿名提問（Padlet／表單），每堂課保留 5 分鐘回應。"; } },
    { id: "K12", test: function (s) { return s.optPct("L3", 0) >= 40; },
      text: function (s) { return s.optPct("L3", 0) + "% 希望進度慢一點 → 壓縮第 13–16 週專題週次，保留 1 週為總複習週。"; } }
  ];

  var MODES = {
    basic:  { name: "基礎鞏固", desc: "前 4 週放慢概念與操作，每週一次實作練習。" },
    tiered: { name: "分層差異化", desc: "同一主題提供基礎／挑戰任務，異質分組互教。" },
    accel:  { name: "加速專題", desc: "提早進入專題流程，教師角色轉為顧問。" },
    normal: { name: "標準節奏", desc: "依原 18 週進度，穿插模擬平台操作。" }
  };

  /* ---------------- 18 週基準進度 ---------------- */
  var WEEKS = [
    "課程導覽・AI 賦能平台入口・課前評量", "電腦是怎麼運作的：IPO 模型", "硬體 I：CPU／記憶體／儲存", "硬體 II：3C 拆解與虛擬組裝",
    "軟體 I：作業系統與檔案", "軟體 II：應用軟體與雲端", "網路 I：IP／DNS／封包流", "網路 II：資安與密碼",
    "期中評量（模擬平台即時評量）", "運算思維：心智圖 → IPO", "Python I：變數與流程", "Python II：函式與資料",
    "AI 人機協作 I：提示與驗證", "AI 人機協作 II：抓 AI 錯誤", "專題 I：主題與架構", "專題 II：實作與簡報",
    "專題發表・學習後測", "期末考"
  ];
  /* 依判準調整逐週內容，回傳 [{w, base, adj}] */
  function weeklyPlan(hits) {
    var ids = hits.map(function (h) { return h.id; });
    var has = function (k) { return ids.indexOf(k) >= 0; };
    return WEEKS.map(function (t, i) {
      var w = i + 1, adj = [];
      if (has("K1") && w <= 4) adj.push("基礎鞏固：加 20 分鐘操作練習");
      if (has("K2") && w >= 3 && w <= 16) adj.push("分層任務單（基礎／挑戰）");
      if (has("K3") && w === 6) adj.push("提早啟動專題：心智圖選題");
      if (has("K3") && w >= 15) adj.push("專題深化（顧問制）");
      if (has("K4") && w === 2) adj.push("異質分組成組");
      if (has("K5") && (w === 2 || w === 10)) adj.push("流程圖拆解練習加量");
      if (has("K6") && w === 3) adj.push("改以 3C 拆解開場");
      if (has("K7") && w === 10) adj.push("插入積木式程式 1 週（Python 順延）");
      if (has("K8")) adj.push(w === 1 ? "公告電腦教室時段；任務可用手機完成" : "");
      if (has("K9") && w >= 5 && w <= 16 && w % 2 === 1) adj.push("抓 AI 錯誤 10 分鐘");
      if (has("K10")) adj.push(w !== 9 && w !== 18 ? "講授 ≤ 40%，其餘操作" : "");
      if (has("K11") && w === 1) adj.push("開設匿名提問管道");
      if (has("K12") && w >= 13 && w <= 16) adj.push(w === 16 ? "改為總複習週" : "專題壓縮（3 週完成）");
      return { w: w, base: t, adj: adj.filter(Boolean) };
    });
  }

  /* ---------------- 彙整 ---------------- */
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function sd(a) { if (a.length < 2) return 0; var m = mean(a); return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1)); }

  function aggregate(records) {
    var scored = records.map(function (r) { var s = scoreResponse(r.ans); return { rec: r, score: s }; });
    var n = scored.length;
    var Rs = scored.map(function (x) { return x.score.R; }).filter(function (v) { return v !== null; });
    var levelCnt = { starter: 0, steady: 0, advanced: 0 };
    scored.forEach(function (x) { levelCnt[x.score.level]++; });
    var levelPct = {};
    Object.keys(levelCnt).forEach(function (k) { levelPct[k] = n ? Math.round(levelCnt[k] / n * 100) : 0; });
    var dimMean = {};
    DIMS.forEach(function (d) {
      if (d.weight === 0) return;
      var v = scored.map(function (x) { return x.score.dims[d.key]; }).filter(function (v) { return v !== null && v !== undefined; });
      dimMean[d.key] = v.length ? Math.round(mean(v)) : 0;
    });
    /* 選項分布 */
    var dist = {};
    QUESTIONS.forEach(function (q) {
      if (q.type === "text") { dist[q.id] = records.map(function (r) { return r.ans[q.id]; }).filter(Boolean); return; }
      var len = q.type === "scale" ? (q.max - q.min + 1) : q.opts.length;
      var arr = []; for (var i = 0; i < len; i++) arr.push(0);
      var answered = 0;
      records.forEach(function (r) {
        var v = r.ans[q.id]; if (v === undefined || v === null || v === "") return; answered++;
        if (q.type === "multi") (v || []).forEach(function (i) { arr[i]++; });
        else if (q.type === "scale") arr[Number(v) - q.min]++;
        else arr[Number(v)]++;
      });
      dist[q.id] = { counts: arr, n: answered };
    });
    function optPct(qid, idx) { var d = dist[qid]; return d && d.n ? Math.round(d.counts[idx] / d.n * 100) : 0; }
    /* 有正解題答對率 */
    var correct = {};
    QUESTIONS.forEach(function (q) {
      if (q.answer === undefined) return;
      var d = dist[q.id]; correct[q.id] = d && d.n ? Math.round(d.counts[q.answer] / d.n * 100) : 0;
    });
    /* 各班 */
    var byClass = {};
    scored.forEach(function (x) {
      var c = x.rec.cls || "未填";
      if (!byClass[c]) byClass[c] = { n: 0, Rs: [], lv: { starter: 0, steady: 0, advanced: 0 } };
      byClass[c].n++; if (x.score.R !== null) byClass[c].Rs.push(x.score.R); byClass[c].lv[x.score.level]++;
    });
    Object.keys(byClass).forEach(function (c) { byClass[c].mean = Math.round(mean(byClass[c].Rs)); byClass[c].sd = Math.round(sd(byClass[c].Rs)); });

    var stats = {
      n: n, scored: scored,
      R: { mean: Math.round(mean(Rs)), sd: Math.round(sd(Rs) * 10) / 10 },
      levelCnt: levelCnt, levelPct: levelPct, dimMean: dimMean, dist: dist, optPct: optPct, correct: correct, byClass: byClass
    };
    var hits = CRITERIA.filter(function (c) { try { return n > 0 && c.test(stats); } catch (e) { return false; } })
      .map(function (c) { return { id: c.id, text: c.text(stats), mode: c.mode }; });
    var mode = "normal";
    if (hits.some(function (h) { return h.mode === "tiered"; })) mode = "tiered";
    else if (hits.some(function (h) { return h.mode === "accel"; })) mode = "accel";
    else if (hits.some(function (h) { return h.mode === "basic"; })) mode = "basic";
    stats.hits = hits; stats.mode = mode; stats.modeInfo = MODES[mode];
    stats.weekly = weeklyPlan(hits);
    stats.interpretation = interpret(stats);
    return stats;
  }

  function interpret(s) {
    if (!s.n) return "尚無資料。";
    var lv = s.levelPct, out = [];
    out.push("共 " + s.n + " 份有效作答，整體準備度平均 " + s.R.mean + "（SD " + s.R.sd + "）。");
    out.push("起步型 " + lv.starter + "%、穩健型 " + lv.steady + "%、進階型 " + lv.advanced + "%。");
    var dm = s.dimMean, strong = [], weak = [];
    DIMS.forEach(function (d) { if (d.weight === 0) return; (dm[d.key] >= 65 ? strong : dm[d.key] < 50 ? weak : []).push(d.name); });
    if (strong.length) out.push("相對強項：" + strong.join("、") + "。");
    if (weak.length) out.push("需補強：" + weak.join("、") + "。");
    out.push("建議教學模式：「" + s.modeInfo.name + "」— " + s.modeInfo.desc);
    return out.join("");
  }

  /* ---------------- 匯出給統計工作台（T＋C 共 11 題，0/1） ---------------- */
  var ANSWER_ITEMS = QUESTIONS.filter(function (q) { return q.answer !== undefined; });
  function toStatsRecords(records) {
    return records.map(function (r) {
      return {
        sid: r.sid, stage: r.stage === "post" ? "後測" : "前測", ts: r.ts, group: r.cls,
        scores: ANSWER_ITEMS.map(function (q) { var v = r.ans[q.id]; return (v === undefined || v === "") ? "" : (Number(v) === q.answer ? 1 : 0); })
      };
    });
  }

  /* ---------------- CSV ---------------- */
  function toCSV(records) {
    var head = ["sid", "class", "stage", "ts"].concat(QUESTIONS.map(function (q) { return q.id; }))
      .concat(DIMS.filter(function (d) { return d.weight; }).map(function (d) { return "score_" + d.key; })).concat(["R", "level"]);
    var lines = [head.join(",")];
    records.forEach(function (r) {
      var s = scoreResponse(r.ans);
      var row = [r.sid, r.cls, r.stage || "pre", r.ts].concat(QUESTIONS.map(function (q) {
        var v = r.ans[q.id]; if (v === undefined || v === null) return "";
        if (Array.isArray(v)) return v.length ? v.join("|") : "-";   // "-" = 有作答但未勾任何項
        return String(v);
      })).concat(DIMS.filter(function (d) { return d.weight; }).map(function (d) { return s.dims[d.key] === null ? "" : s.dims[d.key]; }))
        .concat([s.R === null ? "" : s.R, s.levelName]);
      lines.push(row.map(function (c) { c = String(c).replace(/"/g, '""'); return /[",\n]/.test(c) ? '"' + c + '"' : c; }).join(","));
    });
    return "﻿" + lines.join("\r\n");
  }
  function fromCSV(text) {
    var lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var head = lines[0].split(",").map(function (h) { return h.trim(); });
    var qi = {}; QUESTIONS.forEach(function (q) { qi[q.id] = head.indexOf(q.id); });
    var si = head.indexOf("sid"), ci = head.indexOf("class"), sti = head.indexOf("stage"), ti = head.indexOf("ts");
    return lines.slice(1).map(function (l) {
      var cells = parseCSVLine(l), ans = {};
      QUESTIONS.forEach(function (q) {
        var i = qi[q.id]; if (i < 0) return; var v = cells[i]; if (v === undefined || v === "") return;
        if (q.type === "multi") ans[q.id] = v === "-" ? [] : v.split("|").map(Number);
        else if (q.type === "text") ans[q.id] = v;
        else ans[q.id] = Number(v);
      });
      return { v: VERSION, sid: cells[si] || "", cls: cells[ci] || "", stage: cells[sti] || "pre", ts: cells[ti] || "", ans: ans };
    });
  }
  function parseCSVLine(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  }

  /* ---------------- 示範資料（40 筆） ---------------- */
  function demoData(seed) {
    var s = seed || 7; function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    function pick(n, bias) { var r = Math.pow(rnd(), bias || 1); return Math.min(n - 1, Math.floor(r * n)); }
    var out = [];
    for (var i = 0; i < 40; i++) {
      var cls = i < 22 ? "資管一A 計算機概論" : "車輛一A 數位科技與AI應用";
      var strong = cls.indexOf("資管") >= 0 ? 0.75 : 1.5;   // 資管班整體偏強
      var ans = {};
      QUESTIONS.forEach(function (q) {
        if (q.type === "text") { ans[q.id] = ["想學會寫 Python 小工具", "擔心程式太難", "希望多做實作", "想了解 AI 怎麼用在工作上", ""][pick(5)]; return; }
        if (q.type === "scale") { ans[q.id] = q.min + pick(q.max - q.min + 1, strong); return; }
        if (q.type === "multi") { var k = pick(q.opts.length + 1, strong), arr = []; for (var j = 0; j < q.opts.length && arr.length < k; j++) if (rnd() > 0.4) arr.push(j); ans[q.id] = arr; return; }
        if (q.answer !== undefined) { var pr = (cls.indexOf("資管") >= 0 ? 0.58 : 0.36) + (q.dim === "C" ? -0.08 : 0); ans[q.id] = rnd() < pr ? q.answer : pick(q.opts.length); return; }
        ans[q.id] = q.dim === "L" ? pick(q.opts.length) : pick(q.opts.length, q.score && q.score[0] === 0 ? strong : 1);
      });
      var sid = String(1000 + Math.floor(rnd() * 9000));
      out.push({ v: VERSION, sid: sid, cls: cls, stage: "pre", ts: "2026-09-0" + (1 + (i % 7)) + "T10:" + (10 + i % 50) + ":00", ans: ans });
      /* 其中 30 人有期末複測（T＋C），答對率提高 */
      if (i % 4 !== 3) {
        var post = {};
        ANSWER_ITEMS.forEach(function (q) { post[q.id] = rnd() < 0.78 ? q.answer : pick(q.opts.length); });
        out.push({ v: VERSION, sid: sid, cls: cls, stage: "post", ts: "2027-01-0" + (1 + (i % 7)) + "T10:" + (10 + i % 50) + ":00", ans: post });
      }
    }
    return out;
  }


  /* ---------------- 生活化文字：給學生的建議、全班共識 ---------------- */
  /* 個人建議：依向度分數與作答，回傳 [{icon, title, text}] */
  function friendlyAdvice(score, ans) {
    var d = score.dims || {}, out = [];
    var lv = score.level;
    out.push({ icon: lv === "starter" ? "🌱" : lv === "advanced" ? "🚀" : "🙂",
      title: lv === "starter" ? "你現在是「起步型」——這門課就是為你設計的" : lv === "advanced" ? "你是「進階型」——這門課可以讓你跑得更遠" : "你是「穩健型」——照節奏走就會很順",
      text: lv === "starter" ? "不用擔心，班上很多人跟你一樣是從零開始。前幾週我們會慢慢來，每週都有動手做的練習，你只要跟著做，第四週以後會明顯感覺到「原來我也會」。"
          : lv === "advanced" ? "基礎的部分你可以當複習，重點放在專題：挑一個你真的想解決的生活問題（例如幫社團排班、算機車油錢），提早把它做成作品。課堂上也歡迎你當小老師。"
          : "你有基礎、也有一些空白。上課聽懂就好，回家不用預習；把每週的小練習做完，期末專題自然就做得出來。" });
    if (d.T !== undefined && d.T !== null && d.T < 50) out.push({ icon: "🍜", title: "把事情拆成步驟", text: "你在「運算思維」題比較不熟，這其實就是「泡麵要先倒水還是先放麵」的順序感。我們會用心智圖和 IPO（輸入→處理→輸出）練習拆步驟，練幾次就上手，這比背語法重要多了。" });
    else if (d.T >= 80) out.push({ icon: "🧩", title: "你的拆解能力很好", text: "運算思維幾乎全對，寫程式對你來說會是把想法翻譯成文字而已。可以直接試試 AI 賦能平台的「心智圖 → Python」。" });
    if (d.C !== undefined && d.C !== null && d.C < 50) out.push({ icon: "🔧", title: "先摸懂電腦再談程式", text: "RAM、DNS 這些名詞現在不懂很正常。我們第一個月會把一台電腦和一支手機「拆開來看」，你會發現每個零件都對應到你每天在用的功能。" });
    if (ans && ans.H2 === 0) out.push({ icon: "🧱", title: "從積木開始，不急著打字", text: "你還沒寫過程式，所以 Python 之前我們先用拖拉積木的方式玩一週，先有成就感再進入文字程式。" });
    if (ans && ans.D1 === 0) out.push({ icon: "📱", title: "只有手機也可以", text: "本站所有平台都能用手機操作。需要電腦的作業，可以用系上電腦教室（時段會公告），不用特地買電腦。" });
    if (ans && (ans.A3 === 0 || ans.A3 === 3)) out.push({ icon: "🔍", title: "AI 說的，先查一下", text: "AI 會很有自信地講錯話（阿里山不是最高峰，玉山才是）。這門課會教你怎麼用 AI 又不被 AI 騙，這是未來幾年最值錢的能力之一。" });
    else if (ans && ans.A3 === 2) out.push({ icon: "👍", title: "你已經會查證 AI", text: "很棒的習慣。課堂上的「抓 AI 錯誤」活動可以請你示範怎麼查。" });
    if (ans && ans.L2 === 3) out.push({ icon: "🙋", title: "不想舉手也沒關係", text: "課堂會有匿名提問的管道，打字問就好，老師每堂課都會回答。聽不懂先放著，最後會累積成大洞，所以匿名問也請一定要問。" });
    if (ans && ans.L1 === 2) out.push({ icon: "🛠", title: "你喜歡動手做", text: "這門課大概六成時間都在操作模擬平台和做專題，很適合你。" });
    return out;
  }

  /* 全班共識：依 aggregate() 的 stats，回傳 {headline, story, agreements:[{icon,text}], weeks:[{w,text}]} */
  function consensus(stats) {
    var lv = stats.levelPct, mode = stats.mode, ids = stats.hits.map(function (h) { return h.id; });
    var has = function (k) { return ids.indexOf(k) >= 0; };
    var headline = { basic: "這學期我們「慢慢來，比較快」", tiered: "這學期我們「各走各的路，一起到終點」", accel: "這學期我們「提早動手，做出作品」", normal: "這學期我們「照節奏走，邊做邊學」" }[mode];
    var story = "全班 " + stats.n + " 人的起點：起步型 " + lv.starter + "%、穩健型 " + lv.steady + "%、進階型 " + lv.advanced + "%。";
    story += { basic: "起步的同學比較多，所以前四週老師會把速度放慢，每堂課一定有動手做的時間，不會一直講課。",
               tiered: "有人從零開始、也有人已經會寫程式，所以同一個主題會有「基礎版」和「挑戰版」兩種任務，你選自己的那一版就好，分組時會混搭，互相教是最快的學法。",
               accel: "多數同學已經有基礎，所以我們會提早進入專題，老師的角色變成顧問，課堂時間留給你們做東西、卡關時來問。",
               normal: "起點分布很平均，我們依照原本的 18 週進度走，每週講一點、做一點，穩穩累積。" }[mode];
    var ag = [];
    ag.push({ icon: "🤝", text: "老師的承諾：每堂課講授不超過一半時間，其餘讓你操作、討論或做專題。" });
    if (has("K5")) ag.push({ icon: "🍜", text: "寫程式之前，我們先練「把事情拆成步驟」：用心智圖和 IPO 把想法畫出來，再動手寫。" });
    if (has("K6")) ag.push({ icon: "🔧", text: "開學先拆一台電腦、一支手機：看得到摸得到，名詞才記得住。" });
    if (has("K7")) ag.push({ icon: "🧱", text: "Python 之前先玩一週積木式程式，讓沒寫過程式的同學先有手感。" });
    if (has("K8")) ag.push({ icon: "📱", text: "所有作業都可以用手機完成；需要電腦的部分，電腦教室開放時段會公告。" });
    if (has("K9")) ag.push({ icon: "🔍", text: "每週有 10 分鐘「抓 AI 錯誤」：可以用 AI，但你要負責查證。" });
    if (has("K4")) ag.push({ icon: "👥", text: "分組會混搭起步與進階的同學，會的教不會的，教人是最好的複習。" });
    if (has("K11")) ag.push({ icon: "🙋", text: "開一個匿名提問區，不想舉手就打字問，老師每堂課都回。" });
    if (has("K12")) ag.push({ icon: "🐢", text: "專題期程會壓縮一點，留一週當總複習，不讓進度壓垮任何人。" });
    if (has("K3")) ag.push({ icon: "🚀", text: "第六週就開始選專題題目，期末你會有一個能放進履歷的作品。" });
    if (has("K10")) ag.push({ icon: "🛠", text: "大家都想動手做，所以課堂以操作模擬平台和任務單為主。" });
    ag.push({ icon: "💬", text: "你的承諾：每週的小練習做完、卡住就問（舉手或匿名都行）、AI 的答案自己驗證過再交。" });
    var weeks = stats.weekly.filter(function (w) { return w.adj.length; }).map(function (w) { return { w: w.w, text: w.base + "（" + w.adj.join("；") + "）" }; });
    return { headline: headline, story: story, agreements: ag, weeks: weeks, modeName: stats.modeInfo.name };
  }

  global.PS = {
    VERSION: VERSION, CODE_PREFIX: CODE_PREFIX, STORE_KEY: STORE_KEY, TEACHER_KEY: TEACHER_KEY,
    CLASSES: CLASSES, DIMS: DIMS, QUESTIONS: QUESTIONS, LEVELS: LEVELS, MODES: MODES, WEEKS: WEEKS, CRITERIA: CRITERIA,
    ANSWER_ITEMS: ANSWER_ITEMS,
    itemScore: itemScore, scoreResponse: scoreResponse, levelOf: levelOf,
    encodeResponse: encodeResponse, decodeResponse: decodeResponse, extractCodes: extractCodes,
    aggregate: aggregate, weeklyPlan: weeklyPlan, toStatsRecords: toStatsRecords,
    toCSV: toCSV, fromCSV: fromCSV, demoData: demoData, friendlyAdvice: friendlyAdvice, consensus: consensus
  };
})(window);
