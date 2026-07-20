<?php
$pdo = new PDO('sqlite:' . __DIR__ . '/ecommerce.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

try {
    $stmt = $pdo->query("SELECT user_id FROM orders LIMIT 1");
    $user_id = $stmt->fetchColumn();

    if (!$user_id) {
        echo "No orders found.\n";
        exit;
    }

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
    
    echo "SUCCESS:\n";
    print_r($orders);

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
