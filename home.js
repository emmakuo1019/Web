$(document).ready(function(){

    $('.fish').click(function(){
        $('.object').slideToggle(500);
    });

    $('.angry').click(function(){
        $('.object').slideToggle(500);
    });

});

$(document).ready(function () {
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
});
