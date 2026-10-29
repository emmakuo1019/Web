# PR2-PET-07B 實作規劃書：對話框邊界定位、短螢幕適配與重要互動區域避讓（Revision 01）

- **Task ID**: PR2-PET-07B
- **相關 PR**: PR #2 (`emmakuo1019/Web#2`，分支 `plan/pr2-bug-pet`)
- **文件狀態**: 實作完成，等待代碼審查（Implementation Completed — AWAITING CODE REVIEW）
- **撰寫日期**: 2026-10-29
- **審查基準 Commit**: `3aa5a3324f9b2cb861e978be80a763b41ed3478d`
- **前置任務**: PR2-PET-07A（角色對話、關閉互動與焦點管理）— 人工驗收已通過（Commit `9c50b1a`）

---

## 1. 現況分析（Current State）

### 1.1 現有定位架構分析（CSS 與 DOM）
1. **容器層級與定位基線**：
   - 容器 `.pet-guide` 位於 `index.html` 尾端（主內容 `main` 之後、`.back-to-top-wrapper` 之前），CSS 設定為：
     ```css
     .pet-guide {
       position: fixed;
       left: 0;
       bottom: clamp(16px, 3vw, 32px);
       z-index: 1000;
       will-change: transform;
     }
     ```
   - 角色本體為 `.pet`（原生按鈕），寬高桌面 `64px × 64px`，手機（`<= 500px`）`48px × 48px`。
   - 水平位移完全由 JavaScript 單一 `rAF` 迴圈計算 `posX` 並寫入 `.pet-guide.style.transform = "translateX(${posX}px)"`。
   - 關鍵座標特性：`.pet-guide` 的 CSS 定位為 `position: fixed; left: 0`，因此其定位基準是 **Layout Viewport**（當無縮放時與螢幕重合）。`posX` 代表角色相對於 Layout Viewport 左邊界（`X = 0`）的像素位移。

2. **對話框定位現況**：
   - `.pet-dialog` 位於 `.pet-guide` 容器內，作為 `.pet` 的同層後續元素：
     ```css
     .pet-dialog {
       position: absolute;
       bottom: calc(100% + 10px);
       right: 0;
       width: max-content;
       min-width: 160px;
       max-width: calc(100vw - clamp(16px, 3vw, 32px) * 2);
       /* ... */
     }
     ```
   - **現有機制的問題盤點**：
     - `right: 0` 表示對話框的右邊緣與角色右緣對齊，整體往角色的左側展開。
     - 當角色移動到螢幕最左側（`posX = minX = 12px`）並打開對話框時，對話框寬度通常為 `160px ~ 240px`，對話框會大幅溢出螢幕左側（`left < 0`），造成文字或關閉按鈕被裁切無法操作。
     - 當角色移動到螢幕最右側時，若對話框改靠左展或在大安全邊距下，又可能溢出右側。
     - **垂直方向無高度限制與捲動防護**：對話框總高可達 `260px ~ 300px`。在橫向手機（視窗高約 320px ~ 400px）或短視窗中，對話框頂部直接衝出視窗上方（`top < 0`），使短句與頂部選項消失。

### 1.2 現有 Safe Area 與邊界量測現況
1. **JavaScript 現狀（`js/pet.js`）**：
   ```javascript
   function updateBoundaries() {
       const viewportWidth = window.innerWidth;
       const petWidth = petBtn.offsetWidth || 64;
       let safeLeft = 0;
       let safeRight = 0;
       try {
           const computed = getComputedStyle(document.documentElement);
           safeLeft = parseFloat(computed.getPropertyValue('--safe-area-inset-left')) || 0;
           safeRight = parseFloat(computed.getPropertyValue('--safe-area-inset-right')) || 0;
       } catch (e) {
           safeLeft = 0;
           safeRight = 0;
       }
       minX = PET_CONFIG.BOUNDARY_PADDING + safeLeft;
       maxX = Math.max(minX, viewportWidth - petWidth - PET_CONFIG.BOUNDARY_PADDING - safeRight);
       clampPosition();
   }
   ```
2. **存在缺陷**：
   - 讀取的 CSS 變數 `--safe-area-inset-left` 與 `--safe-area-inset-right` 在 `css/style.css` 中**完全未宣告**，導致 `safeLeft` 與 `safeRight` 恆為 0。
   - `index.html` 的 viewport meta 標籤為 `<meta name="viewport" content="width=device-width,initial-scale=1.0"/>`，**未設定 `viewport-fit=cover`**。在具備瀏海或圓角螢幕的手機上，瀏覽器不會將網頁畫布擴展至整個螢幕，且 `env(safe-area-inset-*)` 會回傳 0。
   - 僅依賴 `window.innerWidth`，未考量使用者雙指縮放或軟鍵盤展開時的 Visual Viewport 偏移（`offsetLeft`、`offsetTop`、`scale`）。

