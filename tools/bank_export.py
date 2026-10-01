#!/usr/bin/env python3
"""
bank_export.py — Notion 🗃️ 題庫 → 學生端自主練習題庫 assets/bank/practice.json

用法：
    python3 tools/bank_export.py bank_raw.json assets/bank/practice.json [--course 關鍵字]

輸入 bank_raw.json：陣列，每題欄位與 exam-builder 相同
    id, no, type(選擇/問答), axis, stem, A, B, C, D, answer, rubric,
    difficulty, status, courses[], use（用途：練習/考試保留/兩者，可省略＝兩者）

只匯出：
    ・status == "已審核"（HITL：AI 草擬題未經老師審核不會到學生端）
    ・use != "考試保留"（正式考試題留在 Moodle，不進練習池）
    ・選擇題需有四個選項與 A–D 答案；問答題需有評分規準

輸出（精簡鍵，降低流量）：
    {"v":1,"built":"YYYY-MM-DD","n":{"mc":N,"es":M},
     "mc":[{"i":"QB-12","a":"硬體","d":"易","s":"題幹","o":["…","…","…","…"],"c":0}],   # d 未分級時省略
     "es":[{"i":"QB-301","a":"硬體","d":"中","s":"題幹","r":"評分規準"}]}
注意：答案在前端可見——本題庫只供自學練習；正式評量請用 Moodle（伺服器端計分）。
"""
import json
import sys
import datetime

LET = "ABCD"


def qid(x):
    no = x.get("no")
    try:
        return "QB-%d" % int(no)
    except (TypeError, ValueError):
        return str(x.get("id", ""))[:12]


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    src, dst = argv[1], argv[2]
    course = None
    if "--course" in argv:
        course = argv[argv.index("--course") + 1]
    bank = json.load(open(src, encoding="utf-8"))
    mc, es, skipped = [], [], {"未審核": 0, "考試保留": 0, "欄位不全": 0, "課程不符": 0}
    for x in bank:
        if str(x.get("status", "")).strip() != "已審核":
            skipped["未審核"] += 1
            continue
        if str(x.get("use", "")).strip() == "考試保留":
            skipped["考試保留"] += 1
            continue
        if course and not any(course in c for c in (x.get("courses") or [])):
            skipped["課程不符"] += 1
            continue
        t = str(x.get("type", "")).strip()
        diff = str(x.get("difficulty", "") or "未分級")
        base = {"i": qid(x), "a": x.get("axis", ""), "s": str(x.get("stem", "")).strip()}
        if diff != "未分級":
            base["d"] = diff
        if t == "選擇":
            opts = [str(x.get(k, "") or "").strip() for k in LET]
            ans = str(x.get("answer", "")).strip().upper()[:1]
            if not all(opts) or ans not in LET or not base["s"]:
                skipped["欄位不全"] += 1
                continue
            base.update({"o": opts, "c": LET.index(ans)})
            mc.append(base)
        elif t == "問答":
            rub = str(x.get("rubric", "") or "").strip()
            if not rub or not base["s"]:
                skipped["欄位不全"] += 1
                continue
            base["r"] = rub
            es.append(base)
    mc.sort(key=lambda q: (q["a"], q["i"]))
    es.sort(key=lambda q: (q["a"], q["i"]))
    out = {"v": 1, "built": datetime.date.today().isoformat(), "n": {"mc": len(mc), "es": len(es)}, "mc": mc, "es": es}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    axes = {}
    for q in mc:
        axes[q["a"]] = axes.get(q["a"], 0) + 1
    print("practice.json：選擇 %d、問答 %d；各向度 %s；略過 %s" % (len(mc), len(es), axes, skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
