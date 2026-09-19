# -*- coding: utf-8 -*-
OLD = 'https://ai-empower-hub.netlify.app/assets/bridge.js'
NEW = 'https://pjkuo.github.io/ai-empower/assets/bridge.js'
for f in ['teacher.html', 'manual.html']:
    s = open(f, encoding='utf-8').read()
    assert s.count(OLD) == 1, f
    open(f, 'w', encoding='utf-8').write(s.replace(OLD, NEW))
print('OK')