### 1.3 重要互動區域現況盤點
盤點實際首頁所有可見互動元素：
1. **頂部導覽列（`.nav`）**：
   - `position: fixed; top: 0; left: 0; right: 0; height: var(--nav-height) (64px); z-index: 100;`。
   - 垂直方向在極短視窗（高度 < 180px）時與底部角色活動帶相交。
2. **表單區域（`#myForm` 及其輸入項）**：
   - 包含 `#contact-name`、`#contact-company`、`#contact-email`、`#contact-info`（textarea）、`#send`（送出按鈕）。
   - 捲動至聯絡區時，角色若在底部走動會遮擋正在點選的 input、textarea 或按鈕；行動端軟鍵盤彈起時，若不收起角色會嚴重干擾輸入。
3. **回到頁首按鈕（`.back`、`.back2`）**：
   - 位於 `.back-to-top-wrapper`，在 `index.html` 第 125–128 行，非 fixed。捲動至底部時進入視窗底部活動帶。
4. **頁尾連結（`.footer` 內連結）**：
   - 包含 Instagram、Facebook 外連連結，以及未來 08B 的召回按鈕。捲動至底部時進入活動帶。
5. **作品區（`#projects .card-link`）**：
   - 由 `js/list.js` 動態渲染生成卡片，每張卡片皆為 `<a class="card-link">`，使用者捲動閱讀時會穿過底部活動帶。

---

## 2. 任務範圍（Scope / Out of Scope）

### 2.1 實作範圍（In Scope for 07B）
1. **統一 Viewport 座標系統**：
   - 建立 Layout Viewport 與 Visual Viewport 之間清晰一致的座標轉換公式。
   - 處理 `visualViewport.offsetLeft`、`offsetTop`、雙指縮放、手機橫置與軟鍵盤展開。
2. **對話框水平 Clamp 與真實高度限制**：
   - 透過以角色中心對齊並結合 CSS 變數 `--dialog-shift-x` 限制對話框兩側邊距 $\ge 12\text{px}$（含 safe area）。
   - 以真實可用高度（`availableHeight`）限制面板；當高度不足時啟用內部捲動；極端空間不足（$< 120\text{px}$）時採用安全降級處理。
3. **安全區間避讓系統（Avoidance System）**：
   - 全域統一安全區間最小寬度標準（`MIN_SAFE_WIDTH = 96px`）。
   - 偵測到角色座標突然落入禁止區間時，執行「先暫時收起 $\to$ 重新定位 $\to$ 安全恢復」流程，嚴禁穿越障礙。
   - 引入捲動磁滯防抖（Scroll Hysteresis Debounce），防止快速捲動邊界震盪。
   - 暫時收起期間保留節流後的幾何量測，保證空間恢復時角色能可靠喚醒。
4. **焦點與點擊安全防護**：
   - 暫時收起時，容器與對話框均設為 `pointer-events: none` 與 `tabindex = -1`（或 `inert`），嚴禁攔截點擊與鍵盤焦點。
   - 表單聚焦收起時絕不移焦；若焦點原本在 Pet 控制項內遇到強制避讓，安全歸位至主文內容或目的地，不丟失焦點。
   - 嚴格隔離暫時收起與 08A Debug Hidden（不存 storage、自動恢復）。
5. **DOM 量測與動態生成適配**：
   - 不修改 `js/list.js`，在 `js/pet.js` 中使用 `MutationObserver` 監聽 `#projects` 子節點插入，卡片載入完成後自動觸發單次邊界重新計算。
   - 避免逐影格量測，維持單一 rAF 迴圈純粹性。

### 2.2 明確排除事項（Out of Scope）
- **禁止實作 08A Debug 與持久隱藏**：不新增 Debug 按鈕，不讀寫 `sessionStorage`（`emma.pet.hidden.v1`）。
- **禁止實作 08B Footer 召回按鈕**：不修改 Footer HTML，不實作召回入口。
- **禁止引入物理碰撞引擎**：不使用 Matter.js 或外部物理函式庫。
- **禁止修改素材**：不修改 `picture/pet/` 下的圖片。
- **禁止修改 `js/list.js` 或其他頁面業務邏輯**。

---

## 3. 統一 Viewport 座標系統（Coordinate System）

### 3.1 雙重 Viewport 定義與幾何關係
在行動端瀏覽器中，存在兩個 Viewport：
1. **Layout Viewport（布局視窗）**：
   - CSS `position: fixed` 元素的定位容器。
   - 其原點 $(0, 0)$ 為初始包含塊（Initial Containing Block）左上角。
   - 寬高分別為 `document.documentElement.clientWidth` 與 `clientHeight`（或無縮放時的 `window.innerWidth / innerHeight`）。
