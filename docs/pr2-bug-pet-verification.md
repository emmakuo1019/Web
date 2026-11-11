# PR2-PET｜09A/09B 驗收紀錄

- Task ID：PR2-PET-09A
- 測試日期：2026-11-12（Asia/Taipei）
- Repository：`emmakuo1019/Web`
- Branch：`plan/pr2-bug-pet`
- 驗收基準：`06ba34bfff1818e0621c0de845ea335a48b60633`
- 瀏覽器：Google Chrome 157.0.8103.39，headless
- 測試頁：本機 HTTP 網站
- 請求視窗：1280×800；Chrome 回報 `innerWidth=1280`、`innerHeight=657`
- 裝置／作業系統 GUI：未測；本次為 headless，不代表桌面人工操作

## 結果摘要

| 結果 | 數量 | 說明 |
| --- | ---: | --- |
| PASS | 15 | headless Chrome 中可觀察的 DOM、FSM、Storage 與部分互動路徑 |
| FAIL | 0 | 沒有確認的產品缺陷 |
| NOT TESTED | 1 | 表格中的左右 clamp 測量需在 CSS transition 結束後重測；另有下方人工驗收清單 |

瀏覽器 harness 曾以 CSS transform 尚在過渡時立即讀取右側對話框矩形，結果不穩定；該結果不列 FAIL，也不算 clamp 通過。左右邊界 clamp 留待人工驗收。

## 自動化瀏覽器檢查

以下是實際 Chrome 瀏覽器載入本機網站後，由頁面腳本驅動 DOM 操作取得的結果；不是靜態程式碼推論。它不等同於使用實體鍵盤／滑鼠操作。Console 訊息未被可靠擷取，未以無錯誤作為通過條件。本次沒有保留截圖；結果證據為頁面回報的 JSON。`Escape`、Reduced Motion 與召回均由頁面腳本／測試介面觸發，不是實體鍵盤或作業系統偏好操作。

| 項目 | 操作 | 預期結果 | 實際結果 | 結果 |
| --- | --- | --- | --- | --- |
| 初始角色 | 清除測試分頁 Hidden key 後載入 | 初始 Idle 且可見 | `initial=["Idle",true]` | PASS |
| Happy | 呼叫既有角色開啟入口 | 狀態進入 Happy | `happy="Happy"` | PASS |
| Escape | 對 document 派送 Escape keydown | 對話關閉並回 Idle | `escape="Idle"` | PASS |
| 暫停／恢復 | 呼叫既有暫停切換兩次 | 暫停及恢復旗標正確 | `pause=true`、`resume=true` | PASS |
| 表單避讓 | 聚焦 Contact name，接著 blur 並等待 | 聚焦時暫時避讓，失焦後恢復 | `formFocusAvoidance=true`、`formBlurRestored=true` | PASS |
| Debug 保存 | Debug 後等待動畫／保底完成 | Hidden、key 為 1、DOM hidden | `debug=["Hidden","1",true]` | PASS |
| 重整保持 Hidden | Debug 後 reload | 初始化為 Hidden | `hiddenReload=["Hidden","1",true]` | PASS |
| Footer 召回 | Hidden 時按召回元素 | 回 Idle、清 key、顯示且保持捲動位置 | `recallReduced=["Idle",null,true,true,true,null]`；程式觸發原生 `.click()`，本次啟用 reduced motion，因此沒有 Walking 排程；不是實體鍵盤輸入 | PASS |
| 連續往返 | 連續執行 10 次 Debug／召回 | 每次回 Idle，scheduler 目標為 Walking | `tenCycles=[true,"Idle","Walking"]` | PASS |
| Storage 移除例外 | 暫時令 `Storage.removeItem` 拋例外再召回 | 當頁仍可用，不產生未處理錯誤 | `storageFailure=["Idle",true,false]` | PASS |
| Reduced Motion | 召回前切入 reduced motion | 立即 Idle，不排 Walking | `recallReduced` 最後欄為 `null` | PASS |
| 正常召回後重整 | Debug → reload → Footer 召回 → reload | Hidden key 清除，重載後可見 | `debug=["Hidden","1",true]`、`hiddenReload=["Hidden",true]`、`recall=["Idle",null,true,true]`、`recallReload=["Idle",true,null]` | PASS |
| Storage 例外後重整 | Storage 移除故意失敗後重整 | 不承諾重整後可見；讀回仍 Hidden 屬預期降級 | `storageFailure=["Idle",true,false]`；後續 reload 為 `Hidden`，key 仍為 `1` | PASS（符合 Storage 失敗限制） |
| 原站結構 | 查詢 Navbar、作品卡、Profile、Contact、Back to Top | 相關 DOM 仍存在 | 五項皆 `true`；只確認存在，未操作 | PASS（結構檢查） |
| Footer 社群連結 | 查詢 Footer anchors | Instagram、Facebook 仍存在 | `socialLinks=["INSTAGRAM","FACEBOOK"]` | PASS（結構檢查） |
| 對話左右 clamp | 角色置左右邊界後開框 | 面板位於 viewport 內並保留間距 | 量測時處於 transform transition，值不可靠 | NOT TESTED |

