<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
