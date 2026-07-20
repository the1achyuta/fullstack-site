<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
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
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    postal_code TEXT NOT NULL,
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
    product_id INTEGER NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS crm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

echo "Missing tables created.\n";

// Insert stories if none exist
$stmt = $pdo->query("SELECT COUNT(*) FROM stories");
if ($stmt->fetchColumn() == 0) {
    $pdo->exec("INSERT INTO stories (title, content, image_url, tags) VALUES
        ('The History of Chettinad Architecture', 'Chettinad architecture is renowned...', 'https://placehold.co/800x400', 'vintage,decor'),
        ('Caring for Antique Teakwood', 'Antique teakwood furniture is incredibly durable...', 'https://placehold.co/800x400', 'vintage')
    ");
}
echo "Database update completed.\n";
