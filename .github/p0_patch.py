# -*- coding: utf-8 -*-
import hashlib
s = open('index.html', encoding='utf-8').read()
ri = s.find('AE Router'); rj = s.find('</script>', ri)
router_before = hashlib.md5(s[ri:rj].encode()).hexdigest()

def rep(old, new, n=1):
    global s
    assert s.count(old) == n, 'anchor not unique: %r' % old[:60]
    s = s.replace(old, new, n)

css = """
/* ===== P0 學生首頁 4 鈕（s4）與教師專區（tzone）===== */
.s4-week{margin-top:16px;font-size:14.5px;font-weight:700;color:#fff;opacity:.95}
.s4-week a{color:#fff;text-decoration:underline}
.s4-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:8px;max-width:880px}
@media(max-width:760px){.s4-grid{grid-template-columns:repeat(2,1fr)}}
.s4-btn{display:flex;flex-direction:column;gap:4px;background:#fff;color:var(--ink,#0f172a);border-radius:14px;padding:14px 16px;text-decoration:none;box-shadow:0 2px 12px rgba(0,0,0,.18);border:2px solid transparent;transition:.15s}
.s4-btn:hover{border-color:var(--accent,#0891b2);transform:translateY(-2px)}
.s4-btn b{font-size:17px}
.s4-ic{font-size:22px;line-height:1}
.s4-d{font-size:12.5px;color:#475569}
.tzone{margin:26px 0;border:1.5px dashed var(--line,#cbd5e1);border-radius:14px;padding:12px 16px;background:#f8fafc}
.tzone summary{cursor:pointer;font-weight:800;font-size:15.5px;color:var(--ink,#0f172a)}
.tzone .tz-hint{font-weight:500;font-size:12.5px;color:#64748b;margin-left:8px}
"""
rep('</style>', css + '</style>')

cta_old = """    <div class="cta">
      <a href="https://pjkuo.github.io/AI-empower-platform/">開始做專題 →</a>
      <a class='ghost' href='ioc.html'>進入 IOC 課程</a>
      <a class='ghost' href='console.html'>🔐 教師工作台</a>
      <a class='ghost' href='manual.html'>📖 操作手冊</a>
      <a class='ghost' href='manual.html#video'>🎬 3 分鐘導覽影片</a>
    </div>"""
cta_new = """    <div id="s4week" class="s4-week">📅 今天要做什麼？四顆按鈕就是你的日常。</div>
    <div class="s4-grid" aria-label="今天要做什麼">
      <a class="s4-btn" href="ioc.html"><span class="s4-ic">🖥</span><b>本週學習</b><span class="s4-d">IOC 單元：模擬 → 講義 → 小測</span></a>
      <a class="s4-btn" href="https://pjkuo.github.io/AI-empower-platform/"><span class="s4-ic">🎨</span><b>專題創作</b><span class="s4-d">四步驟，想法變作品</span></a>
      <a class="s4-btn" href="weekly.html"><span class="s4-ic">📈</span><b>我的學習週報</b><span class="s4-d">看進度、拿下一步建議</span></a>
      <a class="s4-btn" href="manual.html"><span class="s4-ic">🧭</span><b>新手上路</b><span class="s4-d">手冊＋3 分鐘導覽影片</span></a>
    </div>"""
rep(cta_old, cta_new)

ioc_teacher = """      <article class="pc">
        <h3>教師版</h3>
        <span class="en">Teacher Console</span>
        <p>題庫控制、班級統計與雲端成績彙整，與學生版共用同一資料結構。</p>
        <a class="go" href="https://pjkuo.github.io/IOC-platform/teacher.html">開啟 →</a>
      </article>
"""
rep(ioc_teacher, '')

console_card = """      <article class="pc">
        <h3>教師工作台：總覽＋統計＋論文 <span class="badge new">新</span></h3>
        <span class="en">All-platform Teacher Console</span>
        <p>以教師密碼進入，四個分頁：教師總覽、課前評量儀表板、統計分析、論文生成。總覽把所有平台的評量（課前、4C、即時測驗、期中期末、拆解組裝、專題、問卷）集中：即時動態、各平台 KPI、4C 前後測 paired t、平台間相關與預測力、需關注名單、跨平台逐人矩陣，並依雲端現況給整合建議。</p>
        <a class='go' href='console.html' style='background:var(--primary)'>開啟教師工作台 →</a>
      </article>
"""
rep(console_card, '')

