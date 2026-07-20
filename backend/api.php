<?php
// backend/api.php

// --- 1. SETUP AND ROUTING ---
session_start(); // For CSRF and basic session state

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db_path = __DIR__ . '/ecommerce.db';
$is_new_db = !file_exists($db_path);

try {
    $pdo = new PDO("sqlite:" . $db_path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    if ($is_new_db) {
        init_db($pdo);
    }
} catch (PDOException $e) {
    send_error("ERR_DB_CONNECTION", "Database connection failed.", 500);
}

// Global Exception Handler
set_exception_handler(function($e) {
    global $pdo;
    if (isset($pdo)) {
        log_action($pdo, "CRITICAL_ERROR", $e->getMessage());
    }
    send_error("ERR_INTERNAL", "An internal error occurred: " . $e->getMessage(), 500);
});

// Router
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Global Request Handling & Validation
if ($method === 'POST' || $method === 'PUT') {
    // Content-Type validation
    if (strpos($_SERVER["CONTENT_TYPE"] ?? '', 'application/json') === false) {
        send_error("ERR_INVALID_CONTENT_TYPE", "Content-Type must be application/json", 400);
    }
    // CSRF Validation
    $headers = apache_request_headers();
    $csrf_token = $headers['X-CSRF-Token'] ?? $headers['x-csrf-token'] ?? '';
    if ($action !== 'csrf_token' && $action !== 'login' && $action !== 'register' && $action !== 'verify_otp' && $action !== 'products') {
        if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf_token)) {
            log_action($pdo, "CSRF_FAILURE", "Invalid CSRF token for action: $action");
            send_error("ERR_FORBIDDEN", "Invalid CSRF token.", 403);
        }
    }
}

try {
    switch ($action) {
        case 'csrf_token':
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_csrf_token();
            break;
        case 'register':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_register($pdo);
            break;
        case 'login':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_login($pdo);
            break;
        case 'verify_otp':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_verify_otp($pdo);
            break;
        case 'google_login':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_google_login($pdo);
            break;
        case 'sync_data':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_sync_data($pdo);
            break;
        case 'get_sync_data':
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_get_sync_data($pdo);
            break;
        case 'products':
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_get_products($pdo);
            break;
        case 'product_details': 
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_product_details($pdo); 
            break;
        case 'checkout':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_checkout($pdo);
            break;
        case 'get_user_profile': 
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_get_user_profile($pdo); 
            break;
        case 'update_profile': 
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_update_profile($pdo); 
            break;
        case 'manage_addresses': 
            handle_manage_addresses($pdo); 
            break;
        case 'get_user_history': 
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_get_user_history($pdo); 
            break;
        case 'get_stories': handle_get_stories($pdo); break;
        case 'get_story': handle_get_story($pdo); break;
        case 'submit_review':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_submit_review($pdo);
            break;
        case 'get_product_reviews':
            if ($method !== 'GET') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_get_product_reviews($pdo);
            break;
        case 'checkout_start':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_checkout_start();
            break;
        case 'payment_process':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_payment_process();
            break;
        case 'confirm_order':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_confirm_order($pdo);
            break;
        case 'log_view':
            handle_log_view($pdo);
            break;
        case 'get_recommendations':
            handle_get_recommendations($pdo);
            break;
        case 'simulate_order_ship':
            handle_simulate_order_ship($pdo);
            break;
        case 'cancel_order':
            if ($method !== 'POST') send_error("ERR_METHOD", "Method Not Allowed", 405);
            handle_cancel_order($pdo);
            break;
        default:
            send_error("ERR_NOT_FOUND", "Endpoint not found.", 404);
            break;
    }
} catch (Exception $e) {
    log_action($pdo, "ERROR", $e->getMessage());
    send_error("ERR_INTERNAL", "An internal error occurred.", 500);
}

// --- 2. HELPERS ---
if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $arh = array();
        foreach ($_SERVER as $rx => $rx_v) {
            if (substr($rx, 0, 5) == 'HTTP_') {
                $arh[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($rx, 5)))))] = $rx_v;
            }
        }
        return $arh;
    }
}

function send_success($data = [], $message = "") {
    echo json_encode(["success" => true, "data" => $data, "message" => $message]);
    exit();
}

function send_error($code, $detail, $status_code = 400) {
    http_response_code($status_code);
    echo json_encode(["success" => false, "error" => ["code" => $code, "detail" => $detail]]);
    exit();
}

function sanitize_input($data) {
    if (is_array($data)) {
        foreach ($data as $key => $value) {
            $data[$key] = sanitize_input($value);
        }
        return $data;
    }
    return htmlspecialchars(trim($data ?? ''), ENT_QUOTES, 'UTF-8');
}