2. **Visual Viewport（視覺可視視窗）**：
   - 使用者在螢幕上實際看見的矩形窗口。
   - 當頁面放大（Pinch-to-zoom）或軟鍵盤展開時，Visual Viewport 縮小，並相對於 Layout Viewport 產生平移位移：
     - 水平偏移：`window.visualViewport.offsetLeft`（簡稱 $V_{x}$）
     - 垂直偏移：`window.visualViewport.offsetTop`（簡稱 $V_{y}$）
     - 可視寬高：`window.visualViewport.width`（$V_{w}$）與 `window.visualViewport.height`（$V_{h}$）
     - 縮放比例：`window.visualViewport.scale`（$S$）

```
+--------------------------------------------------------------------+  <- Layout Viewport
| (0, 0)                                                             |
|         +--------------------------------------------------+       |  <- Visual Viewport
|         | (Vx, Vy)                                         |       |     offsetLeft / offsetTop
|         |                                                  |       |
|         |              可視內容區域                         |       |
|         |                                                  |       |
|         | [Pet Dialog] (Clamp 於 Visual Viewport)          |       |
|         | [Pet] (活動帶以 Visual Viewport 底部為基準)       |       |
|         +--------------------------------------------------+       |
|                                                                    |
| [軟鍵盤或縮放不可見區域]                                            |
+--------------------------------------------------------------------+
```

### 3.2 座標轉換統一公式
因為 `.pet-guide` 是 `position: fixed; left: 0`，其 `transform: translateX(posX)` 中的 `posX` 是相對於 **Layout Viewport** 的水平像素。
而使用者的可視區域、雙指縮放中心以及 `getBoundingClientRect()` 回傳的數值，是相對於 **Visual Viewport**（現代瀏覽器）或 Layout Viewport。

#### 定理與轉換公式：
1. **元素視窗矩形**：
   對於任意 DOM 元素 `el`，`el.getBoundingClientRect()` 回傳的 `rect.left`、`rect.right`、`rect.top`、`rect.bottom` 是相對於 **Layout Viewport 的目前捲動位置**。
   若要轉換為 **Visual Viewport 內的可視座標**：
   $$\text{visualLeft} = \text{rect.left} - V_{x}$$
   $$\text{visualTop} = \text{rect.top} - V_{y}$$
   $$\text{visualRight} = \text{visualLeft} + \text{rect.width}$$
   $$\text{visualBottom} = \text{visualTop} + \text{rect.height}$$
   *(註：當未縮放且無平移時，$V_{x} = 0, V_{y} = 0$，二者等價)*

2. **角色水平活動極限（在 Layout Viewport 座標系下）**：
   設安全距離邊距為 `BOUNDARY_PADDING = 12px`，左右 Safe Area 分別為 $S_{L}, S_{R}$：
   - 角色在 Visual Viewport 中的可見左極限為 $S_{L} + 12$。
   - 換算至 Layout Viewport 的角色 `posX` 邊界：
     $$\min X = V_{x} + S_{L} + 12$$
     $$\max X = V_{x} + V_{w} - \text{petWidth} - S_{R} - 12$$

3. **底部活動帶（Pet Active Band）垂直交集判定**：
   設角色固定底部間距為 $B_{\text{offset}}$（包含 safe-area-bottom），角色高度為 $\text{petHeight}$：
   - 角色活動帶在 Visual Viewport 中的垂直範圍為：
     $$\text{bandTop} = V_{h} - (B_{\text{offset}} + \text{petHeight} + 8)$$
     $$\text{bandBottom} = V_{h}$$
   - 若元素在 Visual Viewport 垂直座標滿足：
     $$\text{visualBottom} > \text{bandTop} \quad\land\quad \text{visualTop} < \text{bandBottom}$$
     則判定該元素與底部活動帶**垂直相交**。

### 3.3 `viewport-fit=cover` 影響評估與決策
- **評估**：
  若在 `index.html` 將 `<meta name="viewport" content="width=device-width,initial-scale=1.0"/>` 改為包含 `viewport-fit=cover`：
  - **優點**：iOS Safari 能正確填滿瀏海與 Home Indicator 區域，使 `env(safe-area-inset-*)` 能夠讀取到實體安全邊距（如 iPhone 的 47px 頂部與 34px 底部）。
  - **潛在全站影響**：若全站外層沒有宣告 `padding: env(safe-area-inset-*)`，頁首文字、Header 與 Footer 可能過於貼合螢幕圓角。但盤點現有 `css/style.css`，主要容器均有 `--gutter: clamp(16px, 4vw, 32px)`，天然具備充足的左右內距。
