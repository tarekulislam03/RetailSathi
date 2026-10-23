import sqlite3
import json
import random
import time

def generate_ean13(existing_set):
    for attempt in range(500):
        time_digits = str(int(time.time() * 1000) + attempt)[-6:]
        rand_digits = str(random.randint(100, 999))
        first12 = f"200{time_digits}{rand_digits}"
        s = 0
        for i in range(12):
            d = int(first12[i])
            s += d if i % 2 == 0 else d * 3
        check_digit = (10 - (s % 10)) % 10
        candidate = f"{first12}{check_digit}"
        if candidate not in existing_set:
            existing_set.add(candidate)
            return candidate
    return f"200{int(time.time())}{random.randint(10, 99)}"

con = sqlite3.connect('/home/tarekul/.config/com.tarekul.retail-sathi/retail_sathi.db')
cur = con.cursor()
cur.execute("SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ''")
existing_barcodes = set(r[0].strip().lower() for r in cur.fetchall())

print(f"Loaded {len(existing_barcodes)} existing barcodes from DB.")

# Define the 3 purchases
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

for p in purchases:
    print(f"\nInvoice {p['invoice_no']} from {p['supplier_name']}:")
    total_qty = sum(item["quantity"] for item in p["items"])
    calc_total = sum(item["subtotal"] for item in p["items"])
    print(f"  Items: {len(p['items'])}, Total Units: {total_qty}, Expected Total: {p['total_amount']}, Sum Subtotals: {calc_total:.2f}")
    for item in p["items"]:
        if not item["barcode"]:
            item["barcode"] = generate_ean13(existing_barcodes)
            print(f"  [NEW BARCODE] {item['product_name']} -> {item['barcode']}")
        else:
            print(f"  [EXISTING/ASSIGNED] {item['product_name']} -> {item['barcode']}")

print("\nGrand Total of all 3 invoices:", sum(p["total_amount"] for p in purchases))
con.close()