function get_json_input() {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true) ?? [];
    return sanitize_input($decoded); // Sanitize all JSON input recursively
}

function log_action($pdo, $action, $details) {
    try {
        $stmt = $pdo->prepare("INSERT INTO logs (action, details) VALUES (?, ?)");
        $stmt->execute([$action, is_string($details) ? $details : json_encode($details)]);
    } catch (Exception $e) { } // Ignore logging failures
}

function init_db($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        img TEXT NOT NULL,
        description TEXT,
        stock INTEGER NOT NULL DEFAULT 10
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        review_text TEXT,
        is_verified_purchase INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 1,
        last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total REAL NOT NULL,
        tax REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Processing',
        shipping_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT,
        address_line_1 TEXT,
        city TEXT,
        zip TEXT,
        is_default INTEGER DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        tags TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS product_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event_type TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Phase 10 & 11 Schema Migrations
    try { $pdo->exec("ALTER TABLE orders ADD COLUMN tax REAL DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE products ADD COLUMN tags TEXT"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 20"); } catch (Exception $e) {}

    // Auth Schema Migrations
    try { $pdo->exec("ALTER TABLE users ADD COLUMN otp_code TEXT"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN otp_expires_at DATETIME"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE"); } catch (Exception $e) {}

    // Insert dummy stories if needed
    $stmt = $pdo->query("SELECT COUNT(*) FROM stories");
    if ($stmt->fetchColumn() < 2) {
        $pdo->exec("
            INSERT INTO stories (title, content, image_url, tags) VALUES
            ('The History of Chettinad Architecture', 'Chettinad architecture is renowned for its grand mansions, wide courtyards, and intricate woodwork. The use of Burma teak, Athangudi tiles, and imported ceramics creates a unique blend of local craftsmanship and global influence. Historically, the Nattukottai Chettiars, a prosperous mercantile community, built these palatial homes to accommodate large joint families and host grand ceremonies. The architecture is characterized by its heavy, carved wooden doors, majestic pillars, and vibrant tile patterns that not only serve aesthetic purposes but also offer climate control in the hot southern regions.', 'https://placehold.co/800x400', 'vintage,decor'),
            ('Caring for Antique Teakwood', 'Antique teakwood furniture is incredibly durable but requires proper care to maintain its luster. Avoid direct sunlight and extreme humidity. Regular dusting with a soft cloth and occasional polishing with high-quality beeswax will keep the wood nourished. Unlike modern synthetic finishes, traditional teakwood finishes breathe, so it is important to avoid harsh chemical cleaners. For intricate carvings, a soft brush can be used to dislodge dust. Proper maintenance ensures these heirlooms can be passed down for generations.', 'https://placehold.co/800x400', 'vintage')
        ");
        // Tag some products
        $pdo->exec("UPDATE products SET tags = 'vintage' WHERE category = 'Vintage' OR name LIKE '%Teakwood%'");
        $pdo->exec("UPDATE products SET tags = 'decor' WHERE category = 'Home decor' OR name LIKE '%Brass%'");
    }

    // Insert 40 dummy products if needed
    $stmt = $pdo->query("SELECT COUNT(*) FROM products");
    if ($stmt->fetchColumn() < 40) {
        $pdo->exec("DELETE FROM products"); // Clear existing
        
        $categories = [
            "vintage" => ["Antique Chettinad Pillar", "Vintage Brass Pot", "Old Teak Storage Box", "Carved Rosewood Panel", "Heritage Tanjore Painting", "Vintage Kerala Mural", "Antique Bronze Idol", "Classic Wooden Dowry Chest", "Vintage Colonial Chair", "Traditional Grain Measure"],
            "modern" => ["Modern Athangudi Tile Art", "Abstract Canvas Print", "Minimalist Wood Sculpture", "Contemporary Metal Wall Art", "Geometric Patterned Rug", "Modernist Ceramic Vase", "Sleek Brass Planter", "Resin River Table Top", "Monochrome Ink Drawing", "Modern Teak Coffee Table"],
            "gifting" => ["Handcrafted Brass Diya", "Silver Plated Bowl Set", "Rosewood Jewelry Box", "Aromatic Sandalwood Incense Set", "Traditional Kumkum Box", "Silk Woven Stole", "Bronze Dancing Nataraja", "Decorative Meenakari Plate", "Hand-painted Coaster Set", "Carved Wooden Bookends"],
            "home-decor" => ["Teakwood Wall Panel", "Brass Hanging Bell", "Handloom Cotton Throw", "Terracotta Floor Lamp", "Wrought Iron Wall Bracket", "Intricate Macrame Wall Hanging", "Bamboo Woven Basket", "Hand-painted Wood Tray", "Brass Urlī Bowl", "Carved Teak Mirror Frame"]
        ];

        $images = [
            "vintage" => "placeholder_vintage.jpg",
            "modern" => "placeholder_modern.jpg",
            "gifting" => "placeholder_gifting.jpg",
            "home-decor" => "placeholder_decor.jpg"
        ];

        $stmt = $pdo->prepare("INSERT INTO products (name, price, category, img, description, stock) VALUES (?, ?, ?, ?, ?, ?)");
        
        foreach ($categories as $cat => $names) {
            foreach ($names as $index => $name) {
                // Vary the price systematically
                $price = 50 + ($index * 15) + (rand(0, 9) * 5); 
                if ($cat == "vintage") $price += 100; // Vintage is more expensive
                
                $img = $images[$cat];
                $description = "A beautiful, premium quality $name crafted with traditional techniques, perfect for your collection.";
                $stock = rand(5, 50);
                $stmt->execute([$name, $price, $cat, $img, $description, $stock]);
            }
        }

        $pw = password_hash("password123", PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)");
        try {
            $stmt->execute(["Test User", "test@example.com", $pw]);
        } catch (PDOException $e) {} // ignore if exists
    }
}

// --- 3. CORE AUTH LOGIC ---
function handle_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    send_success(["csrf_token" => $_SESSION['csrf_token']], "CSRF Token generated.");
}

function handle_register($pdo) {
    $data = get_json_input();
    if (empty($data['name']) || empty($data['email']) || empty($data['password'])) {
        send_error("ERR_MISSING_FIELDS", "Missing required fields.", 400);
    }
    
    $name = $data['name'];
    $email = $data['email'];
    $hashed_pw = password_hash($data['password'], PASSWORD_DEFAULT);
    
    try {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)");
        $stmt->execute([$name, $email, $hashed_pw]);
        log_action($pdo, "USER_REGISTER", "Email: $email");
        send_success(["name" => $name, "email" => $email], "User registered successfully.");
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            send_error("ERR_EMAIL_EXISTS", "Email already exists.", 409);
        }
        throw $e;
    }
}