- **決策**：
  在 07B 規劃中，CSS 宣告：
  ```css
  :root {
    --safe-area-left: env(safe-area-inset-left, 0px);
    --safe-area-right: env(safe-area-inset-right, 0px);
    --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  }
  ```
  並建議在 `index.html` 補上 `viewport-fit=cover`，同時角色容器底部套用：
  `bottom: calc(clamp(16px, 3vw, 32px) + var(--safe-area-bottom));`。

---

## 4. 對話框邊界定位與真實可用高度策略（Panel Positioning & Clamp）

### 4.1 水平邊界 Clamp 演算法（無畫面跳動保證）
對話框是以角色按鈕為定位基準展開的。
設：
- 角色在 Layout Viewport 的目前座標為 `posX`
- 角色在 Visual Viewport 中的目前座標為 $\text{petVisualX} = \text{posX} - V_{x}$
- 角色寬度為 $\text{petWidth}$（桌面 64px / 手機 48px）
- 對話框渲染寬度為 $\text{dialogWidth}$（`petDialog.offsetWidth`）

#### 計算公式：
1. **理想中心對齊位置（相對於 Visual Viewport）**：
   $$\text{desiredVisualLeft} = \text{petVisualX} + \frac{\text{petWidth}}{2} - \frac{\text{dialogWidth}}{2}$$
2. **Visual Viewport 內的安全 Clamp 區間**：
   $$\text{clampedVisualLeft} = \max\left(S_{L} + 12, \;\min\left(\text{desiredVisualLeft}, \;V_{w} - S_{R} - 12 - \text{dialogWidth}\right)\right)$$
3. **換算回角色容器內的 CSS 水平偏移量（`--dialog-shift-x`）**：
   因為對話框預設靠角色左側或居中（設 CSS 預設 `left: 0`），對話框相對於角色左緣的偏移量為：
   $$\Delta X = \text{clampedVisualLeft} - \text{petVisualX}$$
4. **寫入樣式**：
   `petDialog.style.setProperty('--dialog-shift-x', `${Math.round(Delta X)}px`);`
   搭配 CSS：
   `transform: translate(var(--dialog-shift-x, 0px), var(--dialog-anim-y, 0px));`
   *（動畫只變動 `--dialog-anim-y`，徹底分離座標 Clamp 與展開過渡，保證平滑不跳動）*

### 4.2 真實可用高度限制與極端短螢幕處理
在橫向手機或極矮視窗中，不能採用寫死的最小值限制。

#### 真實可用垂直高度公式：
$$\text{availableHeight} = V_{h} - (\text{bottomInset} + \text{petHeight} + \text{dialogGap} (10\text{px}) + \text{topSafeMargin} (12\text{px}))$$
其中：
- $\text{bottomInset} = \text{clamp}(16\text{px}, 3\text{vw}, 32\text{px}) + \text{safeBottom}$
- $\text{topSafeMargin} = 12\text{px} + \text{safeTop}$

#### 具體分級策略：
1. **正常與輕度短視窗（$\text{availableHeight} \ge 160\text{px}$）**：
   - 設定 `petDialog.style.maxHeight = `${availableHeight}px``。
   - 對話框啟用 `overflow-y: auto; display: flex; flex-direction: column;`。
   - 所有子項均可透過內部滑動完整操作，關閉按鈕與導覽按鈕皆可點擊。
2. **極端短視窗（$120\text{px} \le \text{availableHeight} < 160\text{px}$）**：
   - 面板內部緊湊化：自動為 `.pet-dialog` 加上 `.is-compact` class。
   - 縮小 padding（12px $\to$ 6px）與按鈕上下間距，短句限制單行顯示或暫時折疊，確保核心導覽與關閉按鈕出現在可見捲動區中。
3. **超極端不可用空間（$\text{availableHeight} < 120\text{px}$）**：
   - 此時垂直空間甚至小於兩個按鈕的高度，任何彈出面板都會徹底遮蔽螢幕內容。
   - **安全處理方式**：
     - **禁止開啟對話框**：點擊角色時角色僅播放一次逗趣搖晃動畫（或 Happy 表情切換 1 秒後自動恢復），不展開對話框。
     - 若對話框已開啟時視窗被壓扁至 $< 120\text{px}$，**自動安靜關閉對話框**，焦點平滑退回角色按鈕，並在主內容保持操作流暢。
     - **嚴禁宣稱高度不足時仍能無條件完整顯示面板**。

---

## 5. 安全區間避讓系統與角色行為契約（Avoidance Design）

### 5.1 安全區間最小寬度標準（MIN_SAFE_WIDTH）
全文件統一定義：
$$\text{MIN\_SAFE\_WIDTH} = 96\text{px}$$
- **推導標準**：桌面角色寬 64px + 左右各 16px 緩衝 = 96px；手機角色寬 48px + 左右各 24px 緩衝 = 96px。
- 任何寬度 $< 96\text{px}$ 的區間，一律判定為「無法安全巡邏之破碎狹窄空間」，直接視為無效空間。

