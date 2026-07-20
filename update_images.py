import sqlite3

db_path = r'backend\ecommerce.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

updates = [
    (1, 'img_1.png'),
    (2, 'img_2.png'),
    (3, 'img_3.png'),
    (6, 'img_6.png'),
    (9, 'img_9.png'),
]

for product_id, img_name in updates:
    c.execute("UPDATE products SET img = ? WHERE id = ?", (img_name, product_id))

conn.commit()
conn.close()
print("Database updated successfully.")