function handle_login($pdo) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Rate Limiting Check
    $stmt = $pdo->prepare("SELECT attempts, strftime('%s', last_attempt) as last_ts FROM login_attempts WHERE ip = ?");
    $stmt->execute([$ip]);
    $attempt_data = $stmt->fetch();
    
    if ($attempt_data) {
        $time_diff = time() - $attempt_data['last_ts'];
        if ($attempt_data['attempts'] >= 5 && $time_diff < 600) { // 10 minutes lockout
            log_action($pdo, "RATE_LIMIT_HIT", "IP: $ip");
            send_error("ERR_ACCOUNT_LOCKED", "Too many failed attempts. Try again in 10 minutes.", 429);
        }
        // Reset attempts if 10 minutes passed
        if ($time_diff >= 600) {
            $pdo->prepare("UPDATE login_attempts SET attempts = 0, last_attempt = CURRENT_TIMESTAMP WHERE ip = ?")->execute([$ip]);
        }
    }

    $data = get_json_input();
    if (empty($data['email']) || empty($data['password'])) {
        send_error("ERR_MISSING_FIELDS", "Missing email or password.", 400);
    }
    
    $email = $data['email'];
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($data['password'], $user['password_hash'])) {
        // Success: Reset attempts
        $pdo->prepare("DELETE FROM login_attempts WHERE ip = ?")->execute([$ip]);
        
        $otp_code = sprintf("%06d", mt_rand(1, 999999));
        $stmt = $pdo->prepare("UPDATE users SET otp_code = ?, otp_expires_at = datetime('now', '+5 minutes') WHERE email = ?");
        $stmt->execute([$otp_code, $email]);
        
        log_action($pdo, "OTP_GENERATED", "Email: $email");
        
        send_success([
            "status" => "otp_required",
            "email" => $email,
            "dev_otp" => $otp_code // For dev purposes only
        ], "OTP required.");
    } else {
        // Failure: Increment attempts
        if ($attempt_data) {
            $pdo->prepare("UPDATE login_attempts SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE ip = ?")->execute([$ip]);
        } else {
            $pdo->prepare("INSERT INTO login_attempts (ip) VALUES (?)")->execute([$ip]);
        }
        log_action($pdo, "USER_LOGIN_FAILED", "Email: $email IP: $ip");
        send_error("ERR_UNAUTHORIZED", "Invalid email or password.", 401);
    }
}

