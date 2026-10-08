# Pet Guide MVP — 紫色小球導覽寵物

## 目標
在作品集首頁加入簡單的互動式導覽寵物。本階段不加入 AI、自由文字輸入或走動動畫；先以紫色圓球作為 placeholder，驗證互動、導覽、RWD 與無障礙。

## ⚠️ 給本地端 AI：執行管制（優先於下方全部規格）

> **此文件是完整產品規格，不是「一次完成全部」的授權。**
>
> **每次對話只允許執行一個明確指定的 Task ID（PET-01 至 PET-05）。**
> 若使用者沒有指定 Task ID，僅列出待辦狀態並詢問要從哪個任務開始；**不可自行開始開發**。
> 即使本次任務完成得很快，也**絕對不可自動執行下一個 Task**。後續階段需使用者新訊息明確授權。

### 配額節省與停止規則
1. **只讀必要檔案：** 優先讀本文件、任務列出的目標檔案與相關小範圍程式碼，不要反覆掃描整個 repo 或每一頁。
2. **只改任務範圍：** 不做順手重構、不升級套件、不擴充 UI、不處理與本 Task 無關的問題；有問題記錄為 Known Issues。
3. **小範圍驗證：** 僅跑本 Task 列出的必要檢查。完整跨裝置回歸測試保留給 PET-05。
4. **有限次自我修正：** 同一錯誤最多自行嘗試兩輪修正；仍無法解決時停止並向使用者提供錯誤訊息和最小復現資訊。
5. **禁止自動串關：** 不要在完成 PET-01 時就規劃並執行 PET-02；也不要在 PET-05 完成後擴充 Pet Movement 或 AI。
6. **完成就停止：** 每個 Task 以一個小 commit 為目標（若本地環境沒有提交權限，僅回報 diff 與待提交檔案），回報後等待下一次指示。**不要自行 merge PR。**
7. **若遇不可預期的大幅更動：** 超出該 Task 檔案或範圍時，先停下來詢問，而不是繼續嘗試。

### 本地端 AI 回報格式（每個 Task 都要）
- Task ID：PET-0X
- Status：DONE / BLOCKED / NEEDS_REVIEW
- Modified Files：變動檔案
- Summary：完成內容（最多 5 句）
- Checks：執行過的測試／未測項目，務必區分
- Commit：短 SHA（若已提交），否則填 Not committed
- Known Issues：未解決風險
- Next Task：只填下一個 Task ID；**不得自行執行**

---

## MVP 使用流程
1. 使用者進入首頁，右下角顯示紫色圓球。
2. 點擊紫色圓球，展開對話泡泡：「你好！想看看什麼呢？」
3. 顯示三個按鈕：作品 / 關於 / 聯絡。
4. 導覽目標沿用現有首頁 ID：
   - 作品 → `#works-area`
   - 關於 → `#profile-area`
   - 聯絡 → `#contact-area`
5. 使用 `scrollIntoView({ behavior: "smooth" })` 平滑捲動。
6. 選擇後關閉泡泡；再次點擊寵物可重新開啟。

## 現有網站整合原則
- 沿用目前 `index.html` 的 `#works-area`、`#profile-area`、`#contact-area`。
- `js/home.js` 已有 navbar smooth-scroll 邏輯，不引入新的 scroll library。
- 首頁已有 Matter.js 功能；Pet Guide 不得耦合 Matter.js world。
- Dark Mode 沿用現有 CSS variables / `data-theme="dark"`。
- 不修改既有主要 layout flow。

## 預計修改檔案
### `index.html`
新增 Pet Guide DOM，建議放在 footer 前或 `</body>` 前。

建議結構：

```html
<div class="pet-guide">
  <div class="pet-dialog" id="pet-dialog">
    <p>你好！想看看什麼呢？</p>
    <div class="pet-options">
      <button data-target="works-area">作品</button>
      <button data-target="profile-area">關於</button>
      <button data-target="contact-area">聯絡</button>
    </div>
  </div>

  <button
    class="pet"
    id="pet"
    aria-label="開啟網站導覽"
    aria-expanded="false">
  </button>
</div>
```

### `css/style.css`
新增獨立 `Pet Guide` 樣式區塊，不把規則散落到既有 card/button 規則。

#### `.pet-guide`
- `position: fixed`
- 右下角
- 建議 `right/bottom: clamp(16px, 3vw, 32px)`
- z-index 高於目前 navbar，但避免無限制提高層級。

