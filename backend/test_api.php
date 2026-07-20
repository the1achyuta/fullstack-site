<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

try {
    $stmt = $pdo->query("SELECT u.email FROM orders o JOIN users u ON o.user_id = u.id LIMIT 1");
    $email = $stmt->fetchColumn();

    if (!$email) {
        echo "No orders found.";
        exit;
    }

    echo "Testing with email: $email\n";

    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_GET['action'] = 'get_user_history';
    $_SERVER['HTTP_X_CSRF_TOKEN'] = 'dummy';

    require_once __DIR__ . '/api.php';
    $_SESSION['user_email'] = $email;

    handle_get_user_history($pdo);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
