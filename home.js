$(document).ready(function () {

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
    
})