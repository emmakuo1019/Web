# PR2｜Bug 先生復活計畫
Pet Visual & Behavior Integration · .EMMA 個人作品集

- 文件日期：2026-10-08
- 狀態：規劃已整理；功能尚未實作／驗收。本 PR 先提交本文件，後續在同分支追加實作。
- 基準：main / 3d9cca2d75ac987fdd7472fc943c04ea9b564e5e；PR1 #1 已合併。
- 執行方式：本地 AI 一次完成一個明確指定的小任務，人工驗收後才進下一項。
- 命名：原初稿 PET-05～09 保留為階段，但正式 Task ID 使用 PR2-PET-05A 等，避免與 PR1 PET-05 重複。
- 本文件為 PR2 規格；docs/pet-guide-mvp.md 保留為 PR1 歷史。PR1「不加動畫／FSM」限制不適用本次已授權的 PR2 功能。

## 1. 開發目標與範圍
首頁紫色球替換為 Bug 先生，固定於瀏覽器可視區域底部，左右行走、隨機停留、點擊開心與導覽、Debug 消失、Footer 召回。手機也保留較慢行走；減少動態模式改靜態。

角色服務於作品閱讀，不能讓趣味互動妨礙主要導覽、作品連結與表單。延用三個導覽目標 works-area / profile-area / contact-area，不增設假連結。

本次不做 AI 對話、拖曳、物理碰撞、Canvas/WebGL、額外動畫套件、養成、跨頁角色部署、睡眠動畫或大量隨機事件。音效僅預留呼叫位置，不新增素材、播放 UI 或自動播放；未來另行授權。

## 2. 已核對的程式基線與實作落點
以下為上述 commit 的原始碼檢查，不代表已完成瀏覽器實測。

| 檔案／項目 | 實際現況 | PR2 處理 |
| --- | --- | --- |
| index.html | .pet-guide、#pet、#pet-dialog、三個 data-target 按鈕 | 保留 ID 與功能契約；允許增加必要視覺 wrapper、關閉／Debug／暫停按鈕 |
| js/home.js | 檔案尾端集中處理切換、外部點擊關閉、導覽；只處理 .pet-options button 的 tabindex | 將 pet 專屬區段搬到 js/pet.js；刪除舊 pet listener，避免雙重綁定。擴充全部隱藏互動元素的焦點管理 |
| css/style.css | Pet Guide 區段；64px/52px 紫球；right 固定定位；hover transform | 集中修改此區；避免位移、翻轉、縮放互相覆蓋 |
| 對話框 | 沒有獨立關閉按鈕、Escape handler | PR2 明確新增 |
| Footer | 社群連結；沒有召回入口 | 加入原生 button 亂碼入口，不覆寫社群連結 |
| 素材 | main 的檔案樹尚無 picture/pet/ 三個檔案 | PR2-PET-05A 檢查使用者本地素材並納入 git |
| back-to-top | 原始碼中為文件流內按鈕，不是固定懸浮鈕 | 使用實際元素矩形檢查遮擋，不假設右下角永遠被占用 |
| 其他系統 | home.js 也包含 Matter.js 拉繩、表單、導覽、標題效果 | 不重構，不把角色接進 Matter.js |
| 專案指示 | 本次遠端檔案樹未見 AGENTS.md | 本地執行仍須讀取當地存在的適用指示 |

允許實作檔案：index.html、css/style.css、js/home.js（僅搬移 pet 區段）、新增 js/pet.js、picture/pet/ 指定素材、本文件，以及最終 docs/pr2-bug-pet-verification.md。不新增框架或建置系統。

## 3. 美術與初始參數
素材原始比例、透明背景不可破壞。實際圖像內容、GIF 初始朝向、三張圖的透明邊界與檔案大小尚未檢查，05A 必須記錄；不得自行重畫或壓縮覆寫原圖。

