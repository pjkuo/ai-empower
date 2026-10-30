/**
 * crisp-form.gs — CRISP 提示工坊（Google 表單問卷版）產生器＋送出處理
 * 屏東科技大學．生成式 AI 提示工程｜2026-10-30 v1.0
 *
 * 一支獨立 Apps Script 專案就夠：
 *   ① buildCrispForm()：建立分段 Google 表單（C 背景、R 角色、I 指令、S 規格、P 驗證），
 *      「I 提問形式」「S 輸出成」依答案跳到對應的填空段；同時建立回覆試算表與送出觸發器。
 *   ② onCrispFormSubmit(e)：學生送出後——
 *        ・依填空組好 CRISP 提示（空白欄位用所選任務卡的範例補上，並標示）；
 *        ・寫進回覆試算表「組好的提示」工作表；
 *        ・推送 ai-empower 統一記錄（kind = prompt，app = crisp-form）到「ai-empower 評量資料庫」；
 *        ・學生選「要」時，請老師代管的 Gemini 代理先回答一次；
 *        ・有填 Email 就把提示（＋AI 回答）寄給學生，方便複製貼到 AI。
 *
 * 【安裝（約 3 分鐘）】
 *   1. https://script.google.com → 新專案 → 命名「CRISP 提示工坊_Google表單產生器」→ 貼上本檔。
 *   2. 確認下方 CFG（評量資料庫、AI 代理網址、班級碼）。
 *   3. 上方函式選 buildCrispForm → 執行 → 依提示授權（表單、試算表、外部連線、寄信、觸發器）。
 *   4. 執行紀錄會印出：學生填答網址（含短網址）、表單編輯網址、回覆試算表網址。
 *   5. 只想檢查組提示邏輯、不寫任何資料：執行 selfTest()。
 *
 * 【不計評分】score 存的是「CRISP 五面向完成度」（每面向 20 分），detail.graded = false。
 * 【隱私】Email 只用來寄信，不寫進評量資料庫；學號只推後 4 碼（與 ai-empower 其他頁一致）。
 */

// ===================== 設定 =====================
var CFG = {
  CLOUD_URL: 'https://script.google.com/macros/s/AKfycbz7wHWbc7go-OVR0Q_g_NBzDqwzV9-leqL1CRe1S9wGkLLjvJIAm-KrZj80s1KJ_VdGVg/exec',  // ai-empower 評量資料庫
  AI_PROXY:  'https://script.google.com/macros/s/AKfycbzeZIdckk825BFGen2C2l9WYG_qYSJUDTTAzLMAmhg6fdvi_HrwZsa518PSAurleMSm/exec',  // 老師代管 Gemini 代理
  AI_CODE:   'MIS2026',
  WEB_URL:   'https://pjkuo.github.io/ai-empower/crisp.html',
  TITLE:     'CRISP 提示工坊（問卷版）',
  APP:       'crisp-form',
  KIND:      'prompt'
};
var AI_SYSTEM = '你是大學通識課的 AI 助教。請用繁體中文回答，嚴格依照使用者提示中的格式與條件作答；不確定的地方要明說，不要編造數字或出處。這個介面只傳文字、收不到任何附檔：使用者提到附檔時，不要假裝讀過，需要內容就請他貼上重點。';

// 題目標題（表單與送出處理共用；改字要兩邊一起改，所以集中在這裡）
var Q = {
  SID: '學號', NAME: '姓名', CLS: '班級', EMAIL: 'Email（想收到組好的提示就填）',
  TASK: '任務卡', VAGUE: '模糊版提示（先猜 AI 會回什麼）',
  C_WHO: 'C｜我是＿＿', C_PROJ: 'C｜正在做＿＿', C_DETAIL: 'C｜細節資訊', C_FILE: 'C｜附檔', C_FDESC: 'C｜附檔檔名與內容',
  R_ROLE: 'R｜請你扮演＿＿', R_AUD: 'R｜對象是＿＿', R_TONE: 'R｜用＿＿的語氣說明',
  I_TASK: 'I｜任務：請幫我＿＿', I_FORM: 'I｜提問形式',
  I_IN: 'I｜輸入 Input', I_PROC: 'I｜處理 Process', I_OUT: 'I｜輸出 Output',
  I_S1: 'I｜步驟 ①', I_S2: 'I｜步驟 ②', I_S3: 'I｜步驟 ③', I_PAUSE: 'I｜每一步做完先停下來，等我確認',
  S_OUT: 'S｜輸出成', S_COLS: 'S｜表格欄位', S_EX: 'S｜一列範例', S_CHART: 'S｜圖表類型', S_X: 'S｜X 軸', S_Y: 'S｜Y 軸',
  S_WEB: 'S｜網頁要有', S_FLOW: 'S｜流程圖要包含', S_PY: 'S｜程式的輸入輸出', S_CHECKS: 'S｜條件', S_COND: 'S｜其他條件',
  P_CHECKS: 'P｜驗證方式', P_DATA: 'P｜測試資料', P_GOAL: 'P｜通過標準', P_PLACE: 'P｜影音實拍地點', P_WHERE: 'P｜驗收清單在哪裡檢查',
  ASK_AI: '送出後要不要讓老師代管的 Gemini 先回答一次？'
};

