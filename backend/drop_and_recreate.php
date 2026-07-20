<?php
$pdo = new PDO('sqlite:backend/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
try {
    $pdo->exec("DROP TABLE IF EXISTS user_addresses");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT,
        address_line_1 TEXT,
        city TEXT,
        zip TEXT,
        is_default INTEGER DEFAULT 0
    )");
    
    echo "Table recreated successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