| 項目 | 初始設定 | 調整原則 |
| --- | --- | --- |
| Walking | picture/pet/pet.gif | 僅行走時顯示；不是每幀重設 src |
| Idle | picture/pet/pet.png | 預設及減少動態時使用 |
| Happy | picture/pet/pethappy.png | 開啟對話期間使用 |
| 桌面角色寬 | 64px | 可於56–72px內人工微調 |
| ≤500px 角色寬 | 48px | 可於40–52px內微調；按鈕至少44×44 CSS px |
| 桌面速度 | 35px/s | 每次 Walking 可在25–45取值 |
| ≤500px 速度 | 22px/s | 每次 Walking 可在15–30取值 |
| Walking 持續 | 每段隨機4–8秒 | 到時轉 Idle；不要每幀抽停留機率 |
| Idle 持續 | 每段隨機2–5秒 | Happy 關閉／召回先 Idle 2秒 |
| 邊界／角色與對話間隔 | 12px / 10px | 邊界另計 safe-area |
| 消失／出場 | 約180ms / 240ms | 縮淡／由底部小幅上移；減少動態時立即完成 |

尺寸、速度與時間都是待實機調整的設計值，不是已驗證最佳值。共用穩定視覺容器，以 contain 呈現三種素材，避免換圖造成角色腳底與對話框跳動。方向只翻轉圖像層，不翻轉文字或按鈕。

載入失敗：GIF/Happy 失敗改 pet.png；pet.png 也失敗則顯示可讀的「Bug」文字按鈕，保留導覽功能。fallback 只執行有限次，禁止 error 無限循環。

## 4. 行為狀態與轉換契約
核心 FSM 只用 Walking、Idle、Happy、Hidden。另以 flags 管理 userPaused、documentHidden、reducedMotion、focus/hover 暫停與 transitionBusy；不要將每個組合擴充成新 FSM 狀態。

| 來源／事件 | 結果 | 副作用 |
| --- | --- | --- |
| 首次進入且未隱藏 | Idle → Walking | Idle 2秒；Reduced Motion 或暫停時維持 Idle |
| Walking 到停留時間 | Idle | 換靜態圖，停止移動 |
| Idle 到期且允許移動 | Walking | 可隨機取左右方向；邊界處只能向內 |
| 任一可見狀態點角色 | 對話未開→Happy；已開→Idle | 與 PR1 一樣支援再次點擊關閉 |
| Happy 關閉／Escape／導覽／外部點擊 | Idle | 所有關閉路径統一處理；2秒後依允許條件行走 |
| 可見狀態 Debug | Hidden | 立即停止更新、關閉對話、寫入隱藏旗標；視覺層完成淡出後移除顯示 |
| Hidden Footer 召回 | Idle | 清除隱藏旗標，出場一次；2秒後可 Walking |
| 已顯示時 Footer 召回 | 維持狀態 | 不新增 timer、rAF、角色或 listener；可將焦點放角色 |
| 分頁不可見 | 保留邏輯狀態，暫停 | 取消 rAF／待機排程，改靜態圖；回來不得追趕離開的時間 |
| Reduced Motion 開啟 | Walking→Idle；Happy/Hidden維持 | 靜態圖、無自走／hover縮放／彈出；手動互動與召回仍有效 |

- 全部狀態更動經單一 transition/render 入口；不可由多個 handler 分別猜測 class、圖片、aria-expanded。
- 移動、左右翻轉、消失縮放分層：外層位移／內層圖像方向／效果層 scale-opacity，互不覆寫 transform。
- 只有一個 rAF 迴圈；使用 timestamp 差換算秒，delta 上限例如50ms，恢復可見時重設前次 timestamp。
- 隨機排程可用單一可清除 timeout 或一致的剩餘時間機制；退出狀態、Hidden、背景頁要取消過期工作。
- 連續 Debug／召回期間以 transitionBusy 或取消 token 排除舊動畫回呼；Reduced Motion、animationend 未發生時仍完成狀態，不得只靠事件解鎖。
- 桌機指標進入角色、角色收到鍵盤焦點、觸控 pointerdown 時立即暫停，避免要點擊的目標逃走；離開且無其他暫停原因才繼續。
- 對話新增「暫停走動／恢復走動」切換，當次頁面有效，不另持久保存；Reduced Motion 下顯示系統已減少動態，不提供強制覆蓋。

