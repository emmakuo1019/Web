<?php
// 顯示所有錯誤（開發階段用，正式上線要關掉）
ini_set('display_errors', 1);
error_reporting(E_ALL);

// 資料庫連線參數
$host = 'localhost'; // 如果是本地端或cPanel通常是localhost，不要加:3306
$dbname = 'emmakuo_testform';
$username = 'emmakuo';
$password = 'Emma20041019';

// 建立資料庫連線
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500); // 回傳500給前端
    echo "資料庫連線失敗: " . $e->getMessage();
    exit;
}

// 接收表單資料
$name = $_POST['name'] ?? '';
$company = $_POST['company'] ?? '';
$email = $_POST['email'] ?? '';
$information = $_POST['information'] ?? '';

// 檢查資料是否為空
if (empty($name) || empty($email) || empty($information)) {
    http_response_code(400); // 回傳400給前端
    echo "請填寫所有必填欄位 (姓名、Email、訊息)";
    exit;
}

// 寫入資料庫
try {
    $stmt = $pdo->prepare("INSERT INTO 表單資料表 (name, company, email, information) VALUES (:name, :company, :email, :information)");
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':company', $company);
    $stmt->bindParam(':email', $email);
    $stmt->bindParam(':information', $information);
    $stmt->execute();
    echo "收到回覆了！";
} catch (PDOException $e) {
    http_response_code(500);
    echo "資料儲存失敗: " . $e->getMessage();
    exit;
}
?>
