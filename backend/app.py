import os
import sqlite3
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
CORS(app)

DB_PATH = 'ecommerce.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('DROP TABLE IF EXISTS products')
        c.execute('DROP TABLE IF EXISTS users')
        
        # Products table
        c.execute('''
            CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                category TEXT NOT NULL,
                img TEXT NOT NULL,
                description TEXT,
                stock INTEGER NOT NULL DEFAULT 10
            )
        ''')
        
        # Users table
        c.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        ''')

        products = [
            ("Antique Chettinad Pillar", 250.00, "vintage", "placeholder_vintage.jpg", "A beautiful carved wooden pillar.", 5),
            ("Modern Athangudi Tile Art", 85.00, "modern", "placeholder_modern.jpg", "Handcrafted tile art.", 20),
            ("Handcrafted Brass Diya", 45.00, "gifting", "placeholder_gifting.jpg", "Traditional brass lamp.", 50),
            ("Teakwood Wall Panel", 150.00, "home-decor", "placeholder_decor.jpg", "Exquisite wall decor.", 3)
        ]
        c.executemany("INSERT INTO products (name, price, category, img, description, stock) VALUES (?, ?, ?, ?, ?, ?)", products)
        
        # Add a default test user
        default_pw = generate_password_hash("password123")
        c.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", ("Test User", "test@example.com", default_pw))

        conn.commit()
    finally:
        conn.close()

init_db()

# --- API Response Helpers ---
def success_response(data=None, message=""):
    return jsonify({
        "success": True,
        "data": data if data is not None else {},
        "message": message
    }), 200

def error_response(code, detail, status_code=400):
    return jsonify({
        "success": False,
        "error": {
            "code": code,
            "detail": detail
        }
    }), status_code

# --- Rate limiting ---
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 20
ip_requests = {}

def rate_limit_api(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        ip = request.remote_addr
        current_time = time.time()
        
        if ip not in ip_requests:
            ip_requests[ip] = []
            
        ip_requests[ip] = [t for t in ip_requests[ip] if current_time - t < RATE_LIMIT_WINDOW]
        
        if len(ip_requests[ip]) >= RATE_LIMIT_MAX:
            return error_response("ERR_RATE_LIMIT", "Too many requests. Please try again later.", 429)
            
        ip_requests[ip].append(current_time)
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# --- AUTH ENDPOINTS ---
@app.route('/api/v1/auth/register', methods=['POST'])
@rate_limit_api
def register():
    try:
        data = request.json
        if not data or 'name' not in data or 'email' not in data or 'password' not in data:
            return error_response("ERR_MISSING_FIELDS", "Missing required fields.", 400)
            
        hashed_pw = generate_password_hash(data['password'])
        
        conn = get_db_connection()
        try:
            with conn:
                c = conn.cursor()
                c.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", 
                          (data['name'], data['email'], hashed_pw))
            return success_response({"name": data['name'], "email": data['email']}, "User registered successfully.")
        except sqlite3.IntegrityError:
            return error_response("ERR_EMAIL_EXISTS", "Email already exists.", 409)
        finally:
            conn.close()
    except Exception as e:
        return error_response("ERR_INTERNAL", "Registration failed.", 500)

@app.route('/api/v1/auth/login', methods=['POST'])
@rate_limit_api
def login():
    try:
        data = request.json
        if not data or 'email' not in data or 'password' not in data:
            return error_response("ERR_MISSING_FIELDS", "Missing email or password.", 400)
            
        conn = get_db_connection()
        try:
            c = conn.cursor()
            c.execute("SELECT * FROM users WHERE email = ?", (data['email'],))
            user = c.fetchone()
            
            if user and check_password_hash(user['password_hash'], data['password']):
                return success_response({"name": user['name'], "email": user['email']}, "Login successful.")
            else:
                return error_response("ERR_UNAUTHORIZED", "Invalid email or password.", 401)
        finally:
            conn.close()
    except Exception as e:
        return error_response("ERR_INTERNAL", "Login failed.", 500)

# --- ECOMMERCE ENDPOINTS ---
@app.route('/api/v1/products', methods=['GET'])
@rate_limit_api
def get_products():
    try:
        category = request.args.get('category')
        search = request.args.get('search')
        
        if search and len(search) > 50:
            return error_response("ERR_INVALID_INPUT", "Search query is too long.", 400)

        conn = get_db_connection()
        try:
            c = conn.cursor()
            query = "SELECT * FROM products WHERE 1=1"
            params = []
            
            if category:
                query += " AND category = ?"
                params.append(category)
            
            if search:
                query += " AND (name LIKE ? OR description LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])
                
            c.execute(query, params)
            products = [dict(row) for row in c.fetchall()]
            return success_response({"products": products}, "Products retrieved.")
        finally:
            conn.close()
    except Exception as e:
        return error_response("ERR_INTERNAL", "An internal error occurred.", 500)

@app.route('/api/v1/product/<int:id>', methods=['GET'])
@rate_limit_api
def get_product(id):
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor()
            c.execute("SELECT * FROM products WHERE id = ?", (id,))
            product = c.fetchone()
            if product:
                return success_response({"product": dict(product)}, "Product retrieved.")
            return error_response("ERR_NOT_FOUND", "Product not found.", 404)
        finally:
            conn.close()
    except Exception as e:
        return error_response("ERR_INTERNAL", "An internal error occurred.", 500)

@app.route('/api/v1/checkout/start', methods=['POST'])
@rate_limit_api
def checkout_start():
    try:
        data = request.json
        if not data or not isinstance(data, dict):
            return error_response("ERR_INVALID_PAYLOAD", "Invalid JSON payload.", 400)
        if 'address' not in data or not isinstance(data['address'], dict):
             return error_response("ERR_INVALID_ADDRESS", "Valid address object is required.", 400)
        if 'items' not in data or not isinstance(data['items'], list) or len(data['items']) == 0:
             return error_response("ERR_EMPTY_CART", "Cart is empty.", 400)
        
        subtotal = sum(item.get('price', 0) * item.get('quantity', 1) for item in data['items'])
        shipping = 15.00 if data['address'].get('country') != 'IN' else 5.00
        total = subtotal + shipping
        
        return success_response({
            "subtotal": subtotal,
            "shipping": shipping,
            "total": total
        }, "Checkout initiated.")
    except Exception as e:
        return error_response("ERR_INTERNAL", "Checkout initialization failed.", 500)

@app.route('/api/v1/payment/process', methods=['POST'])
@rate_limit_api
def payment_process():
    try:
        data = request.json
        if not data or 'amount' not in data or 'method' not in data:
            return error_response("ERR_MISSING_FIELDS", "Amount and method are required.", 400)
        
        gateway = 'Razorpay' if data['method'] == 'razorpay' else 'Stripe'
            
        return success_response({
            "transaction_id": f"txn_{int(time.time())}",
            "gateway": gateway
        }, f"Payment of ${data['amount']:.2f} processed successfully.")
    except Exception as e:
        return error_response("ERR_INTERNAL", "Payment processing failed.", 500)

@app.route('/api/v1/order/<int:order_id>', methods=['POST'])
@rate_limit_api
def confirm_order(order_id):
    try:
        data = request.json
        if not data or 'items' not in data or not isinstance(data['items'], list) or len(data['items']) == 0:
            return error_response("ERR_EMPTY_CART", "Valid items array required to process order.", 400)
            
        conn = get_db_connection()
        # Set isolation level to None to manage transactions manually
        conn.isolation_level = None 
        try:
            c = conn.cursor()
            
            # 1. Fail Fast: Pre-transaction validation
            for item in data['items']:
                product_id = item.get('id')
                quantity = item.get('quantity', 1)
                if not product_id:
                    continue
                c.execute("SELECT stock, name FROM products WHERE id = ?", (product_id,))
                row = c.fetchone()
                if not row:
                    return error_response("ERR_NOT_FOUND", f"Product ID {product_id} not found.", 404)
                if row['stock'] < quantity:
                    return error_response("ERR_OUT_OF_STOCK", f"Insufficient stock for {row['name']}.", 409)

            # 2. Atomic Database Locking Transaction
            c.execute("BEGIN EXCLUSIVE TRANSACTION")
            
            for item in data['items']:
                product_id = item.get('id')
                quantity = item.get('quantity', 1)
                if product_id:
                    # Final safety check during locked update
                    c.execute("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", (quantity, product_id, quantity))
                    if c.rowcount == 0:
                        c.execute("ROLLBACK")
                        return error_response("ERR_OUT_OF_STOCK", f"Insufficient stock for product ID {product_id} during checkout.", 409)
            
            c.execute("COMMIT")
            return success_response({"order_id": order_id}, f"Order {order_id} confirmed successfully.")
            
        except Exception as e:
            c.execute("ROLLBACK")
            return error_response("ERR_INTERNAL", "Order confirmation failed during transaction.", 500)
        finally:
            conn.close()
    except Exception as e:
        return error_response("ERR_INTERNAL", "An error occurred during order confirmation.", 500)

if __name__ == '__main__':
    app.run(port=3000, debug=True)