## 5. 對話、內容與無障礙
沿用非模態展開面板：保留 aria-controls、aria-expanded、aria-hidden 的同步，不加不完整的 aria-modal 或焦點陷阱。關閉時用 hidden/inert 或完整控制所有可聚焦子項，不能只管原有三個按鈕。

- 開啟：Happy 停止，抽一則短句；同次開啟不自動輪播。優先避免連續兩次相同。
- 內容：嗨！我是 Bug 先生。／今天也在努力找 Bug！／想看看我的主人做過的遊戲嗎？／這個網站也是自己做的喔！／我好像又發現一個 Bug……／不要 Debug 我啦！
- 作品／關於／聯絡皆保留；資料可存在 js/pet.js 小陣列，不另建遠端 API。
- 新增明確關閉按鈕、Debug、暫停走動；原生 button type=button；只有 data-target 項才進導覽 handler。
- 點角色打開後焦點保持角色；DOM Tab 順序安排角色→開啟的面板控制項。不得要求鍵盤使用者繞完整頁才找到選項。
- Escape／關閉按鈕：關閉後返回角色。
- 外部點擊：不要搶回使用者剛選的外部控制項焦點；若焦點仍留在被隱藏面板中才返回角色。
- 導覽：關閉後將焦點移到目的 section 或標題（必要時暫設 tabindex=-1），使用 preventScroll 避免二次跳動；實際 scroll 尊重最新 Reduced Motion。
- Debug：先將面板內焦點安全移回可見角色並顯示短暫確認（可用獨立 polite status），隱藏前移至可見主內容的適當焦點落點，preventScroll；不得直接跳到離屏 Footer。
- Footer 召回：以鍵盤觸發後將焦點交給角色；保留使用者當前捲動位置。
- Focus 樣式清晰；新增按鈕至少44×44px。亂碼可低調但不能用難以辨識的低對比文字。

## 6. 定位、避讓與手機
固定的是 viewport 底部，不是文件 Footer。Footer 僅是召回入口所在位置。

- 左右邊界包含角色實際 hitbox、12px 邊距與 safe-area-inset-left/right；底部含 safe-area-inset-bottom。
- 位置計算統一座標系。resize／orientation change 重新量測並 clamp；可用 visualViewport resize/scroll 處理手機可視區變化，有能力檢查與 window fallback。
- rAF 只寫 transform；尺寸量測放在初始化、resize、scroll或必要布局改變，合併至下一幀，不在每幀重讀全頁矩形。
- pet overlay 大面積透明區域 pointer-events:none，角色與開啟面板才 auto。按鈕矩形內透明像素仍属于 hitbox；不要求逐像素點擊穿透。
- 對話框以角色為錨點，左右 clamp 到可視區12px內；短螢幕限制 max-height 並讓面板內捲動；高度不足時仍可操作關閉與 Debug。
- 避讓策略：對可視的 .nav、#myForm 互動項、.back/.back2、Footer 連結／召回及作品連結的重疊區，將與底部活動帶相交的水平區間排除（含間距）。移動取所在安全區間；空間不夠則暫時不顯示角色並停止活動，空間恢復才顯示。此暫時避讓不寫入 Debug 隱藏旗標。
- 表單 input/textarea 聚焦，尤其軟鍵盤出現時，暫時隱去角色與面板、不奪焦；失焦後恢复非 Happy 的 Idle 或保留 Hidden。
- 首版不做物理碰撞；若安全區算法超出小任務預算，回報具體重疊情境，由使用者決定調整規格，不可把「不遮擋」勾選通過。

## 7. Debug、Footer 與保存
Footer 按鈕顯示 #@$%_BUG?!，可附 title，accessible name 為「召回 Bug 先生」。觸發後從視窗底部出現，不從 Footer 的文件座標飛行。

保存 key 建議 emma.pet.hidden.v1，值為1代表 Hidden，召回時 removeItem。
讀写 sessionStorage 均 try/catch；不可用時退化為當頁記憶，整個角色仍可用。初始化先讀旗標再顯示，避免重整時閃現。

保存語意是「同源、分頁工作階段」：一般重整保留；獨立新開分頁通常重新開始，但複製分頁、opener 或瀏覽器恢復工作階段可能保留／複製既有資料，因此不可承諾每種新視窗情境一定顯示。不主動同步其他分頁，也不替 project.html 新增角色。

