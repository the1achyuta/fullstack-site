<?php
$base_url = 'http://localhost:8000/backend/api.php';

$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$hash = password_hash('password', PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (name, email, password_hash) VALUES ('Test User', 'testuser@example.com', '$hash')");
$user_id = $pdo->lastInsertId();

$ch = curl_init("$base_url?action=login");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email' => 'testuser@example.com', 'password' => 'password']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-CSRF-Token: dummy']);
$response = curl_exec($ch);
preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $response, $matches);
$cookies = array();
foreach($matches[1] as $item) {
    parse_str($item, $cookie);
    $cookies = array_merge($cookies, $cookie);
}
$cookie_str = '';
foreach ($cookies as $k => $v) { $cookie_str .= "$k=$v; "; }

echo "Login Response: " . substr($response, strpos($response, "\r\n\r\n")) . "\n";

$checkout_payload = [
    'cart' => [['id' => 1, 'price' => 100, 'quantity' => 1]],
    'shipping' => [
        'name' => 'Test User', 'address' => '123 Test St', 'city' => 'Test City', 'zip' => '12345', 'country' => 'US'
    ]
];

$ch = curl_init("$base_url?action=checkout");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($checkout_payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-CSRF-Token: dummy', "Cookie: $cookie_str"]);
$response = curl_exec($ch);
echo "Checkout Response: $response\n";

$review_payload = ['product_id' => 1, 'rating' => 5, 'review_text' => 'Great product!'];
$ch = curl_init("$base_url?action=submit_review");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($review_payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-CSRF-Token: dummy', "Cookie: $cookie_str"]);
$response = curl_exec($ch);
echo "Review Submit Response: $response\n";

$ch = curl_init("$base_url?action=product_details&id=1");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Cookie: $cookie_str"]);
$response = curl_exec($ch);
echo "Product Details Response: $response\n";

$pdo->exec("DELETE FROM users WHERE email = 'testuser@example.com'");
$pdo->exec("DELETE FROM orders WHERE user_id = $user_id");
$pdo->exec("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $user_id)");
$pdo->exec("DELETE FROM reviews WHERE user_id = $user_id");