#### 紫色球 `.pet`
- Desktop：約 64px
- Mobile：約 52px
- `border-radius: 50%`
- 紫色 placeholder，例如 `#7c4dff`
- 可有非常輕微 hover scale
- 本階段禁止持續 bounce / float / rotate 動畫。

#### `.pet-dialog`
- 位於球體上方、右側對齊。
- Desktop 約 250–300px。
- Mobile 寬度不得超出 viewport。
- 預設 hidden；用 `.is-open` 控制 `opacity / visibility / pointer-events`。
- 背景、文字、邊框優先使用現有 semantic CSS variables，以支援 Dark Mode。

## JavaScript
第一版避免 Class、Manager、State Machine。可直接加入 `home.js`；若實作明顯膨脹，再拆 `js/pet.js`。

### Toggle
點擊 `#pet` 切換 `#pet-dialog.is-open`，同步更新 `aria-expanded`。

### Navigation
用 `data-target` 統一處理三個按鈕，不寫三份重複 listener：

```js
document.querySelectorAll('.pet-options button').forEach(option => {
  option.addEventListener('click', () => {
    const target = document.getElementById(option.dataset.target);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth' });
  });
});
```

導覽後關閉 dialog 並把 `aria-expanded` 設回 `false`。

### 點擊外部關閉
建議實作，但優先級低於核心功能。注意不要讓 pet click 同時觸發 outside close。

## Mobile
- 以目前網站 breakpoint 為優先，不任意增加大量 breakpoint。
- 小球縮至約 52px。
- Dialog 不得溢出 viewport。
- 第一版 Mobile 不加入任何移動動畫。
- 確認不遮擋 Contact、Back to top、Footer、Navbar 等操作。

## Accessibility
- Pet 必須使用 `<button>`，不能用 `<div onclick>`。
- 加入 `aria-label="開啟網站導覽"` 與 `aria-expanded`。
- 三個導覽選項使用 `<button>`。
- Tab 鍵必須可操作。
- Focus state 不可被完全移除。

## Performance
本階段禁止：
- Matter.js 控制寵物
- Canvas / WebGL
- requestAnimationFrame movement
- setInterval movement
- GIF / Sprite Sheet
- AI API
- 額外動畫 library

Placeholder 只使用 DOM + CSS + 少量事件監聽，不應造成可感知的效能負擔。

## Scope — 本 PR 不做
- AI chat
- 自由文字輸入
- 自動回答
- 寵物走路 / 隨機移動
- Sprite animation
- 寵物碰撞
- 語音
- localStorage 對話紀錄
- 多段對話樹
- API

## 分階段執行任務（一次只准做一個 Task）

任務必須依序完成；本文件其他程式碼區塊是**最終預期結構的參考**，不可解讀為同一次任務需全部實作。每階段的 Done Criteria 只驗收當前任務，不要求提前完成其他階段。

### PET-01 — 固定紫色球（最小可見成果）
**允許修改：** `index.html`、`css/style.css`。

- [ ] 在首頁加入 `.pet-guide` 容器和紫色球 placeholder。
- [ ] 用 CSS 固定在右下角；桌面約 64px；手機約 52px。
- [ ] 保留球體未來會成為 `button` 的語意；本 Task 尚未接上互動時，可暫設 `disabled`，避免可點卻無回應。
- [ ] 不更動 Matter.js、不調整原版面、不新增外部套件。

**本 Task 驗收：** 在桌面與 375px 手機寬度確認球可見、頁面沒有因此橫向溢出、球未遮住主要導覽；只需要局部視覺檢查。

**STOP：** commit / 回報 / 等待授權 PET-02。

### PET-02 — 點擊顯示與關閉問候泡泡
**允許修改：** `index.html`、`css/style.css`、`js/home.js`（或只在有明確理由時新增 `js/pet.js`）。

- [ ] 加入對話框，文字固定為「你好！想看看什麼呢？」
- [ ] 對話框預設隱藏，點紫色球可以開啟、再次點擊可以關閉。
- [ ] 將 PET-01 的暫時 disabled 狀態改為可操作。
- [ ] 同步 `aria-expanded`，避免隱藏內容被鍵盤聚焦。
- [ ] 此階段**不要加入**作品／關於／聯絡按鈕，也不實作外部點擊關閉。