## 8. 本地 AI 執行規則
本文件為完整規格，不代表一次授權實作所有任務。

1. 一次只執行一個使用者指定 Task ID。即使母階段只剩一项，也不可自行串做。
2. 先檢查工作樹；不覆寫或回退使用者未提交變更。使用 plan/pr2-bug-pet 分支，不在 main 開發。
3. 只讀本任務必要檔案；不全站重構、不更新相依、不把歷史 PR1 限制誤用在 PR2。
4. 保留原有公開 ID、導覽與使用者可見行為，但允許按計畫搬移 pet 專属實作。不可重複掛 listener。
5. 同一錯誤最多自行修正兩輪；仍失敗就提供最小重現並停止。不得為省用量省略必要的狀態／焦點驗收。
6. 每小任務以一個 commit 為目標；只 stage 本任務檔案；不自行 merge、部署或擴充下項。Push 依使用者本地授權。
7. 完成回報 Task ID / Status / Modified Files / Summary / Checks（已測、未測、失敗分開）/ Commit / Known Issues / Next Task，然後停止。
8. 若無執行環境或實體手機，標未測，不得以閱讀程式取代 Passed。此文件 checklist 只在實際完成後勾選。
9. 未授權子任務時只回報現況；本次建立規劃 PR 不代表網站已實作。

## 9. 製作任務：依序執行12個小任務
每项約一次本地 AI 對話；实际時間與用量依環境而異，不承諾固定工時。

### PR2-PET-05A｜素材盤點與靜態換圖
前置：PR1 基線；範圍：index.html、CSS Pet 區、picture/pet/、本文件。
- [ ] 檢查三個本地檔案存在、大小、尺寸、透明邊界、GIF 動畫與原始朝向，記錄結果；納入 git。找不到就回報確切缺件，不拿其他圖假裝完成。
- [ ] #pet 中放 Idle 圖；提供穩定容器、桌面64px／手機48px與至少44px hitbox；圖片 alt=""，名稱交給按鈕。
- [ ] 移除紫球常態背景與圓形裁切；保留 focus，沿用現有點擊，不寫移动/FSM。
驗收：桌面與375px三張素材路徑可載入；静態圖不變形；點角色與三個導覽正常。
STOP → 05B。

### PR2-PET-05B｜隔離角色程式與失敗降級
範圍：js/home.js 尾端 pet 區、新增 js/pet.js、index.html script、必要 Pet CSS。
- [ ] 把現有 pet 開關／導覽／外部關閉搬到專用檔；在 DOM 可用時初始化，無 pet DOM 直接退出。
- [ ] 保留三個導覽、Reduced Motion 捲動與 ARIA 同步；不動 Matter.js。
- [ ] 加入素材失敗回退；其他狀態圖回退機制供後續狀態共用。
驗收：一次點擊只切換一次；三導覽及外部關閉正常；模拟 pet.png 失敗仍可操作；無重複錯誤迴圈。
STOP → 06A。

### PR2-PET-06A｜FSM 與事件單一入口
範圍：js/pet.js、必要 Pet CSS。
- [ ] 建立四狀態與單一轉換入口；Idle/Happy 可實際切換；Hidden 僅內部契約，尚不接新 UI。
- [ ] 集中圖片、對話顯示與 ARIA 更新；先接現有點擊、外部關閉、導覽。
- [ ] 建立排程清理、初始化防重與設定物件；不實作移動演算法。
驗收：快速開關20次，圖像／對話／ARIA 一致，單次導覽只執行一次。
STOP → 06B。

### PR2-PET-06B｜底部移動、停留與邊界
範圍：js/pet.js、Pet CSS。
- [ ] 單一 rAF、px/s 位移、左右轉向、4–8秒走／2–5秒停。
- [ ] 分離位移與翻轉 transform；按 GIF 原朝向決定翻轉。
- [ ] 實作 resize clamp、safe-area與基本可視範圍；開對話立即停止。
驗收：左右邊界各撞一次；持續30秒見走／停；1280縮至320不出界；Happy 不移動。
STOP → 06C。