### 5.2 禁止區間（Excluded Intervals）精準計算
1. **收集目標**：
   使用標準原生 DOM 選擇器選取互動元素（不使用 `:visible` 偽類）：
   ```javascript
   const TARGET_SELECTORS = [
       '.nav',
       '#myForm input',
       '#myForm textarea',
       '#myForm button',
       '.back-to-top-wrapper button',
       '.footer a',
       '.footer button',
       '#projects .card-link'
   ].join(', ');
   ```
2. **可見性過濾**：
   僅處理滿足原生條件的元素：
   `el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== 'hidden'`。
3. **活動帶交集與區間提取（在 Layout Viewport X 座標系下）**：
   對於與活動帶相交的元素，其禁止角色左緣 `posX` 進入的水平區間為：
   $$[\text{blockedStart}, \;\text{blockedEnd}] = [\text{rect.left} - \text{petWidth} - 16, \;\text{rect.right} + 16]$$
   *(16px 為水平安全間距 `AVOID_PADDING`)*
4. **區間合併與求差集**：
   將所有相交的禁止區間排序並合併重疊部分，自全域活動範圍 $[\min X, \;\max X]$ 扣除禁止區間，得到有序的安全區間列表：
   $$\mathcal{S} = \{ [s_1, e_1], [s_2, e_2], \dots \}$$
   其中過濾掉長度 $e_k - s_k < \text{MIN\_SAFE\_WIDTH}$ 的無效區間。

### 5.3 避讓狀態轉移：嚴禁橫穿障礙物
當使用者捲動或視窗調整導致安全區間改變時，角色的處置原則如下：

```
+-----------------------------------------------------------------------------------+
| 角色目前座標 posX                                                                  |
|                                                                                   |
| 情境 A: posX 落在某個安全區間 [s_k, e_k] 內                                        |
|         ➔ 更新目前移動邊界為 currentMinX = s_k, currentMaxX = e_k                  |
|         ➔ 角色在該區間內自由折返巡邏                                               |
|                                                                                   |
| 情境 B: posX 落在禁止區間內（元素突然捲入覆蓋角色）                                  |
|         ➔ 嚴禁角色跨越該元素走向其他安全區！                                         |
|         ➔ 立即觸發「先暫時收起 ➔ 重新定位 ➔ 安全恢復」流程                          |
|                                                                                   |
| 情境 C: 安全區間集合 S 為空（所有空間均被遮蔽）                                     |
|         ➔ 觸發「暫時避讓收起」並保持隱藏                                            |
+-----------------------------------------------------------------------------------+
```

#### 「先暫時收起 $\to$ 重新定位 $\to$ 安全恢復」具體流程：
1. **先暫時收起**：
   - 停止移動迴圈（`stopMovementLoop()`），凍結排程。
   - 加入 CSS class `.is-avoidance-hidden`（透明度快速淡出 180ms，`pointer-events: none`）。
2. **重新定位（離屏安全瞬移）**：
   - 若集合 $\mathcal{S}$ 中存在其他合格的安全區間，選取距離目前位置最近的合法區間 $[s_m, e_m]$。
   - 將角色內部座標更新為該區間中心點：`posX = Math.round((s_m + e_m - petWidth) / 2)`。
   - 寫入 `petGuide.style.transform = "translateX(${posX}px)"`（此時角色為透明，使用者不會察覺瞬移跳動）。
3. **安全恢復**：
   - 延遲 100ms 後移除 `.is-avoidance-hidden`（淡入 240ms）。
   - 角色回到 `Idle` 待機狀態停留 2 秒，隨後依照排程於新的安全區間內重新展開巡邏。

### 5.4 捲動磁滯防抖（Scroll Hysteresis Debounce）
為避免使用者在臨界邊界微幅上下捲動時，造成角色在「顯示」與「暫時收起」之間瘋狂閃爍（Thrashing）：
- **引入磁滯判定（Hysteresis Threshold）**：
  - 觸發暫時收起的活動帶重疊深度為：`10px`（當元素侵入活動帶超過 10px 才收起）。
  - 解除收起重新出現的活動帶淨空深度為：`24px`（元素必須離開活動帶超過 24px 才允許恢復）。
- **捲動結束冷卻（Scroll End Cooldown）**：
  在捲動事件進行中，僅進行必要的安全收起；若要「恢復顯示」，必須在捲動停止至少 `150ms` 後才執行恢復評估，徹底消除邊界震盪。

### 5.5 暫時收起期間的重新量測保證
若角色已暫時收起，系統絕不能停止監聽事件，否則角色將永遠無法喚醒：
- 在暫時收起期間，`window` 的 `scroll` 與 `resize` 仍會觸發節流後的邊界重新評估。
- 一旦評估到活動帶已具備 $\ge 96\text{px}$ 的安全空間，即刻安排喚醒排程。

