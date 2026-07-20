<?php
$pdo = new PDO('sqlite:backend/ecommerce.db');
$stmt = $pdo->query("PRAGMA table_info(user_addresses)");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
