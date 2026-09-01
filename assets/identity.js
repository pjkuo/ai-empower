/* ============================================================
   ai-empower 共同身分  v1.0
   學號後 4 碼＋班級只填一次（同源 localStorage：ae.identity.v1），
   課前評量自動帶入；連到舊站的連結自動附 ?sid=&cls=，由 bridge.js 接手。
   API：AEId.get() → {sid, cls} | null；AEId.set({sid,cls})；AEId.clear()；
        AEId.mount(el) 在容器內畫出身分小卡；AEId.decorateLinks()
============================================================ */
(function (global) {
  "use strict";
  var KEY = "ae.identity.v1";
  var CLASSES = ["資管一A 計算機概論", "車輛一A 數位科技與AI應用", "車輛工程系一年級"];
  var EXT_HOSTS = ["pjkuo.github.io"];

  function get() { try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.sid ? v : null; } catch (e) { return null; } }
  function set(o) { var v = { sid: String(o.sid || "").trim(), cls: String(o.cls || "").trim(), ts: new Date().toISOString() }; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} decorateLinks(); fire(); return v; }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} decorateLinks(); fire(); }
  function fire() { try { document.dispatchEvent(new CustomEvent("ae:identity", { detail: get() })); } catch (e) {} }

  /* 從網址 ?sid=&cls= 接收（Hub 連過來或老師給的連結） */
  (function fromQuery() {
    try {
      var p = new URLSearchParams(location.search), sid = p.get("sid"), cls = p.get("cls") || p.get("class");
      if (sid && /^[0-9A-Za-z]{4}$/.test(sid)) set({ sid: sid, cls: cls || (get() || {}).cls || "" });
    } catch (e) {}
  })();

  /* 外站連結自動附身分 */
  function decorateLinks() {
    var id = get();
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var ext = EXT_HOSTS.some(function (h) { return a.hostname === h; }) && a.hostname !== location.hostname;
      if (!ext) return;
      try {
        var u = new URL(a.href); u.searchParams.delete("sid"); u.searchParams.delete("cls");
        if (id) { u.searchParams.set("sid", id.sid); if (id.cls) u.searchParams.set("cls", id.cls); }
        a.href = u.toString();
      } catch (e) {}
    });
  }

  /* 身分小卡 */
  function mount(el) {
    if (!el) return;
    function render() {
      var id = get();
      el.innerHTML = id
        ? '<div class="aeid on"><span class="aeid-ic">🪪</span><div><b>' + esc(id.sid) + '</b> <span>' + esc(id.cls || "未填班級") + '</span><small>各平台會自動帶入這組身分</small></div><button type="button" class="aeid-x" data-act="edit">修改</button></div>'
        : '<form class="aeid"><span class="aeid-ic">🪪</span><div class="aeid-f"><b>我是誰？只填一次</b><div class="aeid-row"><input name="sid" inputmode="numeric" maxlength="4" placeholder="學號後 4 碼" required pattern="[0-9A-Za-z]{4}"><select name="cls">' +
          CLASSES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join("") + '<option value="">其他／不填</option></select><button type="submit" class="aeid-x">記住</button></div><small>存在這台裝置的瀏覽器；課前評量、模擬平台、4C 評量都會自動帶入，資料才對得起來。</small></div></form>';
      var f = el.querySelector("form");
      if (f) f.addEventListener("submit", function (e) { e.preventDefault(); var sid = f.sid.value.trim(); if (!/^[0-9A-Za-z]{4}$/.test(sid)) { f.sid.focus(); return; } set({ sid: sid, cls: f.cls.value }); render(); });
      var b = el.querySelector('[data-act="edit"]');
      if (b) b.addEventListener("click", function () { clear(); render(); });
    }
    render();
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* 樣式（一次注入） */
  var css = ".aeid{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:10px 12px;font-size:12.5px;box-shadow:0 1px 3px rgba(16,24,40,.07)}" +
    ".aeid.on{align-items:center;background:#ECFDF5;border-color:#A7F3D0}.aeid-ic{font-size:22px}.aeid b{color:#1E3A8A}.aeid small{display:block;color:#6B7280;font-size:11px;margin-top:2px}" +
    ".aeid-f{flex:1}.aeid-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}.aeid-row input{width:110px;font-family:inherit;font-size:13px;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px}" +
    ".aeid-row select{flex:1;min-width:150px;font-family:inherit;font-size:12.5px;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff}" +
    ".aeid-x{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:0;background:#1E3A8A;color:#fff;cursor:pointer;margin-left:auto}.aeid.on .aeid-x{background:#fff;color:#1E3A8A;border:1px solid #E5E7EB}";
  try { var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () { decorateLinks(); Array.prototype.forEach.call(document.querySelectorAll("[data-aeid]"), mount); });
  global.AEId = { get: get, set: set, clear: clear, mount: mount, decorateLinks: decorateLinks, CLASSES: CLASSES, KEY: KEY };
})(window);
