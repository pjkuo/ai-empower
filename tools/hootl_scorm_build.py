import json, zipfile, os
PAGE = "https://pjkuo.github.io/ai-empower/hootl.html"
PRE, POST = "https://forms.gle/M1QHAThgNYTQP8Bt8", "https://forms.gle/NoQzb5RXw8jCJJxp8"
WEEKS = {
 "W15": {"title": "HOOTL 治理任務｜第 15 週：前測＋事前規則", "lead": "這週先做前測，再為你們小組的專題寫規格單。驗證任務前測的分數會記到 Moodle 成績簿。",
   "steps": [
    {"k": "survey-pre", "t": "① 治理素養問卷（前測）", "d": "約 5 分鐘・不計分", "form": PRE},
    {"k": "verify-pre", "t": "② 驗證任務前測", "d": "約 15 分鐘・分數記入成績簿", "q": "?embed=1&phase=pre#verify"},
    {"k": "spec-brief", "t": "③ 規格單前測簡版", "d": "開始作答就計時 10 分鐘", "q": "?embed=1&ver=brief#spec"},
    {"k": "report-pre", "t": "④ 驗證報告前測簡版", "d": "檢查題本的 3 條條件", "q": "?embed=1&phase=pre#report"},
    {"k": "spec-formal", "t": "⑤ 正式規格單", "d": "交給 AI 彙整專題前填寫", "q": "?embed=1&ver=formal#spec"}]},
 "W16": {"title": "HOOTL 治理任務｜第 16 週：事後評量＋後測", "lead": "AI 彙整完成後，照規格單逐條檢查並寫驗證報告，再做後測。驗證任務後測的分數會記到 Moodle 成績簿。",
   "steps": [
    {"k": "report-post", "t": "① 正式驗證報告", "d": "對照小組規格單逐條檢查", "q": "?embed=1&phase=post#report"},
    {"k": "verify-post", "t": "② 驗證任務後測", "d": "約 15 分鐘・分數記入成績簿", "q": "?embed=1&phase=post#verify"},
    {"k": "survey-post", "t": "③ 治理素養問卷（後測）", "d": "約 5 分鐘・不計分", "form": POST}]}}

