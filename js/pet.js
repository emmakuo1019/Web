/**
 * PR2: Bug 先生角色互動模組
 * PR2-PET-06B: 底部移動、停留與邊界
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

        const petOptions = petDialog.querySelectorAll('.pet-options button');
        const petImg = petBtn.querySelector('.pet-img');

        // 偵測 Reduced Motion 偏好
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

        // 3. FSM 核心狀態與排程追蹤
        let currentState = PET_STATES.IDLE;
        const timers = new Set();
        let fallbackApplied = false;

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
         * 安全排程註冊：集中管理以確保狀態轉換或清理時能完全清除
         * @param {Function} fn
         * @param {number} delay
         * @returns {number}
         */
        function registerTimer(fn, delay) {
            const id = setTimeout(() => {
                timers.delete(id);
                fn();
            }, delay);
            timers.add(id);
            return id;
        }

        /**
         * 清理所有排程計時器
         */
        function clearAllTimers() {
            timers.forEach((id) => clearTimeout(id));
            timers.clear();
        }

        /**
         * 同步 tabindex，確保隱藏 dialog 內的按鈕不被 Tab 聚焦
         * @param {boolean} accessible
         */
        function setPetOptionsTabIndex(accessible) {
            petOptions.forEach((btn) => {
                btn.setAttribute('tabindex', accessible ? '0' : '-1');
            });
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
         * 切換角色圖片，包含素材載入失敗回退機制
         * @param {string} src
         */
        function setPetImage(src) {
            if (!petImg || petImg.style.display === 'none' || fallbackApplied) return;

            // 綁定單次錯誤處理，避免無限錯誤迴圈
            petImg.onerror = () => {
                petImg.onerror = null;
                // 若 GIF 或 Happy 圖載入失敗，優先降級至靜態 Idle 圖
                if (src !== PET_CONFIG.FALLBACK_SRC && !petImg.src.endsWith(PET_CONFIG.FALLBACK_SRC)) {
                    setPetImage(PET_CONFIG.FALLBACK_SRC);
                } else {
                    // 若 Idle 圖也載入失敗，降級至可讀「Bug」文字按鈕
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

            // 讀取 safe-area-inset（若環境不支援則退回 0）
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

            // Clamp 當前位置，避免視窗縮小或旋轉時超出畫面
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
         * 原素材 pet.gif 為正向面對，向右為正向，向左 scaleX(-1) 翻轉
         */
        function updateFacing() {
            if (petImg) {
                if (direction === -1) {
                    petImg.classList.add('is-flipped');
                } else {
                    petImg.classList.remove('is-flipped');
                }
            }
        }

        /**
         * 挑選行走速度（依螢幕寬度區分手機與桌面）
         */
        function pickWalkingSpeed() {
            const isMobile = window.innerWidth <= 500;
            if (isMobile) {
                return getRandomRange(PET_CONFIG.SPEED.MOBILE_MIN, PET_CONFIG.SPEED.MOBILE_MAX);
            }
            return getRandomRange(PET_CONFIG.SPEED.DESKTOP_MIN, PET_CONFIG.SPEED.DESKTOP_MAX);
        }

        /**
         * 排程：下一次自動狀態切換
         * @param {string} toState
         * @param {number} delay
         */
        function scheduleNextState(toState, delay) {
            registerTimer(() => {
                transitionTo(toState);
            }, delay);
        }

        /**
         * rAF 移動主迴圈：單一 loop，僅在 Walking 狀態時運行
         * @param {number} timestamp
         */
        function movementStep(timestamp) {
            if (currentState !== PET_STATES.WALKING) {
                animationFrameId = null;
                return;
            }

            if (!lastTimestamp) {
                lastTimestamp = timestamp;
            }

            let deltaMs = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            // 限制 deltaMs 上限，防止背景恢復或掉幀時瞬移
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
            // 更新狀態 class 於外層容器
            if (petGuide) {
                Object.values(PET_STATES).forEach((s) => {
                    petGuide.classList.remove(`is-${s.toLowerCase()}`);
                });
                petGuide.classList.add(`is-${state.toLowerCase()}`);
            }

            switch (state) {
                case PET_STATES.IDLE:
                    stopMovementLoop();
                    setPetImage(PET_CONFIG.ASSETS.IDLE);
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.DEFAULT);
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = false;

                    // Idle 到期後轉為 Walking
                    // 若前一狀態為 Happy，固定先 Idle 2 秒；否則隨機 2–5 秒
                    {
                        const delay = (prevState === PET_STATES.HAPPY)
                            ? PET_CONFIG.DURATION.AFTER_DIALOG_IDLE
                            : getRandomRange(PET_CONFIG.DURATION.IDLE_MIN, PET_CONFIG.DURATION.IDLE_MAX);
                        scheduleNextState(PET_STATES.WALKING, delay);
                    }
                    break;

                case PET_STATES.HAPPY:
                    // 打開對話立即停止移動
                    stopMovementLoop();
                    setPetImage(PET_CONFIG.ASSETS.HAPPY);
                    petDialog.classList.add('is-open');
                    petBtn.setAttribute('aria-expanded', 'true');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.OPEN);
                    petDialog.setAttribute('aria-hidden', 'false');
                    setPetOptionsTabIndex(true);
                    if (petGuide) petGuide.hidden = false;
                    break;

                case PET_STATES.WALKING:
                    setPetImage(PET_CONFIG.ASSETS.WALKING);
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
                        // 隨機選擇左右
                        direction = Math.random() < 0.5 ? -1 : 1;
                    }
                    updateFacing();

                    speed = pickWalkingSpeed();
                    startMovementLoop();

                    // 行走 4–8 秒後轉為 Idle 停留
                    {
                        const walkDuration = getRandomRange(PET_CONFIG.DURATION.WALK_MIN, PET_CONFIG.DURATION.WALK_MAX);
                        scheduleNextState(PET_STATES.IDLE, walkDuration);
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
         * 集中檢查狀態契約、執行排程清理並調用統一渲染
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

            // 清理上一狀態的臨時排程計時器
            clearAllTimers();

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
         * 三個導覽項目點擊
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
        window.addEventListener('resize', handleResize);

        // 初始化邊界與初始位置
        updateBoundaries();
        // 初始右側對齊（延用 PR1 視覺慣例）
        posX = maxX;
        direction = -1; // 預設靠右，起始向左面
        updateFacing();
        clampPosition();

        // 首次進入：以 Idle 2 秒為初始，隨後轉入 Walking
        currentState = PET_STATES.IDLE;
        render(currentState, null);
        clearAllTimers();
        scheduleNextState(PET_STATES.WALKING, 2000);

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
            clearAllTimers,
            registerTimer,
            stepMovement: (deltaMs) => {
                if (currentState !== PET_STATES.WALKING) return;
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