var OPT = {
  CLS: ['資管一A 計算機概論', '車輛一A 數位科技與AI應用', '機械一A 數位科技與AI應用'],
  TASK: ['智慧澆水（示範）', '輪胎檢查（課堂）', '教室 CO₂ 提醒', '魚塭水質警示', '自己的題目'],
  FILE: ['不附檔', '資料檔（Excel／CSV）', 'PDF 文件', '照片', '程式碼檔', '影片'],
  ROLE: ['有 IoT 經驗的農業技師', '資料分析師', 'Python 助教', '網頁設計師', '專題指導老師', '審查委員'],
  AUD: ['完全沒寫過程式的大一新生', '同班同學', '農友', '評審老師'],
  TONE: ['白話、一步一步', '簡潔', '專業', '鼓勵'],
  I_FORM: ['IPO 架構', '分步驟', '先問我', '比較方案'],
  S_OUT: ['表格', '圖表（Python）', '網頁（HTML）', '流程圖（Mermaid）', 'Python 程式', '條列'],
  S_CHART: ['折線圖', '長條圖', '散布圖', '圓餅圖'],
  S_CHECKS: ['用繁體中文', '只用我給的資料，不要自己編數字或出處', '不確定就說不確定', '程式每一段加中文註解', '全部 200 字以內'],
  P_CHECKS: ['程式模擬：用測試資料模擬執行，列出預期與實際結果', '邊界自查：自己檢查等號、空值、負數、單位，錯了就修正',
             '迭代修正：不符合標準就修正再驗證（最多 2 輪）', '影音驗證：設計 30 秒情境影片分鏡，讓我實拍驗證可行性',
             '驗收清單：給我 5 項清單，讓我自己檢查', '標出不確定：列出不確定的地方與查證處'],
  ASK_AI: ['要（結果寄到我的 Email）', '不用，我自己貼到 AI']
};

// 任務卡範例：學生留白的欄位用這裡補（「自己的題目」不補）
var PRESETS = {
  '智慧澆水（示範）': { who: '植物醫學系大一學生', proj: '「智慧澆水」AI 賦能專題',
    detail: '溫室的土壤濕度感測器每 10 分鐘回傳一次數值（0–100%）。番茄適合的濕度是 40–70%：低於 40% 要澆水，高於 70% 要停止',
    role: '有 IoT 經驗的農業技師', aud: '完全沒寫過程式的大一新生', tone: '白話、一步一步',
    task: '設計自動澆水的判斷規則，並寫成程式', in: '土壤濕度（%）', proc: '低於 40% 開水、高於 70% 關水，中間維持原狀', out: '「澆水／停止／維持」與一句提示',
    cols: '濕度｜判斷｜動作', example: '35%｜低於 40%｜澆水', x: '時間', y: '土壤濕度（%）', web: '輸入濕度的欄位、判斷按鈕，結果用顏色顯示',
    flow: '開始、讀濕度、兩個判斷、三種動作、結束', py: '用 input() 讓我輸入濕度，印出判斷結果',
    cond: '剛好 40% 算要澆水，剛好 70% 算要停止', data: '25%、40%、55%、70%、85%、-5%、abc', goal: '我給的門檻', place: '溫室', where: 'Google Colab' },
  '輪胎檢查（課堂）': { who: '車輛工程系大一學生', proj: '保養紀錄整理',
    detail: '四個輪胎的胎紋深度：左前 4.2 mm、右前 2.8 mm、左後 1.4 mm、右後 3.5 mm',
    role: '汽車保養廠的資深技師', aud: '剛買二手車的學生', tone: '直接',
    task: '判斷四個輪胎要不要換，並排出更換的先後順序', in: '四輪胎紋深度（mm）', proc: '低於 1.6 mm 必換、低於 3.0 mm 建議換', out: '每一輪的判定與理由',
    cols: '輪位｜深度｜判定｜理由', example: '左後輪｜1.4 mm｜必須更換｜低於 1.6 mm 法規下限', x: '輪位', y: '胎紋深度（mm）', web: '輸入四輪深度的欄位，結果用紅黃綠顯示',
    flow: '開始、讀深度、兩個門檻判斷、結束', py: '用 input() 輸入四輪深度，印出判定表',
    cond: '剛好 1.6 mm 算建議換', data: '1.6、1.5、3.0、2.9 mm', goal: '法規 1.6 mm 下限', place: '保養廠', where: '保養廠' },
  '教室 CO₂ 提醒': { who: '環境工程系大一學生', proj: '教室空氣品質專題',
    detail: '教室有 CO₂ 感測器（單位 ppm），一堂課 50 分鐘、約 60 人。1000 ppm 以上該開窗，1500 ppm 以上要警示',
    role: '室內空氣品質工程師', aud: '同班同學', tone: '簡潔',
    task: '設計 CO₂ 開窗提醒的規則和畫面', in: 'CO₂ 濃度（ppm）', proc: '未滿 1000 正常、1000–1499 開窗、1500 以上警示', out: '「正常／開窗／警示」',
    s1: '整理判斷規則', s2: '畫出流程圖', s3: '做出提醒網頁',
    cols: '數值｜判定｜理由', example: '1230｜開窗｜介於 1000 與 1500 之間', x: '時間（分鐘）', y: 'CO₂（ppm）',
    web: '一個輸入 CO₂ 數值的欄位、一個判斷按鈕，結果用綠／黃／紅顯示「正常／開窗／警示」',
    flow: '開始、讀數值、兩個門檻判斷、三種結果', py: '用 input() 輸入數值，印出判定',
    cond: '剛好 1000、1500 算較高的那一級', data: '650、999、1000、1500、2100、-80、12OO', goal: '我給的門檻', place: '教室', where: '手機和電腦' },
  '魚塭水質警示': { who: '水產養殖系大一學生', proj: '魚塭水質監測專題',
    detail: '吳郭魚魚塭有溶氧和水溫感測器。溶氧低於 3 mg/L 魚會浮頭，要開增氧機；水溫高於 32°C 也要注意',
    role: '養殖場的水質管理員', aud: '剛接手魚塭的新手', tone: '實務',
    task: '比較「自動開增氧機」和「手機通知人工處理」兩種做法', in: '溶氧（mg/L）、水溫（°C）', proc: '溶氧低於 3 開增氧機、水溫高於 32 提醒', out: '警示等級與建議動作',
    cols: '時間｜溶氧｜水溫｜警示', example: '05:00｜2.4｜29｜溶氧過低，開增氧機', x: '時間（24 小時）', y: '溶氧（mg/L）與水溫（°C）',
    web: '輸入溶氧與水溫的欄位，結果用顏色顯示', flow: '開始、讀溶氧與水溫、判斷、警示', py: '用 input() 輸入溶氧與水溫，印出警示',
    cond: '在 3 mg/L 畫一條紅色警戒線', data: '溶氧 5.2、4.0、3.0、2.4 mg/L；水溫 28、33°C', goal: '溶氧 3 mg/L 門檻', place: '魚塭', where: '魚塭現場' }
};

