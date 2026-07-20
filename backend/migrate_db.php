<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "Starting migration...\n";

// Add tax to orders if it doesn't exist
try {
    $pdo->exec("ALTER TABLE orders ADD COLUMN tax REAL DEFAULT 0");
    echo "Added tax column to orders.\n";
} catch (Exception $e) {
    echo "tax column may already exist: " . $e->getMessage() . "\n";
}

// Drop and recreate reviews
$pdo->exec("DROP TABLE IF EXISTS reviews");
$pdo->exec("CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    review_text TEXT,
    is_verified_purchase INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");
echo "Recreated reviews table.\n";

echo "Migration complete.\n";