測試 viewport 為 `1280×657`（Chrome headless 的可視高度）。未測其他桌面尺寸、200% 縮放、非 headless 桌面瀏覽器或實體裝置。

## 未測項目與人工驗收清單

請在本機分支網站、一般桌面 Chrome 視窗執行；每項記錄瀏覽器版本、實際 viewport、PASS／FAIL、結果及必要截圖。若出現問題，附可重現步驟與 Console 訊息。

### 角色與對話

- [ ] 觀察自然計時下角色自動行走、Idle 隨機停留、左右轉向及連續移動；確認沒有重複 rAF。
- [ ] 用滑鼠點擊角色進入 Happy，再點角色關閉；以真實 Escape 鍵關閉對話。
- [ ] 連續開關對話多次，檢查沒有重複 Walking／Idle 排程。
- [ ] 使用面板暫停與恢復按鈕；同時測試開關對話時暫停理由不互相覆蓋。
- [ ] 左右邊界開啟對話框，等待至少 250ms transition 結束後檢查四周間距與內容可見。

### Debug、召回與鍵盤

- [ ] Debug → 重整，確認 Hidden；Footer 召回 → 重整，確認正常可見並恢復行走。
- [ ] 真實 Tab 移至 Footer 亂碼入口，以 Enter 和 Space 各召回一次；確認焦點只在角色可見、可操作時移交，且頁面不跳動。
- [ ] 連續完成 10 次 Debug／召回往返，另測快速重複點擊 Debug 與召回。
- [ ] 召回角色後確認 Happy、暫停、恢復、三項作品導覽都正常。
- [ ] 使用 DevTools 對 `sessionStorage.removeItem` 造成例外時召回；確認當頁可用，重整後結果依 Storage 能力記錄。

### 07B 避讓與尺寸

- [ ] 聚焦表單欄位、捲至作品卡、Footer 連結及回頂按鈕附近，觀察角色避讓及恢復。
- [ ] 快速捲動及縮放視窗；在避讓／定位過程中觸發 Debug、再召回，確認不突然出現或落在障礙上。
- [ ] 建立沒有足夠安全區的視窗或內容情境，確認角色暫時收起，鍵盤焦點不移交至不可見角色。
- [ ] 檢查 1280、1440px 桌面寬度及短視窗；確認無水平溢出及對話內容被裁切。

### 原網站功能

- [ ] 操作 Navbar 各連結及作品卡連結，確認目標正確。
- [ ] 捲至 Profile，確認內容顯示；操作 Contact 欄位但不要提交真實資料。
- [ ] 使用 Back to Top 並確認捲動結果。
- [ ] 操作 Light／Dark 主題切換，檢查角色與 Footer 可讀性。
- [ ] 比較頁面捲動、Footer 排版與社群連結；確認兩個社群連結仍可正常開啟。

## 缺陷紀錄

- **確認缺陷：無。**
- **不成立的初步警訊：** 右側 clamp 一度在 CSS transform transition 尚未完成時被量測。因量測時機不符合驗收條件，不登記為產品 FAIL；正確的人工重測方式是開框後等待 transition 完成再量測。

## PR2-PET-09A｜使用者回報之桌面人工驗收

以下結果由使用者回報，與上方 headless Chrome 自動化結果分開記錄。使用者回報 8 項均 PASS。執行日期、瀏覽器與版本、作業系統、viewport、縮放比例及截圖均未提供，故不推測。原始詳細 checklist 的細項仍維持未勾選，因回報只提供下列 8 個項目名稱，未提供逐細項證據。