function handle_verify_otp($pdo) {
    $data = get_json_input();
    if (empty($data['email']) || empty($data['otp'])) {
        send_error("ERR_MISSING_FIELDS", "Email and OTP required.", 400);
    }
    $email = $data['email'];
    $otp = $data['otp'];
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user || $user['otp_code'] !== $otp || strtotime($user['otp_expires_at']) < time()) {
        send_error("ERR_INVALID_OTP", "Invalid or expired OTP.", 401);
    }
    
    // Clear OTP
    $pdo->prepare("UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE email = ?")->execute([$email]);
    
    $_SESSION['user_email'] = $email;
    log_action($pdo, "USER_LOGIN_SUCCESS", "Email: $email via OTP");
    
    $cartData = $user['cart_data'] ? json_decode($user['cart_data'], true) : [];
    $wishlistData = $user['wishlist_data'] ? json_decode($user['wishlist_data'], true) : [];
    
    send_success([
        "name" => $user['name'],
        "email" => $email,
        "cart" => $cartData,
        "wishlist" => $wishlistData
    ], "Login successful.");
}

function handle_google_login($pdo) {
    $data = get_json_input();
    if (empty($data['credential'])) {
        send_error("ERR_MISSING_CREDENTIAL", "Google credential missing.", 400);
    }
    
    $token = $data['credential'];
    $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($token);
    
    $context = stream_context_create(['http' => ['ignore_errors' => true]]);
    $response = @file_get_contents($url, false, $context);
    
    if (!$response) {
        send_error("ERR_INVALID_TOKEN", "Failed to verify Google token.", 401);
    }
    
    $payload = json_decode($response, true);
    if (empty($payload['email'])) {
        send_error("ERR_INVALID_TOKEN", "Invalid Google token payload.", 401);
    }
    
    $email = $payload['email'];
    $name = $payload['name'] ?? 'Google User';
    $google_id = $payload['sub'] ?? null;
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, google_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $email, password_hash(random_bytes(16), PASSWORD_DEFAULT), $google_id]);
        
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
    }
    
    $_SESSION['user_email'] = $email;
    log_action($pdo, "USER_LOGIN_SUCCESS", "Email: $email via Google");
    
    $cartData = $user['cart_data'] ? json_decode($user['cart_data'], true) : [];
    $wishlistData = $user['wishlist_data'] ? json_decode($user['wishlist_data'], true) : [];
    
    send_success([
        "cart" => $cartData,
        "wishlist" => $wishlistData
    ], "Login successful.");
}

function handle_sync_data($pdo) {
    if (empty($_SESSION['user_email'])) {
        send_error("ERR_UNAUTHORIZED", "Not authenticated.", 401);
    }
    
    $email = $_SESSION['user_email'];
    $data = get_json_input();
    
    $cart_json = isset($data['cart']) ? json_encode($data['cart']) : null;
    $wishlist_json = isset($data['wishlist']) ? json_encode($data['wishlist']) : null;
    
    $stmt = $pdo->prepare("UPDATE users SET cart_data = ?, wishlist_data = ? WHERE email = ?");
    $stmt->execute([$cart_json, $wishlist_json, $email]);
    
    send_success(null, "Data synced successfully.");
}

function handle_get_sync_data($pdo) {
    if (empty($_SESSION['user_email'])) {
        send_error("ERR_UNAUTHORIZED", "Not authenticated.", 401);
    }
    
    $email = $_SESSION['user_email'];
    $stmt = $pdo->prepare("SELECT cart_data, wishlist_data FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
        send_error("ERR_NOT_FOUND", "User not found.", 404);
    }
    
    $cartData = $user['cart_data'] ? json_decode($user['cart_data'], true) : [];
    $wishlistData = $user['wishlist_data'] ? json_decode($user['wishlist_data'], true) : [];
    
    send_success([
        "cart" => $cartData,
        "wishlist" => $wishlistData
    ], "Data retrieved successfully.");
}

