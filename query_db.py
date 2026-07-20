import sqlite3
import json
import os

db_path = r'C:\Users\the1a\AppData\Local\Ollama\db.sqlite'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT * FROM messages;")
rows = c.fetchall()
data = [dict(row) for row in rows]
with open('c:/Users/the1a/Our Site/messages.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
