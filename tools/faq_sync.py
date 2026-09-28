#!/usr/bin/env python3
"""Regenerate the FAQ-SYNC block in ai-empower/manual.html from Notion FAQ rows.

usage: faq_sync.py rows.json manual_in.html manual_out.html YYYY-MM-DD
rows.json: [{"編號":1,"問題":"...","解答":"...","分類":"...","平台":[...]}...]
Only rows with 納入manual=✓ and 狀態 in (已解答, 已納入manual) should be passed in.
Source: Notion「❓ 學生 FAQ」 collection://c50c3f4e-cfae-4432-8471-e491943b566f
The block between FAQ-SYNC markers is fully regenerated each run (idempotent).
"""
import json, sys, html, re

ORDER = ["登入/帳號", "平台操作", "AI代理/班級碼", "Python/Pyodide",
         "影片/字幕", "評量/成績", "作業繳交", "其他"]
ICON = {"登入/帳號": "🔐", "平台操作": "🧭", "AI代理/班級碼": "🤖", "Python/Pyodide": "🐍",
        "影片/字幕": "🎬", "評量/成績": "📊", "作業繳交": "📤", "其他": "💬"}
START, END = "<!-- FAQ-SYNC:START -->", "<!-- FAQ-SYNC:END -->"


def linkify(text):
    t = html.escape(text or "")
    t = re.sub(r"(https?://[^\s，。；）)]+)", r'<a href="\1" style="color:var(--accent)">\1</a>', t)
    t = re.sub(r"(?<![/\w.])(pjkuo\.github\.io/[\w\-/.]+)",
               r'<a href="https://\1" style="color:var(--accent)">\1</a>', t)
    return t.replace("\n", "<br>")


def build(rows, date):
    groups = {}
    for r in rows:
        groups.setdefault(r.get("分類") or "其他", []).append(r)
    cats = [c for c in ORDER if c in groups] + [c for c in groups if c not in ORDER]
    out = [START,
           '<h3 id="s51">5.1　學生常見問題（課堂／Moodle 提問整理）</h3>',
           f'<p style="color:var(--muted);font-size:12px">由老師從課堂與 Moodle 提問整理，每週批次更新　·　最後同步 {date}　·　共 {len(rows)} 題</p>']
    if not rows:
        out.append('<p>目前尚無收錄的提問。</p>')
    for c in cats:
        items = sorted(groups[c], key=lambda r: r["編號"])
        out.append(f'<p style="margin:14px 0 4px;font-weight:700;color:var(--primary)">{ICON.get(c, "💬")} {html.escape(c)}</p>')
        out.append('<table>')
        out.append('<tr><th style="width:32%">問題</th><th>解答</th></tr>')
        for r in items:
            n = r["編號"]
            out.append(f'<tr id="faq-{n}"><td><b>Q{n}.</b> {html.escape(r["問題"])}</td><td>{linkify(r.get("解答"))}</td></tr>')
        out.append('</table>')
    out.append('<div class="tip">💡 找不到你的問題？在課堂上直接問、或到 Moodle 討論區發問，老師整理後會加到這裡。</div>')
    out.append(END)
    return "\n      ".join(out)


def apply(src, block):
    if START in src and END in src:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: block, src, flags=re.S)
    # first-time install: after the static FAQ table in section 5, plus TOC link
    anchor = '<p style="color:var(--muted);font-size:12px;margin-top:20px">Word 版手冊'
    assert anchor in src, "manual.html anchor not found"
    src = src.replace(anchor, block + "\n      " + anchor, 1)
    toc = '<a href="#s5">5　常見問題</a>'
    src = src.replace(toc, toc + '\n      <a class="sub" href="#s51">5.1 學生提問 FAQ</a>', 1)
    css = ('.mbody tr[id^="faq-"]{scroll-margin-top:70px}\n'
           '.mbody tr[id^="faq-"]:target td{background:#FEF9C3;transition:background .6s}\n</style>')
    src = src.replace("</style>", css, 1)
    return src


if __name__ == "__main__":
    rows = json.load(open(sys.argv[1], encoding="utf-8"))
    src = open(sys.argv[2], encoding="utf-8").read()
    out = apply(src, build(rows, sys.argv[4]))
    out = out.replace("v1.2　·", "v1.3　·", 1)
    open(sys.argv[3], "w", encoding="utf-8").write(out)
    print(f"ok: {len(rows)} FAQ rows, {len(out)} chars")