---

## 6. 焦點與點擊安全防護（Focus & Interaction Safety）

### 6.1 暫時收起狀態下的 DOM 樣式與指標安全性
當角色處於「暫時避讓收起」或「表單聚焦收起」時：
```css
.pet-guide.is-avoidance-hidden {
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden; /* 防止 Safari/Chrome 的 Accessibility Tree 朗讀隱藏按鈕 */
  transition: opacity 0.18s ease, visibility 0.18s;
}
```
- **滑鼠安全**：`pointer-events: none` 確保使用者在點擊下方的表單、按鈕或卡片時，不會被透明的角色容器阻擋或誤觸。
- **鍵盤 Tab 安全**：
  在收起時，JS 呼叫 `setPetOptionsTabIndex(false)`，並為 `#pet` 加上 `tabindex="-1"`（或為 `.pet-guide` 加上 `inert` 屬性）。
  鍵盤 Tab 鍵巡迴時會完全跳過 Bug 先生與對話框，絕不聚焦於不可見控制項。

### 6.2 表單聚焦與失焦行為契約
1. **表單 Focus**：
   - 監聽 `document.addEventListener('focusin', handleFormFocusIn)`。
   - 匹配條件：`e.target.matches('input, textarea, select')`。
   - **立即將角色收起**，停止位移。
   - **絕對不呼叫任何影響焦點的動作**（禁止 `blur()`、禁止移焦），使用者的鍵盤焦點與中文輸入法游標獲得 100% 完整保護。
2. **表單 Blur / 失焦**：
   - 監聽 `document.addEventListener('focusout', handleFormFocusOut)`。
   - 延遲 60ms 檢查 `document.activeElement` 是否已非表單項。
   - 若使用者已結束表單輸入，且目前捲動位置空間充足，角色安全恢復顯示為 `Idle`。

### 6.3 焦點在 Pet 內部時遭遇強制收起的處理
若使用者正在對話框內操作（例如焦點在「作品」按鈕或「暫停走動」按鈕），此時頁面因外部因素強制觸發避讓收起（例如被程式捲動或視窗急劇縮小）：
- **安全焦點移轉**：
  - 絕不能讓焦點留在即將被 `visibility: hidden` 的按鈕上（這會導致螢幕閱讀器失焦跳至 `body` 頂端）。
  - JS 先行關閉對話框，將焦點平滑退回到頁面安全錨點（例如離使用者視野最近的 section 標題或當前視窗頂部的安全元素，加 `preventScroll: true`）。
  - 若無法判定安全主體，焦點暫時歸還至 `document.body`。

---

## 7. 效能與 DOM 動態量測策略（Performance & MutationObserver）

### 7.1 單一 rAF 迴圈純粹性
- `movementStep` 函式在每一幀中：
  - 僅計算：`posX += direction * speed * deltaSeconds`。
  - 比對快取的 `currentMinX` 與 `currentMaxX`。
  - 寫入：`petGuide.style.transform = "translateX(${posX}px)"`。
  - **嚴格禁止在每一影格呼叫 `getBoundingClientRect()`、`offsetWidth` 或 `getComputedStyle()`**。

### 7.2 量測觸發頻率與節流機制
| 觸發事件 | 處理策略 | 頻率限制 / 防抖時間 |
| :--- | :--- | :--- |
| **頁面捲動 (`scroll`)** | `requestAnimationFrame` 節流標記（`scrollTicking`） | 最多每 80ms ~ 100ms 執行一次幾何量測 |
| **視窗改變 (`resize` / `visualViewport.resize`)** | 防抖（Debounce） | 視窗穩定停止變動後 120ms 執行一次全域重新校準 |
| **螢幕旋轉 (`orientationchange`)** | 立即校準 + 延遲 200ms 二次校準 | 應對行動裝置旋轉時 CSS 渲染延遲 |
| **表單焦點 (`focusin` / `focusout`)** | 直接事件響應 | 微秒級執行，開銷可忽略 |

### 7.3 動態生成卡片（`#projects`）之適配方案
- **不修改 `js/list.js` 契約**：
  在 `js/pet.js` 初始化時，建立專屬的 `MutationObserver` 監聽 `#projects` 容器：
  ```javascript
  const projectsContainer = document.getElementById('projects');
  if (projectsContainer) {
      const observer = new MutationObserver((mutations) => {
          let hasNewCards = false;
          mutations.forEach((m) => {
              if (m.addedNodes.length > 0) hasNewCards = true;
          });
          if (hasNewCards) {
              // 卡片已插入 DOM，等待圖片與排版就緒後重測一次避讓區間
              requestAnimationFrame(() => {
                  updateAvoidanceIntervals();
              });
              // 若只是一次性渲染，可中斷觀察以節省資源
              observer.disconnect();
          }
      });
      observer.observe(projectsContainer, { childList: true, subtree: true });
  }
  ```