// --- 4. PRODUCT & REVIEW LOGIC ---
function handle_get_products($pdo) {
    $category = $_GET['category'] ?? '';
    $search = sanitize_input($_GET['search'] ?? '');
    $min_price = floatval($_GET['min_price'] ?? 0);
    $max_price = floatval($_GET['max_price'] ?? 0);
    $sort_by = sanitize_input($_GET['sort_by'] ?? 'newest');
    
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, intval($_GET['limit'] ?? 12));
    $offset = ($page - 1) * $limit;
    
    if (strlen($search) > 50) {
        send_error("ERR_INVALID_INPUT", "Search query is too long.", 400);
    }
    
    $query = "SELECT p.*, (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating, (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count FROM products p WHERE 1=1";
    $count_query = "SELECT COUNT(*) FROM products p WHERE 1=1";
    $params = [];
    
    if ($category) {
        $query .= " AND p.category = ?";
        $count_query .= " AND p.category = ?";
        $params[] = $category;
    }
    
    if ($search) {
        $query .= " AND (p.name LIKE ? OR p.description LIKE ?)";
        $count_query .= " AND (p.name LIKE ? OR p.description LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    if ($min_price > 0) {
        $query .= " AND p.price >= ?";
        $count_query .= " AND p.price >= ?";
        $params[] = $min_price;
    }
    
    if ($max_price > 0) {
        $query .= " AND p.price <= ?";
        $count_query .= " AND p.price <= ?";
        $params[] = $max_price;
    }
    
    if ($sort_by === 'price_asc') {
        $query .= " ORDER BY p.price ASC";
    } elseif ($sort_by === 'price_desc') {
        $query .= " ORDER BY p.price DESC";
    } else {
        $query .= " ORDER BY p.id DESC"; // newest
    }
    
    $query .= " LIMIT ? OFFSET ?";
    
    // Fetch Count
    $stmt_count = $pdo->prepare($count_query);
    $stmt_count->execute($params);
    $total_items = $stmt_count->fetchColumn();
    $total_pages = ceil($total_items / $limit);
    
    // Fetch Data
    $params[] = $limit;
    $params[] = $offset;
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
    
    foreach ($products as &$p) {
        if (isset($p['stock']) && $p['stock'] < 10) {
            $p['dynamic_alert'] = "Limited Stock Alert! Save 10% today.";
            $p['original_price'] = $p['price'];
            $p['price'] = round($p['price'] * 0.9, 2);
        }
    }
    
    send_success([
        "products" => $products,
        "pagination" => [
            "current_page" => $page,
            "total_pages" => $total_pages,
            "total_items" => $total_items,
            "limit" => $limit
        ]
    ], "Products retrieved.");
}

function handle_product_details($pdo) {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) send_error("ERR_INVALID_ID", "Invalid product ID.");
    
    $stmt = $pdo->prepare("SELECT p.*, (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating, (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count FROM products p WHERE p.id = ?");
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    
    if (!$product) send_error("ERR_NOT_FOUND", "Product not found.", 404);
    
    if (isset($product['stock']) && $product['stock'] < 10) {
        $product['dynamic_alert'] = "Limited Stock Alert! Save 10% today.";
        $product['original_price'] = $product['price'];
        $product['price'] = round($product['price'] * 0.9, 2);
    }
    
    $stmt = $pdo->prepare("SELECT r.rating, r.review_text, r.created_at, r.is_verified_purchase, u.email as user_email, u.name as user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC");
    $stmt->execute([$id]);
    $reviews = $stmt->fetchAll();
    
    // Check if verified buyer
    $is_verified_buyer = false;
    if (!empty($_SESSION['user_email'])) {
        $stmt_user = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt_user->execute([$_SESSION['user_email']]);
        $user_id = $stmt_user->fetchColumn();
        if ($user_id) {
            $stmt_buy = $pdo->prepare("SELECT 1 FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = ? AND oi.product_id = ? LIMIT 1");
            $stmt_buy->execute([$user_id, $id]);
            if ($stmt_buy->fetchColumn()) {
                $is_verified_buyer = true;
            }
        }
    }
    
    send_success(["product" => $product, "reviews" => $reviews, "is_verified_buyer" => $is_verified_buyer], "Product details retrieved.");
}