// ===================== ① 建立表單 =====================
function buildCrispForm() {
  var form = FormApp.create(CFG.TITLE);
  form.setDescription(
    '照 C 背景、R 角色、I 指令、S 規格、P 驗證五個面向填空。看不懂的格子可以留白，系統會用你選的任務卡範例補上。\n' +
    '送出後自動組好提示：有填 Email 就寄給你（可選擇讓老師代管的 Gemini 先回答一次），複製貼到任何 AI 都能用。\n' +
    'AI 交回來的成果，由你來驗證：先思考，後驗證。\n網頁版（可即時預覽、直接問 AI）：' + CFG.WEB_URL);
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage(
    '收到！你的 CRISP 提示已經組好。\n' +
    '・有填 Email：約 1 分鐘內寄到信箱（選了「要」的，會附上 Gemini 的回答）。\n' +
    '・沒填 Email：到網頁版用同樣的內容組一次，就能直接複製或問 AI：' + CFG.WEB_URL + '\n' +
    '記得：AI 的回答一定要用你寫的 P 驗證方式檢查一遍。');
  try { form.setCollectEmail(false); } catch (e) {}

  // ---- 第 1 段：身分與任務卡 ----
  form.addTextItem().setTitle(Q.SID).setHelpText('完整學號，例：B11356001（只會用後 4 碼對應你的學習紀錄）').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[A-Za-z0-9]{4,12}$').setHelpText('請填英數字學號').build());
  form.addTextItem().setTitle(Q.NAME);
  form.addMultipleChoiceItem().setTitle(Q.CLS).setChoiceValues(OPT.CLS).showOtherOption(true).setRequired(true);
  form.addTextItem().setTitle(Q.EMAIL).setHelpText('選填。填了就會收到組好的提示，方便複製。')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addMultipleChoiceItem().setTitle(Q.TASK).setHelpText('留白的格子會用這張卡的範例補上；「自己的題目」不補。')
    .setChoiceValues(OPT.TASK).setRequired(true);
  form.addTextItem().setTitle(Q.VAGUE).setHelpText('例：幫我做一個自動澆水的程式');

  // ---- C 背景 ----
  form.addPageBreakItem().setTitle('C 背景 Context').setHelpText('提供背景與細節資訊，如上傳附檔。沒給的資料，AI 會自己編。');
  form.addTextItem().setTitle(Q.C_WHO).setHelpText('例：植物醫學系大一學生');
  form.addTextItem().setTitle(Q.C_PROJ).setHelpText('例：「智慧澆水」AI 賦能專題');
  form.addParagraphTextItem().setTitle(Q.C_DETAIL).setHelpText('數字、時間、對象、門檻。例：番茄適合的濕度是 40–70%，低於 40% 要澆水');
  form.addMultipleChoiceItem().setTitle(Q.C_FILE).setChoiceValues(OPT.FILE).setHelpText('問 AI 時要記得真的把檔案上傳到對話框。');
  form.addTextItem().setTitle(Q.C_FDESC).setHelpText('例：一週濕度紀錄.xlsx，7 天、每 10 分鐘一筆');

  // ---- R 角色 ----
  form.addPageBreakItem().setTitle('R 角色 Role').setHelpText('角色扮演定位：AI 是誰、說給誰聽。選一個，或點「其他」自己寫。');
  form.addMultipleChoiceItem().setTitle(Q.R_ROLE).setChoiceValues(OPT.ROLE).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle(Q.R_AUD).setChoiceValues(OPT.AUD).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle(Q.R_TONE).setChoiceValues(OPT.TONE).showOtherOption(true);

  // ---- I 指令 ----
  var pbI = form.addPageBreakItem().setTitle('I 指令 Instruction').setHelpText('提問形式與執行步驟，如 IPO 架構。任務用交代的，不要用問的。');
  form.addTextItem().setTitle(Q.I_TASK).setHelpText('例：設計自動澆水的判斷規則，並寫成程式');
  var iForm = form.addMultipleChoiceItem().setTitle(Q.I_FORM).setRequired(true)
    .setHelpText('選 IPO 架構或分步驟，下一頁會請你填細節。');
  var pbIpo = form.addPageBreakItem().setTitle('I｜IPO 架構').setHelpText('輸入 → 處理 → 輸出，三格都寫，AI 就知道要怎麼想。');
  form.addTextItem().setTitle(Q.I_IN).setHelpText('給什麼資料。例：土壤濕度（%）');
  form.addTextItem().setTitle(Q.I_PROC).setHelpText('怎麼判斷、計算。例：低於 40% 開水、高於 70% 關水');
  form.addTextItem().setTitle(Q.I_OUT).setHelpText('要得到什麼。例：「澆水／停止／維持」');
  var pbSteps = form.addPageBreakItem().setTitle('I｜分步驟').setHelpText('一次交代一步，比一次丟一大段更準。');
  form.addTextItem().setTitle(Q.I_S1);
  form.addTextItem().setTitle(Q.I_S2);
  form.addTextItem().setTitle(Q.I_S3);
  form.addCheckboxItem().setTitle(Q.I_PAUSE).setChoiceValues(['要']);

  // ---- S 規格 ----
  var pbS = form.addPageBreakItem().setTitle('S 規格 Specifics').setHelpText('指定輸出格式與條件，如視覺化圖表與網頁。選格式後，下一頁填細節。');
  var sOut = form.addMultipleChoiceItem().setTitle(Q.S_OUT).setRequired(true);
  var pbTable = form.addPageBreakItem().setTitle('S｜表格').setHelpText('表格最好驗收；先示範一列，AI 會照著寫。');
  form.addTextItem().setTitle(Q.S_COLS).setHelpText('用｜隔開。例：輪位｜深度｜判定｜理由');
  form.addTextItem().setTitle(Q.S_EX).setHelpText('例：左後輪｜1.4 mm｜必須更換｜低於 1.6 mm 法規下限');
  var pbChart = form.addPageBreakItem().setTitle('S｜圖表（Python）').setHelpText('AI 會給你能在 Google Colab 執行的 matplotlib 程式。');
  form.addListItem().setTitle(Q.S_CHART).setChoiceValues(OPT.S_CHART);
  form.addTextItem().setTitle(Q.S_X).setHelpText('例：時間');
  form.addTextItem().setTitle(Q.S_Y).setHelpText('例：土壤濕度（%）');
  var pbWeb = form.addPageBreakItem().setTitle('S｜網頁（HTML）').setHelpText('單一 HTML 檔、不用外部檔案、手機也能看。');
  form.addTextItem().setTitle(Q.S_WEB).setHelpText('例：輸入欄、判斷按鈕、結果用綠／黃／紅顯示');
  var pbFlow = form.addPageBreakItem().setTitle('S｜流程圖（Mermaid）').setHelpText('判斷條件會放在菱形裡；貼到 mermaid.live 就能看圖。');
  form.addTextItem().setTitle(Q.S_FLOW).setHelpText('例：開始、讀數值、兩個門檻判斷、三種結果');
  var pbPy = form.addPageBreakItem().setTitle('S｜Python 程式').setHelpText('能在 Google Colab 直接執行。');
  form.addTextItem().setTitle(Q.S_PY).setHelpText('例：用 input() 讓我輸入濕度，印出判斷結果');
  var pbCond = form.addPageBreakItem().setTitle('S｜條件').setHelpText('門檻的等號要寫清楚：剛好卡在門檻的值算哪一邊？');
  form.addCheckboxItem().setTitle(Q.S_CHECKS).setChoiceValues(OPT.S_CHECKS);
  form.addTextItem().setTitle(Q.S_COND).setHelpText('例：剛好 40% 算要澆水，剛好 70% 算要停止');

  // ---- P 驗證 ----
  form.addPageBreakItem().setTitle('P 驗證 Proof').setHelpText('模擬驗證、迭代修正，如程式模擬、影音驗證情境可行性。至少勾一項。');
  form.addCheckboxItem().setTitle(Q.P_CHECKS).setChoiceValues(OPT.P_CHECKS).setRequired(true);
  form.addTextItem().setTitle(Q.P_DATA).setHelpText('一般值、剛好卡線、怪資料都要有。例：25%、40%、55%、70%、85%、-5%、abc');
  form.addTextItem().setTitle(Q.P_GOAL).setHelpText('迭代修正用。例：我給的門檻');
  form.addTextItem().setTitle(Q.P_PLACE).setHelpText('影音驗證用。例：溫室');
  form.addTextItem().setTitle(Q.P_WHERE).setHelpText('驗收清單用。例：Google Colab');

  // ---- 送出前 ----
  form.addPageBreakItem().setTitle('送出前').setHelpText('老師代管 Gemini：每人每天有使用上限；只讀得到文字，讀不到附檔。');
  form.addMultipleChoiceItem().setTitle(Q.ASK_AI).setChoiceValues(OPT.ASK_AI).setRequired(true);

  // ---- 依答案跳段 ----
  iForm.setChoices([
    iForm.createChoice(OPT.I_FORM[0], pbIpo),
    iForm.createChoice(OPT.I_FORM[1], pbSteps),
    iForm.createChoice(OPT.I_FORM[2], pbS),
    iForm.createChoice(OPT.I_FORM[3], pbS)
  ]);
  pbSteps.setGoToPage(pbS);           // 填完 IPO（線性走到「分步驟」時）→ 跳到 S
  sOut.setChoices([
    sOut.createChoice(OPT.S_OUT[0], pbTable),
    sOut.createChoice(OPT.S_OUT[1], pbChart),
    sOut.createChoice(OPT.S_OUT[2], pbWeb),
    sOut.createChoice(OPT.S_OUT[3], pbFlow),
    sOut.createChoice(OPT.S_OUT[4], pbPy),
    sOut.createChoice(OPT.S_OUT[5], pbCond)
  ]);
  pbChart.setGoToPage(pbCond);        // 表格頁填完 → 條件
  pbWeb.setGoToPage(pbCond);          // 圖表頁填完 → 條件
  pbFlow.setGoToPage(pbCond);         // 網頁頁填完 → 條件
  pbPy.setGoToPage(pbCond);           // 流程圖頁填完 → 條件（Python 頁線性接到條件）

  // ---- 回覆試算表＋「組好的提示」工作表 ----
  var ss = SpreadsheetApp.create(CFG.TITLE + '｜回覆');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var sh = ss.insertSheet('組好的提示');
  sh.appendRow(['送出時間', '學號後4碼', '姓名', '班級', '任務卡', 'CRISP 完成度', '用範例補的欄位', '組好的提示', 'AI 回答', '寄信', '推送評量資料庫']);
  sh.setFrozenRows(1);
  sh.setColumnWidth(8, 520); sh.setColumnWidth(9, 520);

  // ---- 觸發器 ----
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onCrispFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onCrispFormSubmit').forForm(form).onFormSubmit().create();

  var props = PropertiesService.getScriptProperties();
  props.setProperties({ FORM_ID: form.getId(), SS_ID: ss.getId() });

  var url = form.getPublishedUrl(), short = '';
  try { short = form.shortenFormUrl(url); } catch (e) {}
  Logger.log('✅ 表單建立完成');
  Logger.log('學生填答：' + url);
  if (short) Logger.log('短網址：' + short);
  Logger.log('表單編輯：' + form.getEditUrl());
  Logger.log('回覆試算表：' + ss.getUrl());
  return { form: url, short: short, edit: form.getEditUrl(), sheet: ss.getUrl() };
}

