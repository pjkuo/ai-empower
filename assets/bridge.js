/* ============================================================
   ai-empower 舊站橋接 bridge.js v2（2026-09-19）
   一行接上舊站：</body> 前加
     <script src="https://pjkuo.github.io/ai-empower/assets/bridge.js" data-app="ioc-sim" defer></script>
   data-app：assess-4c／ioc-sim／studio（未填則 legacy）；data-quiet：不彈身分小卡。

   做什麼：不改變舊站任何行為，只「鏡射」一份評量紀錄到 Hub 雲端資料庫。
   - 身分：網址 ?sid=&cls= → 本站 ae.identity.v1 → 嗅探舊鍵（cc_identity／cc_progress_v1／fourC_frontend_v2）
           → 都沒有且未設 data-quiet 時右下角小卡請學生填一次。
   - 攔截（原行為不變）：CCLOUD.push()／qadd()／addRecord()／saveRecord()／submitAssess()，
     以及對「舊 Apps Script」（script.google.com，非本 Hub 端點）的 fetch。
   - 轉換：統一紀錄模型 {v:2,id,ts,app,kind,sid,name,cls,score,max,detail}；
     kind 依關鍵字對應（exam/final→exam、midterm→midterm、stage+scores→assess4c、
     repair/build/project/survey 各自對應、其餘→quiz）。
   - 韌性：離線排入佇列 ae.bridge.queue.v1，上線／開頁自動補送；後端以 id 去重，重送安全；
     同 kind+sid+score+max+detail 片段在本頁生命週期內只送一次。
   - API：AEBridge.push({kind,score,max,detail})、AEBridge.mirror(obj)、
          AEBridge.identity()、AEBridge.setIdentity(sid,cls)。
   v2 說明：v1 只部署於 Netlify 且已隨站佚失（2026-09 檢查為 404）；v2 依 2026-08-22 規格
   重寫、收進 repo 隨兩站部署，正式網址改為上方 GitHub 網址。
   ============================================================ */