// --- 5. CHECKOUT LOGIC (Phase 8) ---
function handle_checkout($pdo) {
    if (empty($_SESSION['user_email'])) {
        send_error("ERR_UNAUTHORIZED", "You must be logged in to checkout.", 401);
    }
    
    $data = get_json_input();
    
    if (empty($data['cart']) || empty($data['shipping'])) {
        send_error("ERR_MISSING_FIELDS", "Cart or shipping details are missing.", 400);
    }
    
    $shipping = $data['shipping'];
    if (empty($shipping['name']) || empty($shipping['address']) || empty($shipping['city']) || empty($shipping['zip'])) {
         send_error("ERR_VALIDATION", "Please fill in all mandatory shipping fields.", 400);
    }
    
    $user_email = $_SESSION['user_email'];
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$user_email]);
    $user_id = $stmt->fetchColumn();
    
    if (!$user_id) {
        send_error("ERR_USER_NOT_FOUND", "User profile not found.", 404);
    }

    $subtotal = 0;
    foreach ($data['cart'] as $item) {
        if (!isset($item['price']) || !isset($item['quantity'])) {
            send_error("ERR_INVALID_CART", "Invalid cart item structure.", 400);
        }
        $subtotal += (floatval($item['price']) * intval($item['quantity']));
    }
    
    if ($subtotal <= 0) {
        send_error("ERR_CART_EMPTY", "Cart is empty or invalid.", 400);
    }
    
    // Taxation & Shipping Logic (Phase 10)
    $country = $shipping['country'] ?? '';
    if ($country !== 'IN' && $country !== 'India' && $country !== 'india') {
        $shipping_fee = 15.00;
        $tax_rate = 0.10; // 10% international tax
    } else {
        $shipping_fee = 5.00;
        $tax_rate = 0.05; // 5% domestic GST
    }
    
    $tax = round($subtotal * $tax_rate, 2);
    $total = $subtotal + $shipping_fee + $tax;
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, total, tax, status, shipping_address) VALUES (?, ?, ?, 'AWAITING PAYMENT/COD CONFIRMATION', ?)");
        $address_str = $shipping['name'] . ", " . $shipping['address'] . ", " . $shipping['city'] . " " . $shipping['zip'] . " " . $country;
        $stmt->execute([$user_id, $total, $tax, $address_str]);
        $order_id = $pdo->lastInsertId();
        
        $stmt_item = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
        foreach ($data['cart'] as $item) {
            $stmt_item->execute([$order_id, intval($item['id']), intval($item['quantity']), floatval($item['price'])]);
        }
        
        $pdo->commit();
        log_action($pdo, "ORDER_CREATED", "Order ID: $order_id by User: $user_email");
        
        send_success(["order_id" => $order_id], "Order successfully placed.");
    } catch (Exception $e) {
        $pdo->rollBack();
        log_action($pdo, "ORDER_FAILED", "Error: " . $e->getMessage());
        send_error("ERR_ORDER_FAILED", "Could not process order.", 500);
    }
}

// --- 6. USER DASHBOARD (Phase 9) ---
function handle_get_user_profile($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $stmt = $pdo->prepare("SELECT id, name, email, mobile_number, whatsapp_number FROM users WHERE email = ?");
    $stmt->execute([$_SESSION['user_email']]);
    $user = $stmt->fetch();
    if (!$user) send_error("ERR_NOT_FOUND", "User not found.", 404);
    
    $stmt = $pdo->prepare("SELECT * FROM user_addresses WHERE user_id = ? AND is_default = 1 LIMIT 1");
    $stmt->execute([$user['id']]);
    $default_address = $stmt->fetch();
    
    send_success(["profile" => $user, "default_address" => $default_address], "Profile loaded.");
}

function handle_update_profile($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $data = get_json_input();
    $name = $data['name'] ?? null;
    $mobile = $data['mobile_number'] ?? null;
    $whatsapp = $data['whatsapp_number'] ?? null;
    
    if (!$name) send_error("ERR_VALIDATION", "Name is required.", 400);

    $stmt = $pdo->prepare("UPDATE users SET name = ?, mobile_number = ?, whatsapp_number = ? WHERE email = ?");
    $stmt->execute([$name, $mobile, $whatsapp, $_SESSION['user_email']]);
    
    send_success([], "Profile updated successfully.");
}

function handle_manage_addresses($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$_SESSION['user_email']]);
    $user_id = $stmt->fetchColumn();
    
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC");
        $stmt->execute([$user_id]);
        send_success(["addresses" => $stmt->fetchAll()], "Addresses retrieved.");
    } else if ($method === 'POST') {
        $data = get_json_input();
        if (empty($data['name']) || empty($data['address_line_1']) || empty($data['city']) || empty($data['zip'])) {
            send_error("ERR_VALIDATION", "All fields are required.", 400);
        }
        
        $is_default = !empty($data['is_default']) ? 1 : 0;
        if ($is_default) {
            $pdo->prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?")->execute([$user_id]);
        }
        
        if (!empty($data['id'])) {
            // Update existing address
            $stmt = $pdo->prepare("UPDATE user_addresses SET name = ?, address_line_1 = ?, city = ?, zip = ?, is_default = ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$data['name'], $data['address_line_1'], $data['city'], $data['zip'], $is_default, $data['id'], $user_id]);
            send_success([], "Address updated.");
        } else {
            // Insert new address
            $stmt = $pdo->prepare("INSERT INTO user_addresses (user_id, name, address_line_1, city, zip, is_default) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$user_id, $data['name'], $data['address_line_1'], $data['city'], $data['zip'], $is_default]);
            send_success(["id" => $pdo->lastInsertId()], "Address added.");
        }
    } else if ($method === 'DELETE') {
        $data = get_json_input();
        if (empty($data['id'])) {
            send_error("ERR_VALIDATION", "Address ID is required.", 400);
        }
        $stmt = $pdo->prepare("DELETE FROM user_addresses WHERE id = ? AND user_id = ?");
        $stmt->execute([$data['id'], $user_id]);
        send_success([], "Address deleted.");
    }
}

function handle_get_user_history($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$_SESSION['user_email']]);
    $user_id = $stmt->fetchColumn();
    
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->execute([$user_id]);
    $orders = $stmt->fetchAll();
    
    foreach ($orders as &$order) {
        $stmt_items = $pdo->prepare("
            SELECT oi.*, p.name, p.img, p.category 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            WHERE oi.order_id = ?
        ");
        $stmt_items->execute([$order['id']]);
        $order['items'] = $stmt_items->fetchAll();
        
        // Smart Suggestions: Suggest items from the same category that weren't in the order
        if (count($order['items']) > 0) {
            $cats = array_unique(array_column($order['items'], 'category'));
            $cat_placeholders = implode(',', array_fill(0, count($cats), '?'));
            $item_ids = array_column($order['items'], 'product_id');
            $id_placeholders = implode(',', array_fill(0, count($item_ids), '?'));
            
            $query = "SELECT id, name, price, img FROM products WHERE category IN ($cat_placeholders) AND id NOT IN ($id_placeholders) LIMIT 2";
            $suggest_stmt = $pdo->prepare($query);
            $suggest_stmt->execute(array_merge($cats, $item_ids));
            $order['suggestions'] = $suggest_stmt->fetchAll();
        } else {
            $order['suggestions'] = [];
        }
    }
    
    send_success(["orders" => $orders], "Order history retrieved.");
}

