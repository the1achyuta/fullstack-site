<?php
$base_url = 'http://localhost:8000/backend/api.php';

$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$pdo->exec("DELETE FROM users WHERE email = 'testuser@example.com'");
$hash = password_hash('password', PASSWORD_DEFAULT);
$pdo->exec("INSERT INTO users (name, email, password_hash) VALUES ('Test User', 'testuser@example.com', '$hash')");
$user_id = $pdo->lastInsertId();

function req($action, $method, $payload, $cookie = '') {
    global $base_url;
    $opts = [
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\nX-CSRF-Token: dummy\r\nCookie: $cookie\r\n",
            'content' => json_encode($payload),
            'ignore_errors' => true
        ]
    ];
    $context = stream_context_create($opts);
    $result = file_get_contents("$base_url?action=$action", false, $context);
    
    // get cookies
    $ret_cookie = '';
    if (isset($http_response_header)) {
        foreach ($http_response_header as $hdr) {
            if (preg_match('/^Set-Cookie:\s*([^;]+)/', $hdr, $matches)) {
                $ret_cookie .= $matches[1] . '; ';
            }
        }
    }
    return [$result, $ret_cookie];
}

list($resp, $cookie) = req('csrf_token', 'GET', []);
$csrf_data = json_decode($resp, true);
$csrf = $csrf_data['data']['csrf_token'] ?? 'dummy';

function req_post($action, $payload, $cookie, $csrf) {
    global $base_url;
    $opts = [
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nX-CSRF-Token: $csrf\r\nCookie: $cookie\r\n",
            'content' => json_encode($payload),
            'ignore_errors' => true
        ]
    ];
    $context = stream_context_create($opts);
    $result = file_get_contents("$base_url?action=$action", false, $context);
    return $result;
}

list($resp, $login_cookie) = req('login', 'POST', ['email' => 'testuser@example.com', 'password' => 'password'], $cookie);
$cookie .= $login_cookie;
echo "Login Response: $resp\n";

$checkout_payload = [
    'cart' => [['id' => 1, 'price' => 100, 'quantity' => 1]],
    'shipping' => [
        'name' => 'Test User', 'address' => '123 Test St', 'city' => 'Test City', 'zip' => '12345', 'country' => 'US'
    ]
];
$resp = req_post('checkout', $checkout_payload, $cookie, $csrf);
echo "Checkout Response: $resp\n";

$review_payload = ['product_id' => 1, 'rating' => 5, 'review_text' => 'Great product!'];
$resp = req_post('submit_review', $review_payload, $cookie, $csrf);
echo "Review Submit Response: $resp\n";

list($resp, $_) = req('get_product_reviews&product_id=1', 'GET', [], $cookie);
echo "Get Product Reviews Response: $resp\n";

$pdo->exec("DELETE FROM users WHERE email = 'testuser@example.com'");
$pdo->exec("DELETE FROM orders WHERE user_id = $user_id");
$pdo->exec("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $user_id)");
$pdo->exec("DELETE FROM reviews WHERE user_id = $user_id");
