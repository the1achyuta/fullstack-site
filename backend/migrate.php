<?php
$pdo = new PDO('sqlite:backend/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    $pdo->exec("ALTER TABLE user_addresses ADD COLUMN name TEXT;");
    echo "Column added successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