| 項目 | 使用者回報結果 | 備註 |
| --- | --- | --- |
| 自然行走與停留 | PASS | 桌面人工驗收；環境資料未提供 |
| 對話框與鍵盤 | PASS | 桌面人工驗收；環境資料未提供 |
| 左右邊界 | PASS | 桌面人工驗收；環境資料未提供 |
| Debug 與 Footer 召回 | PASS | 桌面人工驗收；環境資料未提供 |
| 鍵盤召回 | PASS | 桌面人工驗收；環境資料未提供 |
| 定位避讓 | PASS | 桌面人工驗收；環境資料未提供 |
| 視窗尺寸與版面 | PASS | 桌面人工驗收；環境資料未提供 |
| 原網站功能 | PASS | 桌面人工驗收；環境資料未提供 |

## PR2-PET-09B｜手機、鍵盤與 Reduced Motion 驗收

- Task ID：PR2-PET-09B
- 測試日期：2026-11-12（Asia/Taipei）
- Repository / branch：`emmakuo1019/Web` / `plan/pr2-bug-pet`
- 測試基準：`13c77d7910f5891cf1e1ce3ee084142a616f1f65`，含本任務下列兩項缺陷修正
- 瀏覽器：Google Chrome 157.0.8103.39，headless
- 測試頁：本機唯讀 HTTP `http://127.0.0.1:8765/index.html`
- 作業系統 GUI：未使用；沒有實體手機。Chrome user-agent 顯示 HeadlessChrome 157；未把 user-agent 內的 OS 字串當作實際 OS 版本。
- 方法：Chrome DevTools Protocol（CDP）viewport override、media preference emulation 及合成鍵盤事件；不等同實體手機或桌面 GUI 人工操作。`mobile=false`，未啟用觸控。
- Viewport：320×800、375×812、390×844、768×1024、844×390（短橫向）、640×400。最後一項以 1280×800 的一半 CSS 尺寸作為 200% 縮放等效視窗；不是瀏覽器 UI 的原生 200% 縮放。
- 證據：本機 Chrome 的 DOM／viewport 幾何、狀態與 scheduler 回報；本任務未保存截圖。

### 響應式、面板與避讓（自動化瀏覽器）

| 情境 | 實際結果 | 結果 |
| --- | --- | --- |
| 320×800、375×812、390×844、768×1024、844×390、640×400 CSS viewport 的角色邊界 | 角色 hitbox 留在 viewport 內；安全避讓生效時會收起角色 | PASS |
| 同上六種尺寸的文件水平溢出 | `scrollWidth` 未超過 `clientWidth` | PASS |
| 對話框靠左及靠右開啟 | 兩側 clamp 後矩形均完整落在 viewport 內；包含 640×400 | PASS（修正後） |
| 短視窗對話內容 | 844×390：面板高 276px、內容高 347px，`overflow-y:auto`；640×400：面板高 292px、內容高 347px，可捲動 | PASS |
| Contact 欄位、作品卡與 Footer 召回附近的遮擋 | 各 viewport 比對可見元素與角色 hitbox；作品卡／表單進入活動帶時避讓或收起，未見相交。另在 844×390 先開對話再捲至作品卡、在 390×844 先開對話再聚焦 Contact，對話均關閉並設 `aria-hidden=true`。Footer 入口未被角色遮住 | PASS（DOM 幾何檢查） |
| 200% 瀏覽器縮放 | 640×400 CSS viewport 等效尺寸通過上述幾何檢查 | PASS（等效 viewport 模擬）；原生瀏覽器縮放 UI 未測 |

### 鍵盤與焦點（CDP 瀏覽器事件）

| 情境 | 實際結果 | 結果 |
| --- | --- | --- |
| Tab 導覽至對話控制項；Shift+Tab 返回角色 | 對話開啟後 Tab 到第一個「作品」按鈕，Shift+Tab 回到角色 | PASS |
| Escape | 對話開啟後送出 Escape keydown；回 Idle 並將焦點返回角色 | PASS |
| Debug 後焦點 | 從 Debug 控制項執行 handler；Hidden 完成後焦點在 pet-guide 外，沒有留在隱藏內容 | PASS（DOM handler 測試） |
| 07B 暫時避讓時 Tab 焦點 | Contact 欄位取得焦點期間角色設為 `tabindex=-1` 並避讓隱藏；Tab 序列未把焦點送到不可見角色 | PASS |
| Footer 召回與焦點交接（角色可見） | 以 DOM `.click()` 觸發 Footer 按鈕，回 Idle 並聚焦可見角色；未模擬真實 Enter／Space 按鈕啟動 | PASS（DOM handler 測試） |
| Enter／Space 開啟角色及 Enter／Space 召回 | Headless CDP keydown 未產生原生按鈕啟動 click；需真實鍵盤人工覆核 | NOT TESTED |
| focus-visible 是否清楚可辨 | 本輪未作桌面 GUI 視覺檢查；CSS 規則存在不作為視覺通過證據 | NOT TESTED（人工視覺） |