HTML = r'''<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>__TITLE__</title>
<style>
:root{--p:#1E3A8A;--a:#C2410C;--ok:#059669;--ink:#1F2937;--mut:#6B7280;--line:#E5E7EB;--soft:#F8FAFC}
*{box-sizing:border-box}body{margin:0;font-family:"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif;color:var(--ink);background:#F1F5F9;font-size:14px;line-height:1.6}
.top{background:linear-gradient(120deg,#7C2D12,#C2410C 55%,#F59E0B);color:#fff;padding:16px 20px}
.top h1{margin:0;font-size:19px}.top p{margin:6px 0 0;font-size:13px;opacity:.95;max-width:820px}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12.5px}
.pill{background:rgba(255,255,255,.18);border-radius:999px;padding:3px 11px;font-weight:700}
.wrap{display:grid;grid-template-columns:270px 1fr;gap:14px;padding:14px}
@media(max-width:820px){.wrap{grid-template-columns:1fr}}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:8px;align-content:start}
.steps button{width:100%;text-align:left;font:inherit;border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start}
.steps button[aria-current="true"]{border-color:var(--p);box-shadow:0 0 0 3px #DBEAFE}
.steps .no{flex:0 0 24px;height:24px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--mut);background:#fff}
.steps .done .no{background:var(--ok);border-color:var(--ok);color:#fff}
.steps b{display:block;color:var(--p);font-size:13.5px}.steps small{color:var(--mut);font-size:12px}
.pane{background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(16,24,40,.07);min-height:420px;overflow:hidden}
iframe{width:100%;border:0;display:block;min-height:900px}
.formbox{padding:22px}.formbox h2{margin:0 0 6px;color:var(--p);font-size:17px}
.btn{display:inline-block;font:inherit;font-weight:800;border-radius:10px;padding:10px 16px;border:0;cursor:pointer;text-decoration:none;margin:6px 8px 0 0}
.btn.p{background:var(--p);color:#fff}.btn.g{background:var(--soft);color:var(--p);border:1.5px solid var(--line)}
.note{font-size:12px;color:var(--mut);margin-top:10px}
.hint{font-size:12px;color:var(--mut);padding:0 2px}
</style></head><body>
<header class="top"><h1>__TITLE__</h1><p>__LEAD__</p>
<div class="bar"><span class="pill" id="prog">完成 0／0</span><span class="pill" id="score">成績：尚未作答</span><span class="pill" id="lms">連線中…</span></div></header>
<div class="wrap">
  <div><ol class="steps" id="steps"></ol>
    <p class="hint">完成的步驟會自動打勾。第一次進入請在右側頁面的身分小卡選班級。問卷在新分頁開啟，填完回來按「我已送出」。</p></div>
  <div class="pane" id="pane"></div>
</div>
<script>
(function(){
"use strict";
var PAGE="__PAGE__", STEPS=__STEPS__, KEY="hootl.scorm.__WK__";
var api=null, st={done:{},T:null}, cur=0, frame=null;
function findAPI(w){ var n=0; while(w&&n<12){ try{ if(w.API) return w.API; }catch(e){} if(w===w.parent)break; w=w.parent; n++; } return null; }
api=findAPI(window)||(window.opener?findAPI(window.opener):null);
function g(k){ try{ return api?String(api.LMSGetValue(k)||""):""; }catch(e){ return ""; } }
function s(k,v){ try{ if(api) api.LMSSetValue(k,String(v)); }catch(e){} }
function commit(){ try{ if(api) api.LMSCommit(""); }catch(e){} try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch(e){} }
if(api){ try{ api.LMSInitialize(""); }catch(e){} var sd=g("cmi.suspend_data"); if(sd){ try{ st=JSON.parse(sd); }catch(e){} } }
else { try{ st=JSON.parse(localStorage.getItem(KEY)||"null")||st; }catch(e){} }
st.done=st.done||{};
document.getElementById("lms").textContent=api?"已連上 Moodle":"離線預覽（不記成績）";
var sid4=(g("cmi.core.student_id").replace(/[^0-9A-Za-z]/g,"")).slice(-4);
function save(){
  var n=STEPS.filter(function(x){return st.done[x.k];}).length, all=n===STEPS.length;
  s("cmi.suspend_data",JSON.stringify(st).slice(0,4000));
  if(st.T!=null){ s("cmi.core.score.min",0); s("cmi.core.score.max",100); s("cmi.core.score.raw",st.T); }
  s("cmi.core.lesson_status",all?"completed":"incomplete");
  commit(); render();
}
function render(){
  var n=STEPS.filter(function(x){return st.done[x.k];}).length;
  document.getElementById("prog").textContent="完成 "+n+"／"+STEPS.length;
  document.getElementById("score").textContent=st.T!=null?("成績："+st.T+"／100"):"成績：尚未作答";
  document.getElementById("steps").innerHTML=STEPS.map(function(x,i){ return '<li><button type="button" data-i="'+i+'" aria-current="'+(i===cur)+'" class="'+(st.done[x.k]?"done":"")+'"><span class="no">'+(st.done[x.k]?"✓":i+1)+'</span><span><b>'+x.t+'</b><small>'+x.d+'</small></span></button></li>'; }).join("");
  Array.prototype.forEach.call(document.querySelectorAll(".steps button"),function(b){ b.addEventListener("click",function(){ open(Number(b.getAttribute("data-i"))); }); });
}
function open(i){
  cur=i; var x=STEPS[i], pane=document.getElementById("pane"); render();
  if(x.form){ frame=null;
    pane.innerHTML='<div class="formbox"><h2>'+x.t+'</h2><p>問卷在新分頁開啟。請輸入<b>完整學號</b>，填完送出後回到這裡按「我已送出」。問卷不計分，請依真實情況作答。</p>'+
      '<a class="btn p" href="'+x.form+'" target="_blank" rel="noopener">開啟 Google 表單 ↗</a><button class="btn g" type="button" id="iSent">我已送出</button>'+
      '<p class="note">'+(st.done[x.k]?"✓ 已標記完成。":"")+'</p></div>';
    document.getElementById("iSent").addEventListener("click",function(){ st.done[x.k]=new Date().toISOString(); save(); open(i); });
    return; }
  if(!frame){ pane.innerHTML='<iframe id="fr" title="HOOTL 治理任務" allow="clipboard-write"></iframe>'; frame=document.getElementById("fr"); }
  frame.src=PAGE+x.q;
}
window.addEventListener("message",function(e){
  var d=e.data||{}; if(e.origin!=="https://pjkuo.github.io"||d.src!=="hootl")return;
  if(d.type==="hootl-ready"&&sid4&&frame) frame.contentWindow.postMessage({type:"hootl-id",sid:sid4},"https://pjkuo.github.io");
  if(d.type==="hootl-h"&&frame) frame.style.height=Math.max(900,Number(d.h)+30)+"px";
  if(d.type==="hootl-step"&&STEPS.some(function(x){return x.k===d.step;})){
    st.done[d.step]=new Date().toISOString();
    if(typeof d.T==="number"&&/^verify-/.test(d.step)) st.T=Math.round(d.T);
    save(); }
});
window.addEventListener("beforeunload",function(){ commit(); try{ if(api) api.LMSFinish(""); }catch(e){} });
var first=0; for(var i=0;i<STEPS.length;i++){ if(!st.done[STEPS[i].k]){ first=i; break; } }
s("cmi.core.lesson_status",STEPS.every(function(x){return st.done[x.k];})?"completed":"incomplete"); commit();
open(first);
})();
</script></body></html>'''

MAN = '''<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="NPUST_HOOTL___WK__" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG___WK__">
    <organization identifier="ORG___WK__">
      <title>__TITLE__</title>
      <item identifier="ITEM___WK__" identifierref="RES___WK__" isvisible="true"><title>__TITLE__</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES___WK__" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource>
  </resources>
</manifest>
'''
os.makedirs('out', exist_ok=True)
for wk, cfg in WEEKS.items():
    h = HTML.replace('__TITLE__', cfg['title']).replace('__LEAD__', cfg['lead']).replace('__PAGE__', PAGE).replace('__WK__', wk).replace('__STEPS__', json.dumps(cfg['steps'], ensure_ascii=False))
    m = MAN.replace('__WK__', wk).replace('__TITLE__', cfg['title'])
    os.makedirs(f'src_{wk}', exist_ok=True)
    open(f'src_{wk}/index.html', 'w', encoding='utf-8').write(h)
    open(f'src_{wk}/imsmanifest.xml', 'w', encoding='utf-8').write(m)
    with zipfile.ZipFile(f'out/HOOTL_{wk}_SCORM.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(f'src_{wk}/imsmanifest.xml', 'imsmanifest.xml'); z.write(f'src_{wk}/index.html', 'index.html')
    print(wk, os.path.getsize(f'out/HOOTL_{wk}_SCORM.zip'))
