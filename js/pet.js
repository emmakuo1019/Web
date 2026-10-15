/**
 * PR2: Bug 先生角色互動模組
 * PR2-PET-06C: 暫停、Reduced Motion 與生命週期
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
        MAX_DELTA_MS: 50
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
        const petImg = petBtn.querySelector('.pet-img');

        // 偵測 Reduced Motion 偏好
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let prefersReducedMotion = motionQuery.matches;
        let scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

        // 3. FSM 核心狀態與排程追蹤
        let currentState = PET_STATES.IDLE;
        let fallbackApplied = false;
        let userPaused = false;

        // 暫停原因集合管理 (PauseManager)
        const pauseReasons = new Set();
        if (prefersReducedMotion) {
            pauseReasons.add('reducedMotion');
        }

        // 4. 移動、物理邊界與 rAF 狀態
        let posX = 0;
        let direction = 1; // 1: 向右, -1: 向左
        let speed = 35; // px/s
        let minX = 0;
        let maxX = 0;
        let animationFrameId = null;
        let lastTimestamp = 0;

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
                if (this.targetState !== null && this.remainingMs > 0 && this.timerId === null) {
                    const delay = Math.max(200, this.remainingMs);
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
         * 量測安全可視邊界，結合 safe-area-inset 與元件寬度
         */
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

        /**
         * 限制 posX 在 [minX, maxX] 區間內並更新 DOM transform
         */
        function clampPosition() {
            posX = Math.max(minX, Math.min(posX, maxX));
            petGuide.style.transform = `translateX(${posX}px)`;
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

            // 邊界碰撞檢測與轉向
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
                    petDialog.classList.add('is-open');
                    petBtn.setAttribute('aria-expanded', 'true');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.OPEN);
                    petDialog.setAttribute('aria-hidden', 'false');
                    setPetOptionsTabIndex(true);
                    updatePauseButtonUI();
                    if (petGuide) petGuide.hidden = false;
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
         */
        function handleDocumentClick(e) {
            if (currentState !== PET_STATES.HAPPY) return;

            if (!petBtn.contains(e.target) && !petDialog.contains(e.target)) {
                transitionTo(PET_STATES.IDLE);
            }
        }

        /**
         * 導覽項目點擊（僅限具備 data-target 之導覽按鈕）
         */
        function handleNavOptionClick(e) {
            const btn = e.currentTarget;
            const targetId = btn.dataset.target;
            const target = targetId ? document.getElementById(targetId) : null;

            if (target) {
                target.scrollIntoView({ behavior: scrollBehavior });
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
         * 判定目前裝置是否具備 hover 懸停能力
         */
        function canHover() {
            return !window.matchMedia || window.matchMedia('(hover: hover)').matches;
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
            if (!document.hidden) {
                removePauseReason('visibility');
            }
            if (!petGuide.contains(document.activeElement)) {
                removePauseReason('focus');
            }
            removePauseReason('pointerdown');
            removePauseReason('hover');
            lastTimestamp = 0;
            syncPetAsset();
        }

        /**
         * 視窗尺寸改變時更新邊界與 Clamp
         */
        function handleResize() {
            updateBoundaries();
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

        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', handleMotionChange);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(handleMotionChange);
        }

        // 初始化邊界與初始位置
        updateBoundaries();
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
            updateBoundaries
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPet);
    } else {
        initPet();
    }
})();
