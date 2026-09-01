/* ============================================================
   ai-empower 共用雲端資料層  v2.0（2026-08-26 壓測後改版）
   與整合案的統一記錄模型相容：
     { v:2, id, ts, app, kind, sid, name, cls, score, max, detail }
   後端：Google 試算表 + Apps Script（gas/Code.gs），每個 kind 一張工作表。
   設定：<meta name="cc-cloud-url" content="https://script.google.com/macros/s/…/exec">
   未設定時自動退回「本機＋佇列」模式，不會對假網址發請求；設定後按同步補送。

   v2.0 變更（對呼叫端相容：push()/flush()/pull()/classData() 簽名不變）
   - push 失敗自動退避重試：1.5s／3s／6s／12s／24s（各加 0–1 秒亂數），期間右下角顯示「排隊上傳中」。
   - push 前加 0–AECloud.spread 毫秒隨機延遲（預設 8000），把全班同秒送出的尖峰攤平；設 0 可關閉。
   - 佇列每 20 秒自動補送；分頁回前景／網路恢復時補送；頁面關閉（pagehide）時以 keepalive/sendBeacon 最後補送一次。
   - classData(cls, since) 支援增量（後端 class&since=）；回應含 at 供下次 since 使用。
   - v2.1：pull(kind, code, {incremental:true}) 在記憶體累積、只拉增量（後端 list&rsince=，回 at），回傳合併後完整清單。
   - 重送安全：後端以 id 去重，同一筆重送不會產生重複列。
   ============================================================ */
