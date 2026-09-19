# -*- coding: utf-8 -*-
s = open('assess.html', encoding='utf-8').read()
bad = '搝票、排隊、措團、擺竴'
good = '搶票、排隊、揪團、擺攤'
assert s.count(bad) == 1, s.count(bad)
open('assess.html', 'w', encoding='utf-8').write(s.replace(bad, good))
print('OK')
