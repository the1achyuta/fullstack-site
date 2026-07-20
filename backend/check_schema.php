<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$stmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('reviews', 'user_addresses')");
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
