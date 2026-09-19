# -*- coding: utf-8 -*-
ops = {
 'index.html': [("<a class='go' href='presurvey.html' style='background:var(--eco)'>學生作答 →</a>",
                 "<a class='go' href='presurvey.html' style='background:var(--eco)'>學生作答 →</a>\n          <a class='go' href='start.html' style='background:var(--ipo)'>📍 起點報告</a>", 1)],
 'presurvey.html': [('<button class="btn btn-primary" id="btnCopy">',
                     '<a class="btn btn-primary" href="start.html" style="text-decoration:none">📍 看我的起點報告 →</a>\n      <button class="btn btn-primary" id="btnCopy">', 1)],
 'assets/bridge.js': [('攝截', '攔截', 2)],
}
for f, pairs in ops.items():
    s = open(f, encoding='utf-8').read()
    for old, new, n in pairs:
        c = s.count(old)
        assert c == n, (f, old[:30], c)
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s)
print('OK')