(function () {
  "use strict";
  if (window.AEBridge) return;
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbz7wHWbc7go-OVR0Q_g_NBzDqwzV9-leqL1CRe1S9wGkLLjvJIAm-KrZj80s1KJ_VdGVg/exec";
  var IDK = "ae.identity.v1", QK = "ae.bridge.queue.v1";
  var me = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var APP = (me && me.getAttribute("data-app")) || "legacy";
  var QUIET = !!(me && me.hasAttribute("data-quiet"));
  var seen = {};   /* 本頁去重 */

  function uid() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function last4(v) { var d = String(v == null ? "" : v).replace(/\D/g, ""); return d ? d.slice(-4) : ""; }

  /* ---------- 身分 ---------- */
  function getStore(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function identity() {
    var v = getStore(IDK);
    return v && v.sid ? { sid: String(v.sid), cls: String(v.cls || "") } : null;
  }
  function setIdentity(sid, cls) {
    var v = { sid: last4(sid), cls: String(cls || "").trim(), ts: new Date().toISOString() };
    try { localStorage.setItem(IDK, JSON.stringify(v)); } catch (e) {}
    return v;
  }
  function sniffLegacy() {
    var cand = [getStore("cc_identity"), getStore("cc_progress_v1"), getStore("fourC_frontend_v2")];
    for (var i = 0; i < cand.length; i++) {
      var o = cand[i]; if (!o) continue;
      var sid = o.sid || o.studentId || o.id || (o.user && (o.user.sid || o.user.id));
      var cls = o.cls || o.class || o.className || (o.user && o.user.cls) || "";
      if (sid && last4(sid)) return setIdentity(sid, cls);
    }
    return null;
  }
  (function initIdentity() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("sid")) { setIdentity(q.get("sid"), q.get("cls") || (identity() || {}).cls || ""); return; }
    } catch (e) {}
    if (!identity()) sniffLegacy();
    if (!identity() && !QUIET) whenBody(card);
  })();
  function whenBody(fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn); }
  function card() {
    if (identity() || document.getElementById("ae-bridge-card")) return;
    var d = document.createElement("div"); d.id = "ae-bridge-card";
    d.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:99999;background:#0f2540;color:#fff;padding:12px 14px;border-radius:12px;font:14px/1.5 system-ui,'Microsoft JhengHei',sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:min(92vw,300px)";
    d.innerHTML = '🪪 <b>成績要記在你名下</b><br><span style="font-size:12.5px;opacity:.85">填一次即可，之後所有平台通用</span><br>' +
      '<input id="aebSid" inputmode="numeric" maxlength="4" placeholder="學號後4碼" style="width:90px;margin:8px 6px 0 0;padding:6px 8px;border-radius:8px;border:0">' +
      '<input id="aebCls" placeholder="班級（如 資管1A）" style="width:120px;margin-top:8px;padding:6px 8px;border-radius:8px;border:0">' +
      '<button id="aebOk" style="margin:8px 0 0 6px;padding:6px 12px;border:0;border-radius:8px;background:#22d3ee;color:#03242e;font-weight:700;cursor:pointer">記住</button>';
    document.body.appendChild(d);
    document.getElementById("aebOk").onclick = function () {
      var s = last4(document.getElementById("aebSid").value);
      if (!s) { document.getElementById("aebSid").focus(); return; }
      setIdentity(s, document.getElementById("aebCls").value);
      d.remove(); flush();
    };
  }

  /* ---------- 統一紀錄與 kind 推斷 ---------- */
  function inferKind(o, hint) {
    var s = (JSON.stringify(hint || "") + " " + (o.kind || "") + " " + (o.type || "") + " " + (o.mode || "")).toLowerCase();
    if (o.stage !== undefined && (o.scores || o.c)) return "assess4c";
    if (/exam|final/.test(s)) return "exam";
    if (/midterm/.test(s)) return "midterm";
    if (/repair/.test(s)) return "repair";
    if (/build|assembl/.test(s)) return "build";
    if (/project|studio|step/.test(s)) return "project";
    if (/survey|問卷/.test(s)) return "survey";
    return "quiz";
  }
  function toRecord(o, kindHint) {
    o = o || {};
    var id = identity() || {};
    var sid = last4(o.sid) || (o.id && /^\d{4,}$/.test(String(o.id)) ? last4(o.id) : "") || id.sid || "";
    var score = o.score !== undefined ? o.score : (o.correct !== undefined ? o.correct : (Array.isArray(o.scores) ? o.scores.reduce(function (a, b) { return a + (+b || 0); }, 0) : ""));
    var max = o.max !== undefined ? o.max : (o.total !== undefined ? o.total : (o.items && o.items.length) || (Array.isArray(o.scores) ? o.scores.length : ""));
    var detail = {};
    for (var k in o) if (["sid", "name", "cls", "score", "max", "kind"].indexOf(k) < 0) { try { detail[k] = o[k]; } catch (e) {} }
    return {
      v: 2, id: uid(), ts: new Date().toISOString(), app: APP,
      kind: o.kind || kindHint || inferKind(o), sid: String(sid),
      name: o.name || "", cls: o.cls || id.cls || "",
      score: score === undefined ? "" : score, max: max === undefined ? "" : max,
      detail: detail
    };
  }

  /* ---------- 佇列與送出（後端以 id 去重；重送安全） ---------- */
  function getQ() { try { return JSON.parse(localStorage.getItem(QK) || "[]"); } catch (e) { return []; } }
  function setQ(q) { try { localStorage.setItem(QK, JSON.stringify(q)); } catch (e) {} }
  function post(recs) {
    return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "push", records: recs }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "rejected"); return j; });
  }
  function send(rec) {
    var key = [rec.kind, rec.sid, rec.score, rec.max, JSON.stringify(rec.detail).slice(0, 80)].join("|");
    if (seen[key]) return Promise.resolve({ dup: 1 }); seen[key] = 1;
    var q = getQ(); q.push(rec); setQ(q);          /* 先落地 */
    return post([rec]).then(function (j) { setQ(getQ().filter(function (x) { return x.id !== rec.id; })); return j; })
      .catch(function () { return { queued: true }; });
  }
  var flushing = false;
  function flush() {
    var q = getQ(); if (!q.length || flushing) return Promise.resolve();
    flushing = true;
    return post(q).then(function () { setQ([]); flushing = false; }).catch(function () { flushing = false; });
  }
  window.addEventListener("online", flush);
  setTimeout(function () { if (getQ().length) flush(); }, 2500);

  /* ---------- 攔截舊站上傳（原行為不變，多鏡射一份） ---------- */
  function wrap(objName, fnName, kindHint) {
    var host = objName ? window[objName] : window;
    if (!host || typeof host[fnName] !== "function" || host[fnName].__aeb) return false;
    var orig = host[fnName];
    var w = function () {
      try { var a = arguments[0]; if (a && typeof a === "object") send(toRecord(a, kindHint)); } catch (e) {}
      return orig.apply(this, arguments);
    };
    w.__aeb = 1; host[fnName] = w; return true;
  }
  var HOOKS = [["CCLOUD", "push", null], [null, "qadd", "quiz"], [null, "addRecord", null], [null, "saveRecord", null], [null, "submitAssess", "assess4c"]];
  function hookAll() { HOOKS.forEach(function (h) { wrap(h[0], h[1], h[2]); }); }
  hookAll(); var tries = 0;
  var t = setInterval(function () { hookAll(); if (++tries > 25) clearInterval(t); }, 800);

  /* 對舊 Apps Script 的 fetch 也鏡射（非本 Hub 端點才算舊） */
  var origFetch = window.fetch;
  if (origFetch && !origFetch.__aeb) {
    var f = function (input, init) {
      try {
        var u = String((input && input.url) || input || "");
        if (/script\.google\.com\/macros/.test(u) && u.indexOf(ENDPOINT) < 0 && init && init.body && typeof init.body === "string") {
          var b = JSON.parse(init.body);
          var o = b && (b.record || (Array.isArray(b.records) ? b.records[0] : b));
          if (o && typeof o === "object" && (o.score !== undefined || o.correct !== undefined || o.scores)) send(toRecord(o, null));
        }
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
    f.__aeb = 1; window.fetch = f;
  }

  window.AEBridge = {
    version: "2.0", app: APP, endpoint: ENDPOINT,
    push: function (o) { return send(toRecord(o || {}, (o && o.kind) || null)); },
    mirror: function (o) { return send(toRecord(o || {}, null)); },
    identity: identity, setIdentity: setIdentity, flush: flush, _toRecord: toRecord
  };
})();
