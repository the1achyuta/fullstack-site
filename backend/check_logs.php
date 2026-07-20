<?php
$pdo = new PDO('sqlite:backend/ecommerce.db');
$stmt = $pdo->query("SELECT action, details, created_at FROM logs WHERE action IN ('ERROR', 'CRITICAL_ERROR', 'CSRF_FAILURE') ORDER BY id DESC LIMIT 5");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
