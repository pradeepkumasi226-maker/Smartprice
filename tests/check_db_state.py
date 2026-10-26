import sqlite3

conn = sqlite3.connect("backend/data/smartprice.db")
c = conn.cursor()
print("Products:", c.execute("SELECT COUNT(*) FROM products").fetchone()[0])
print("Transactions:", c.execute("SELECT COUNT(*) FROM inventory_transactions").fetchone()[0])
print("Scenarios:", c.execute("SELECT COUNT(*) FROM what_if_scenarios").fetchone()[0])
print("Recommendations:", c.execute("SELECT COUNT(*) FROM pricing_recommendations").fetchone()[0])
print("HOM-7193:", c.execute("SELECT stock_quantity, current_price FROM products WHERE sku='HOM-7193'").fetchone())
print("ELC-4921:", c.execute("SELECT stock_quantity, current_price FROM products WHERE sku='ELC-4921'").fetchone())
print("APP-1029:", c.execute("SELECT stock_quantity, current_price FROM products WHERE sku='APP-1029'").fetchone())
conn.close()