Tab 序列在表單欄位聚焦時略過避讓隱藏的角色，符合不可聚焦隱藏角色的要求；對話內相鄰順序則另以上表確認。合成 Escape keydown 是瀏覽器事件測試，不是使用者實體鍵盤驗收。

### Reduced Motion（自動化瀏覽器）

| 情境 | 實際結果 | 結果 |
| --- | --- | --- |
| 初次載入即啟用減少動態 | 角色維持 Idle、使用 `pet.png` 靜態圖，沒有 Walking 排程 | PASS |
| 正在 Walking 時切換為減少動態 | 轉 Idle、換靜態圖，scheduler `targetState=null`、timer 為 null | PASS |
| Walking 中啟動 Debug，接著切換減少動態 | 轉 Hidden；`transitionBusy=false`，沒有殘留 scheduler | PASS |
| 減少動態下 Footer 召回 | 回 Idle、使用靜態圖，無 scheduler timer 或 pet movement rAF | PASS（DOM handler 測試） |
| 對話及作品導覽控制可用性 | 減少動態下可開啟對話，三個導覽按鈕仍顯示；未逐一啟動導覽目標 | PASS（顯示／DOM）；目標導覽人工操作 NOT TESTED |
| 重複排程／rAF | 監測角色 `movementStep` rAF：正常走動最多 1 個；減少動態及 10 次快速狀態往返後為 0；Reduced Motion 下 scheduler 為 null | PASS（瀏覽器狀態監測） |

### 裝置與主題

| 情境 | 實際結果 | 結果 |
| --- | --- | --- |
| 實體手機觸控 | 沒有實體裝置可測；本次 CDP 未啟用 touch | NOT TESTED |
| 手機軟鍵盤與安全區域 | 沒有實體手機或作業系統鍵盤／safe-area 測試 | NOT TESTED |
| Light／Dark 元件顏色 | CDP 下切換 `data-theme`，檢查對話背景／文字及 Footer 文字色等 computed values；受測色值隨主題改變 | PASS（computed-style 檢查） |
| 角色、亂碼入口與 focus-visible 的實際可辨識性 | 未在 GUI 或實體顯示器作視覺檢查；computed style 不代表人工對比驗收 | NOT TESTED（人工視覺） |

### 缺陷與修正

1. **作品卡避讓區間排序錯誤**：844×390 捲至作品卡時，角色 x=181–245 與卡片 x=32–402.5 相交，卻仍顯示。原因為禁止區間排序使用 `a.start - b.end`。修正為依 `start` 排序；修正後相同場景安全區為空，角色暫時隱藏且停止活動，連續重算仍不重疊。
2. **短句更新後面板未重新 clamp**：在 640×400 CSS viewport 靠右開啟對話，固定短句「想看看我的主人做過的遊戲嗎？」令面板右緣到 x=726，超出 viewport。原因為面板先以空短句量寬，文字插入後沒有再 clamp。修正為短句更新後、面板顯示前再次量測定位；相同場景右緣為 x=613，完整位於 640px viewport 內。

兩項均可在修正前重現，屬 PR2 的避讓／面板定位且在 09B 範圍內；只改動 `js/pet.js` 的排序鍵及顯示前重新 clamp。修正後已測的 viewport、避讓、焦點及 Reduced Motion 情境重跑通過；下列 NOT TESTED 項目仍待人工確認。

### 尚需使用者親自確認

- 以真實鍵盤 Enter／Space 開啟角色、Space 與 Enter 召回，以及實際 focus-visible 視覺辨識。
- 真實手機觸控、軟鍵盤、safe-area 與對話框操作；本次沒有裝置模擬冒充實機結果。
- 瀏覽器 UI 原生 200% 縮放；本次只有 640×400 CSS viewport 等效模擬。
- Light／Dark 實際顯示器下角色、對話框、亂碼 Footer 入口和焦點樣式的可辨識性。
- 對話作品／關於／聯絡三個目標在 Reduced Motion 下逐一實際導覽；本次僅確認按鈕仍顯示可用。
- 09A 八項桌面人工 PASS 的瀏覽器版本、viewport、測試日期與截圖若需納入正式證據，仍需使用者補充；目前保留為「使用者回報」。