### PR2-PET-06C｜暫停、Reduced Motion 與生命週期
範圍：js/pet.js、index.html 面板暫停鈕、Pet CSS。
- [ ] 分頁 hidden 停 rAF及排程、換靜態；恢復不瞬移不補跑。
- [ ] 讀取並監聽動態偏好變更；靜態替代 GIF，停用 hover、出場與離場動態。
- [ ] 接入「暫停／恢復走動」，與 hover/focus/pointerdown 暫停共同運作；每種原因解除不得覆蓋其他原因。
驗收：切走10秒再回；執行中切偏好；暫停後開關對話；Tab 聚焦時角色不逃走；確認未重複排程。
STOP → 07A。

### PR2-PET-07A｜內容、關閉與焦點
範圍：index.html、js/pet.js、Pet CSS。
- [ ] Happy 換圖，新增短句池；保留作品／關於／聯絡。
- [ ] 加入關閉、Escape；依第5節實作開關、外部點擊、導覽焦點；涵蓋全部可聚焦項。
- [ ] 調整 DOM／Tab 順序，使角色後可直接進面板；面板關閉後子項不可聚焦。
驗收：滑鼠、Tab/Shift+Tab、Enter/Space、Escape；三導覽焦點／落點；連開5次無中途輪播。
STOP → 07B。

### PR2-PET-07B｜面板邊界與避讓
範圍：js/pet.js、Pet CSS。
- [ ] 跟隨角色定位、面板邊界 clamp、高度限制、透明區點擊穿透。
- [ ] 按第6節排除重要互動區；沒有安全空間時暫時收起、恢復時 Idle。
- [ ] 表單聚焦／手機可視高度改變不遮擋、不奪焦；臨時收起不等於 Hidden。
驗收：角色在最左最右開框；320px與橫向矮螢幕；到表單、回頂、Footer及作品卡逐項確認可操作。
STOP → 08A。

### PR2-PET-08A｜Debug 與持久隱藏
範圍：index.html、js/pet.js、Pet CSS。
- [ ] Debug 按鈕、Hidden、縮淡、排程停止、隱藏焦點交接。
- [ ] sessionStorage 防例外讀寫；初始化隱藏不閃現；Reduced Motion 立即隱藏。
- [ ] transitionBusy／取消 token，連點不重入；記錄 Debug 後停止活動。
驗收：Debug後按Tab不進隱藏項；重整仍隱藏；拒絕儲存時不崩潰；連點不重複寫入或排程。
本小步尚無召回 UI，驗收後可由開發工具移除指定 key 重整，不能把這項當成最終產品體驗。
STOP → 08B。

### PR2-PET-08B｜Footer 召回與往返
範圍：index.html Footer、js/pet.js、Pet CSS。
- [ ] 原生亂碼 button、可讀焦點及accessible name；接清旗標、出場、Idle再Walking。
- [ ] 保持捲動位置；鍵盤召回焦點交給角色；可見時重按不重建實例。
- [ ] Debug／召回連續切換具一致結果；音效只留無副作用註解或 hook，不載入音檔。
驗收：Debug→重整→Footer召回→重整；10次往返；減少動態；召回中再次點擊；原社群連結正常。
STOP → 09A。

### PR2-PET-09A｜桌面與狀態回歸
範圍：只修正本 PR 引入缺陷；新增 docs/pr2-bug-pet-verification.md。
- [ ] 按下方矩陣驗證桌面、主題、狀態、異常情境；記錄瀏覽器版本／viewport／結果／截圖或重現步驟。
- [ ] 原 Navbar、作品列表、Profile、Contact操作、Back to top、Matter.js切換主題抽查。
驗收：必測項有真實結果；無新增 Console 錯誤；未解缺陷具重現步驟。
STOP → 09B。

### PR2-PET-09B｜手機、鍵盤與減少動態驗收
範圍：Pet缺陷修正與驗收文件。
- [ ] 320/375/390/768px、橫向、200%縮放；實體手機軟鍵盤與safe-area，若無設備明列未測。
- [ ] 鍵盤開關／導航／Debug／召回焦點；隱藏內容無可聚焦項。
- [ ] Reduced Motion 初次載入和執行中變更；手動暫停；Light/Dark。
驗收：主要內容與表單操作不受干擾；不得把裝置模擬寫為實體手機實測。
STOP → 09C。

