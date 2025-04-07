$(document).ready(function () {

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

    const elements = document.querySelectorAll(".line")

    function observeHandler(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 當元素進入視窗時觸發動畫
                var $div = $(entry.target); // 使用 jQuery 選取目標元素
                $div.animate({width: '100%', opacity: '0.4'}, "slow");
                // 停止觀察該元素，避免重複動畫
                observer.unobserve(entry.target);
            }
        })
    }

    const observer = new IntersectionObserver(observeHandler);

    // 開始觀察指定的元素
    elements.forEach(element => {
        observer.observe(element);
    });

    $(".back").on("click", function () {
        $("html,body").animate(
            {
                scrollTop: 0
            })
    });

})