/** 觸發器遺失時重建（表單已存在） */
function setupTrigger() {
  var form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onCrispFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onCrispFormSubmit').forForm(form).onFormSubmit().create();
  Logger.log('已重建觸發器：onCrispFormSubmit');
}

// ===================== ② 送出處理 =====================
function onCrispFormSubmit(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) {}
  try {
    var a = answersOf_(e.response);
    var built = buildPrompt_(a);
    var sid4 = String(a.sid || '').replace(/\s/g, '').slice(-4);
    var wantAI = a.askAI === OPT.ASK_AI[0];
    var aiText = '';
    if (wantAI) aiText = askAI_(built.text + (built.hasFile ? '\n\n（系統附註：這次是用文字介面提問，附檔沒有一起傳過去。不要假裝讀過附檔；需要附檔內容就先問我。）' : ''), sid4, a.cls);

    var pushed = '';
    try {
      pushed = push_([{
        v: 2, id: 'crf_' + e.response.getId(), ts: e.response.getTimestamp().toISOString(),
        app: CFG.APP, kind: CFG.KIND, sid: sid4, name: a.name || '', cls: a.cls || '',
        score: built.score, max: 100,
        detail: { graded: false, unit: 'prompt', label: 'CRISP 提示工坊問卷版（五面向完成度）', source: 'google-form',
          task: a.task || '', crisp: built.status, prompt: built.text, vague: a.vague || '', filled: built.filled,
          iForm: a.iForm || '', sOut: a.sOut || '', proof: a.pChecks || [], askAI: wantAI, aiOk: !!aiText && aiText.indexOf('（AI 沒回成') !== 0 }
      }]);
    } catch (err2) { pushed = '失敗：' + err2; }

    var mailed = '';
    if (a.email) {
      try { mail_(a, built, aiText); mailed = '已寄 ' + a.email.replace(/^(.).*(@.*)$/, '$1***$2'); }
      catch (err3) { mailed = '寄信失敗：' + err3; }
    }

    var ssId = PropertiesService.getScriptProperties().getProperty('SS_ID');
    if (ssId) {
      var sh = SpreadsheetApp.openById(ssId).getSheetByName('組好的提示');
      if (sh) sh.appendRow([e.response.getTimestamp(), sid4, a.name || '', a.cls || '', a.task || '', built.score,
        built.filled.join('、'), built.text, aiText, mailed || '（沒填 Email）', pushed]);
    }
  } catch (err) {
    Logger.log('onCrispFormSubmit 失敗：' + err + '\n' + (err && err.stack));
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** 把一份回覆轉成欄位物件 */
function answersOf_(response) {
  var byTitle = {};
  response.getItemResponses().forEach(function (ir) { byTitle[ir.getItem().getTitle()] = ir.getResponse(); });
  function s(t) { var v = byTitle[t]; return (v instanceof Array) ? v.join('、') : String(v == null ? '' : v).trim(); }
  function arr(t) { var v = byTitle[t]; return (v instanceof Array) ? v : (v ? [String(v)] : []); }
  return {
    sid: s(Q.SID), name: s(Q.NAME), cls: s(Q.CLS), email: s(Q.EMAIL), task: s(Q.TASK), vague: s(Q.VAGUE),
    who: s(Q.C_WHO), proj: s(Q.C_PROJ), detail: s(Q.C_DETAIL), file: s(Q.C_FILE), fdesc: s(Q.C_FDESC),
    role: s(Q.R_ROLE), aud: s(Q.R_AUD), tone: s(Q.R_TONE),
    iTask: s(Q.I_TASK), iForm: s(Q.I_FORM), in: s(Q.I_IN), proc: s(Q.I_PROC), out: s(Q.I_OUT),
    s1: s(Q.I_S1), s2: s(Q.I_S2), s3: s(Q.I_S3), pause: arr(Q.I_PAUSE).length > 0,
    sOut: s(Q.S_OUT), cols: s(Q.S_COLS), example: s(Q.S_EX), chart: s(Q.S_CHART), x: s(Q.S_X), y: s(Q.S_Y),
    web: s(Q.S_WEB), flow: s(Q.S_FLOW), py: s(Q.S_PY), sChecks: arr(Q.S_CHECKS), cond: s(Q.S_COND),
    pChecks: arr(Q.P_CHECKS), data: s(Q.P_DATA), goal: s(Q.P_GOAL), place: s(Q.P_PLACE), where: s(Q.P_WHERE),
    askAI: s(Q.ASK_AI)
  };
}

/** 組 CRISP 提示（與網頁版 crisp.html 同一套句型）；留白欄位用任務卡範例補，回傳補了哪些 */
function buildPrompt_(a) {
  var pre = PRESETS[a.task] || null, filled = [];
  var LABEL = { who: 'C 我是', proj: 'C 正在做', detail: 'C 細節', role: 'R 角色', aud: 'R 對象', tone: 'R 語氣', iTask: 'I 任務',
    in: 'I 輸入', proc: 'I 處理', out: 'I 輸出', s1: 'I 步驟①', s2: 'I 步驟②', s3: 'I 步驟③', cols: 'S 欄位', example: 'S 範例',
    x: 'S X 軸', y: 'S Y 軸', web: 'S 網頁', flow: 'S 流程圖', py: 'S 程式', cond: 'S 條件', data: 'P 測試資料', goal: 'P 標準', place: 'P 地點', where: 'P 驗收地點' };
  function v(k, presetKey) {
    var x = tidy_(a[k]);
    if (!x && pre && pre[presetKey || k]) { x = tidy_(pre[presetKey || k]); filled.push(LABEL[k] || k); }
    return x;
  }
  var L = [];
  // C
  var who = v('who'), proj = v('proj');
  if (who || proj) L.push(['C', '背景：' + (who ? '我是' + who : '') + (who && proj ? '，' : '') + (proj ? '正在做' + proj : '') + '。']);
  var detail = v('detail'); if (detail) L.push(['C', '細節：' + detail + '。']);
  var hasFile = a.file && a.file !== OPT.FILE[0];
  if (hasFile) { var fd = tidy_(a.fdesc); L.push(['C', '附檔：我上傳了' + a.file + (fd ? '「' + fd + '」' : '') + '，請先讀完附檔再回答。']); }
  // R
  var role = v('role').replace(/^你是/, ''), aud = v('aud'), tone = v('tone'), rp = [];
  if (role) rp.push('請你扮演' + role); if (aud) rp.push('對象是' + aud); if (tone) rp.push('用' + tone + '的語氣說明');
  if (rp.length) L.push(['R', rp.join('，') + '。']);
  // I
  var task = v('iTask', 'task').replace(/^(請你|請|麻煩你|麻煩)/, '').replace(/^(幫我|幫忙)/, '');
  if (task) L.push(['I', '任務：請幫我' + task + '。']);
  if (a.iForm === OPT.I_FORM[0]) {
    var ipo = [['輸入（Input）', v('in')], ['處理（Process）', v('proc')], ['輸出（Output）', v('out')]].filter(function (p) { return p[1]; });
    L.push(['I', ipo.length ? '請用 IPO 架構思考：' + ipo.map(function (p) { return p[0] + '：' + p[1]; }).join('；') + '。' : '請先用 IPO 架構（輸入、處理、輸出）整理這個任務，再開始做。']);
  } else if (a.iForm === OPT.I_FORM[1]) {
    var st = [v('s1'), v('s2'), v('s3')].filter(String), n = '①②③';
    L.push(['I', (st.length ? '請分步驟執行：' + st.map(function (x, i) { return n.charAt(i) + x; }).join('　') : '請分步驟執行，一次只做一步') + (a.pause ? '。每一步做完先停下來，等我確認再做下一步。' : '。')]);
  } else if (a.iForm === OPT.I_FORM[2]) {
    L.push(['I', '開始之前，先問我 3 個你需要釐清的問題，等我回答再做。']);
  } else if (a.iForm === OPT.I_FORM[3]) {
    L.push(['I', '請提出 2 個方案並比較優缺點，最後建議一個並說明理由。']);
  }
  // S
  var so = a.sOut;
  if (so === OPT.S_OUT[0]) {
    var cols = v('cols').replace(/\s*\|\s*/g, '｜');
    L.push(['S', cols ? '輸出：表格，欄位是 ' + cols + '；一列一筆，不要加表格外的說明。' : '輸出：表格，一列一筆，不要加表格外的說明。']);
    var ex = v('example'); if (ex) L.push(['S', '照這一列的寫法完成其他列。範例：' + ex.replace(/\s*\|\s*/g, '｜')]);
  } else if (so === OPT.S_OUT[1]) {
    var x = v('x'), y = v('y');
    L.push(['S', '輸出：用 Python（matplotlib）畫' + (a.chart || '折線圖') + (x ? '，X 軸是' + x : '') + (y ? '，Y 軸是' + y : '') + '；標題和座標軸用中文，能在 Google Colab 直接執行。']);
  } else if (so === OPT.S_OUT[2]) {
    var w = v('web'); L.push(['S', '輸出：一個單一 HTML 檔的網頁' + (w ? '，要有' + w : '') + '；不要用外部檔案，手機也能看。']);
  } else if (so === OPT.S_OUT[3]) {
    var f = v('flow'); L.push(['S', '輸出：Mermaid 流程圖' + (f ? '，要包含' + f : '') + '；判斷條件放在菱形裡。']);
  } else if (so === OPT.S_OUT[4]) {
    var py = v('py'); L.push(['S', '輸出：Python 程式，能在 Google Colab 直接執行' + (py ? '，' + py : '') + '。']);
  } else if (so === OPT.S_OUT[5]) {
    L.push(['S', '輸出：條列 3 點，每點一句話。']);
  }
  var items = (a.sChecks || []).slice(), cond = v('cond'); if (cond) items.push(cond);
  if (items.length) L.push(['S', '條件：' + items.join('；') + '。']);
  // P
  var pc = a.pChecks || [];
  function has(i) { return pc.indexOf(OPT.P_CHECKS[i]) >= 0; }
  if (has(0)) { var d = v('data'); L.push(['P', '驗證：請用' + (d ? '這些測試資料模擬執行：' + d : ' 3 組測試資料（一般值、剛好卡在門檻、怪資料）模擬執行') + '，列出「輸入｜預期結果｜實際結果｜是否一致」。']); }
  if (has(1)) L.push(['P', '完成後自己檢查邊界條件（等號、空值、負數、單位），發現錯誤就修正，並說明改了哪裡。']);
  if (has(2)) { var g = v('goal'); L.push(['P', '如果結果不符合' + (g || '我的需求') + '，請修正後再驗證一次，最多 2 輪，每輪寫一行修改紀錄。']); }
  if (has(3)) { var pl = v('place'); L.push(['P', '請設計一段 30 秒的情境影片分鏡（場景、動作、要拍到的證據），讓我到' + (pl || '現場') + '實拍，驗證這個方案是否可行；拍完我會上傳照片或影片截圖，請幫我判斷。']); }
  if (has(4)) { var wh = v('where'); L.push(['P', '最後給我一份 5 項的驗收清單，讓我自己在' + (wh || '現場') + '檢查。']); }
  if (has(5)) L.push(['P', '列出你不確定的地方，與我應該去哪裡查證。']);

  var status = { C: !!(detail || hasFile), R: !!role, I: !!task, S: !!so, P: pc.length > 0 };
  var score = ['C', 'R', 'I', 'S', 'P'].filter(function (k) { return status[k]; }).length * 20;
  return { lines: L, text: L.map(function (l) { return l[1]; }).join('\n'), status: status, score: score, filled: filled, hasFile: !!hasFile };
}

function tidy_(s) { return String(s || '').trim().replace(/[。．.；;，,、？?！!\s]+$/, ''); }

// ===================== 外部連線 =====================
function askAI_(text, sid4, cls) {
  try {
    var res = UrlFetchApp.fetch(CFG.AI_PROXY, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ action: 'ai', code: CFG.AI_CODE, sid: sid4 || 'form', cls: cls || '', system: AI_SYSTEM, user: text, max: 3000 })
    });
    var j = JSON.parse(res.getContentText());
    return j.ok ? String(j.text || '').trim() : '（AI 沒回成：' + (j.error || res.getResponseCode()) + '）';
  } catch (err) {
    return '（AI 沒回成：' + err + '）';
  }
}

