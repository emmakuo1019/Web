/**
 * PR2: Bug 先生角色互動模組
 * PR2-PET-07A: 角色對話、關閉互動與焦點管理
 */
(function () {
    'use strict';

    // 0. 防重初始化保護：避免多次載入造成重複綁定或多重實例
    if (window.__petInitialized) {
        return;
    }

    // 1. 設定物件 (Configuration)
    const PET_CONFIG = {
        ASSETS: {
            WALKING: 'picture/pet/pet.gif',
            IDLE: 'picture/pet/pet.png',
            HAPPY: 'picture/pet/pethappy.png'
        },
        FALLBACK_SRC: 'picture/pet/pet.png',
        FALLBACK_TEXT: 'Bug',
        ARIA_LABELS: {
            DEFAULT: '開啟網站導覽',
            OPEN: '關閉網站導覽'
        },
        SPEED: {
            DESKTOP_MIN: 25,
            DESKTOP_MAX: 45,
            MOBILE_MIN: 15,
            MOBILE_MAX: 30
        },
        DURATION: {
            WALK_MIN: 4000,
            WALK_MAX: 8000,
            IDLE_MIN: 2000,
            IDLE_MAX: 5000,
            AFTER_DIALOG_IDLE: 2000
        },
        BOUNDARY_PADDING: 12,
        MIN_SAFE_WIDTH: 96, // PR2-PET-07B: 全域統一安全區間最小寬度
        AVOID_PADDING: 16,  // PR2-PET-07B: 水平避讓間距
        MAX_DELTA_MS: 50,
        // PR2-PET-07A: 短句池
        SPEECHES: [
            '嗨！我是 Bug 先生。',
            '今天也在努力找 Bug！',
            '想看看我的主人做過的遊戲嗎？',
            '這個網站也是自己做的喔！',
            '我好像又發現一個 Bug……',
            '不要 Debug 我啦！'
        ]
    };

    // 2. 狀態常數 (FSM States)
    const PET_STATES = Object.freeze({
        WALKING: 'Walking',
        IDLE: 'Idle',
        HAPPY: 'Happy',
        HIDDEN: 'Hidden'
    });

    function initPet() {
        if (window.__petInitialized) return;

        const petGuide = document.querySelector('.pet-guide');
        const petBtn = document.getElementById('pet');
        const petDialog = document.getElementById('pet-dialog');

        // 無 pet DOM 時直接退出，不影響其他頁面
        if (!petBtn || !petDialog || !petGuide) {
            return;
        }

        window.__petInitialized = true;

        const petOptions = petDialog.querySelectorAll('.pet-options button[data-target]');
        const petPauseBtn = document.getElementById('pet-pause-btn');
        const petCloseBtn = document.getElementById('pet-close-btn'); // PR2-PET-07A
        const petSpeechEl = document.getElementById('pet-speech');    // PR2-PET-07A
        const petImg = petBtn.querySelector('.pet-img');

        // 偵測 Reduced Motion 偏好
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let prefersReducedMotion = motionQuery.matches;
        let scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

        // 3. FSM 核心狀態與排程追蹤
        let currentState = PET_STATES.IDLE;
        let fallbackApplied = false;
        let userPaused = false;

        // PR2-PET-07A: 短句抽取狀態（跨次開啟持續追蹤）
        let lastSpeechIndex = -1;

        /**
         * 從短句池隨機抽取一則，避免連續兩次相同
         * @returns {string}
         */
        function pickSpeech() {
            const speeches = PET_CONFIG.SPEECHES;
            if (!speeches || speeches.length === 0) return '';
            if (speeches.length === 1) return speeches[0];
            let idx;
            do {
                idx = Math.floor(Math.random() * speeches.length);
            } while (idx === lastSpeechIndex);
            lastSpeechIndex = idx;
            return speeches[idx];
        }

        // 暫停原因集合管理 (PauseManager)
        const pauseReasons = new Set();
        if (prefersReducedMotion) {
            pauseReasons.add('reducedMotion');
        }
        if (document.hidden) {
            pauseReasons.add('visibility');
        }

        // 4. 移動、物理邊界與 rAF 狀態
        let posX = 0;
        let direction = 1; // 1: 向右, -1: 向左
        let speed = 35; // px/s
        let minX = 0;
        let maxX = 0;
        let animationFrameId = null;
        let lastTimestamp = 0;

        // PR2-PET-07B: 避讓系統 (AvoidanceManager) 狀態變數
        let isAvoidanceHidden = false;
        let safeIntervals = [];       // [{ start, end }]
        let currentInterval = null;   // { start, end }
        let currentMinX = 0;
        let currentMaxX = 0;
        let isFormFocused = false;
        let isRepositioning = false;  // 避讓重新定位過渡中旗標

        /**
         * 隨機整數產生輔助函式 [min, max]
         */
        function getRandomRange(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        /**
         * 判定角色當前是否具備移動許可
         * @returns {boolean}
         */
        function isMovementAllowed() {
            return pauseReasons.size === 0 &&
                !prefersReducedMotion &&
                !isAvoidanceHidden &&
                currentState !== PET_STATES.HIDDEN &&
                currentState !== PET_STATES.HAPPY;
        }

        /**
         * 單一計時排程管理器 (Scheduler)
         * 支援純暫停凍結剩餘時間、狀態切換徹底作廢舊排程、與契約掛起機制
         */
        const scheduler = {
            timerId: null,
            targetState: null,
            totalDuration: 0,
            startTime: 0,
            remainingMs: 0,

            schedule(toState, delay) {
                if (prefersReducedMotion && toState === PET_STATES.WALKING) {
                    this.cancel();
                    return;
                }
                if (this.timerId !== null) {
                    clearTimeout(this.timerId);
                    this.timerId = null;
                }
                this.targetState = toState;
                this.totalDuration = delay;
                this.startTime = Date.now();
                this.remainingMs = delay;

                // 若目前不允許移動，將剩餘時間記下但不啟動定時器
                if (!isMovementAllowed()) {
                    return;
                }

                this.timerId = setTimeout(() => {
                    this.timerId = null;
                    this.remainingMs = 0;
                    transitionTo(this.targetState);
                }, delay);
            },

            pause() {
                if (this.timerId !== null) {
                    this.remainingMs = Math.max(0, this.totalDuration - (Date.now() - this.startTime));
                    clearTimeout(this.timerId);
                    this.timerId = null;
                }
            },

            resume() {
                if (!isMovementAllowed()) return;
                if (prefersReducedMotion && this.targetState === PET_STATES.WALKING) {
                    this.cancel();
                    return;
                }
                if (this.targetState !== null && this.timerId === null) {
                    const delay = this.remainingMs > 0 ? Math.max(200, this.remainingMs) : 0;
                    this.totalDuration = delay;
                    this.startTime = Date.now();
                    this.timerId = setTimeout(() => {
                        this.timerId = null;
                        this.remainingMs = 0;
                        transitionTo(this.targetState);
                    }, delay);
                }
            },

            cancel() {
                if (this.timerId !== null) {
                    clearTimeout(this.timerId);
                    this.timerId = null;
                }
                this.targetState = null;
                this.totalDuration = 0;
                this.startTime = 0;
                this.remainingMs = 0;
            }
        };

        /**
         * 加入暫停原因
         * @param {string} reason
         */
        function addPauseReason(reason) {
            const wasAllowed = isMovementAllowed();
            pauseReasons.add(reason);
            if (wasAllowed && !isMovementAllowed()) {
                handlePauseActivated();
            }
        }

        /**
         * 移除暫停原因
         * @param {string} reason
         */
        function removePauseReason(reason) {
            const wasAllowed = isMovementAllowed();
            pauseReasons.delete(reason);
            if (!wasAllowed && isMovementAllowed()) {
                handlePauseDeactivated();
            }
        }

        /**
         * 暫停觸發：停止位移迴圈、凍結計時排程、同步靜態待機素材
         */
        function handlePauseActivated() {
            stopMovementLoop();
            scheduler.pause();
            syncPetAsset();
        }

        /**
         * 暫停解除：若處於行走狀態重啟位移迴圈、恢復計時排程、同步走動素材
         */
        function handlePauseDeactivated() {
            syncPetAsset();
            if (currentState === PET_STATES.WALKING) {
                lastTimestamp = 0;
                startMovementLoop();
            }
            scheduler.resume();
        }

        /**
         * 同步 tabindex，確保隱藏 dialog 內的按鈕不被 Tab 聚焦
         * @param {boolean} accessible
         */
        function setPetOptionsTabIndex(accessible) {
            petOptions.forEach((btn) => {
                btn.setAttribute('tabindex', accessible ? '0' : '-1');
            });
            if (petPauseBtn) {
                petPauseBtn.setAttribute('tabindex', accessible ? '0' : '-1');
            }
            // PR2-PET-07A: 新增關閉按鈕管理
            if (petCloseBtn) {
                petCloseBtn.setAttribute('tabindex', accessible ? '0' : '-1');
            }
        }

        // =========================================================================
        // PR2-PET-07B: 避讓管理器 (AvoidanceManager)
        // =========================================================================

        const AVOIDANCE_TARGET_SELECTORS = [
            '.nav',
            '#myForm input',
            '#myForm textarea',
            '#myForm button',
            '.back-to-top-wrapper button',
            '.footer a',
            '.footer button',
            '#projects .card-link'
        ].join(', ');

        let scrollThrottleTimeout = null;
        let resizeDebounceTimeout = null;
        let scrollCooldownTimeout = null;
        let isScrolling = false;

        /**
         * 尋找視窗中可見且安全的主要內容標題或區塊（供角色收起時安全轉移焦點，不丟給 body）
         * @returns {HTMLElement}
         */
        function findSafeContentFocusTarget() {
            const sections = document.querySelectorAll('main section, header.header');
            const geo = getViewportGeometry();
            const viewMidY = geo.offsetTop + (geo.height / 2);

            let bestTarget = null;
            let minDistance = Infinity;

            sections.forEach((sec) => {
                const rect = sec.getBoundingClientRect();
                const secMidY = rect.top + (rect.height / 2);
                const dist = Math.abs(secMidY - (geo.height / 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    const title = sec.querySelector('.title, h1, h2, h3');
                    bestTarget = title || sec;
                }
            });

            if (!bestTarget) {
                bestTarget = document.querySelector('.logo a, .nav a, main') || petBtn;
            }

            return bestTarget;
        }

        /**
         * 暫時避讓收起／恢復處理
         * @param {boolean} hide 是否隱藏
         * @param {boolean} immediate 是否跳過淡出動畫
         */
        function setAvoidanceHidden(hide, immediate = false) {
            if (isAvoidanceHidden === hide) return;

            isAvoidanceHidden = hide;

            if (isAvoidanceHidden) {
                // 1. 若焦點在角色或面板內部，安全轉移焦點至可見主內容元素
                if (petGuide.contains(document.activeElement)) {
                    if (isFormFocused) {
                        // 表單正在操作中，焦點不移轉，游標 100% 保持
                    } else {
                        const safeTarget = findSafeContentFocusTarget();
                        if (safeTarget && safeTarget !== petBtn) {
                            if (!safeTarget.getAttribute('tabindex')) {
                                safeTarget.setAttribute('tabindex', '-1');
                                safeTarget.addEventListener('blur', () => {
                                    safeTarget.removeAttribute('tabindex');
                                }, { once: true });
                            }
                            safeTarget.focus({ preventScroll: true });
                        }
                    }
                }

                // 2. 對話框開啟中遇到避讓，安靜關閉對話框
                if (currentState === PET_STATES.HAPPY) {
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    currentState = PET_STATES.IDLE;
                }

                // 3. 角色按鈕本身在隱藏期間不可被 Tab 聚焦
                petBtn.setAttribute('tabindex', '-1');
                setPetOptionsTabIndex(false);

                // 4. 套用 CSS 避讓收起樣式（opacity: 0; pointer-events: none; visibility: hidden）
                petGuide.classList.add('is-avoidance-hidden');

                // 5. 停止移動迴圈與排程
                stopMovementLoop();
                scheduler.pause();
                syncPetAsset();
            } else {
                // 恢復顯示
                petBtn.removeAttribute('tabindex'); // 恢復正常 Tab 順序
                petGuide.classList.remove('is-avoidance-hidden');

                // 恢復待機素材與排程
                syncPetAsset();
                if (currentState === PET_STATES.WALKING && isMovementAllowed()) {
                    lastTimestamp = 0;
                    startMovementLoop();
                }
                scheduler.resume();
            }
        }

        /**
         * 計算所有可見關鍵互動元素與底部活動帶的禁止區間，並提取合法安全區間
         */
        function evaluateAvoidanceIntervals() {
            // 若為表單聚焦狀態，一律維持避讓收起
            if (isFormFocused) {
                setAvoidanceHidden(true);
                return;
            }

            const geo = getViewportGeometry();
            const petWidth = petBtn.offsetWidth || 64;
            const petHeight = petBtn.offsetHeight || 64;

            let bottomInset = 20;
            try {
                const guideStyle = getComputedStyle(petGuide);
                bottomInset = parseFloat(guideStyle.bottom) || 20;
            } catch (e) {
                bottomInset = 20 + geo.safeBottom;
            }

            // 活動帶在 Visual Viewport 中的垂直範圍
            // 磁滯門檻：收起門檻為侵入超過 10px，恢復門檻為淨空超過 24px
            const bandTop = geo.height - (bottomInset + petHeight + 8);
            const bandBottom = geo.height;

            const targets = document.querySelectorAll(AVOIDANCE_TARGET_SELECTORS);
            const blockedIntervals = [];

            targets.forEach((el) => {
                // 排除角色與對話框自身的子元素
                if (petGuide.contains(el)) return;

                // 可見性過濾
                if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
                const cs = getComputedStyle(el);
                if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return;

                const rect = el.getBoundingClientRect();
                // 換算為相對於 Visual Viewport 的垂直座標
                const visualTop = rect.top - geo.offsetTop;
                const visualBottom = rect.bottom - geo.offsetTop;

                // 判斷是否與活動帶垂直相交（侵入深度 > 10px）
                const isOverlapping = (visualBottom > (bandTop + 10)) && ((visualTop + 10) < bandBottom);

                if (isOverlapping) {
                    // 水平禁止區間（換算為 Layout Viewport 下角色左緣 posX 的禁止範圍）
                    // 當 posX + petWidth > rect.left - AVOID_PADDING 且 posX < rect.right + AVOID_PADDING 時重疊
                    const blockedStart = Math.max(minX, rect.left - petWidth - PET_CONFIG.AVOID_PADDING);
                    const blockedEnd = Math.min(maxX, rect.right + PET_CONFIG.AVOID_PADDING);

                    if (blockedEnd > blockedStart) {
                        blockedIntervals.push({ start: blockedStart, end: blockedEnd });
                    }
                }
            });

            // 合併重疊的禁止區間
            blockedIntervals.sort((a, b) => a.start - b.end);
            const mergedBlocked = [];
            blockedIntervals.forEach((interval) => {
                if (mergedBlocked.length === 0) {
                    mergedBlocked.push({ ...interval });
                } else {
                    const last = mergedBlocked[mergedBlocked.length - 1];
                    if (interval.start <= last.end) {
                        last.end = Math.max(last.end, interval.end);
                    } else {
                        mergedBlocked.push({ ...interval });
                    }
                }
            });

            // 自 [minX, maxX] 扣除禁止區間，提取安全區間
            const extractedSafe = [];
            let currentLeft = minX;

            mergedBlocked.forEach((b) => {
                if (b.start > currentLeft) {
                    const width = b.start - currentLeft;
                    if (width >= PET_CONFIG.MIN_SAFE_WIDTH) {
                        extractedSafe.push({ start: currentLeft, end: b.start });
                    }
                }
                currentLeft = Math.max(currentLeft, b.end);
            });

            if (maxX > currentLeft) {
                const width = maxX - currentLeft;
                if (width >= PET_CONFIG.MIN_SAFE_WIDTH) {
                    extractedSafe.push({ start: currentLeft, end: maxX });
                }
            }

            safeIntervals = extractedSafe;

            // 根據安全區間評估角色行為
            if (safeIntervals.length === 0) {
                // 完全無安全空間 -> 觸發暫時收起
                currentInterval = null;
                setAvoidanceHidden(true);
            } else {
                // 檢查目前角色 posX 是否處於合法安全區間
                const containingInterval = safeIntervals.find((interval) => {
                    return posX >= (interval.start - 1) && posX <= (interval.end + 1);
                });

                if (containingInterval) {
                    // 目前座標安全，更新邊界
                    currentInterval = containingInterval;
                    currentMinX = containingInterval.start;
                    currentMaxX = containingInterval.end;

                    // 若先前處於暫時收起狀態且目前非捲動激烈中，安全恢復
                    if (isAvoidanceHidden && !isRepositioning && !isScrolling) {
                        setAvoidanceHidden(false);
                    }
                } else {
                    // 當前座標落入禁止區間！
                    // 規格強制要求：嚴禁穿越障礙前往安全區！
                    // 執行「先暫時收起 -> 重新定位 -> 安全恢復」流程
                    repositionToSafeInterval();
                }
            }
        }

        /**
         * 執行「先暫時收起 -> 重新定位至合法安全區中心 -> 安全恢復」流程
         */
        function repositionToSafeInterval() {
            if (isRepositioning) return;
            isRepositioning = true;

            // 1. 先暫時收起（透明淡出）
            setAvoidanceHidden(true);

            // 2. 等待淡出動畫完成後（180ms），在不可見狀態下離屏重新定位
            setTimeout(() => {
                if (safeIntervals.length > 0) {
                    // 選取距離目前位置最近的安全區間
                    let nearestInterval = safeIntervals[0];
                    let minDistance = Infinity;

                    safeIntervals.forEach((interval) => {
                        const mid = (interval.start + interval.end) / 2;
                        const dist = Math.abs(mid - posX);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestInterval = interval;
                        }
                    });

                    currentInterval = nearestInterval;
                    currentMinX = nearestInterval.start;
                    currentMaxX = nearestInterval.end;

                    // 追加實作要求：安全區間定義為角色左緣合法 posX 時，中心點使用 (start + end) / 2，不可重複扣除角色寬度
                    posX = Math.round((nearestInterval.start + nearestInterval.end) / 2);
                    clampPosition();

                    // 3. 安全恢復（待完全隱藏並就位後，延遲 100ms 移除隱藏，並重設 Idle 2 秒契約）
                    setTimeout(() => {
                        isRepositioning = false;
                        if (!isFormFocused && safeIntervals.length > 0 && !isScrolling) {
                            setAvoidanceHidden(false);
                            if (currentState === PET_STATES.WALKING) {
                                currentState = PET_STATES.IDLE;
                                render(PET_STATES.IDLE, null);
                            }
                        }
                    }, 100);
                } else {
                    isRepositioning = false;
                }
            }, prefersReducedMotion ? 10 : 200);
        }

        /**
         * 捲動監聽（rAF / 節流與磁滯冷卻）
         */
        function handleScroll() {
            isScrolling = true;

            if (scrollCooldownTimeout) {
                clearTimeout(scrollCooldownTimeout);
            }

            // 捲動期間以 80ms 節流進行避讓檢查（僅在必要時執行收起）
            if (!scrollThrottleTimeout) {
                scrollThrottleTimeout = setTimeout(() => {
                    scrollThrottleTimeout = null;
                    evaluateAvoidanceIntervals();
                }, 80);
            }

            // 磁滯防抖：捲動停止 150ms 後冷卻，才允許重新恢復顯示
            scrollCooldownTimeout = setTimeout(() => {
                isScrolling = false;
                scrollCooldownTimeout = null;
                evaluateAvoidanceIntervals();
                if (currentState === PET_STATES.HAPPY) {
                    updateDialogPositionAndHeight();
                }
            }, 150);
        }

        /**
         * 表單控制項聚焦處理（即時收起角色，絕不移焦或干擾輸入法）
         */
        function handleFormFocusIn(e) {
            const target = e.target;
            if (target && target.matches && target.matches('input, textarea, select')) {
                isFormFocused = true;
                setAvoidanceHidden(true);
            }
        }

        /**
         * 表單控制項失焦處理
         */
        function handleFormFocusOut(e) {
            setTimeout(() => {
                const active = document.activeElement;
                if (!active || !active.matches || !active.matches('input, textarea, select')) {
                    isFormFocused = false;
                    evaluateAvoidanceIntervals();
                }
            }, 60);
        }

        /**
         * 監聽 #projects 卡片動態生成（不修改 js/list.js）
         */
        function setupProjectsObserver() {
            const projectsContainer = document.getElementById('projects');
            if (!projectsContainer) return;

            const observer = new MutationObserver((mutations) => {
                let hasNewNodes = false;
                mutations.forEach((m) => {
                    if (m.addedNodes.length > 0) hasNewNodes = true;
                });
                if (hasNewNodes) {
                    requestAnimationFrame(() => {
                        evaluateAvoidanceIntervals();
                    });
                }
            });

            observer.observe(projectsContainer, { childList: true, subtree: true });
        }

        /**
         * 更新手動暫停按鈕的無障礙語意與狀態文字
         */
        function updatePauseButtonUI() {
            if (!petPauseBtn) return;
            if (prefersReducedMotion) {
                petPauseBtn.disabled = true;
                petPauseBtn.setAttribute('aria-disabled', 'true');
                petPauseBtn.textContent = '已配合系統減少動態';
                petPauseBtn.removeAttribute('aria-pressed');
                petPauseBtn.setAttribute('data-paused', 'disabled');
            } else {
                petPauseBtn.disabled = false;
                petPauseBtn.removeAttribute('aria-disabled');
                petPauseBtn.textContent = userPaused ? '恢復走動' : '暫停走動';
                petPauseBtn.removeAttribute('aria-pressed');
                petPauseBtn.setAttribute('data-paused', userPaused ? 'true' : 'false');
            }
        }

        /**
         * 圖片載入失敗時降級為文字按鈕
         */
        function showTextFallback() {
            if (fallbackApplied) return;
            fallbackApplied = true;

            if (petImg) {
                petImg.style.display = 'none';
            }
            if (!petBtn.querySelector('.pet-fallback-text')) {
                const textSpan = document.createElement('span');
                textSpan.className = 'pet-fallback-text';
                textSpan.textContent = PET_CONFIG.FALLBACK_TEXT;
                petBtn.appendChild(textSpan);
                petBtn.classList.add('has-text-fallback');
            }
        }

        /**
         * 依據 FSM 狀態、移動許可與動態偏好統一決定應顯示的素材路徑
         * @returns {string|null}
         */
        function resolveCurrentAsset() {
            if (currentState === PET_STATES.HAPPY) {
                return PET_CONFIG.ASSETS.HAPPY;
            }
            if (currentState === PET_STATES.HIDDEN) {
                return null;
            }
            if (currentState === PET_STATES.WALKING && isMovementAllowed()) {
                return PET_CONFIG.ASSETS.WALKING;
            }
            return PET_CONFIG.ASSETS.IDLE;
        }

        /**
         * 同步角色圖片素材，比對 URL 防止重複賦值造成 GIF 重播閃爍
         */
        function syncPetAsset() {
            const targetSrc = resolveCurrentAsset();
            if (!targetSrc || !petImg || petImg.style.display === 'none' || fallbackApplied) {
                return;
            }
            if (!petImg.src.endsWith(targetSrc)) {
                setPetImage(targetSrc);
            }
        }

        /**
         * 切換角色圖片，包含素材載入失敗回退機制
         * @param {string} src
         */
        function setPetImage(src) {
            if (!petImg || petImg.style.display === 'none' || fallbackApplied) return;

            petImg.onerror = () => {
                petImg.onerror = null;
                if (src !== PET_CONFIG.FALLBACK_SRC && !petImg.src.endsWith(PET_CONFIG.FALLBACK_SRC)) {
                    setPetImage(PET_CONFIG.FALLBACK_SRC);
                } else {
                    showTextFallback();
                }
            };
            petImg.src = src;
        }

        // 初始化素材錯誤監聽
        if (petImg) {
            petImg.onerror = () => {
                petImg.onerror = null;
                if (!petImg.src.endsWith(PET_CONFIG.FALLBACK_SRC)) {
                    setPetImage(PET_CONFIG.FALLBACK_SRC);
                } else {
                    showTextFallback();
                }
            };
            if (petImg.complete && petImg.naturalWidth === 0) {
                showTextFallback();
            }
        }

        /**
         * PR2-PET-07B: 幾何查詢器 (Viewport Geometry Resolver)
         * 統一取得 Visual Viewport、Layout Viewport 與 Safe Area Insets
         */
        function getViewportGeometry() {
            const vv = window.visualViewport;
            const width = vv ? vv.width : window.innerWidth;
            const height = vv ? vv.height : window.innerHeight;
            const offsetLeft = vv ? vv.offsetLeft : 0;
            const offsetTop = vv ? vv.offsetTop : 0;
            const scale = vv ? vv.scale : 1;

            let safeLeft = 0;
            let safeRight = 0;
            let safeBottom = 0;
            let safeTop = 0;

            try {
                const computed = getComputedStyle(document.documentElement);
                safeLeft = parseFloat(computed.getPropertyValue('--safe-area-left')) ||
                           parseFloat(computed.getPropertyValue('--safe-area-inset-left')) || 0;
                safeRight = parseFloat(computed.getPropertyValue('--safe-area-right')) ||
                            parseFloat(computed.getPropertyValue('--safe-area-inset-right')) || 0;
                safeBottom = parseFloat(computed.getPropertyValue('--safe-area-bottom')) ||
                             parseFloat(computed.getPropertyValue('--safe-area-inset-bottom')) || 0;
                safeTop = parseFloat(computed.getPropertyValue('--safe-area-top')) ||
                          parseFloat(computed.getPropertyValue('--safe-area-inset-top')) || 0;
            } catch (e) {
                safeLeft = 0;
                safeRight = 0;
                safeBottom = 0;
                safeTop = 0;
            }

            return {
                width,
                height,
                offsetLeft,
                offsetTop,
                scale,
                safeLeft,
                safeRight,
                safeBottom,
                safeTop
            };
        }

        /**
         * 量測安全可視邊界，結合 safe-area-inset 與元件寬度
         * PR2-PET-07B: 支援 Visual Viewport 偏移換算至 Layout Viewport
         */
        function updateBoundaries() {
            const geo = getViewportGeometry();
            const petWidth = petBtn.offsetWidth || 64;

            minX = geo.offsetLeft + PET_CONFIG.BOUNDARY_PADDING + geo.safeLeft;
            maxX = Math.max(minX, geo.offsetLeft + geo.width - petWidth - PET_CONFIG.BOUNDARY_PADDING - geo.safeRight);

            // 若尚未建立有效安全區間，預設當前區間為全域可視邊界
            if (safeIntervals.length === 0) {
                currentMinX = minX;
                currentMaxX = maxX;
            }

            clampPosition();
        }

        /**
         * 限制 posX 在 [currentMinX, currentMaxX] 區間內並更新 DOM transform
         */
        function clampPosition() {
            const boundMin = (currentMinX !== undefined && currentMinX >= minX) ? currentMinX : minX;
            const boundMax = (currentMaxX !== undefined && currentMaxX <= maxX) ? currentMaxX : maxX;
            posX = Math.max(boundMin, Math.min(posX, boundMax));
            petGuide.style.transform = `translateX(${posX}px)`;
        }

        /**
         * PR2-PET-07B: 對話框定位與 Clamp 演算法
         * 以角色為錨點，左右 Clamp 保留 12px 安全距離，並根據真實可用高度限制面板
         * @returns {boolean} 是否允許開啟對話框（可用高度不足 120px 時拒絕開啟）
         */
        function updateDialogPositionAndHeight() {
            const geo = getViewportGeometry();
            const petWidth = petBtn.offsetWidth || 64;
            const petHeight = petBtn.offsetHeight || 64;

            // 1. 真實可用高度計算
            // bottomInset 包含 clamp(16px, 3vw, 32px) 與 safeBottom
            let bottomInset = 20;
            try {
                const guideStyle = getComputedStyle(petGuide);
                bottomInset = parseFloat(guideStyle.bottom) || 20;
            } catch (e) {
                bottomInset = 20 + geo.safeBottom;
            }

            const dialogGap = 10;
            const topMargin = 12 + geo.safeTop;
            const availableHeight = geo.height - (bottomInset + petHeight + dialogGap + topMargin);

            // 規格要求：可用高度不足 120px 時安全拒絕開啟或關閉面板
            if (availableHeight < 120) {
                return false;
            }

            // 2. 設置對話框最大高度與緊湊模式
            petDialog.style.maxHeight = `${Math.floor(availableHeight)}px`;
            if (availableHeight < 160) {
                petDialog.classList.add('is-compact');
            } else {
                petDialog.classList.remove('is-compact');
            }

            // 3. 水平 Clamp 計算
            // 角色相對於 Visual Viewport 的目前左緣
            const petVisualX = posX - geo.offsetLeft;
            const dialogWidth = petDialog.offsetWidth || 200;

            // 理想中心對齊：對話框中心與角色中心重疊
            const desiredVisualLeft = petVisualX + (petWidth / 2) - (dialogWidth / 2);

            const minAllowedVisual = geo.safeLeft + 12;
            const maxAllowedVisual = geo.width - geo.safeRight - 12 - dialogWidth;

            let clampedVisualLeft;
            if (maxAllowedVisual < minAllowedVisual) {
                // 窄螢幕（如 320px）下對話框寬度貼滿安全區間
                clampedVisualLeft = minAllowedVisual;
                petDialog.style.maxWidth = `${Math.max(120, geo.width - minAllowedVisual - geo.safeRight - 12)}px`;
            } else {
                clampedVisualLeft = Math.max(minAllowedVisual, Math.min(desiredVisualLeft, maxAllowedVisual));
            }

            // 對話框相對於角色左緣 (left: 0) 的 CSS 水平偏移量
            const dialogShiftX = clampedVisualLeft - petVisualX;
            petDialog.style.setProperty('--dialog-shift-x', `${Math.round(dialogShiftX)}px`);

            return true;
        }

        /**
         * 更新圖像水平翻轉方向
         */
        function updateFacing() {
            if (petImg) {
                if (direction === 1) {
                    petImg.classList.add('is-flipped');
                } else {
                    petImg.classList.remove('is-flipped');
                }
            }
        }

        /**
         * 挑選行走速度
         */
        function pickWalkingSpeed() {
            const isMobile = window.innerWidth <= 500;
            if (isMobile) {
                return getRandomRange(PET_CONFIG.SPEED.MOBILE_MIN, PET_CONFIG.SPEED.MOBILE_MAX);
            }
            return getRandomRange(PET_CONFIG.SPEED.DESKTOP_MIN, PET_CONFIG.SPEED.DESKTOP_MAX);
        }

        /**
         * rAF 移動主迴圈：單一 loop，僅在 Walking 且允許移動時運行
         * @param {number} timestamp
         */
        function movementStep(timestamp) {
            if (currentState !== PET_STATES.WALKING || !isMovementAllowed()) {
                animationFrameId = null;
                return;
            }

            if (!lastTimestamp) {
                lastTimestamp = timestamp;
            }

            let deltaMs = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (deltaMs > PET_CONFIG.MAX_DELTA_MS) {
                deltaMs = PET_CONFIG.MAX_DELTA_MS;
            }

            const deltaSeconds = deltaMs / 1000;
            posX += direction * speed * deltaSeconds;

            // 邊界碰撞檢測與轉向（遵循目前所在安全區間或全域邊界）
            const boundMin = (currentMinX !== undefined && currentMinX >= minX) ? currentMinX : minX;
            const boundMax = (currentMaxX !== undefined && currentMaxX <= maxX) ? currentMaxX : maxX;

            if (posX <= boundMin) {
                posX = boundMin;
                direction = 1;
                updateFacing();
            } else if (posX >= boundMax) {
                posX = boundMax;
                direction = -1;
                updateFacing();
            }

            petGuide.style.transform = `translateX(${posX}px)`;

            animationFrameId = requestAnimationFrame(movementStep);
        }

        /**
         * 啟動 rAF 移動迴圈
         */
        function startMovementLoop() {
            if (animationFrameId !== null) return;
            lastTimestamp = 0;
            animationFrameId = requestAnimationFrame(movementStep);
        }

        /**
         * 停止 rAF 移動迴圈
         */
        function stopMovementLoop() {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            lastTimestamp = 0;
        }

        /**
         * 5. 狀態渲染器 (Render)
         * 集中管理圖片、對話框 class、DOM 狀態以及 ARIA 屬性同步
         * @param {string} state
         * @param {string} prevState
         */
        function render(state, prevState) {
            if (petGuide) {
                Object.values(PET_STATES).forEach((s) => {
                    petGuide.classList.remove(`is-${s.toLowerCase()}`);
                });
                petGuide.classList.add(`is-${state.toLowerCase()}`);
            }

            switch (state) {
                case PET_STATES.IDLE:
                    stopMovementLoop();
                    syncPetAsset();
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.DEFAULT);
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = false;

                    // Idle 到期後排程轉為 Walking
                    // 若偏好減少動態則不排程 Walking；若前一狀態為 Happy，固定先 Idle 2 秒契約；否則隨機 2–5 秒
                    if (!prefersReducedMotion) {
                        const delay = (prevState === PET_STATES.HAPPY)
                            ? PET_CONFIG.DURATION.AFTER_DIALOG_IDLE
                            : getRandomRange(PET_CONFIG.DURATION.IDLE_MIN, PET_CONFIG.DURATION.IDLE_MAX);
                        scheduler.schedule(PET_STATES.WALKING, delay);
                    }
                    break;

                case PET_STATES.HAPPY:
                    stopMovementLoop();
                    syncPetAsset();

                    // PR2-PET-07B: 檢查可用高度，不足 120px 時拒絕開啟對話框並退回 Idle
                    if (!updateDialogPositionAndHeight()) {
                        currentState = PET_STATES.IDLE;
                        render(PET_STATES.IDLE, prevState);
                        return;
                    }

                    petDialog.classList.add('is-open');
                    petBtn.setAttribute('aria-expanded', 'true');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.OPEN);
                    petDialog.setAttribute('aria-hidden', 'false');
                    setPetOptionsTabIndex(true);
                    updatePauseButtonUI();
                    if (petGuide) petGuide.hidden = false;
                    // PR2-PET-07A: 每次開啟更新一次短句，同次不自動輪播
                    if (petSpeechEl) {
                        petSpeechEl.textContent = pickSpeech();
                    }
                    break;

                case PET_STATES.WALKING:
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.DEFAULT);
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = false;

                    // 決定行走方向（在邊界處只能向內）
                    if (posX <= minX + 2) {
                        direction = 1;
                    } else if (posX >= maxX - 2) {
                        direction = -1;
                    } else {
                        direction = Math.random() < 0.5 ? -1 : 1;
                    }
                    updateFacing();

                    speed = pickWalkingSpeed();

                    if (isMovementAllowed()) {
                        syncPetAsset();
                        startMovementLoop();
                    } else {
                        syncPetAsset();
                    }

                    // 行走 4–8 秒後排程轉為 Idle
                    {
                        const walkDuration = getRandomRange(PET_CONFIG.DURATION.WALK_MIN, PET_CONFIG.DURATION.WALK_MAX);
                        scheduler.schedule(PET_STATES.IDLE, walkDuration);
                    }
                    break;

                case PET_STATES.HIDDEN:
                    stopMovementLoop();
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = true;
                    break;
            }
        }

        /**
         * 6. 單一狀態轉換入口 (Transition)
         * 集中檢查狀態契約、徹底銷毀舊計時器排程，並調用統一渲染
         * @param {string} nextState
         * @returns {boolean} 是否轉換成功
         */
        function transitionTo(nextState) {
            if (!Object.values(PET_STATES).includes(nextState)) {
                console.warn(`[Pet] 未知的狀態轉換目標: ${nextState}`);
                return false;
            }

            if (currentState === nextState) {
                return false;
            }

            // 狀態切換：徹底銷毀上一狀態的計時器，防範舊 Walking / Idle 排程復活
            scheduler.cancel();

            const prevState = currentState;
            currentState = nextState;

            render(currentState, prevState);
            return true;
        }

        // 7. 統一事件處理中心 (Event Handlers)

        /**
         * 點擊角色按鈕
         */
        function handlePetClick(e) {
            if (e) e.preventDefault();
            if (currentState === PET_STATES.HAPPY) {
                transitionTo(PET_STATES.IDLE);
            } else if (currentState === PET_STATES.IDLE || currentState === PET_STATES.WALKING) {
                transitionTo(PET_STATES.HAPPY);
            }
        }

        /**
         * 點擊外部關閉
         * PR2-PET-07A: 補強焦點判斷，僅在焦點位於 pet-guide 內時才返焦，
         * 否則尊重使用者正在操作的外部元素，不搶奪焦點。
         */
        function handleDocumentClick(e) {
            if (currentState !== PET_STATES.HAPPY) return;

            if (!petBtn.contains(e.target) && !petDialog.contains(e.target)) {
                // 先判斷焦點位置，再執行狀態轉換（轉換後 activeElement 可能已跳位）
                const focusIsInPetGuide = petGuide.contains(document.activeElement);
                transitionTo(PET_STATES.IDLE);
                // 僅在焦點確實在 pet-guide 內時才返焦
                if (focusIsInPetGuide) {
                    petBtn.focus({ preventScroll: true });
                }
            }
        }

        /**
         * 導覽項目點擊（僅限具備 data-target 之導覽按鈕）
         * PR2-PET-07A: 導覽後將焦點移至目的地 section 的 .title 或 section 本身
         */
        function handleNavOptionClick(e) {
            const btn = e.currentTarget;
            const targetId = btn.dataset.target;
            const target = targetId ? document.getElementById(targetId) : null;

            if (target) {
                target.scrollIntoView({ behavior: scrollBehavior });

                // 優先聚焦 section 下的 .title；無法使用時才聚焦 section 本身
                const heading = target.querySelector('.title') || target;
                const needsTabindex = !heading.getAttribute('tabindex');
                if (needsTabindex) {
                    heading.setAttribute('tabindex', '-1');
                    heading.addEventListener('blur', () => {
                        heading.removeAttribute('tabindex');
                    }, { once: true });
                }
                heading.focus({ preventScroll: true });
            }

            // 導覽後關閉對話框，轉回 Idle 狀態
            transitionTo(PET_STATES.IDLE);
        }

        /**
         * 手動暫停／恢復按鈕切換
         */
        function handlePauseToggle(e) {
            if (e) e.stopPropagation();
            if (prefersReducedMotion) return;

            userPaused = !userPaused;
            if (userPaused) {
                addPauseReason('user');
            } else {
                removePauseReason('user');
            }
            updatePauseButtonUI();
        }

        /**
         * PR2-PET-07A: 關閉按鈕點擊 Handler
         * 關閉對話框並將焦點返回角色
         */
        function handleCloseBtn(e) {
            if (e) e.stopPropagation(); // 防止觸發 handleDocumentClick
            transitionTo(PET_STATES.IDLE);
            petBtn.focus({ preventScroll: true });
        }

        /**
         * PR2-PET-07A: 全域 Escape 按鍵 Handler
         * 在 Happy 狀態下按 Escape 關閉對話框並將焦點返回角色
         */
        function handleDocumentKeydown(e) {
            if (e.key !== 'Escape') return;
            if (currentState !== PET_STATES.HAPPY) return;
            e.preventDefault();
            transitionTo(PET_STATES.IDLE);
            petBtn.focus({ preventScroll: true });
        }

        /**
         * 判定目前裝置是否具備 hover 懸停能力
         */
        function canHover() {
            return !window.matchMedia || window.matchMedia('(hover: hover)').matches;
        }

        /**
         * 判定目前指標是否正懸停於角色容器上方（排除不具 hover 能力之觸控裝置）
         */
        function isHovered() {
            if (!canHover()) return false;
            try {
                return Boolean(petGuide && petGuide.matches && petGuide.matches(':hover'));
            } catch (e) {
                return false;
            }
        }

        /**
         * 指標懸停進入（必須判斷 pointerType 為 mouse 且具備懸停能力，防止觸控殘留）
         */
        function handlePointerEnter(e) {
            if (e.pointerType === 'mouse' && canHover()) {
                addPauseReason('hover');
            }
        }

        /**
         * 指標移出（可靠釋放 hover 原因）
         */
        function handlePointerLeave() {
            removePauseReason('hover');
        }

        /**
         * 指標按壓
         */
        function handlePointerDown() {
            addPauseReason('pointerdown');
        }

        /**
         * 指標釋放
         */
        function handlePointerUp() {
            removePauseReason('pointerdown');
        }

        /**
         * 指標取消（可靠釋放 pointerdown 與 hover 原因）
         */
        function handlePointerCancel() {
            removePauseReason('pointerdown');
            removePauseReason('hover');
        }

        /**
         * 視窗失焦保護（防止指標按壓狀態懸掛殘留）
         */
        function handleWindowBlur() {
            removePauseReason('pointerdown');
        }

        /**
         * 鍵盤焦點移入
         */
        function handleFocusIn(e) {
            if (petGuide.contains(e.target)) {
                addPauseReason('focus');
            }
        }

        /**
         * 鍵盤焦點移出（雙層判定防抖，避免在角色與面板控制項之間切換時誤解鎖）
         */
        function handleFocusOut(e) {
            if (e.relatedTarget && petGuide.contains(e.relatedTarget)) {
                return;
            }
            setTimeout(() => {
                if (!petGuide.contains(document.activeElement)) {
                    removePauseReason('focus');
                }
            }, 0);
        }

        /**
         * Reduced Motion 動態偏好變更
         */
        function handleMotionChange(e) {
            prefersReducedMotion = e.matches;
            scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
            if (prefersReducedMotion) {
                addPauseReason('reducedMotion');
                scheduler.cancel();
                if (currentState === PET_STATES.WALKING) {
                    transitionTo(PET_STATES.IDLE);
                }
            } else {
                removePauseReason('reducedMotion');
                if (currentState === PET_STATES.IDLE && scheduler.targetState === null) {
                    scheduler.schedule(PET_STATES.WALKING, getRandomRange(PET_CONFIG.DURATION.IDLE_MIN, PET_CONFIG.DURATION.IDLE_MAX));
                }
            }
            syncPetAsset();
            updatePauseButtonUI();
        }

        /**
         * 頁面可見度改變
         */
        function handleVisibilityChange() {
            if (document.hidden) {
                removePauseReason('pointerdown');
                removePauseReason('hover');
                addPauseReason('visibility');
            } else {
                removePauseReason('visibility');
            }
        }

        /**
         * 頁面隱藏 (Pagehide)
         */
        function handlePageHide() {
            removePauseReason('pointerdown');
            removePauseReason('hover');
            addPauseReason('visibility');
        }

        /**
         * 頁面恢復 (Pageshow / BFCache 喚醒)
         */
        function handlePageShow() {
            updateBoundaries();
            const currentMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (currentMotion !== prefersReducedMotion) {
                handleMotionChange({ matches: currentMotion });
            }
            removePauseReason('pointerdown');

            // BFCache 恢復時校正 Hover 狀態：
            // 僅在具備 hover 懸停能力且當前指標確實命中容器時建立/保留 hover 暫停，
            // 避免觸控裝置誤判，亦避免滑鼠停在角色上時誤解除暫停。
            // 先於 visibility 處理，防止多重原因切換時產生短暫啟動的抖動。
            if (isHovered()) {
                addPauseReason('hover');
            } else {
                removePauseReason('hover');
            }

            if (!petGuide.contains(document.activeElement)) {
                removePauseReason('focus');
            }
            if (!document.hidden) {
                removePauseReason('visibility');
            }

            lastTimestamp = 0;
            syncPetAsset();
        }

        /**
         * 視窗尺寸改變時更新邊界、Clamp 與對話框
         */
        function handleResize() {
            if (resizeDebounceTimeout) clearTimeout(resizeDebounceTimeout);
            resizeDebounceTimeout = setTimeout(() => {
                resizeDebounceTimeout = null;
                updateBoundaries();
                evaluateAvoidanceIntervals();
                if (currentState === PET_STATES.HAPPY) {
                    if (!updateDialogPositionAndHeight()) {
                        transitionTo(PET_STATES.IDLE);
                    }
                }
            }, 120);
        }

        // 事件綁定
        petBtn.addEventListener('click', handlePetClick);
        document.addEventListener('click', handleDocumentClick);
        petOptions.forEach((option) => {
            option.addEventListener('click', handleNavOptionClick);
        });
        if (petPauseBtn) {
            petPauseBtn.addEventListener('click', handlePauseToggle);
        }

        // PR2-PET-07A: 關閉按鈕與全域 Escape 鍵（初始化時綁定一次，不在 render 中重複綁定）
        if (petCloseBtn) {
            petCloseBtn.addEventListener('click', handleCloseBtn);
        }
        document.addEventListener('keydown', handleDocumentKeydown);

        // 指標與焦點暫停綁定
        petGuide.addEventListener('pointerenter', handlePointerEnter);
        petGuide.addEventListener('pointerleave', handlePointerLeave);
        petGuide.addEventListener('focusin', handleFocusIn);
        petGuide.addEventListener('focusout', handleFocusOut);
        petBtn.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerCancel);

        // 生命週期與偏好監聽
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('resize', handleResize);
        window.addEventListener('blur', handleWindowBlur);

        // PR2-PET-07B: Visual Viewport、捲動、表單焦點與卡片生成監聽
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            window.visualViewport.addEventListener('scroll', handleScroll);
        }
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('orientationchange', () => {
            handleResize();
            setTimeout(handleResize, 200);
        });

        document.addEventListener('focusin', handleFormFocusIn, true);
        document.addEventListener('focusout', handleFormFocusOut, true);
        setupProjectsObserver();

        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', handleMotionChange);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(handleMotionChange);
        }

        // 初始化邊界與初始位置
        updateBoundaries();
        evaluateAvoidanceIntervals();
        posX = maxX;
        direction = -1; // 預設靠右，起始向左面
        updateFacing();
        clampPosition();

        // 首次進入：以 Idle 2 秒為初始，若無 Reduced Motion 則排程轉入 Walking
        currentState = PET_STATES.IDLE;
        render(currentState, null);
        scheduler.cancel();
        if (!prefersReducedMotion) {
            scheduler.schedule(PET_STATES.WALKING, 2000);
        }
        updatePauseButtonUI();

        // 8. 內部與測試控制器（供驗收測試與除錯）
        window.__petController = {
            STATES: PET_STATES,
            CONFIG: PET_CONFIG,
            getState: () => currentState,
            getPosition: () => posX,
            setPosition: (x) => {
                posX = x;
                clampPosition();
            },
            getDirection: () => direction,
            setDirection: (d) => {
                direction = d;
                updateFacing();
            },
            getBoundaries: () => ({ minX, maxX }),
            transitionTo,
            isPaused: () => pauseReasons.size > 0,
            isMovementAllowed,
            getPauseReasons: () => Array.from(pauseReasons),
            addPauseReason,
            removePauseReason,
            getSchedulerState: () => ({ ...scheduler }),
            toggleUserPause: () => handlePauseToggle(),
            getUserPaused: () => userPaused,
            canHover,
            isHovered,
            setReducedMotion: (val) => handleMotionChange({ matches: !!val }),
            syncPetAsset,
            clearAllTimers: () => scheduler.cancel(),
            stepMovement: (deltaMs) => {
                if (currentState !== PET_STATES.WALKING || !isMovementAllowed()) return;
                const d = Math.min(deltaMs, PET_CONFIG.MAX_DELTA_MS) / 1000;
                posX += direction * speed * d;
                if (posX <= minX) {
                    posX = minX;
                    direction = 1;
                    updateFacing();
                } else if (posX >= maxX) {
                    posX = maxX;
                    direction = -1;
                    updateFacing();
                }
                petGuide.style.transform = `translateX(${posX}px)`;
            },
            closePetDialog: () => transitionTo(PET_STATES.IDLE),
            openPetDialog: () => transitionTo(PET_STATES.HAPPY),
            togglePetDialog: () => {
                if (currentState === PET_STATES.HAPPY) {
                    transitionTo(PET_STATES.IDLE);
                } else {
                    transitionTo(PET_STATES.HAPPY);
                }
            },
            setPetImage,
            showTextFallback,
            updateBoundaries,
            // PR2-PET-07A: 新增測試接口
            pickSpeech,
            getSpeechIndex: () => lastSpeechIndex,
            closePetDialogWithFocus: () => {
                transitionTo(PET_STATES.IDLE);
                petBtn.focus({ preventScroll: true });
            },
            triggerEscape: () => handleDocumentKeydown({ key: 'Escape', preventDefault: () => {} }),
            // PR2-PET-07B: 避讓系統測試接口
            isAvoidanceHidden: () => isAvoidanceHidden,
            getSafeIntervals: () => safeIntervals.map(i => ({ ...i })),
            getCurrentInterval: () => (currentInterval ? { ...currentInterval } : null),
            evaluateAvoidance: () => evaluateAvoidanceIntervals(),
            setAvoidanceHidden: (h) => setAvoidanceHidden(h),
            getViewportGeometry,
            updateDialogPositionAndHeight
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPet);
    } else {
        initPet();
    }
})();
