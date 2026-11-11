# PR2-PET-09A｜桌面與狀態回歸驗收

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

## 建議

本輪 headless Chrome 狀態及 Storage 測試通過，但桌面人工互動、定位幾何、避讓對象、原站功能操作與外觀仍有多項 NOT TESTED。建議先完成上方人工清單，再決定是否進入 PR2-PET-09B；本文件不代表 09A 全面驗收通過。
