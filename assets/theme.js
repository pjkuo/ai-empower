/* ai-empower 共用小工具 v1.0：外部連結自動加 target/rel、表格加 scroll 容器 */
(function(){
  "use strict";
  if(/[?&]embed=1/.test(location.search)){ document.documentElement.classList.add("embed"); var st=document.createElement("style"); st.textContent=".embed .topnav{display:none!important}.embed .chipbar{top:0!important}.embed .progress{top:0!important}.embed .side,.embed .mtoc{top:12px!important}"; document.head.appendChild(st); }
  document.addEventListener("DOMContentLoaded",function(){
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="http"]'),function(a){
      if(a.hostname!==location.hostname){ if(!a.target) a.target="_blank"; a.rel=(a.rel?a.rel+" ":"")+"noopener"; }
    });
  });
})();
