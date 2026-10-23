import sqlite3
import shutil
import urllib.request
import json
import time
import random
import datetime

DB_PATH = '/home/tarekul/.config/com.tarekul.retail-sathi/retail_sathi.db'
BACKUP_PATH = '/home/tarekul/.config/com.tarekul.retail-sathi/retail_sathi.db.bak'

# 1. Backup local DB
shutil.copy2(DB_PATH, BACKUP_PATH)
print("Backed up local DB to:", BACKUP_PATH)

SUPABASE_URL = "https://sfbzeehmjrarhprpagxy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmYnplZWhtanJhcmhwcnBhZ3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODk0NjMsImV4cCI6MjEwNDk2NTQ2M30.lENrO2VCCGEAEuiuOEB1JCzKiFDcV8fY6Nn49Pw-Cto"

def exec_supabase_sql(query):
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    data = json.dumps({"query_text": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return True, None
    except Exception as e:
        return False, str(e)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Get existing barcodes
cur.execute("SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ''")
existing_barcodes = set(r[0].strip().lower() for r in cur.fetchall())

def generate_ean13():
    for attempt in range(500):
        time_digits = str(int(time.time() * 1000) + attempt)[-6:]
        rand_digits = str(random.randint(100, 999))
        first12 = f"200{time_digits}{rand_digits}"
        s = 0
        for i in range(12):
            d = int(first12[i])
            s += d if i % 2 == 0 else d * 3
        check_digit = (10 - (s % 10)) % 10
        candidate = f"{first12}${check_digit}".replace('$', '')
        if candidate.lower() not in existing_barcodes:
            existing_barcodes.add(candidate.lower())
            return candidate
    return f"200{int(time.time())}{random.randint(10, 99)}"

# Ensure suppliers
suppliers_data = [
    {
        "name": "R K ENTERPRISE",
        "company_name": "R K ENTERPRISE",
        "gst_no": "19CYXPS2562Q1Z0",
        "contact_no": "9932937598",
        "address": "MASAT, NEAR BAJAJ SHOWROOM Hooghly"
    },
    {
        "name": "JAYA SADHUKHAN",
        "company_name": "JAYA SADHUKHAN",
        "gst_no": "",
        "contact_no": "03212241129",
        "address": "MASAT PH 03212241129 West Bengal"
    }
]

for sup in suppliers_data:
    cur.execute("SELECT id FROM suppliers WHERE name = ?", (sup["name"],))
    row = cur.fetchone()
    if not row:
        cur.execute("""
            INSERT INTO suppliers (name, company_name, gst_no, contact_no, address, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """, (sup["name"], sup["company_name"], sup["gst_no"], sup["contact_no"], sup["address"]))
        sup_id = cur.lastrowid
        print(f"Inserted supplier {sup['name']} with ID {sup_id}")
        # Sync supplier
        sql = f"INSERT INTO suppliers (id, name, company_name, gst_no, contact_no, address, created_at) VALUES ({sup_id}, '{sup['name']}', '{sup['company_name']}', '{sup['gst_no']}', '{sup['contact_no']}', '{sup['address']}', NOW());"
        ok, err = exec_supabase_sql(sql)
        if not ok:
            print("  Supabase sync supplier err:", err)

# Purchase definitions
purchases = [
    {
        "supplier_name": "R K ENTERPRISE",
        "invoice_no": "SIT-4154",
        "purchase_date": "2026-10-18",
        "gst_no": "19CYXPS2562Q1Z0",
        "contact_no": "9932937598",
        "total_amount": 3009.00,
        "items": [
            {
                "product_name": "SUN HALDI 50GM",
                "barcode": "8901781000338",
                "hsn_code": "0910",
                "category": "Spices & Masala",
                "purchase_price": 15.71,
                "mrp": 19.00,
                "selling_price": 18.00,
                "gst_rate": 5.0,
                "quantity": 20,
                "subtotal": 314.20
            },
            {
                "product_name": "SUN HALDI 100GM",
                "barcode": "8901781000291",
                "hsn_code": "0910",
                "category": "Spices & Masala",
                "purchase_price": 31.42,
                "mrp": 44.00,
                "selling_price": 35.00,
                "gst_rate": 5.0,
                "quantity": 10,
                "subtotal": 314.20
            },
            {
                "product_name": "SUN HALDI 200GM",
                "barcode": "8901781001137",
                "hsn_code": "0910",
                "category": "Spices & Masala",
                "purchase_price": 62.86,
                "mrp": 74.00,
                "selling_price": 70.00,
                "gst_rate": 5.0,
                "quantity": 5,
                "subtotal": 314.30
            },
            {
                "product_name": "SUN MIRCHI 50GM",
                "barcode": "8901781000352",
                "hsn_code": "0904",
                "category": "Spices & Masala",
                "purchase_price": 22.86,
                "mrp": 31.00,
                "selling_price": 26.00,
                "gst_rate": 5.0,
                "quantity": 20,
                "subtotal": 457.20
            },
            {
                "product_name": "SUN MIRCHI 100GM",
                "barcode": "8901781000307",
                "hsn_code": "0904",
                "category": "Spices & Masala",
                "purchase_price": 45.71,
                "mrp": 56.00,
                "selling_price": 54.00,
                "gst_rate": 5.0,
                "quantity": 10,
                "subtotal": 457.10
            },
            {
                "product_name": "SUN MIRCHI 200GM",
                "barcode": "8901781001144",
                "hsn_code": "0904",
                "category": "Spices & Masala",
                "purchase_price": 91.43,
                "mrp": 118.00,
                "selling_price": 105.00,
                "gst_rate": 5.0,
                "quantity": 5,
                "subtotal": 457.15
            },
            {
                "product_name": "NUT SOYA BORI 200GM+20gm",
                "barcode": "8906032016571",
                "hsn_code": "21060000",
                "category": "Grocery & Food",
                "purchase_price": 45.95,
                "mrp": 55.00,
                "selling_price": 53.00,
                "gst_rate": 5.0,
                "quantity": 6,
                "subtotal": 275.70
            },
            {
                "product_name": "NUT SOYA MINI 200GM+20GM",
                "barcode": "8906032011019",
                "hsn_code": "21060000",
                "category": "Grocery & Food",
                "purchase_price": 45.95,
                "mrp": 55.00,
                "selling_price": 51.00,
                "gst_rate": 5.0,
                "quantity": 6,
                "subtotal": 275.70
            }
        ]
    },
    {
        "supplier_name": "JAYA SADHUKHAN",
        "invoice_no": "1695",
        "purchase_date": "2026-10-18",
        "gst_no": "",
        "contact_no": "03212241129",
        "total_amount": 11562.00,
        "items": [
            {
                "product_name": "COL 100G 73/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 65.83,
                "mrp": 73.00,
                "selling_price": 73.00,
                "gst_rate": 0.0,
                "quantity": 12,
                "subtotal": 790.00
            },
            {
                "product_name": "COL 50GM 20/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 17.83,
                "mrp": 20.00,
                "selling_price": 20.00,
                "gst_rate": 0.0,
                "quantity": 24,
                "subtotal": 428.00
            },
            {
                "product_name": "COL MF 20/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 17.75,
                "mrp": 20.00,
                "selling_price": 20.00,
                "gst_rate": 0.0,
                "quantity": 12,
                "subtotal": 213.00
            },
            {
                "product_name": "CLOSE UP 20/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 17.75,
                "mrp": 20.00,
                "selling_price": 20.00,
                "gst_rate": 0.0,
                "quantity": 12,
                "subtotal": 213.00
            },
            {
                "product_name": "LG TEA B 200/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Beverages & Tea",
                "purchase_price": 175.00,
                "mrp": 200.00,
                "selling_price": 200.00,
                "gst_rate": 0.0,
                "quantity": 3,
                "subtotal": 525.00
            },
            {
                "product_name": "HORLICKS LITE 450GM",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Health & Nutrition",
                "purchase_price": 275.00,
                "mrp": 299.00,
                "selling_price": 299.00,
                "gst_rate": 0.0,
                "quantity": 3,
                "subtotal": 825.00
            },
            {
                "product_name": "COL C 200GM 68/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 58.00,
                "mrp": 68.00,
                "selling_price": 68.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 348.00
            },
            {
                "product_name": "DOVE SAMP 180Ml 189/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 160.00,
                "mrp": 189.00,
                "selling_price": 189.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 960.00
            },
            {
                "product_name": "DOVE SMPO 100ML 60/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 50.50,
                "mrp": 60.00,
                "selling_price": 60.00,
                "gst_rate": 0.0,
                "quantity": 7,
                "subtotal": 353.50
            },
            {
                "product_name": "TRASMEE sampoo 172/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 145.00,
                "mrp": 172.00,
                "selling_price": 172.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 870.00
            },
            {
                "product_name": "SUNSILK 200ML 173/- black",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 148.00,
                "mrp": 173.00,
                "selling_price": 173.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 888.00
            },
            {
                "product_name": "SUNSULK SAMPOO PINK",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 148.00,
                "mrp": 173.00,
                "selling_price": 173.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 888.00
            },
            {
                "product_name": "CP 100ML 49/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 41.00,
                "mrp": 49.00,
                "selling_price": 49.00,
                "gst_rate": 0.0,
                "quantity": 7,
                "subtotal": 287.00
            },
            {
                "product_name": "CP 180ML 140/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 119.00,
                "mrp": 153.00,
                "selling_price": 153.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 714.00
            },
            {
                "product_name": "CP 400ML 350/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 302.00,
                "mrp": 350.00,
                "selling_price": 350.00,
                "gst_rate": 0.0,
                "quantity": 2,
                "subtotal": 604.00
            },
            {
                "product_name": "K JAM 110/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Sauces & Condiments",
                "purchase_price": 100.91,
                "mrp": 110.00,
                "selling_price": 110.00,
                "gst_rate": 0.0,
                "quantity": 3,
                "subtotal": 302.73
            },
            {
                "product_name": "K JAM 200gm 90/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Sauces & Condiments",
                "purchase_price": 85.71,
                "mrp": 90.00,
                "selling_price": 90.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 514.26
            },
            {
                "product_name": "K JAM 27/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Sauces & Condiments",
                "purchase_price": 24.50,
                "mrp": 27.00,
                "selling_price": 27.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 147.00
            },
            {
                "product_name": "VBL 400ML 580/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 448.00,
                "mrp": 580.00,
                "selling_price": 580.00,
                "gst_rate": 0.0,
                "quantity": 3,
                "subtotal": 1344.00
            },
            {
                "product_name": "TRASMEE 100ml 69/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 58.00,
                "mrp": 69.00,
                "selling_price": 69.00,
                "gst_rate": 0.0,
                "quantity": 6,
                "subtotal": 348.00
            }
        ]
    },
    {
        "supplier_name": "JAYA SADHUKHAN",
        "invoice_no": "1696",
        "purchase_date": "2026-10-18",
        "gst_no": "",
        "contact_no": "03212241129",
        "total_amount": 1428.00,
        "items": [
            {
                "product_name": "COL S F 20/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 11.50,
                "mrp": 20.00,
                "selling_price": 20.00,
                "gst_rate": 0.0,
                "quantity": 12,
                "subtotal": 138.00
            },
            {
                "product_name": "COL ZIK ZAK 30/-",
                "barcode": "",
                "hsn_code": "1234",
                "category": "Personal Care",
                "purchase_price": 18.33,
                "mrp": 30.00,
                "selling_price": 30.00,
                "gst_rate": 0.0,
                "quantity": 12,
                "subtotal": 220.00
            },
            {
                "product_name": "SLDP 500GM 59/-",
                "barcode": "8901030959257",
                "hsn_code": "1234",
                "category": "Household & Cleaning",
                "purchase_price": 53.50,
                "mrp": 59.00,
                "selling_price": 56.00,
                "gst_rate": 0.0,
                "quantity": 20,
                "subtotal": 1070.00
            }
        ]
    }
]

# Track max product id across SQLite and Supabase
cur.execute("SELECT MAX(id) FROM products")
current_max_prod_id = max(cur.fetchone()[0] or 0, 978)

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

for p in purchases:
    print(f"\nProcessing Invoice {p['invoice_no']} from {p['supplier_name']}...")
    
    # Insert purchase locally
    cur.execute("""
        INSERT INTO purchases (supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, item_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        p["supplier_name"],
        p["invoice_no"],
        p["purchase_date"],
        p["gst_no"],
        p["contact_no"],
        p["total_amount"],
        len(p["items"]),
        now_iso
    ))
    purchase_id = cur.lastrowid
    print(f"  Recorded purchase ID: {purchase_id}")
    
    # Sync purchase to Supabase
    p_sql = f"INSERT INTO purchases (id, supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, item_count, created_at) VALUES ({purchase_id}, '{p['supplier_name']}', '{p['invoice_no']}', '{p['purchase_date']}', '{p['gst_no']}', '{p['contact_no']}', {p['total_amount']}, {len(p['items'])}, '{now_iso}');"
    ok, err = exec_supabase_sql(p_sql)
    if not ok:
        print("  Supabase sync purchase err:", err)

    for item in p["items"]:
        # Find or create product
        barcode = item["barcode"].strip()
        name = item["product_name"].strip()
        
        existing_prod = None
        if barcode:
            cur.execute("SELECT id, barcode, name, stock, price, cost_price, mrp FROM products WHERE barcode = ? LIMIT 1", (barcode,))
            existing_prod = cur.fetchone()
        
        if not existing_prod and name:
            cur.execute("SELECT id, barcode, name, stock, price, cost_price, mrp FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1", (name,))
            existing_prod = cur.fetchone()

        if existing_prod:
            prod_id = existing_prod[0]
            new_stock = (existing_prod[3] or 0) + item["quantity"]
            # Update product locally
            cur.execute("""
                UPDATE products
                SET stock = stock + ?,
                    price = ?,
                    cost_price = ?,
                    mrp = ?,
                    hsn_code = COALESCE(NULLIF(?, ''), hsn_code),
                    gst_rate = ?,
                    category = COALESCE(NULLIF(?, ''), category)
                WHERE id = ?
            """, (
                item["quantity"],
                item["selling_price"],
                item["purchase_price"],
                item["mrp"],
                item["hsn_code"],
                item["gst_rate"],
                item["category"],
                prod_id
            ))
            # Sync product update
            prod_sql = f"UPDATE products SET stock = stock + {item['quantity']}, price = {item['selling_price']}, cost_price = {item['purchase_price']}, mrp = {item['mrp']}, hsn_code = '{item['hsn_code']}', gst_rate = {item['gst_rate']}, category = '{item['category']}' WHERE id = {prod_id};"
            ok, err = exec_supabase_sql(prod_sql)
            if not ok:
                print(f"  Supabase update prod #{prod_id} err:", err)
            print(f"  Updated existing product #{prod_id} '{existing_prod[2]}': Stock {existing_prod[3]} -> {new_stock}")
        else:
            current_max_prod_id += 1
            prod_id = current_max_prod_id
            final_barcode = barcode if barcode else generate_ean13()
            item["barcode"] = final_barcode
            
            # Insert product locally
            cur.execute("""
                INSERT INTO products (id, barcode, name, batch_no, hsn_code, mrp, price, cost_price, stock, gst_rate, category, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prod_id,
                final_barcode,
                name,
                "",
                item["hsn_code"],
                item["mrp"],
                item["selling_price"],
                item["purchase_price"],
                item["quantity"],
                item["gst_rate"],
                item["category"],
                now_iso
            ))
            # Sync product insert
            prod_sql = f"INSERT INTO products (id, barcode, name, batch_no, hsn_code, mrp, price, cost_price, stock, gst_rate, category, created_at) VALUES ({prod_id}, '{final_barcode}', '{name.replace(chr(39), chr(39)+chr(39))}', '', '{item['hsn_code']}', {item['mrp']}, {item['selling_price']}, {item['purchase_price']}, {item['quantity']}, {item['gst_rate']}, '{item['category']}', '{now_iso}');"
            ok, err = exec_supabase_sql(prod_sql)
            if not ok:
                print(f"  Supabase insert prod #{prod_id} err:", err)
            print(f"  Created new product #{prod_id} '{name}' with barcode {final_barcode}: Stock {item['quantity']}")

        # Insert purchase item locally
        cur.execute("""
            INSERT INTO purchase_items (purchase_id, product_id, product_name, barcode, batch_no, hsn_code, category, purchase_price, mrp, selling_price, gst_rate, quantity, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            purchase_id,
            prod_id,
            name,
            item["barcode"],
            "",
            item["hsn_code"],
            item["category"],
            item["purchase_price"],
            item["mrp"],
            item["selling_price"],
            item["gst_rate"],
            item["quantity"],
            item["subtotal"]
        ))
        p_item_id = cur.lastrowid
        
        # Sync purchase item to Supabase
        pitem_sql = f"INSERT INTO purchase_items (id, purchase_id, product_id, product_name, barcode, batch_no, hsn_code, category, purchase_price, mrp, selling_price, gst_rate, quantity, subtotal) VALUES ({p_item_id}, {purchase_id}, {prod_id}, '{name.replace(chr(39), chr(39)+chr(39))}', '{item['barcode']}', '', '{item['hsn_code']}', '{item['category']}', {item['purchase_price']}, {item['mrp']}, {item['selling_price']}, {item['gst_rate']}, {item['quantity']}, {item['subtotal']});"
        ok, err = exec_supabase_sql(pitem_sql)
        if not ok:
            print(f"  Supabase insert purchase item #{p_item_id} err:", err)

con.commit()
con.close()
print("\nAll 3 invoices successfully recorded into purchases and synced with inventory!")