**本 Task 驗收：** 點擊開／關各一次，確認 Console 無新增錯誤。

**STOP：** commit / 回報 / 等待授權 PET-03。

### PET-03 — 三個導覽按鈕
**允許修改：** `index.html` 與 PET-02 所用的 JS；僅在必要時微調 Pet Guide CSS。

- [ ] 新增「作品／關於／聯絡」三個 button。
- [ ] 用 `data-target` 對應 `works-area`、`profile-area`、`contact-area`。
- [ ] 點擊後平滑捲動至對應 section，並關閉泡泡、同步 `aria-expanded=false`。
- [ ] 不改寫既有 navbar 導覽或 Matter.js 行為。

**本 Task 驗收：** 三個按鈕各按一次，落點正確、點選後泡泡消失。

**STOP：** commit / 回報 / 等待授權 PET-04。

### PET-04 — RWD、Dark Mode 與基本無障礙
**允許修改：** Pet Guide 相關 HTML/CSS/JS，不藉此重構全站。

- [ ] 手機 320px、375px 與桌面 1280px 不超出視窗。
- [ ] 深色／淺色模式下泡泡與按鈕文字可讀。
- [ ] 鍵盤 Tab／Enter／Space 可操作球與三個選項；聚焦狀態可見。
- [ ] 檢查顯示／隱藏時焦點不會困在不可見的選項中。
- [ ] 確認固定球不遮擋 Contact 表單送出鈕與回頂端操作；如有衝突，只微調 Pet Guide 定位。
- [ ] `prefers-reduced-motion` 下避免不必要的動態效果；不要擴充走動動畫。

**本 Task 驗收：** 上述三個寬度與兩種主題的局部檢查，基本鍵盤操作；不能完成的設備檢查標為未測，不宣稱已通過。

**STOP：** commit / 回報 / 等待授權 PET-05。

### PET-05 — 小範圍整合與回歸驗收
**允許修改：** 僅修正 PET-01 至 PET-04 引入的缺陷。

- [ ] 依本文件「驗收條件」逐項檢查。
- [ ] 抽查 Navbar、作品列表、Profile、Contact、Back to top、Matter.js 拉繩切換主題。
- [ ] 實測桌面／手機尺寸、Light/Dark、三個跳轉、Keyboard、Console。
- [ ] 提交完成報告：已測 / 未測 / 失敗 / Known Issues，不要把未測寫成 Passed。
- [ ] 不導入新的產品功能，不自行 merge。

**本 Task 驗收：** 回報結果與需要修正的清單。若需要跨任務重做，先停止請求人工判斷。

**STOP：** 回報，等待使用者決定是否結束 PR 或另開下一階段。

### 交給本地端 AI 的首輪指令

```text
請閱讀 docs/pet-guide-mvp.md，嚴格遵守「執行管制」。
本次只執行 PET-01，禁止實作 PET-02～PET-05。
只讀必要檔案，不做其他重構與功能擴充。
僅完成 PET-01 的驗收，最多自行修正兩輪。
完成後 commit 並依格式回報，立即停止；等我下次明確下達 PET-02。
```

## 驗收條件
- [ ] 首頁右下角有紫色圓球
- [ ] 不影響原網站 Layout Flow
- [ ] 點球可開啟 / 關閉 Dialog
- [ ] 顯示「你好！想看看什麼呢？」
- [ ] 有「作品 / 關於 / 聯絡」三個選項
- [ ] 正確導覽到 `#works-area / #profile-area / #contact-area`
- [ ] 使用 smooth scroll
- [ ] 選擇後 dialog 關閉
- [ ] Light / Dark Mode 正常
- [ ] Desktop / Tablet / Mobile 正常
- [ ] Keyboard / Tab 可操作
- [ ] 無新增 Console Error
- [ ] 原 Navbar navigation 正常
- [ ] 原 Matter.js theme rope 正常
- [ ] Contact form 不受影響

## 實作者完成後回報格式
### Modified Files
列出修改檔案。

### Implementation
簡述實際採用方式。

### Deviations
若與規格不同，說明原因。

### Test Result
至少回報 Desktop、Mobile、Light、Dark、三個 navigation target、Console。

### Known Issues
若沒有，填 `None`。

## 下一階段（不屬於本 PR）
Pet Movement v2：
- Idle
- 左右走動
- viewport 邊界限制
- 對話時停止
- Mobile disable movement
- `prefers-reduced-motion`
