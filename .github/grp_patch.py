# -*- coding: utf-8 -*-
import hashlib
s = open('index.html', encoding='utf-8').read()
ri = s.find('AE Router'); rj = s.find('</script>', ri)
rmd5 = hashlib.md5(s[ri:rj].encode()).hexdigest()

i = s.find('      <article class="pc">\n        <h3>運算思維四大技巧練習')
j = s.find('</article>', s.find('4C 學習成效評量')) + len('</article>\n')
assert i > 0 and j > i and (j - i) < 2600, (i, j)
assert s.count('運算思維四大技巧練習 <span') == 1 and s.count('4C 學習成效評量') == 1

NEW = '''      <article class="pc">
        <h3>我的評量中心 <span class="badge new">新</span></h3>
        <span class="en">My Assessments</span>
        <p>這學期<b>所有要作答的項目</b>集中在這一頁：課前評量、運算思維練習、IPOS 課堂問卷、每週單元評量、4C 前後測——每項標好時機・時長・計不計分，完成的自動打勾。</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <a class='go' href='assess.html' style='background:var(--eco)'>進入評量中心 →</a>
          <a class='go' href='start.html' style='background:var(--ipo)'>📍 起點報告</a>
        </div>
      </article>
'''
s = s[:i] + NEW + s[j:]

old_nav = "<a href='presurvey.html'>課前評量</a><a href='ct-practice.html'>運算思維練習</a>"
assert s.count(old_nav) == 1
s = s.replace(old_nav, "<a href='assess.html'>我的評量</a>")

ri2 = s.find('AE Router'); rj2 = s.find('</script>', ri2)
assert hashlib.md5(s[ri2:rj2].encode()).hexdigest() == rmd5, 'ROUTER BLOCK CHANGED'
open('index.html', 'w', encoding='utf-8').write(s)
print('OK', len(s))