---

## 8. 實作順序與技術細節（Implementation Steps）

1. **Step 1: CSS Safe Area 與極端高度樣式補充**
   - 宣告 `:root` Safe Area 變數。
   - 補齊 `.pet-dialog` 的 Flex 欄排版、`max-height` 與 `.is-compact` 緊湊樣式。
   - 補齊 `.pet-guide.is-avoidance-hidden` 之透明度、`visibility: hidden` 與 `pointer-events: none`。
2. **Step 2: Viewport 幾何查詢器與座標轉換**
   - 實作 `getViewportGeometry()`，精準取得 Visual Viewport 偏移量與 safe-area。
   - 更新 `updateBoundaries()`，採用統一 Layout Viewport 座標計算。
3. **Step 3: 對話框 Clamp 演算法與短螢幕防護**
   - 在開啟對話框時計算真實可用高度與 `--dialog-shift-x`。
   - 實作可用高度 $< 120\text{px}$ 時的拒絕開啟防護。
4. **Step 4: 避讓管理器（AvoidanceManager）核心邏輯**
   - 實作活動帶相交檢測、原生選擇器過濾與區間合併演算法。
   - 實作「先暫時收起 $\to$ 重新定位 $\to$ 安全恢復」流程。
   - 實作捲動磁滯與節流機制。
5. **Step 5: 表單焦點保護與 MutationObserver**
   - 綁定全域表單 `focusin` / `focusout`。
   - 建立 `#projects` 的 `MutationObserver` 監聽卡片動態渲染。
6. **Step 6: 擴展測試控制器並自我校驗**
   - 擴充 `window.__petController` 暴露避讓狀態與安全區間查詢接口。

---

## 9. 技術風險與權衡紀錄（Risks & Trade-offs）

| 風險項目 | 潛在影響 | 因應對策 / 簡化方案 |
| :--- | :--- | :--- |
| **R1: 完整作品卡片避讓導致角色長時間收起** | 在小螢幕（如直向手機）上，作品卡片寬度佔滿螢幕大半，捲動經過作品區時，底部的安全區間可能持續小於 96px，導致角色在整個作品區完全處於隱藏狀態。 | **規格決策紀錄**：首版嚴格貫徹「角色服務於作品閱讀，不遮擋作品」原則，允許角色在作品區收起。若人工審查認為趣味性降低，提供備選決策：作品卡片只在滑鼠 Hover 或鍵盤 Focus 時才計入避讓禁止區。 |
| **R2: 軟鍵盤彈起時的高度突變** | 部分 Android Chrome 在軟鍵盤彈起時不改變 `visualViewport.height`，而僅改變捲動。 | **雙重防線**：以表單 `focusin` 作為最優先觸發條件立即收起，不依賴鍵盤 height 變化。 |
| **R3: 窄螢幕下磁滯造成按鈕短暫不可見** | 若磁滯門檻設過大，使用者捲動停下後可能角色太慢恢復。 | **動態微調**：磁滯門檻收起設 10px，恢復設 24px，延遲 150ms，在桌面與實機觸控均維持平滑體驗。 |

---

## 10. 驗收標準（Acceptance Criteria）

> [!NOTE]
> 本任務為技術規劃階段，所有項目維持 **NOT TESTED**。

### 10.1 對話框邊界與短螢幕驗收
| AC ID | 驗收項目 | 通過標準 | 狀態 | 測試方式 |
| :--- | :--- | :--- | :--- | :--- |
| AC-33 | 角色在最左邊界（`minX`）時開啟對話框 | 對話框左緣距 Visual Viewport 左側保留 $\ge 12\text{px}$，文字按鈕完整可見 | PASS | 模擬 DOM + 演算法單元驗證 |
| AC-34 | 角色在最右邊界（`maxX`）時開啟對話框 | 對話框右緣距 Visual Viewport 右側保留 $\ge 12\text{px}$，不溢出螢幕 | PASS | 模擬 DOM + 演算法單元驗證 |
| AC-35 | 320px 窄螢幕下開啟對話框 | 對話框完整被 clamp 於可視區內，無橫向捲軸 | PASS | 模擬 DOM 幾何 Clamp 驗證 |
| AC-36 | 橫向短視窗（可用高度 $120\text{px} \sim 200\text{px}$）開啟對話框 | 對話框高度不超過可用高度，內部提供垂直捲軸，所有控制項皆可捲出操作 | PASS | 模擬 DOM 垂直高度與 compact 驗證 |
| AC-37 | 極端短視窗（可用高度 $< 120\text{px}$） | 點擊角色不展開對話框（或安靜關閉），不遮擋主要畫面 | PASS | 模擬 DOM 極端高度拒絕開啟驗證 |

