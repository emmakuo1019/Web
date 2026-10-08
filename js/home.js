$(document).ready(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    // ==========================================
    // 1. 導覽列平滑捲動 (Nav Scroll)
    // ==========================================
    const scrollLinks = {
        'emma': 'home-area',
        'home': 'home-area',
        'works': 'works-area',
        'profile': 'profile-area',
        'contact': 'contact-area'
    };

    // 迴圈綁定點擊事件
    for (const [btnId, targetId] of Object.entries(scrollLinks)) {
        const btn = document.getElementById(btnId);
        const target = document.getElementById(targetId);

        if (btn && target) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                target.scrollIntoView({ behavior: scrollBehavior });
                if (window.history && window.history.pushState) {
                    window.history.pushState(null, '', `#${targetId}`);
                }
            });
        }
    }

    // Back to top 按鈕
    const backBtns = document.querySelectorAll('.back, .back2');
    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: scrollBehavior });
        });
    });


    // ==========================================
    // 2. 物理拉繩開關 (Matter.js Theme Toggle)
    // ==========================================
    const container = document.getElementById('rope-container');

    // 如果畫面上有這個容器，而且 Matter 引擎有載入，才執行畫繩子
    if (container && typeof Matter !== 'undefined') {
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Composites = Matter.Composites,
            MouseConstraint = Matter.MouseConstraint,
            Mouse = Matter.Mouse,
            Composite = Matter.Composite,
            Bodies = Matter.Bodies;

        const engine = Engine.create();
        const world = engine.world;

        const render = Render.create({
            element: container,
            engine: engine,
            options: {
                width: 100,
                height: 350,
                wireframes: false,
                background: 'transparent' // 透明背景
            }
        });

        const group = Matter.Body.nextGroup(true);

        // 1. 繩子的節點生成器 (Composites.stack)
        const rope = Composites.stack(50, 10, 1, 12, 10, 10, function(x, y) {
            return Bodies.circle(x, y, 2, { // <--- 球的半徑 (大小)
                collisionFilter: { group: group },
                render: { fillStyle: 'var(--text-color)' } // 讓繩子跟著你的文字顏色變化
            });
        });

        // 2. 將節點串連成繩子 (Composites.chain)
        Composites.chain(rope, 0.5, 0, -0.5, 0, {
            stiffness: 0.9,  // 這是繩子的彈性 (剛性)
            length: 1,       // <--- 這是球與球之間的「間距 (長度)」
            render: { visible: false } // 隱藏球與球之間的線
        });

        // 頂部固定點
        const anchor = Matter.Constraint.create({
            pointA: { x: 50, y: 0 },
            bodyB: rope.bodies[0],
            pointB: { x: -5, y: 0 },
            stiffness: 1,
            render: { visible: false }
        });

        // 底部的拉把
        const handle = Bodies.circle(50, 110, 15, {
            collisionFilter: { group: group },
            render: { fillStyle: '#000000' } 
        });
        const handleLink = Matter.Constraint.create({
            bodyA: rope.bodies[rope.bodies.length - 1],
            bodyB: handle,
            stiffness: 1,
            length: 0,
            render: { visible: false }
        });

        Composite.add(world, [rope, anchor, handle, handleLink]);

        // 滑鼠控制
        const mouse = Mouse.create(render.canvas);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        Composite.add(world, mouseConstraint);
        render.mouse = mouse;

        // 觸發切換邏輯
        let isPulled = false;
        Matter.Events.on(engine, 'afterUpdate', function() {
            if (handle.position.y > 220 && !isPulled) {
                isPulled = true;
                toggleTheme();   // 觸發切換
                handle.render.fillStyle = '#000000';
            }
            if (handle.position.y < 180 && isPulled) {
                isPulled = false;
                handle.render.fillStyle = '#000000';
            }
        });

        Render.run(render);
        Runner.run(Runner.create(), engine);

        // 主題切換函數
        function toggleTheme() {
            const root = document.documentElement;
            const currentTheme = root.getAttribute('data-theme') || 'light'; // 預設 light
            if (currentTheme === 'dark') {
                root.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                root.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        }
    }

    $("#work-top").on("click", function () {
        $(".work-info-big").css("display", "block");
        // ... (這裡保留你原本寫的程式碼)
    });
    

    const elements = document.querySelectorAll(".title");
    if (elements.length > 0 && 'IntersectionObserver' in window && !prefersReducedMotion) {
        document.documentElement.classList.add("js-reveal");
        function observeHandler(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                } else {
                    entry.target.classList.remove("visible");
                }
            });
        }

        const observer = new IntersectionObserver(observeHandler, { threshold: 0.1 });
        elements.forEach(element => {
            observer.observe(element);
        });
    }
    
/*表單訊息*/
    const form = document.getElementById("myForm");

    if (form) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();

            const formData = new FormData(form);

            fetch("submit.php", {
                method: "POST",
                body: formData
            })
                .then(response => response.text())
                .then(data => {
                    alert(data); // 顯示回傳的訊息
                    form.reset(); // 清空表單
                })
                .catch(error => {
                    alert('送出失敗，請稍後再試');
                    console.error('錯誤:', error);
                });
        });
    } else {
        console.error('找不到表單myForm');
    }


    // ==========================================
    // PET-02: 寵物球對話框開關
    // ==========================================
    const petBtn = document.getElementById('pet');
    const petDialog = document.getElementById('pet-dialog');

    function closePetDialog() {
        petDialog.classList.remove('is-open');
        petBtn.setAttribute('aria-expanded', 'false');
        petDialog.setAttribute('aria-hidden', 'true');
    }

    if (petBtn && petDialog) {
        petBtn.addEventListener('click', () => {
            const isOpen = petDialog.classList.toggle('is-open');
            petBtn.setAttribute('aria-expanded', String(isOpen));
            petDialog.setAttribute('aria-hidden', String(!isOpen));
        });
    }

    // ==========================================
    // PET-03: 三個導覽按鈕
    // ==========================================
    document.querySelectorAll('.pet-options button').forEach(option => {
        option.addEventListener('click', () => {
            const target = document.getElementById(option.dataset.target);
            if (!target) return;
            target.scrollIntoView({ behavior: scrollBehavior });
            closePetDialog();
        });
    });

}); // $(document).ready 結束