(function (global) {
  "use strict";
  var QUEUE_KEY = "ae.cloud.queue.v1";
  var CODE_KEY = "ae.cloud.teacherCode";
  var PLACEHOLDER = "PASTE_YOUR_APPS_SCRIPT_EXEC_URL";
  var RETRY_MS = [1500, 3000, 6000, 12000, 24000];   /* 失敗後重試間隔（另加 0–1000ms 亂數） */
  var FATAL = /bad json|no records|^code$|bad code|unknown action/i;   /* 這些錯誤重試也不會好 */
  var FLUSH_EVERY = 20000;

  function url() {
    var m = document.querySelector('meta[name="cc-cloud-url"]');
    var u = m ? (m.getAttribute("content") || "").trim() : "";
    try { var o = localStorage.getItem("ae.cloud.url"); if (o) u = o; } catch (e) {}
    return (u && u !== PLACEHOLDER && /^https?:\/\//.test(u)) ? u : "";
  }
  function ready() { return !!url(); }
  function uid() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  /* 建立統一記錄 */
  function record(o) {
    return {
      v: 2, id: o.id || uid(), ts: o.ts || new Date().toISOString(),
      app: o.app || "ai-empower", kind: o.kind || "misc",
      sid: String(o.sid || ""), name: o.name || "", cls: o.cls || "",
      score: o.score === undefined ? "" : o.score, max: o.max === undefined ? "" : o.max,
      detail: o.detail || {}
    };
  }

  /* ---- 佇列 ---- */
  function getQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; } }
  function setQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {} }
  function enqueue(recs) { var q = getQueue(); recs.forEach(function (r) { if (!q.some(function (x) { return x.id === r.id; })) q.push(r); }); setQueue(q); return q.length; }
  function dequeue(ids) { var q = getQueue().filter(function (x) { return ids.indexOf(x.id) < 0; }); setQueue(q); return q.length; }

  /* ---- 狀態小標籤（右下角；頁面不必自行處理） ---- */
  var toastEl = null, toastTimer = null;
  function toast(msg, kind, autoHide) {
    try {
      if (!toastEl) {
        toastEl = document.createElement("div"); toastEl.id = "ae-cloud-status"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite");
        toastEl.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9999;max-width:min(92vw,360px);padding:9px 13px;border-radius:8px;font:14px/1.45 system-ui,'Microsoft JhengHei',sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.18);transition:opacity .25s;pointer-events:none;";
        document.body.appendChild(toastEl);
      }
      var bg = kind === "ok" ? "#0a4f4f" : kind === "warn" ? "#7a4f00" : "#0f6e6e";
      toastEl.style.background = bg; toastEl.style.color = "#fff"; toastEl.textContent = msg; toastEl.style.opacity = "1";
      clearTimeout(toastTimer);
      if (autoHide) toastTimer = setTimeout(function () { toastEl.style.opacity = "0"; }, autoHide);
    } catch (e) {}
    try { document.dispatchEvent(new CustomEvent("aecloud:status", { detail: { msg: msg, kind: kind } })); } catch (e2) {}
  }

  /* ---- 送出（text/plain 避免 preflight；讀回應確認寫入） ---- */
  function post(recs, keepalive) {
    return fetch(url(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, keepalive: !!keepalive,
      body: JSON.stringify({ action: "push", records: recs }) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "後端拒絕"); return j; });
  }
  /* 帶重試的送出：成功回後端 JSON；全部失敗則 throw 最後一個錯誤 */
  function postRetry(recs, label) {
    var attempt = 0;
    function tryOnce() {
      attempt++;
      return post(recs).catch(function (e) {
        var msg = String(e && e.message || e);
        if (FATAL.test(msg) || attempt > RETRY_MS.length) throw e;
        var wait = RETRY_MS[attempt - 1] + Math.random() * 1000;
        toast("☁ " + (label || "") + "排隊上傳中…（第 " + attempt + " 次重試，" + Math.round(wait / 1000) + " 秒後）", "info");
        return sleep(wait).then(tryOnce);
      });
    }
    return tryOnce();
  }

  /* push：有網址就直接送（含隨機分散＋退避重試），失敗或無網址則排入佇列。回傳 Promise<{sent, dup, queued, error?, offline?}> */
  function push(recs, opts) {
    opts = opts || {};
    recs = (Array.isArray(recs) ? recs : [recs]).map(record);
    if (!ready()) { return Promise.resolve({ sent: 0, queued: enqueue(recs), offline: true }); }
    enqueue(recs);                                     /* 先落地：就算中途關頁也不會遺失 */
    var spread = opts.spread != null ? opts.spread : AE.spread;
    var delay = spread > 0 ? Math.random() * spread : 0;
    toast("☁ 上傳中…", "info");
    return sleep(delay).then(function () { return postRetry(recs); })
      .then(function (j) {
        var ids = recs.map(function (r) { return r.id; }); dequeue(ids);
        toast("☁ 已上傳雲端", "ok", 3000);
        return { sent: (j.saved || 0) + (j.dup || 0) > 0 ? (j.saved || 0) || 1 : 0, saved: j.saved || 0, dup: j.dup || 0, queued: getQueue().length };
      })
      .catch(function (e) {
        toast("⚠ 暫時無法上傳，已存在瀏覽器，稍後自動補送", "warn", 6000);
        return { sent: 0, queued: getQueue().length, error: String(e && e.message || e) };
      });
  }
  /* flush：補送佇列（不重試；由定時器／事件再觸發） */
  var flushing = false;
  function flush() {
    var q = getQueue();
    if (!q.length || !ready() || flushing) return Promise.resolve({ sent: 0, queued: q.length });
    flushing = true;
    return post(q).then(function (j) { dequeue(q.map(function (r) { return r.id; })); flushing = false; if (j.saved) toast("☁ 已補送 " + j.saved + " 筆", "ok", 3000); return { sent: j.saved, queued: getQueue().length }; })
      .catch(function (e) { flushing = false; return { sent: 0, queued: q.length, error: e.message }; });
  }
  /* 頁面關閉前最後一搏：keepalive fetch（優先）或 sendBeacon；回應無法讀取，佇列保留，下次開頁再補送（後端以 id 去重） */
  function flushOnLeave() {
    var q = getQueue(); if (!q.length || !ready()) return;
    var body = JSON.stringify({ action: "push", records: q });
    try { fetch(url(), { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body }); return; } catch (e) {}
    try { navigator.sendBeacon(url(), new Blob([body], { type: "text/plain;charset=utf-8" })); } catch (e2) {}
  }

  /* ---- 讀取（教師端，需教師碼） ---- */
  function get(params) {
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(url() + (url().indexOf("?") > 0 ? "&" : "?") + qs, { method: "GET" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "讀取失敗"); return j; });
  }
  /* 教師端讀取。opts.incremental=true 時：以 (kind|cls|since) 為鍵在記憶體累積，之後只向後端要「上次 at 之後落地＋尚未落地」的紀錄
     （rsince），回傳合併後的完整清單（陣列附 .at／.added／.incremental）；opts.reset=true 先清掉累積。頁面邏輯不必改。 */
  var PULL_CACHE = {};
  function normRec(r) {
    if (typeof r.detail === "string") { try { r.detail = JSON.parse(r.detail); } catch (e) {} }
    if (typeof r.sid === "number") r.sid = String(r.sid).padStart(4, "0");   // 試算表把 0615 存成數字時補回前導零
    return r;
  }
  function pull(kind, code, opts) {
    opts = opts || {};
    var key = (kind || "") + "|" + (opts.cls || "") + "|" + (opts.since || "");
    if (opts.reset) delete PULL_CACHE[key];
    var c = PULL_CACHE[key];
    var p = { action: "list", kind: kind || "", code: code || "" };
    if (opts.since) p.since = opts.since;
    if (opts.cls) p.cls = opts.cls;
    if (opts.incremental && c && c.at) p.rsince = c.at;
    return get(p).then(function (j) {
      var recs = (j.records || []).map(normRec);
      if (!opts.incremental) { recs.at = j.at || ""; recs.added = recs.length; recs.incremental = false; return recs; }
      if (!c) c = PULL_CACHE[key] = { byId: {}, order: [], at: "" };
      var added = 0;
      recs.forEach(function (r) { var id = String(r.id || ""); if (!id) { c.order.push(r); return; } if (!c.byId[id]) { added++; c.order.push({ id: id }); } c.byId[id] = r; });
      if (j.at) c.at = j.at;
      var full = c.order.map(function (o) { return o.id ? c.byId[o.id] : o; });
      full.at = c.at; full.added = added; full.incremental = true;
      return full;
    });
  }
  function pullReset() { PULL_CACHE = {}; }
  /* 去識別化的全班課前作答（學生端／教師端用，不需教師碼）；since（ISO）→ 只回該時間之後的增量 */
  function classData(cls, since) {
    var p = { action: "class", cls: cls || "" }; if (since) p.since = since;
    return get(p).then(function (j) { var recs = j.records || []; recs.at = j.at || ""; recs.consensus = j.consensus || 0; return recs; });
  }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return "h" + (h % 1000000).toString(36); }
  function ping() { return ready() ? get({ action: "ping" }) : Promise.reject(new Error("尚未設定雲端網址")); }

  /* 教師碼只放 sessionStorage（關閉分頁即清除），不落地到 localStorage，避免外流 */
  function teacherCode(v) {
    if (v !== undefined) { try { if (v) sessionStorage.setItem(CODE_KEY, v); else sessionStorage.removeItem(CODE_KEY); } catch (e) {} }
    try { return sessionStorage.getItem(CODE_KEY) || ""; } catch (e) { return ""; }
  }
  /* 向後端驗證教師碼（前端不保存正確答案） */
  function verify(code) {
    if (!ready()) return Promise.reject(new Error("尚未設定雲端網址"));
    return get({ action: "list", kind: "__auth__", code: code || "" }).then(function () { return true; });
  }
  function setUrl(u) { try { if (u) localStorage.setItem("ae.cloud.url", u.trim()); else localStorage.removeItem("ae.cloud.url"); } catch (e) {} }

  var AE = { url: url, setUrl: setUrl, ready: ready, record: record, push: push, flush: flush, pull: pull, pullReset: pullReset, classData: classData, hash: hash, ping: ping,
    queue: getQueue, teacherCode: teacherCode, verify: verify, PLACEHOLDER: PLACEHOLDER, spread: 8000, version: "2.1" };
  global.AECloud = AE;

  /* 自動補送：開頁 1.5 秒後、每 20 秒、網路恢復、分頁回前景；關頁前最後一次 */
  if (typeof window !== "undefined") {
    window.addEventListener("online", function () { flush(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") flush(); });
    window.addEventListener("pagehide", flushOnLeave);
    setTimeout(function () { if (getQueue().length) flush(); }, 1500);
    setInterval(function () { if (getQueue().length) flush(); }, FLUSH_EVERY);
  }
})(window);