function handle_submit_review($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $data = get_json_input();
    if (empty($data['product_id']) || empty($data['rating'])) {
        send_error("ERR_MISSING_FIELDS", "Product ID and Rating are required.", 400);
    }
    
    $stmt_user = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt_user->execute([$_SESSION['user_email']]);
    $user_id = $stmt_user->fetchColumn();
    
    // Verified Buyer Check
    $stmt_buy = $pdo->prepare("SELECT 1 FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = ? AND oi.product_id = ? LIMIT 1");
    $stmt_buy->execute([$user_id, $data['product_id']]);
    if (!$stmt_buy->fetchColumn()) {
        send_error("ERR_NOT_VERIFIED", "Only verified buyers can leave a review.", 403);
    }

    $rating = intval($data['rating']);
    if ($rating < 1 || $rating > 5) {
        send_error("ERR_INVALID_RATING", "Rating must be between 1 and 5.", 400);
    }
    
    $stmt = $pdo->prepare("INSERT INTO reviews (product_id, user_id, rating, review_text, is_verified_purchase) VALUES (?, ?, ?, ?, 1)");
    $stmt->execute([$data['product_id'], $user_id, $rating, $data['review_text'] ?? '']);
    
    log_action($pdo, "REVIEW_SUBMITTED", "Product ID: " . $data['product_id'] . " By User ID: " . $user_id);
    send_success([], "Review submitted successfully.");
}

function handle_get_product_reviews($pdo) {
    $id = isset($_GET['product_id']) ? intval($_GET['product_id']) : 0;
    if ($id <= 0) send_error("ERR_INVALID_ID", "Invalid product ID.", 400);
    
    $stmt = $pdo->prepare("
        SELECT r.rating, r.review_text, r.is_verified_purchase, r.created_at, u.name as user_name 
        FROM reviews r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.product_id = ? 
        ORDER BY r.created_at DESC
    ");
    $stmt->execute([$id]);
    $reviews = $stmt->fetchAll();
    
    $average = 0;
    if (count($reviews) > 0) {
        $total = array_sum(array_column($reviews, 'rating'));
        $average = round($total / count($reviews), 1);
    }
    
    send_success([
        "reviews" => $reviews,
        "average_rating" => $average,
        "total_reviews" => count($reviews)
    ], "Reviews loaded.");
}

// --- 7. STORIES (Phase 10) ---
function handle_get_stories($pdo) {
    $stmt = $pdo->query("SELECT id, title, image_url FROM stories");
    send_success(["stories" => $stmt->fetchAll()], "Stories loaded.");
}

function handle_get_story($pdo) {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id <= 0) send_error("ERR_INVALID_ID", "Invalid story ID.", 400);
    
    $stmt = $pdo->prepare("SELECT * FROM stories WHERE id = ?");
    $stmt->execute([$id]);
    $story = $stmt->fetch();
    
    if (!$story) send_error("ERR_NOT_FOUND", "Story not found.", 404);
    
    $featured_products = [];
    if (!empty($story['tags'])) {
        $tags = array_map('trim', explode(',', $story['tags']));
        $conditions = [];
        $params = [];
        foreach ($tags as $tag) {
            $conditions[] = "tags LIKE ?";
            $params[] = "%$tag%";
        }
        $query = "SELECT id, name, price, img FROM products WHERE " . implode(' OR ', $conditions) . " LIMIT 4";
        $stmt_prod = $pdo->prepare($query);
        $stmt_prod->execute($params);
        $featured_products = $stmt_prod->fetchAll();
    }
    
    send_success(["story" => $story, "featured_products" => $featured_products], "Story loaded.");
}

