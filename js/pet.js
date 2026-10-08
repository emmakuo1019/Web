/**
 * PR2: Bug 先生角色互動模組
 * 包含角色狀態、對話框開關、導覽與素材載入失敗降級
 */
(function () {
    'use strict';

    const IDLE_SRC = 'picture/pet/pet.png';

    function initPet() {
        const petBtn = document.getElementById('pet');
        const petDialog = document.getElementById('pet-dialog');

        // 無 pet DOM 時直接退出，不影響其他頁面
        if (!petBtn || !petDialog) {
            return;
        }

        const petOptions = petDialog.querySelectorAll('.pet-options button');
        const petImg = petBtn.querySelector('.pet-img');

        // 偵測 Reduced Motion 偏好
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

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
         * 關閉對話框
         */
        function closePetDialog() {
            petDialog.classList.remove('is-open');
            petBtn.setAttribute('aria-expanded', 'false');
            petDialog.setAttribute('aria-hidden', 'true');
            setPetOptionsTabIndex(false);
        }

        /**
         * 開啟對話框
         */
        function openPetDialog() {
            petDialog.classList.add('is-open');
            petBtn.setAttribute('aria-expanded', 'true');
            petDialog.setAttribute('aria-hidden', 'false');
            setPetOptionsTabIndex(true);
        }

        /**
         * 切換對話框開關
         */
        function togglePetDialog() {
            const isOpen = petDialog.classList.toggle('is-open');
            petBtn.setAttribute('aria-expanded', String(isOpen));
            petDialog.setAttribute('aria-hidden', String(!isOpen));
            setPetOptionsTabIndex(isOpen);
        }

        /**
         * 圖片載入失敗時降級為文字按鈕
         */
        function showTextFallback() {
            if (petImg) {
                petImg.style.display = 'none';
            }
            if (!petBtn.querySelector('.pet-fallback-text')) {
                const textSpan = document.createElement('span');
                textSpan.className = 'pet-fallback-text';
                textSpan.textContent = 'Bug';
                petBtn.appendChild(textSpan);
                petBtn.classList.add('has-text-fallback');
            }
        }

        /**
         * 切換角色圖片，包含素材載入失敗回退機制
         * @param {string} src
         */
        function setPetImage(src) {
            if (!petImg || petImg.style.display === 'none') return;

            // 綁定單次錯誤處理，避免無限錯誤迴圈
            petImg.onerror = () => {
                petImg.onerror = null;
                // 若 GIF 或 Happy 圖載入失敗，優先降級至靜態 Idle 圖
                if (src !== IDLE_SRC && !petImg.src.endsWith(IDLE_SRC)) {
                    setPetImage(IDLE_SRC);
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
                if (!petImg.src.endsWith(IDLE_SRC)) {
                    setPetImage(IDLE_SRC);
                } else {
                    showTextFallback();
                }
            };
            // 若腳本執行前圖片已載入失敗（naturalWidth 為 0 且 complete）
            if (petImg.complete && petImg.naturalWidth === 0) {
                showTextFallback();
            }
        }

        // 初始化：隱藏狀態下不可 Tab
        setPetOptionsTabIndex(false);

        // 點擊角色切換對話框
        petBtn.addEventListener('click', (e) => {
            togglePetDialog();
        });

        // 點擊外部關閉
        document.addEventListener('click', (e) => {
            if (
                petDialog.classList.contains('is-open') &&
                !petBtn.contains(e.target) &&
                !petDialog.contains(e.target)
            ) {
                closePetDialog();
            }
        });

        // 三個導覽按鈕
        petOptions.forEach((option) => {
            option.addEventListener('click', () => {
                const targetId = option.dataset.target;
                const target = targetId ? document.getElementById(targetId) : null;
                if (target) {
                    target.scrollIntoView({ behavior: scrollBehavior });
                }
                closePetDialog();
            });
        });

        // 提供內部控制器供測試與後續任務擴充
        window.__petController = {
            closePetDialog,
            openPetDialog,
            togglePetDialog,
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