stats_card = """      <article class="pc">
        <h3>統計分析工作台 <span class="badge new">新</span></h3>
        <span class="en">Statistics Workbench</span>
        <p>匯入評量資料一次，配對 t、Cohen's dz、95% CI、Cronbach's α 與比較圖即刻算好——課前評量的 T＋C 題可於期末複測後直接帶入配對；資料自動與論文生成器共用，免重複貼上。</p>
        <a class='go' href='console.html#stats' style='background:var(--eco)'>開啟 →</a>
      </article>
"""
rep(stats_card, '')

paper_section = """  <!-- ===== 論文生成 ===== -->
  <section style="--gc:var(--py)">
    <div class="sec-head"><span class="bar"></span>
      <div><h2>📝 HOTL 論文內文生成</h2><p>數據長成研究——AI 起草，人在迴路上把關，每一段都留下監督紀錄</p></div>
    </div>
    <div class="cards" style="grid-template-columns:1fr">
      <article class="pc" style="--gc:var(--py)">
        <h3>即時論文段落生成器 <span class="badge new">新</span></h3>
        <span class="en">HOTL Manuscript Drafter</span>
        <p>把評量數據直接寫成<b>七節全文</b>：題目與關鍵詞、摘要、引言、方法、結果（含表格）、討論、結論——
           繁中／英文／IEEE 會議風格三態切換。每段草稿經你「採納／修改後採納／退回重生」，
           進度自動存檔、決策全程記錄；一鍵匯出 Markdown／Word／<b>LaTeX（IEEEtran）</b>與監督日誌，
           並自動生成「人機協作聲明」。監督紀錄本身就是 HOTL 研究的實證資料。</p>
        <a class='go' href='console.html#paper' style='background:var(--py)'>開啟生成器 →</a>
      </article>
    </div>
  </section>

"""
assert s.count(paper_section) == 1
paper_card = """      <article class="pc" style="--gc:var(--py)">
        <h3>即時論文段落生成器</h3>
        <span class="en">HOTL Manuscript Drafter</span>
        <p>把評量數據直接寫成<b>七節全文</b>：題目與關鍵詞、摘要、引言、方法、結果（含表格）、討論、結論——
           繁中／英文／IEEE 會議風格三態切換。每段草稿經你「採納／修改後採納／退回重生」，
           進度自動存檔、決策全程記錄；一鍵匯出 Markdown／Word／<b>LaTeX（IEEEtran）</b>與監督日誌，
           並自動生成「人機協作聲明」。監督紀錄本身就是 HOTL 研究的實證資料。</p>
        <a class='go' href='console.html#paper' style='background:var(--py)'>開啟生成器 →</a>
      </article>
"""
s = s.replace(paper_section, '')

tzone = """  <!-- ===== 教師與研究專區（P0：與學生動線分離；學生日常不需進入）===== -->
  <details class="tzone" id="teacher">
    <summary>🔐 教師與研究專區<span class="tz-hint">教師工作台・統計分析・論文生成・IOC 教師版</span></summary>
    <div class="cards" style="--gc:var(--primary);margin-top:14px">
""" + console_card + stats_card + paper_card + ioc_teacher + """    </div>
  </details>

"""
mini_anchor = '  <div class="mini" aria-label="更多資源">'
rep(mini_anchor, tzone + mini_anchor)

wk = """<script>
/* P0：週次提示（semStart 2026-09-14，與 cfg 預設一致） */
(function(){try{
  var el=document.getElementById('s4week'); if(!el) return;
  var st=new Date('2026-09-14T00:00:00+08:00'), w=Math.floor((Date.now()-st.getTime())/604800000)+1;
  if(w>=1&&w<=18){
    el.innerHTML='📅 第 '+w+' 週 · 今天要做什麼？'+(w<=2?' <a href="presurvey.html">新生請先完成課前評量 →</a>':'');
  }else if(w<1){ el.innerHTML='📅 開學倒數 · 新生請先完成 <a href="presurvey.html">課前評量 →</a>'; }
}catch(e){}})();
</script>
</body>"""
rep('</body>', wk)

ri = s.find('AE Router'); rj = s.find('</script>', ri)
assert hashlib.md5(s[ri:rj].encode()).hexdigest() == router_before, 'ROUTER BLOCK CHANGED'
assert s.count('id="aeParity"') == 1 and 'data-aeid' in s
open('index.html','w',encoding='utf-8').write(s)
print('OK', len(s))