### PR2-PET-09C｜整理證據與交付審查
範圍：文件及必要PR資訊；不新增功能。
- [ ] 核對實作任務、diff、素材版本、驗收結果與已知問題；勾選有證據的任務。
- [ ] 回報未測設備與所有失敗項；高影響缺陷未解則維持 Draft。
- [ ] 提供最後commit、已測矩陣、待人工驗收事項；由使用者決定ready／merge。
驗收：沒有把規劃文件或尚未執行測試當成功能完成。
STOP；不得自行合併。

## 10. 最終驗收矩陣
結果欄於實作後填 PASS / FAIL / NOT TESTED，附證據；目前全部未測。

| 類別 | 必測情境 | 通過標準 |
| --- | --- | --- |
| 素材 | 三狀態、失敗載入、方向 | 比例正確、底線穩定、可退化操作 |
| 移動 | 邊界、resize、連續30秒 | 不出界、速度合理、無重複迴圈 |
| 暫停 | hover/focus、背景、手動、對話 | 不移動、恢復無瞬移、其他暫停原因仍有效 |
| 對話 | 再點、Close、Escape、外部、三導覽 | 一致關閉、焦點合理、ARIA同步 |
| 往返 | Debug/召回10次、快速重按 | 狀態正確、動畫不中途鎖死 |
| 保存 | 重整、獨立新頁、儲存拋錯 | 同頁保留、例外可操作；分頁複製行為依瀏覽器記錄 |
| 尺寸 | 320/375/390/768/1280/1440px、矮螢幕、200% | 無新增橫向捲軸，面板內容可存取 |
| 手機 | iOS Safari／Android Chrome可取得設備 | 安全區／軟鍵盤不遮擋；無設備須列未測 |
| 桌面 | 至少一個Chromium瀏覽器，Safari可取得時 | 記錄名稱版本，不籠統寫全瀏覽器通過 |
| 外觀 | Light/Dark、focus、Footer入口 | 文字／焦點可辨，角色不主導作品閱讀 |
| 減少動態 | 初始及執行中切換 | 無GIF、自走、彈跳；導覽非smooth |
| 效能 | Hidden／背景／Idle檢查排程 | 無不必要移動迴圈、無累積timer/listener |
| 原站回歸 | Nav、列表、Profile、表單、回頂、拉繩 | PR1既有操作不退化，不擅自送出真實表單資料 |

## 11. 交給本地 AI 的第一輪指令
```text
請先檢查工作樹，保留我的未提交變更，切換／追蹤 plan/pr2-bug-pet 分支。
閱讀 docs/pr2-bug-pet-plan.md 及本地適用的專案指示。
這次只執行 PR2-PET-05A：素材盤點與靜態換圖。
使用 picture/pet/pet.gif、pet.png、pethappy.png；若缺件請回報，不自行生成替代圖。
不要做05B或後續任務，不重構全站，不新增框架。
完成當前驗收，同一錯誤最多自行修正兩輪。
只提交本任務檔案，回報 Task ID / Status / Modified Files / Summary /
Checks（已測、未測、失敗）/ Commit / Known Issues / Next Task，然後停止。
不要自行 merge 或部署。
```

後續每輪以同模板替換為下一個完整 Task ID；新對話提供目前分支、上次commit、未解問題即可，不要求AI每次重讀全站。

## 12. 合併標準
- [ ] 三素材已核對並提交；角色取代紫球。
- [ ] 自走、待機、轉向、暫停、Happy與導覽正常。
- [ ] Debug／Footer召回及保存／儲存失敗降級正常。
- [ ] FSM、計時器、動畫與重複輸入沒有互相衝突。
- [ ] 桌機／手機布局、鍵盤、Reduced Motion、Light/Dark符合矩陣。
- [ ] 重要內容不被角色阻礙，暫時避讓與真正Hidden可區分。
- [ ] PR1回歸檢查完成，未測與失敗明確列出。
- [ ] 使用者完成人工審查並決定合併。

本 PR 建立時僅包含製作規格；上述各項均未宣稱完成。
