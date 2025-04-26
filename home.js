$(document).ready(function () {
    console.log('home.js 載入成功');


    $("#emma").on("click", function () {
        $("#top-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        )
    });

    $("#top").on("click", function () {
        $("#top-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        )
    });

    $("#works").on("click", function () {
        $("#works-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        );
    });

    $("#profile").on("click", function () {
        $("#profile-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        );
    });

    $("#contact").on("click", function () {
        $("#contact-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        );
    });

    const elements = document.querySelectorAll(".title");

    function observeHandler(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            } else {
                entry.target.classList.remove("visible"); // 離開視窗就移除 class，讓它可以再次觸發
            }
        });
    }

    const observer = new IntersectionObserver(observeHandler);

    elements.forEach(element => {
        observer.observe(element);
    });
    
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
    
    $(".back").on("click", function () {
        $("html,body").animate(
            {
                scrollTop: 0
            })
    });

    $(".back2").on("click", function () {
        $("html,body").animate(
            {
                scrollTop: 0
            })
    });
/*作品頁*/
    $("#work-top").on("click", function () {
        $(".work-info-big").get(0).scrollIntoView(
            {behavior: "smooth"}
        )
    });
    
})