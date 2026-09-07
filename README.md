# ai-empower — AI 賦能教學 Hub

單一入口整合所有教學平台，加上三個新模組：IOC 課程嵌入、統計分析工作台、HOTL 論文內文生成器。

**線上網址**：https://pjkuo.github.io/ai-empower/

## 頁面

| 頁面 | 內容 |
|------|------|
| `index.html` | 入口：AI 賦能專題創作（主）、IOC 課程（次）、評量統計、論文生成，連接所有現有平台 |
| `ioc.html` | IOC 模擬平台次頁：iframe 同源嵌入 `IOC-platform/student.html`，12 模組 chip 一鍵切換（hash 直通，不重載） |
| `presurvey.html` | 課前評量（學生）：27 題六向度、回覆碼 `PS1.<base64>`、本機自存；`?stage=post` 為期末複測（T＋C 11 題） |
| `weekly.html` | 我的學習週報（學生自查）：學號後 4 碼＋班級查自己的每週活動、成績趨勢、與全班中位數對照及建議；`?demo=1` 示範模式；需後端 v3.2 `action=me`（見 `gas/me-patch.gs`） |
| `assets/identity.js` | 共同身分：入口頁「我是誰」小卡（`[data-aeid]` 容器），`ae.identity.v1`；外站連結自動附 `?sid=&cls=`；`AEId.get/set/clear` |
| `assets/bridge.js` | 舊站一行接入：`<script src="…/assets/bridge.js" data-app="…">`，攝截 CCLOUD.push／qadd／addRecord／舊 Apps Script 送出 → 轉統一記錄鏡射到雲端；身分由 ?sid=&cls= 或小卡取得；`AEBridge.push()` |
| `assets/cloud.js` ＋ `gas/Code.gs` | 共用雲端資料層：統一記錄模型 `{v,id,ts,app,kind,sid,name,cls,score,max,detail}`，一份試算表、每 kind 一張工作表；`<meta name="cc-cloud-url">（已填：AKfycbz7…/exec，試算表「ai-empower 評量資料庫」）` 未填時自動退回本機＋佇列。`action=push`（POST）、`list`／`summary`（教師碼＝Code.gs 的 TEACHER_CODE；前端不保存答案，console.html 以 `list&kind=__auth__` 向後端驗證，通過後只存 sessionStorage）、`class`（去識別化全班課前作答）、`ping` |
| `console.html` | 教師工作台：密碼 UI（雲端驗證、不記住）＋四分頁（teacher／presurvey-teacher／stats／paper 以同源 iframe `?embed=1` 嵌入，隱藏各頁導覽列），雲端連線狀態、另開、登出 |
| `teacher.html` | 教師總覽：雲端所有 kind 集中一頁——即時動態、各平台 KPI、4C 前後測 paired t、課前→期末複測、平台間相關矩陣、需關注名單、逐人矩陣（CSV）、整合建議；內建 8 種平台示範資料 |
| `presurvey-teacher.html` | 課前評量教師儀表板：貼回覆碼／匯入 JSON／CSV → 準備度分群、五向度、各班、12 條判準建議、18 週逐週調整、答對率、分布、逐人清單；匯出 JSON／CSV；一鍵帶到 `stats.html`（scheme `presurvey`） |
| `stats.html` | 統計分析：匯入 4C 評量 JSON／運算思維 JSON／CSV → 配對 t、Cohen's dz（Hedges gz）、95% CI、Cronbach's α、前後測比較圖、CSV 匯出 |
| `paper.html` | HOTL 論文生成：數據 → Methods／Results／Discussion／Abstract 中英雙語草稿 → 逐段「採納／修改後採納／退回重生」→ 最終稿（Markdown／Word）＋監督日誌（CSV／JSON）＋自動人機協作聲明 |

## 設計原則

- **零後端、零 CDN**：clone 下來離線就能跑；資料只存在使用者瀏覽器。
- **舊 repo 一律不動**：以連結與同源 iframe 引用，本 repo 獨立運作。
- **統計可信**：`assets/stats-engine.js` 之 t 分配／不完全 Beta／α 已對照 SciPy 驗證（最大誤差 4.4e-15，見 `tests/verify-stats.md`）。
- **HOTL 即資料**：論文生成器的每個決策（採納率、修改幅度、退回理由）都寫進監督日誌，可直接作為人機協作研究的實證素材。

## 部署

GitHub 建新 repo `ai-empower` → 推上這些檔案 → Settings → Pages → Branch: main。

## 資料格式

課前評量題庫、計分權重（D10／H20／T30／C25／A15）、判準與 18 週基準進度集中在 `assets/presurvey-questions.js`，改題目只要改這一檔。


`stats.html`／`paper.html` 接受：

1. **4C 評量平台匯出 JSON**：`[{sid, stage:"前測"|"後測", ts, scores:[16], se, group, bg}]`
2. **運算思維 HISTORY JSON**：`[{s, g:"前"|"後", t, c:[16], e}]`
3. **CSV**：欄名含 `sid`／`學號` 與 `stage`／`階段`，其後數值欄視為題項

同一學號同一階段取最新一筆；題項缺漏整筆排除（listwise）；前後測依學號自動配對。

## 2026-08-26 v2.0 更新（壓測後）
- `assets/cloud.js` v2.0：push 失敗自動退避重試（1.5s／3s／6s／12s／24s＋亂數）、右下角狀態標籤「上傳中／排隊上傳中／已上傳」、送出前 0–8 秒隨機分散（`AECloud.spread`，設 0 關閉）、佇列每 20 秒自動補送、分頁回前景／網路恢復補送、關頁前 keepalive 補送；`classData(cls, since)` 支援增量。
- `presurvey-teacher.html`：自動更新改為每 15 秒。
- `gas/code.gs`：同步後端 v3.1（緩衝區寫入＋每分鐘 flushBuffer＋讀取合併緩衝區＋cleanup＋README 工作表）。

- v2.1（同日）：`AECloud.pull(kind, code, {incremental:true, reset})` 記憶體累積＋只拉增量（後端 `list&rsince=` 回 `at`）；presurvey-teacher／teacher 自動更新改用增量、手動「讀取」重置。

## 2026-09-07 v3.2 更新（每周學習分析）
- 新增 `weekly.html`「我的學習週報」（學生自查）：KPI、每週趨勢 SVG、各單元 vs 全班中位數、個人化建議（先思考、後驗證）、最近紀錄；離線顯示快取、`?demo=1` 示範模式。
- 新增 `gas/me-patch.gs`（後端 v3.2）：`GET ?action=me&sid=&cls=` 只回本人紀錄（AI 協作僅旗標、不回提示語）＋同班各 kind 去識別化統計（人數／中位數／平均）＋`cfg.semStart`；60 秒快取。**安裝步驟見檔頭**（貼進 Apps Script、doGet 加一行、重新部署）。
- `cfg` 工作表可加 `semStart`（YYYY-MM-DD，第 1 週的週一）供週次計算；未設時前端預設 2026-09-14。
- 教師端每周追蹤：由 Cowork「每周學習分析」PLUGIN 於每週一 07:00 排程執行——讀試算表「ai-empower 評量資料庫」→ 產出教師週報（Gmail 寄送＋Google Drive 歸檔＋私有儀表板）＋依 12 條判準的教學調整建議（HITL：AI 起草、教師採納）。
