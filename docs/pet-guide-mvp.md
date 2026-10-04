# Pet Guide MVP — 紫色小球導覽寵物

## 目標
在作品集首頁加入簡單的互動式導覽寵物。本階段不加入 AI、自由文字輸入或走動動畫；先以紫色圓球作為 placeholder，驗證互動、導覽、RWD 與無障礙。

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

## 實作順序
1. 紫色球 fixed 定位，確認 RWD / z-index。
2. Dialog open / close。
3. 三個 navigation option。
4. Mobile / Dark Mode / Accessibility。
5. Regression test 現有 navbar、works、profile、contact、back-to-top、Matter.js theme toggle。

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
