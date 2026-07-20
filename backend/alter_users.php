<?php
$pdo = new PDO('sqlite:backend/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $pdo->exec("ALTER TABLE users ADD COLUMN mobile_number TEXT");
    echo "Added mobile_number.\n";
} catch (Exception $e) {
    echo "mobile_number may already exist.\n";
}

try {
    $pdo->exec("ALTER TABLE users ADD COLUMN whatsapp_number TEXT");
    echo "Added whatsapp_number.\n";
} catch (Exception $e) {
    echo "whatsapp_number may already exist.\n";
}
echo "Done.\n";
