$(document).ready(function () {

    $( "#top" ).on( "click", function() {
        $("html,body").animate(
            {
                scrollTop:0
            })
    });

    $( "#art" ).on( "click", function() {
        $("#art-area").get(0).scrollIntoView(
            {behavior:"smooth"}
        );
    } );
        
    $( "#picture" ).on( "click", function() {
        $("#picture-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        );
    } );

    $( "#game" ).on( "click", function() {
        $("#game-area").get(0).scrollIntoView(
            {behavior: "smooth"}
        );
    } );

    $(".contact").click(function(){
        $('.object').slideToggle(500);
    });

    const $track = $('.carousel-track');
    const $carousel = $('.carousel');
    const speed = 50; // 控制滾動速度，數字越小越快

    // 複製內容以實現無縫滾動
    $track.append($track.html());
    $track.append($track.html());

    let scrollAmount = 0;

    function startScrolling() {
        scrollAmount -= 1; // 每次向左滾動 1 像素
        if (Math.abs(scrollAmount) >= $track.width() / 1) {
            scrollAmount =0;
        }
        $track.css('transform', `translateX(${scrollAmount}px)`);
        requestAnimationFrame(startScrolling); // 使用更流暢的動畫更新
    }

    startScrolling();

    const elements = document.querySelectorAll(".line")
    function observeHandler(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 當元素進入視窗時觸發動畫
                var $div = $(entry.target); // 使用 jQuery 選取目標元素
                $div.animate({ width: '100%', opacity: '0.4' }, "slow");
                // 停止觀察該元素，避免重複動畫
                observer.unobserve(entry.target);
            }
        })
    }
    const observer = new IntersectionObserver(observeHandler);

    // 開始觀察指定的元素
    elements.forEach(element =>{
        observer.observe(element);
    });

    $( ".back" ).on( "click", function() {
        $("html,body").animate(
            {
                scrollTop:0
            })
    });
    $( ".back2" ).on( "click", function() {
        $("html,body").animate(
            {
                scrollTop:0
            })
    });
});

/*
    
    let currentIndex = 0; // 記錄當前顯示圖片的索引
    const artworks = $('.slideshow .artwork'); // 取得所有的 artwork 圖片
    $(artworks[currentIndex]).show(); // 初始顯示第一張圖片

    $('.slideshow').click(function () {
        $(artworks[currentIndex]).hide(); // 隱藏當前圖片
        currentIndex = (currentIndex + 1) % artworks.length; // 更新索引到下一張（若超出範圍則回到第一張）
        $(artworks[currentIndex]).fadeIn(); // 以淡入效果顯示下一張圖片
    });

    $('#target').on('input', function() {
        var inputValue = $(this).val();
        $('#display').text(inputValue);
    });
    */