function push_(records) {
  var res = UrlFetchApp.fetch(CFG.CLOUD_URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ action: 'push', records: records })
  });
  var t = res.getContentText().slice(0, 120);
  Logger.log('push → ' + res.getResponseCode() + ' ' + t);
  return res.getResponseCode() + ' ' + t;
}

function mail_(a, built, aiText) {
  var esc = function (s) { return String(s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var color = { C: '#0E7F83', R: '#6B4BC0', I: '#2152D4', S: '#9A5B00', P: '#BE3655' };
  var rows = built.lines.map(function (l) {
    return '<tr><td style="font:600 13px Consolas,monospace;color:' + color[l[0]] + ';vertical-align:top;padding:4px 8px 4px 0">' + l[0] + '</td>' +
      '<td style="padding:4px 0;white-space:pre-wrap">' + esc(l[1]) + '</td></tr>';
  }).join('');
  var miss = ['C', 'R', 'I', 'S', 'P'].filter(function (k) { return !built.status[k]; });
  var html =
    '<div style="font:15px/1.7 \'Microsoft JhengHei\',\'PingFang TC\',sans-serif;color:#172033;max-width:680px">' +
    '<h2 style="margin:0 0 6px">你的 CRISP 提示組好了</h2>' +
    '<p style="margin:0 0 12px;color:#5A6476">任務卡：' + esc(a.task) + '　CRISP 完成度 ' + built.score + '/100' +
    (miss.length ? '　還缺：' + miss.join('、') : '　五個面向齊全') + '</p>' +
    (built.filled.length ? '<p style="margin:0 0 12px;color:#94600A">這些格子你留白，用任務卡範例補上了：' + esc(built.filled.join('、')) + '。改成自己的版本會更準。</p>' : '') +
    '<p style="margin:0 0 4px"><b>① 複製下面整段，貼到 Claude／ChatGPT／Gemini：</b></p>' +
    '<pre style="white-space:pre-wrap;background:#F5F7FA;border:1px solid #D2D9E2;border-radius:8px;padding:12px;font:14px/1.7 \'Microsoft JhengHei\',sans-serif">' + esc(built.text) + '</pre>' +
    '<details open><summary style="cursor:pointer;color:#5A6476">依面向看</summary><table style="border-collapse:collapse;margin:6px 0 12px">' + rows + '</table></details>' +
    (built.hasFile ? '<p style="color:#94600A">你選了附檔：貼上提示前，先在 AI 對話框按迴紋針或「＋」，把檔案真的上傳。</p>' : '') +
    (aiText ? '<p style="margin:16px 0 4px"><b>② 老師代管 Gemini 的回答（記得用你的 P 驗證方式檢查）：</b></p>' +
      '<pre style="white-space:pre-wrap;background:#fff;border:1px solid #D2D9E2;border-radius:8px;padding:12px;font:14px/1.7 \'Microsoft JhengHei\',sans-serif">' + esc(aiText) + '</pre>' : '') +
    '<p style="margin:16px 0 0;color:#5A6476">想即時預覽、改了馬上再問：<a href="' + CFG.WEB_URL + '">CRISP 提示工坊網頁版</a>。先思考，後驗證。</p></div>';
  MailApp.sendEmail({
    to: a.email,
    subject: '【CRISP 提示工坊】你組好的提示' + (aiText ? '＋AI 回答' : ''),
    body: '你的 CRISP 提示：\n\n' + built.text + (aiText ? '\n\n— 老師代管 Gemini 的回答 —\n\n' + aiText : '') + '\n\n網頁版：' + CFG.WEB_URL,
    htmlBody: html,
    name: 'CRISP 提示工坊'
  });
}

// ===================== 檢查工具 =====================
/** 只跑組提示邏輯，不寫資料、不寄信、不問 AI */
function selfTest() {
  var a = { task: '智慧澆水（示範）', who: '', proj: '', detail: '', file: '資料檔（Excel／CSV）', fdesc: '一週濕度紀錄.xlsx',
    role: '', aud: '同班同學', tone: '', iTask: '', iForm: 'IPO 架構', in: '', proc: '', out: '', pause: false,
    sOut: 'Python 程式', py: '', sChecks: ['用繁體中文'], cond: '', pChecks: [OPT.P_CHECKS[0], OPT.P_CHECKS[5]], data: '' };
  var b = buildPrompt_(a);
  Logger.log('完成度 ' + b.score + '｜範例補：' + b.filled.join('、') + '\n' + b.text);
  return b;
}

/** 雲端連線自我測試（不寫入資料） */
function pingCloud() {
  [CFG.CLOUD_URL, CFG.AI_PROXY].forEach(function (u) {
    var r = UrlFetchApp.fetch(u + '?action=ping', { muteHttpExceptions: true, followRedirects: true });
    Logger.log(u.slice(-12) + ' → ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 120));
  });
}