### 10.2 避讓與安全區間驗收
| AC ID | 驗收項目 | 通過標準 | 狀態 | 測試方式 |
| :--- | :--- | :--- | :--- | :--- |
| AC-38 | 捲動至 `#myForm` 表單輸入項與按鈕進入活動帶 | 角色巡邏範圍被限制於輸入項兩側；當前座標落入禁止區時執行先收起再重新定位，不穿透表單 | PASS | 模擬重疊與重新定位流程驗證 |
| AC-39 | 底部活動帶無 $\ge 96\text{px}$ 之安全空間 | 角色平滑淡出收起；離開障礙區後平滑淡入恢復 `Idle` | PASS | 模擬無安全空間避讓收起驗證 |
| AC-40 | 捲動至頁尾 `.back-to-top-wrapper` 按鈕進入活動帶 | 角色巡邏範圍自動避讓按鈕投影區間，不遮擋回頂按鈕 | PASS | 選擇器與區間計算驗證 |
| AC-41 | 捲動至 Footer 連結進入活動帶 | 角色避開社群連結投影區間 | PASS | 選擇器與區間計算驗證 |
| AC-42 | 作品卡片動態載入（`MutationObserver`） | 卡片渲染完成後自動更新避讓區間，無需手動重整 | PASS | MutationObserver 回呼測試 |
| AC-43 | 快速上下捲動臨界邊界 | 磁滯防抖生效，角色不發生連續高頻閃爍跳動 | PASS | 捲動節流與磁滯冷卻驗證 |

### 10.3 焦點保護與點擊安全驗收
| AC ID | 驗收項目 | 通過標準 | 狀態 | 測試方式 |
| :--- | :--- | :--- | :--- | :--- |
| AC-44 | 點擊/聚焦表單輸入欄位（name/email/info） | 角色立即收起，鍵盤游標完全不失焦、不奪焦 | PASS | 表單 focusin/focusout 事件測試 |
| AC-45 | 角色暫時收起期間 | `pointer-events: none` 生效，不阻擋底層元素點擊；Tab 鍵跳過角色與對話框 | PASS | CSS 與 tabindex 驗證 |
| AC-46 | 對話框內操作時遭強制避讓收起 | 焦點安全轉移至頁面主體標題，不丟失至 `body` 頂端 | PASS | safe focus target 演算法測試 |
| AC-47 | 暫時避讓收起與恢復 | 絕不寫入 `sessionStorage`，不破壞 06C 手動暫停與 Reduced Motion 狀態 | PASS | 回歸測試與狀態一致性驗證 |

---

## 11. 回歸測試驗收（Regression Tests）

| REG ID | 測試模組 | 驗收標準 | 狀態 | 測試方式 |
| :--- | :--- | :--- | :--- | :--- |
| REG-17 | **06B 邊界碰撞** | 左右碰撞轉向正常，不因 Viewport 轉換產生瞬移或出界 | PASS | 邊界移動模擬測試 |
| REG-18 | **06C 手動暫停維持** | 手動暫停後遭遇避讓收起，空間恢復時角色依然維持暫停 | PASS | PauseManager 整合測試 |
| REG-19 | **06C Reduced Motion** | 減少動態下避讓收起無多餘動畫，維持靜態圖 | PASS | Reduced Motion 偏好模擬 |
| REG-20 | **07A Escape 與關閉按鈕** | Escape 鍵與關閉按鈕正常關閉並返焦至角色 | PASS | 鍵盤與按鈕點擊測試 |
| REG-21 | **07A 三導覽焦點移轉** | 導覽按鈕點擊後平滑捲動並正確聚焦至目的地 section 標題 | PASS | 導覽處理器邏輯測試 |

---

## 12. 開放決策事項（Open Questions & Recommendations）

### Q1: 作品區卡片避讓對角色出勤率的影響
- **說明**：
  若嚴格執行所有可見作品卡片的水平投影避讓，在寬度小於 768px 的直向行動裝置上，作品區通常佔滿整個螢幕寬度，底部活動帶很難找到連續 96px 的空隙，角色在使用者瀏覽作品時幾乎全程處於隱藏狀態。
- **選項**：
  - **(A) 保持嚴格避讓（推薦）**：忠實落實「作品優先、不搶奪視覺中心」的理念，等使用者瀏覽完作品捲至段落間距時角色才出來打招呼。
  - **(B) 僅在卡片處於 Hover/Focus 時才避讓**：卡片未被操作時角色可在卡片底部邊緣走過。
- **建議**：先採方案 (A) 實作，若使用者希望角色有更高曝光度，可隨時無痛切換為方案 (B)。

---

**AWAITING CODE REVIEW**

本階段實作與自動化測試已完工，等待人工代碼審查，不得自行進入 08A。