// --- 5. TRANSACTIONAL LOGIC ---
function handle_checkout_start() {
    $data = get_json_input();
    if (empty($data['items']) || !is_array($data['items'])) {
        send_error("ERR_EMPTY_CART", "Cart is empty.", 400);
    }
    if (empty($data['address']) || !is_array($data['address'])) {
        send_error("ERR_INVALID_ADDRESS", "Valid address object is required.", 400);
    }
    
    $subtotal = 0;
    foreach ($data['items'] as $item) {
        $price = isset($item['price']) ? (float)$item['price'] : 0;
        $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 1;
        $subtotal += ($price * $quantity);
    }
    
    $country = $data['address']['country'] ?? '';
    $shipping = ($country !== 'IN') ? 15.00 : 5.00;
    $total = $subtotal + $shipping;
    send_success([
        "subtotal" => $subtotal,
        "shipping" => $shipping,
        "total" => $total
    ], "Checkout initiated.");
}

function handle_payment_process() {
    $data = get_json_input();
    if (empty($data['amount']) || empty($data['method'])) {
        send_error("ERR_MISSING_FIELDS", "Amount and method are required.", 400);
    }
    
    $gateway = ($data['method'] === 'razorpay') ? 'Razorpay' : 'Stripe';
    
    send_success([
        "transaction_id" => "txn_" . time(),
        "gateway" => $gateway
    ], "Payment of $" . number_format($data['amount'], 2) . " processed successfully.");
}

function handle_confirm_order($pdo) {
    $data = get_json_input();
    if (empty($data['items']) || !is_array($data['items'])) {
        send_error("ERR_EMPTY_CART", "Valid items array required to process order.", 400);
    }
    
    // Fail Fast Validation
    $stmt_check = $pdo->prepare("SELECT stock, name FROM products WHERE id = ?");
    foreach ($data['items'] as $item) {
        $id = $item['id'] ?? null;
        $qty = $item['quantity'] ?? 1;
        if (!$id) continue;
        
        $stmt_check->execute([$id]);
        $row = $stmt_check->fetch();
        
        if (!$row) send_error("ERR_NOT_FOUND", "Product ID $id not found.", 404);
        if ($row['stock'] < $qty) send_error("ERR_OUT_OF_STOCK", "Insufficient stock for {$row['name']}.", 409);
    }
    
    try {
        $pdo->exec("BEGIN EXCLUSIVE TRANSACTION");
        
        $stmt_update = $pdo->prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
        
        foreach ($data['items'] as $item) {
            $id = $item['id'] ?? null;
            $qty = $item['quantity'] ?? 1;
            if (!$id) continue;
            
            $stmt_update->execute([$qty, $id, $qty]);
            if ($stmt_update->rowCount() === 0) {
                $pdo->rollBack();
                log_action($pdo, "ORDER_FAILED_STOCK", "Product ID: $id");
                send_error("ERR_OUT_OF_STOCK", "Insufficient stock for product ID $id during checkout.", 409);
            }
        }
        
        $pdo->commit();
        $order_id = rand(1000, 9999);
        log_action($pdo, "ORDER_CONFIRMED", "Order ID: $order_id");
        send_success(["order_id" => $order_id], "Order $order_id confirmed successfully.");
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        log_action($pdo, "ORDER_ERROR", $e->getMessage());
        send_error("ERR_INTERNAL", "Order confirmation failed during transaction.", 500);
    }
}

function handle_cancel_order($pdo) {
    if (empty($_SESSION['user_email'])) send_error("ERR_UNAUTHORIZED", "Not logged in.", 401);
    
    $data = get_json_input();
    if (empty($data['order_id'])) send_error("ERR_MISSING_FIELDS", "Order ID required.", 400);
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$_SESSION['user_email']]);
    $user_id = $stmt->fetchColumn();
    
    $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['order_id'], $user_id]);
    $order = $stmt->fetch();
    
    if (!$order) send_error("ERR_NOT_FOUND", "Order not found.", 404);
    
    if ($order['status'] !== 'AWAITING PAYMENT/COD CONFIRMATION' && $order['status'] !== 'Processing') {
        send_error("ERR_CANT_CANCEL", "Order cannot be cancelled at this stage.", 400);
    }
    
    $stmt = $pdo->prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['order_id'], $user_id]);
    
    log_action($pdo, "ORDER_CANCELLED", "Order ID: " . $data['order_id']);
    send_success([], "Order cancelled successfully.");
}
