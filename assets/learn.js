/* ============================================================
   ai-empower — 學生自學頁共用小工具（reflect / practice / showcase）
   2026-10-01 新增。依附 assets/cloud.js（AECloud）與 assets/identity.js（AEId）。
   AELearn.week()      → 目前教學週（第 1 週＝2026-09-14，夾在 1–18）
   AELearn.weekSelect(el, w) → 在 <select> 填 W01–W18
   AELearn.classes()   → 班級清單（本學期三班＋「其他」）
   AELearn.esc(s)      → HTML 跳脫；AELearn.fmt(ts) → 本地時間 YYYY-MM-DD HH:mm
   AELearn.tabs(root)  → 啟用 .tabs/.pane 分頁（支援 #hash）
   AELearn.send(rec)   → AECloud.push 的包裝：回 Promise<{ok,msg}>
   AELearn.me(kind)    → 以身分小卡查本人紀錄（action=me），回 Promise<records[]>
   AELearn.local(key[,val]) → localStorage JSON 讀寫（失敗不拋錯）
============================================================ */
(function (global) {
  "use strict";
  var W1 = new Date("2026-09-14T00:00:00+08:00").getTime();
  function week(d) {
    var t = (d ? new Date(d) : new Date()).getTime();
    var w = Math.floor((t - W1) / (7 * 864e5)) + 1;
    return Math.max(1, Math.min(18, w));
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function weekSelect(el, w) {
    if (!el) return;
    w = w || week();
    var h = "";
    for (var i = 1; i <= 18; i++) h += '<option value="' + i + '"' + (i === w ? " selected" : "") + ">W" + pad(i) + "（第 " + i + " 週）</option>";
    el.innerHTML = h;
  }
  function classes() {
    var out = ["資管一A 計算機概論", "車輛一A 數位科技與AI應用", "機械一A 數位科技與AI應用"];
    out.push("其他");
    return out;
  }
  function fmt(ts) {
    var d = new Date(ts); if (isNaN(d)) return String(ts || "").slice(0, 16);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function local(key, val) {
    try {
      if (arguments.length > 1) { localStorage.setItem(key, JSON.stringify(val)); return val; }
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) { return arguments.length > 1 ? val : null; }
  }
  function tabs(root) {
    root = root || document;
    var btns = root.querySelectorAll(".tabs [data-tab]");
    function show(id) {
      var ok = false;
      Array.prototype.forEach.call(btns, function (b) { var on = b.getAttribute("data-tab") === id; b.setAttribute("aria-selected", on ? "true" : "false"); if (on) ok = true; });
      if (!ok) return false;
      Array.prototype.forEach.call(root.querySelectorAll(".pane"), function (p) { p.classList.toggle("on", p.id === id); });
      return true;
    }
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("click", function () { var id = b.getAttribute("data-tab"); show(id); try { history.replaceState(null, "", "#" + id); } catch (e) {} });
    });
    var h = (location.hash || "").slice(1);
    if (!h || !show(h)) show(btns[0] && btns[0].getAttribute("data-tab"));
    return show;
  }
  function send(rec) {
    if (!global.AECloud) return Promise.resolve({ ok: false, msg: "雲端模組未載入，請重新整理頁面。" });
    return global.AECloud.push(rec).then(function (r) {
      if (r.offline) return { ok: true, queued: true, msg: "已存在這台裝置，連上雲端後自動補送。" };
      if (r.error) return { ok: true, queued: true, msg: "網路忙碌，已先存在瀏覽器，稍後自動補送（不用重填）。" };
      return { ok: true, msg: "已送出，謝謝你！" };
    });
  }
  function me(kind) {
    var id = (global.AEId && global.AEId.get()) || null;
    if (!id || !id.sid) return Promise.reject(new Error("noid"));
    var m = document.querySelector('meta[name="cc-cloud-url"]');
    var u = m ? m.getAttribute("content") : "";
    if (!/^https?:/.test(u)) return Promise.reject(new Error("nocloud"));
    return fetch(u + "?action=me&sid=" + encodeURIComponent(id.sid) + "&cls=" + encodeURIComponent(id.cls || ""))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || "查詢失敗");
        return (j.records || []).filter(function (r) { return !kind || r.kind === kind; });
      });
  }
  global.AELearn = { fmt: fmt, week: week, weekSelect: weekSelect, classes: classes, esc: esc, local: local, tabs: tabs, send: send, me: me, W1: W1 };
})(window);
