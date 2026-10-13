/**
 * PR2: Bug 先生角色互動模組
 * PR2-PET-06A: FSM 狀態機與事件單一入口
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
        }
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
        if (!petBtn || !petDialog) {
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
         * 4. 狀態渲染器 (Render)
         * 集中管理圖片、對話框 class、DOM 狀態以及 ARIA 屬性同步
         * @param {string} state
         * @param {string} prevState
         */
        function render(state, prevState) {
            // 更新狀態 class 於外層容器或按鈕
            if (petGuide) {
                Object.values(PET_STATES).forEach((s) => {
                    petGuide.classList.remove(`is-${s.toLowerCase()}`);
                });
                petGuide.classList.add(`is-${state.toLowerCase()}`);
            }

            switch (state) {
                case PET_STATES.IDLE:
                    setPetImage(PET_CONFIG.ASSETS.IDLE);
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.DEFAULT);
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = false;
                    break;

                case PET_STATES.HAPPY:
                    setPetImage(PET_CONFIG.ASSETS.HAPPY);
                    petDialog.classList.add('is-open');
                    petBtn.setAttribute('aria-expanded', 'true');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.OPEN);
                    petDialog.setAttribute('aria-hidden', 'false');
                    setPetOptionsTabIndex(true);
                    if (petGuide) petGuide.hidden = false;
                    break;

                case PET_STATES.WALKING:
                    // 06A 狀態契約：更新素材與關閉對話，不啟動 rAF 移動（留待 06B）
                    setPetImage(PET_CONFIG.ASSETS.WALKING);
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petBtn.setAttribute('aria-label', PET_CONFIG.ARIA_LABELS.DEFAULT);
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = false;
                    break;

                case PET_STATES.HIDDEN:
                    // 06A 狀態契約：收起對話框、aria 關閉，UI 隱藏（不接 Debug/召回，留待 08A/08B）
                    petDialog.classList.remove('is-open');
                    petBtn.setAttribute('aria-expanded', 'false');
                    petDialog.setAttribute('aria-hidden', 'true');
                    setPetOptionsTabIndex(false);
                    if (petGuide) petGuide.hidden = true;
                    break;
            }
        }

        /**
         * 5. 單一狀態轉換入口 (Transition)
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

        // 6. 統一事件處理中心 (Event Handlers)

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

        // 事件綁定
        petBtn.addEventListener('click', handlePetClick);
        document.addEventListener('click', handleDocumentClick);
        petOptions.forEach((option) => {
            option.addEventListener('click', handleNavOptionClick);
        });

        // 初始化狀態渲染（預設 IDLE）
        render(currentState, null);

        // 7. 內部與測試控制器（保留並擴充）
        window.__petController = {
            STATES: PET_STATES,
            CONFIG: PET_CONFIG,
            getState: () => currentState,
            transitionTo,
            clearAllTimers,
            registerTimer,
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
            showTextFallback
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPet);
    } else {
        initPet();
    }
})();

