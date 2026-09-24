/* ============================================================
   ai-empower 共同身分  v1.1（2026-09-24）
   學號後 4 碼＋班級只填一次（同源 localStorage：ae.identity.v1），
   課前評量自動帶入；連到舊站的連結自動附 ?sid=&cls=，由 bridge.js 接手。

   v1.1 變更：
   ・班級改為「必填」——沒填班級不能儲存；已有學號但缺班級（網址 ?sid= 帶入、舊鍵）時，
     小卡直接以表單模式呈現並提示補填，避免 me API 回 need cls 被誤判為斷線。
   ・班級下拉依學院分組（管理學院／工學院／農學院），每個學院另有「其他系（自行輸入）」，
     加上「其他學院／自行輸入」；自行輸入的文字以關鍵字比對預設班級
     （例：資管、MIS、計概 → 資管一A 計算機概論；車輛、機械、數位科技 → 車輛一A 數位科技與AI應用），
     比對規則與後端 gas/me-patch.gs 的 meCanonCls_ 一致；比不到就原樣儲存並記下學院。
   ・新增 AEId.prompt(msg)：各頁查詢前發現缺班級時呼叫，捲到小卡、切成表單、顯示提示。
   ・新增 AEId.edit()（修改時保留學號）、AEId.complete()、AEId.matchClass(text)、AEId.PRESETS。

   API：AEId.get() → {sid, cls, col?} | null；AEId.set({sid,cls,col})；AEId.clear()；AEId.edit()；
        AEId.complete() → 學號＋班級都齊才 true；AEId.prompt(msg)；AEId.matchClass(text) → {name,college}|null；
        AEId.mount(el) 在容器內畫出身分小卡；AEId.decorateLinks()
============================================================ */
(function (global) {
  "use strict";
  var KEY = "ae.identity.v1";
  var EXT_HOSTS = ["pjkuo.github.io"];

  /* 預設班級（依學院分組）。kw＝關鍵字（比對時去空白、大寫、ㄧ→一）；free＝自行輸入 */
  var PRESETS = [
    { college: "管理學院", items: [
      { name: "資管一A 計算機概論", kw: ["資管", "資訊管理", "計算機概論", "計概", "MIS", "IM"] },
      { name: "管理學院其他系（自行輸入）", free: true, eg: "例如：企管一A、行銷一B" }
    ] },
    { college: "工學院", items: [
      { name: "車輛一A 數位科技與AI應用", kw: ["車輛", "機械", "數位科技"] },
      { name: "車輛工程系一年級", kw: [] },
      { name: "工學院其他系（自行輸入）", free: true, eg: "例如：環工一A、土木一B" }
    ] },
    { college: "農學院", items: [
      { name: "農學院其他系（自行輸入）", free: true, eg: "例如：植醫一A、水產一A" }
    ] },
    { college: "其他", items: [
      { name: "其他學院／自行輸入", free: true, eg: "輸入你上課的班級名稱" }
    ] }
  ];
  var CLASSES = [];
  PRESETS.forEach(function (g) { g.items.forEach(function (it) { if (!it.free) CLASSES.push(it.name); }); });

  function norm(s) { return String(s == null ? "" : s).trim().toUpperCase().replace(/[\s　]+/g, "").replace(/ㄧ/g, "一"); }
  /* 關鍵字比對：與後端 meCanonCls_ 同規則——明示二/三/四年級者不併入大一預設班級 */
  function matchClass(text) {
    var s = norm(text);
    if (!s) return null;
    var otherYear = /(二|三|四|[234])(A|年級|班|$)/.test(s);
    for (var i = 0; i < PRESETS.length; i++) {
      var g = PRESETS[i];
      for (var j = 0; j < g.items.length; j++) {
        var it = g.items[j];
        if (it.free) continue;
        if (norm(it.name) === s) return { name: it.name, college: g.college, exact: true };
        if (otherYear) continue;
        for (var k = 0; k < (it.kw || []).length; k++) {
          var kw = norm(it.kw[k]);
          var hit = /^[A-Z]+$/.test(kw) ? (s === kw) : (s.indexOf(kw) >= 0);   /* 英文縮寫需完全相等，中文關鍵字含即可 */
          if (hit) return { name: it.name, college: g.college, exact: false };
        }
      }
    }
    return null;
  }

  function get() { try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.sid ? v : null; } catch (e) { return null; } }
  function complete() { var v = get(); return !!(v && v.sid && v.cls); }
  function set(o) {
    var v = { sid: String(o.sid || "").trim(), cls: String(o.cls || "").trim(), ts: new Date().toISOString() };
    if (o.col) v.col = String(o.col).trim();
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    decorateLinks(); renderAll(); fire(); return v;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} decorateLinks(); renderAll(); fire(); }
  function fire() { try { document.dispatchEvent(new CustomEvent("ae:identity", { detail: get() })); } catch (e) {} }

  /* 從網址 ?sid=&cls= 接收（Hub 連過來或老師給的連結）；只帶 sid 時保留原班級，缺班級由小卡提示補填 */
  (function fromQuery() {
    try {
      var p = new URLSearchParams(location.search), sid = p.get("sid"), cls = p.get("cls") || p.get("class");
      if (sid && /^[0-9A-Za-z]{4}$/.test(sid)) set({ sid: sid, cls: cls || (get() || {}).cls || "", col: (get() || {}).col });
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

  /* ---------- 身分小卡 ---------- */
  var MOUNTS = [];                 /* {el, editing, msg} */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function selectHTML(curCls) {
    var h = '<option value="">— 請選班級（必填）—</option>';
    var found = false;
    PRESETS.forEach(function (g) {
      h += '<optgroup label="' + esc(g.college) + '">';
      g.items.forEach(function (it) {
        var val = it.free ? "__free:" + g.college : it.name;
        var sel = (!it.free && curCls && it.name === curCls);
        if (sel) found = true;
        h += '<option value="' + esc(val) + '"' + (sel ? " selected" : "") + ' data-eg="' + esc(it.eg || "") + '">' + esc(it.free ? "✏️ " + it.name : it.name) + '</option>';
      });
      h += '</optgroup>';
    });
    return { html: h, found: found };
  }

  function formHTML(id, msg) {
    var sid = id ? id.sid : "", cls = id ? id.cls : "";
    var sel = selectHTML(cls);
    return '<form class="aeid' + (msg ? " need" : "") + '" novalidate><span class="aeid-ic">🪪</span><div class="aeid-f">' +
      '<b>' + (id && id.sid ? "補齊你的身分" : "我是誰？只填一次") + '</b>' +
      '<div class="aeid-row">' +
        '<input name="sid" inputmode="numeric" maxlength="4" placeholder="學號後 4 碼" required pattern="[0-9A-Za-z]{4}" value="' + esc(sid) + '">' +
        '<select name="cls" required>' + sel.html + '</select>' +
        '<button type="submit" class="aeid-x">記住</button>' +
      '</div>' +
      '<div class="aeid-row aeid-other"' + ((!sel.found && cls) ? "" : " hidden") + '>' +
        '<input name="clsText" placeholder="輸入班級關鍵字，如：資管、車輛、環工一A" value="' + esc(sel.found ? "" : cls) + '">' +
        '<span class="aeid-hint"></span>' +
      '</div>' +
      '<div class="aeid-err" role="alert">' + esc(msg || "") + '</div>' +
      '<small>學號與班級都要填，且要跟作答評量時用的同一組。存在這台裝置的瀏覽器；課前評量、模擬平台、4C 評量都會自動帶入，資料才對得起來。</small>' +
      '</div></form>';
  }

  function render(m) {
    var el = m.el, id = get();
    var needForm = !id || !id.cls || m.editing;
    if (!needForm) {
      el.innerHTML = '<div class="aeid on"><span class="aeid-ic">🪪</span><div><b>' + esc(id.sid) + '</b> <span>' + esc(id.cls) + '</span>' +
        (id.col ? '<span class="aeid-col">' + esc(id.col) + '</span>' : "") +
        '<small>各平台會自動帶入這組身分</small></div><button type="button" class="aeid-x" data-act="edit">修改</button></div>';
      el.querySelector('[data-act="edit"]').addEventListener("click", function () { m.editing = true; m.msg = ""; render(m); try { el.querySelector("select[name=cls]").focus(); } catch (e) {} });
      return;
    }
    var msg = m.msg || ((id && id.sid && !id.cls) ? "還缺班級——請選你上課的班級（跟作答時同一組），查詢才對得到資料。" : "");
    el.innerHTML = formHTML(id, msg);
    var f = el.querySelector("form"), sel = f.cls, other = el.querySelector(".aeid-other"), txt = f.clsText, hint = el.querySelector(".aeid-hint"), err = el.querySelector(".aeid-err");
    /* 若儲存的班級不在預設內 → 切到對應學院的「自行輸入」 */
    if (id && id.cls && !selectHTML(id.cls).found) {
      var want = "__free:" + (id.col || "其他");
      if (!Array.prototype.some.call(sel.options, function (o) { if (o.value === want) { o.selected = true; return true; } return false; })) sel.value = "__free:其他";
    }
    function onSel(initial) {
      var free = sel.value.indexOf("__free:") === 0;
      other.hidden = !free;
      if (free) { var o = sel.options[sel.selectedIndex]; txt.placeholder = (o && o.getAttribute("data-eg")) || "輸入你上課的班級名稱"; if (initial !== true) { try { txt.focus(); } catch (e) {} } onTxt(); }
      else hint.textContent = "";
      if (initial !== true && sel.value) err.textContent = "";   /* 使用者實際改選後才清提示；初次渲染保留 prompt 訊息 */
    }
    function onTxt() {
      var v = txt.value.trim();
      if (!v) { hint.textContent = ""; return; }
      var mc = matchClass(v);
      hint.textContent = mc ? "→ 對應到「" + mc.name + "」" : "將以你輸入的班級儲存（請與作答時的寫法一致）";
      hint.className = "aeid-hint" + (mc ? " ok" : "");
    }
    sel.addEventListener("change", function () { onSel(false); });
    txt.addEventListener("input", onTxt);
    onSel(true);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var sid = f.sid.value.trim();
      if (!/^[0-9A-Za-z]{4}$/.test(sid)) { err.textContent = "請輸入學號後 4 碼。"; f.sid.focus(); return; }
      var cls = "", col = "";
      if (!sel.value) { err.textContent = "請選班級（必填）。找不到你的班級就選「其他系（自行輸入）」。"; sel.focus(); return; }
      if (sel.value.indexOf("__free:") === 0) {
        col = sel.value.slice(7);
        var v = txt.value.trim();
        if (!v) { err.textContent = "請輸入班級名稱或關鍵字（例：資管、環工一A）。"; txt.focus(); return; }
        var mc = matchClass(v);
        if (mc) { cls = mc.name; col = mc.college; } else { cls = v; if (col === "其他") col = ""; }
      } else {
        cls = sel.value;
        col = "";
        PRESETS.forEach(function (g) { g.items.forEach(function (it) { if (it.name === cls) col = g.college; }); });
      }
      m.editing = false; m.msg = "";
      set({ sid: sid, cls: cls, col: col });
    });
  }
  function renderAll() { MOUNTS.forEach(render); }
  function mount(el) {
    if (!el) return;
    for (var i = 0; i < MOUNTS.length; i++) if (MOUNTS[i].el === el) { render(MOUNTS[i]); return; }
    var m = { el: el, editing: false, msg: "" };
    MOUNTS.push(m); render(m);
  }
  function edit() { MOUNTS.forEach(function (m) { m.editing = true; }); renderAll(); }
  /* 各頁查詢前發現身分不完整時呼叫：捲到小卡、切表單、顯示提示 */
  function prompt(msg) {
    var id = get();
    MOUNTS.forEach(function (m) { m.editing = true; m.msg = msg || (id && id.sid ? "還缺班級，請補填後再查詢。" : "請先填學號後 4 碼與班級。"); });
    renderAll();
    var m0 = MOUNTS[0];
    if (m0) {
      try { m0.el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
      try { var f = m0.el.querySelector(id && id.sid ? "select[name=cls]" : "input[name=sid]"); if (f) f.focus(); } catch (e2) {}
    }
  }

  /* 樣式（一次注入） */
  var css = ".aeid{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:10px 12px;font-size:12.5px;box-shadow:0 1px 3px rgba(16,24,40,.07)}" +
    ".aeid.on{align-items:center;background:#ECFDF5;border-color:#A7F3D0;color:#374151}.aeid.need{border-color:#F59E0B;box-shadow:0 0 0 3px rgba(245,158,11,.25)}.aeid-ic{font-size:22px}.aeid b{color:#1E3A8A}.aeid small{display:block;color:#6B7280;font-size:11px;margin-top:2px}" +
    ".aeid-col{display:inline-block;margin-left:6px;font-size:11px;color:#6B7280;background:#F3F4F6;border-radius:20px;padding:1px 8px}" +
    ".aeid-f{flex:1}.aeid-row{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center}.aeid-row input{width:110px;font-family:inherit;font-size:13px;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;color:#111827}" +
    ".aeid-row select{flex:1;min-width:150px;font-family:inherit;font-size:12.5px;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;color:#111827}" +
    ".aeid-row[hidden]{display:none}.aeid-other input{flex:1;min-width:180px;width:auto}.aeid-hint{font-size:11.5px;color:#92400E}.aeid-hint.ok{color:#065F46;font-weight:700}" +
    ".aeid-err{color:#B45309;font-size:11.5px;font-weight:700;margin-top:4px;min-height:0}.aeid-err:empty{display:none}" +
    ".aeid-x{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:0;background:#1E3A8A;color:#fff;cursor:pointer;margin-left:auto}.aeid.on .aeid-x{background:#fff;color:#1E3A8A;border:1px solid #E5E7EB}";
  try { var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () { decorateLinks(); Array.prototype.forEach.call(document.querySelectorAll("[data-aeid]"), mount); });
  global.AEId = { get: get, set: set, clear: clear, edit: edit, complete: complete, prompt: prompt, matchClass: matchClass,
                  mount: mount, decorateLinks: decorateLinks, PRESETS: PRESETS, CLASSES: CLASSES, KEY: KEY };
})(window);
