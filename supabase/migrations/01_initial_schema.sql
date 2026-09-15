-- ============================================
-- RETAILSATHI V3 — SUPABASE CLOUD DATABASE SCHEMA
-- ============================================

-- 1. TENANT / SHOP TABLES
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    shop_name TEXT NOT NULL,
    owner_name TEXT,
    owner_phone TEXT,
    plan TEXT DEFAULT 'starter',
    max_counters INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    counter_id TEXT NOT NULL,
    machine_fingerprint TEXT,
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shop_id, counter_id)
);

-- 2. SYNC OPERATIONS LOG (Append-only operation queue)
CREATE TABLE IF NOT EXISTS sync_operations (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    uuid TEXT UNIQUE NOT NULL,
    counter_id TEXT NOT NULL,
    user_id INTEGER,
    operation TEXT NOT NULL,               -- 'INSERT', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,              -- 'sales', 'products', 'customers', etc.
    record_uuid TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_shop_seq ON sync_operations(shop_id, id);

-- 3. CLOUD MIRROR TABLES
CREATE TABLE IF NOT EXISTS products_cloud (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    barcode TEXT,
    name TEXT NOT NULL,
    batch_no TEXT,
    mrp REAL,
    price REAL NOT NULL,
    cost_price REAL,
    stock INTEGER DEFAULT 0,
    hsn_code TEXT,
    reorder_threshold INTEGER DEFAULT 10,
    gst_rate REAL DEFAULT 0,
    category TEXT DEFAULT 'General',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products_cloud ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS sales_cloud (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    counter_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount REAL NOT NULL,
    discount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL NOT NULL,
    payment_mode TEXT NOT NULL,
    marketing_person_uuid UUID,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shop_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS sale_items_cloud (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_uuid UUID NOT NULL REFERENCES sales_cloud(uuid) ON DELETE CASCADE,
    product_uuid UUID REFERENCES products_cloud(uuid),
    product_name TEXT NOT NULL,
    barcode TEXT,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    total_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS customers_cloud (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    loyalty_points REAL DEFAULT 0,
    dues REAL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. DELTA-BASED STOCK MANAGEMENT
CREATE TABLE IF NOT EXISTS stock_deltas (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_uuid UUID NOT NULL,
    counter_id TEXT NOT NULL,
    delta INTEGER NOT NULL,           -- negative = sold/removed, positive = added/restocked
    reason TEXT NOT NULL,             -- 'sale', 'purchase', 'adjustment', 'sale_edit', 'sale_delete'
    reference_uuid TEXT,              -- UUID of the sale/purchase operation
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_deltas_product ON stock_deltas(shop_id, product_uuid);

-- Get Current Product Stock Function
CREATE OR REPLACE FUNCTION get_product_stock(p_product_uuid UUID, p_shop_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    FROM stock_deltas
    WHERE product_uuid = p_product_uuid AND shop_id = p_shop_id;
$$ LANGUAGE sql STABLE;

-- Atomic Stock Reserve & Oversell Prevention
CREATE OR REPLACE FUNCTION try_reserve_stock(
    p_shop_id UUID,
    p_product_uuid UUID,
    p_counter_id TEXT,
    p_quantity INTEGER,
    p_reference_uuid TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    PERFORM 1 FROM stock_deltas
        WHERE product_uuid = p_product_uuid AND shop_id = p_shop_id
        FOR UPDATE;

    SELECT COALESCE(SUM(delta), 0) INTO current_stock
        FROM stock_deltas
        WHERE product_uuid = p_product_uuid AND shop_id = p_shop_id;

    IF current_stock < p_quantity THEN
        RETURN FALSE;
    END IF;

    INSERT INTO stock_deltas (shop_id, product_uuid, counter_id, delta, reason, reference_uuid)
    VALUES (p_shop_id, p_product_uuid, p_counter_id, -p_quantity, 'sale', p_reference_uuid);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. AUTO-PROVISION MISSING SHOPS (Prevents Foreign Key Constraint Errors)
CREATE OR REPLACE FUNCTION auto_create_shop_if_missing()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Ensure shop exists
    IF NOT EXISTS (SELECT 1 FROM shops WHERE id = NEW.shop_id) THEN
        INSERT INTO shops (id, license_key, shop_name, owner_name, max_counters)
        VALUES (NEW.shop_id, 'RS-AUTO-' || substring(NEW.shop_id::text from 1 for 8), 'Main Retail Store', 'Store Owner', 10)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Ensure counter is registered in counters table
    IF NEW.counter_id IS NOT NULL AND NEW.counter_id != '' THEN
        INSERT INTO counters (shop_id, counter_id, last_seen_at, is_active)
        VALUES (NEW.shop_id, NEW.counter_id, now(), true)
        ON CONFLICT (shop_id, counter_id) DO UPDATE SET
            last_seen_at = now(),
            is_active = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_shop ON sync_operations;

CREATE TRIGGER trigger_auto_create_shop
BEFORE INSERT ON sync_operations
FOR EACH ROW
EXECUTE FUNCTION auto_create_shop_if_missing();

-- 6. AUTOMATIC PROJECTION TRIGGER: SYNC OPS -> MIRROR TABLES (products_cloud, sales_cloud, customers_cloud)
CREATE OR REPLACE FUNCTION project_sync_op_to_mirror_tables()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB := NEW.payload;
    target_uuid UUID;
BEGIN
    -- Safely parse or generate UUID
    BEGIN
        target_uuid := (NEW.record_uuid)::UUID;
    EXCEPTION WHEN OTHERS THEN
        target_uuid := gen_random_uuid();
    END;

    -- 1. PRODUCTS
    IF NEW.table_name = 'products' THEN
        IF NEW.operation IN ('INSERT', 'UPDATE') THEN
            INSERT INTO products_cloud (uuid, shop_id, barcode, name, batch_no, mrp, price, cost_price, stock, hsn_code, reorder_threshold, gst_rate, category, updated_at)
            VALUES (
                target_uuid,
                NEW.shop_id,
                payload->>'barcode',
                COALESCE(NULLIF(payload->>'name', ''), 'Product'),
                payload->>'batch_no',
                COALESCE((payload->>'mrp')::REAL, 0),
                COALESCE((payload->>'price')::REAL, 0),
                COALESCE((payload->>'cost_price')::REAL, 0),
                COALESCE((payload->>'stock')::INTEGER, 0),
                payload->>'hsn_code',
                COALESCE((payload->>'reorder_threshold')::INTEGER, 0),
                COALESCE((payload->>'gst_rate')::REAL, 0),
                COALESCE(NULLIF(payload->>'category', ''), 'General'),
                now()
            )
            ON CONFLICT (uuid) DO UPDATE SET
                barcode = COALESCE(payload->>'barcode', products_cloud.barcode),
                name = CASE 
                    WHEN payload->>'name' IS NOT NULL AND payload->>'name' != '' AND payload->>'name' != 'Product' 
                    THEN payload->>'name' 
                    ELSE products_cloud.name 
                END,
                batch_no = COALESCE(payload->>'batch_no', products_cloud.batch_no),
                mrp = CASE WHEN payload ? 'mrp' AND (payload->>'mrp')::REAL > 0 THEN (payload->>'mrp')::REAL ELSE products_cloud.mrp END,
                price = CASE WHEN payload ? 'price' AND (payload->>'price')::REAL > 0 THEN (payload->>'price')::REAL ELSE products_cloud.price END,
                cost_price = CASE WHEN payload ? 'cost_price' AND (payload->>'cost_price')::REAL > 0 THEN (payload->>'cost_price')::REAL ELSE products_cloud.cost_price END,
                stock = CASE WHEN payload ? 'stock' THEN (payload->>'stock')::INTEGER ELSE products_cloud.stock END,
                hsn_code = COALESCE(payload->>'hsn_code', products_cloud.hsn_code),
                reorder_threshold = CASE WHEN payload ? 'reorder_threshold' THEN (payload->>'reorder_threshold')::INTEGER ELSE products_cloud.reorder_threshold END,
                gst_rate = CASE WHEN payload ? 'gst_rate' THEN (payload->>'gst_rate')::REAL ELSE products_cloud.gst_rate END,
                category = COALESCE(NULLIF(payload->>'category', ''), products_cloud.category),
                updated_at = now();

        ELSIF NEW.operation = 'DELETE' THEN
            UPDATE products_cloud SET is_deleted = true, updated_at = now() WHERE uuid = target_uuid;
        END IF;

    -- 2. CUSTOMERS
    ELSIF NEW.table_name = 'customers' THEN
        IF NEW.operation IN ('INSERT', 'UPDATE') THEN
            INSERT INTO customers_cloud (uuid, shop_id, name, phone, address, loyalty_points, dues, updated_at)
            VALUES (
                target_uuid,
                NEW.shop_id,
                COALESCE(payload->>'name', 'Customer'),
                payload->>'phone',
                payload->>'address',
                COALESCE((payload->>'loyalty_points')::REAL, 0),
                COALESCE((payload->>'dues')::REAL, 0),
                now()
            )
            ON CONFLICT (uuid) DO UPDATE SET
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                address = EXCLUDED.address,
                loyalty_points = EXCLUDED.loyalty_points,
                dues = EXCLUDED.dues,
                updated_at = now();
        ELSIF NEW.operation = 'DELETE' THEN
            UPDATE customers_cloud SET is_deleted = true, updated_at = now() WHERE uuid = target_uuid;
        END IF;

    -- 3. SALES
    ELSIF NEW.table_name = 'sales' THEN
        IF NEW.operation IN ('INSERT', 'UPDATE') THEN
            INSERT INTO sales_cloud (uuid, shop_id, counter_id, invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, updated_at)
            VALUES (
                target_uuid,
                NEW.shop_id,
                NEW.counter_id,
                COALESCE(payload->>'invoice_no', 'INV-UNKNOWN'),
                payload->>'customer_name',
                payload->>'customer_phone',
                COALESCE((payload->>'total_amount')::REAL, 0),
                COALESCE((payload->>'discount')::REAL, 0),
                COALESCE((payload->>'tax_amount')::REAL, 0),
                COALESCE((payload->>'grand_total')::REAL, 0),
                COALESCE(payload->>'payment_mode', 'Cash'),
                now()
            )
            ON CONFLICT (uuid) DO UPDATE SET
                customer_name = EXCLUDED.customer_name,
                customer_phone = EXCLUDED.customer_phone,
                total_amount = EXCLUDED.total_amount,
                discount = EXCLUDED.discount,
                tax_amount = EXCLUDED.tax_amount,
                grand_total = EXCLUDED.grand_total,
                payment_mode = EXCLUDED.payment_mode,
                updated_at = now();
        ELSIF NEW.operation = 'DELETE' THEN
            UPDATE sales_cloud SET is_deleted = true, updated_at = now() WHERE uuid = target_uuid;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_sync_op ON sync_operations;

CREATE TRIGGER trigger_project_sync_op
AFTER INSERT ON sync_operations
FOR EACH ROW
EXECUTE FUNCTION project_sync_op_to_mirror_tables();

-- 7. ENABLE REALTIME PUBLICATION ON SYNC OPERATIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'sync_operations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sync_operations;
  END IF;
END $$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items_cloud ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shops_anon_policy ON shops;
DROP POLICY IF EXISTS counters_anon_policy ON counters;
DROP POLICY IF EXISTS sync_operations_anon_policy ON sync_operations;
DROP POLICY IF EXISTS products_cloud_anon_policy ON products_cloud;
DROP POLICY IF EXISTS sales_cloud_anon_policy ON sales_cloud;
DROP POLICY IF EXISTS stock_deltas_anon_policy ON stock_deltas;
DROP POLICY IF EXISTS customers_cloud_anon_policy ON customers_cloud;
DROP POLICY IF EXISTS sale_items_cloud_anon_policy ON sale_items_cloud;

CREATE POLICY shops_anon_policy ON shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY counters_anon_policy ON counters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY sync_operations_anon_policy ON sync_operations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY products_cloud_anon_policy ON products_cloud FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY sales_cloud_anon_policy ON sales_cloud FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY stock_deltas_anon_policy ON stock_deltas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY customers_cloud_anon_policy ON customers_cloud FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY sale_items_cloud_anon_policy ON sale_items_cloud FOR ALL USING (true) WITH CHECK (true);

-- 9. SEED DEFAULT STORE RECORD
INSERT INTO shops (id, license_key, shop_name, owner_name, max_counters)
VALUES ('00000000-0000-0000-0000-000000000001', 'RS-DEMO-LICENSE-2026', 'Main Retail Store', 'Store Owner', 5)
ON CONFLICT (id) DO NOTHING;

-- 10. BACKFILL ALL EXISTING SYNC_OPERATIONS INTO MIRROR TABLES
DO $$
DECLARE
    op RECORD;
BEGIN
    FOR op IN SELECT * FROM sync_operations ORDER BY id ASC LOOP
        BEGIN
            IF op.table_name = 'products' AND op.operation IN ('INSERT', 'UPDATE') THEN
                INSERT INTO products_cloud (uuid, shop_id, barcode, name, batch_no, mrp, price, cost_price, stock, hsn_code, reorder_threshold, gst_rate, category, updated_at)
                VALUES (
                    (op.record_uuid)::UUID,
                    op.shop_id,
                    op.payload->>'barcode',
                    COALESCE(NULLIF(op.payload->>'name', ''), 'Product'),
                    op.payload->>'batch_no',
                    COALESCE((op.payload->>'mrp')::REAL, 0),
                    COALESCE((op.payload->>'price')::REAL, 0),
                    COALESCE((op.payload->>'cost_price')::REAL, 0),
                    COALESCE((op.payload->>'stock')::INTEGER, 0),
                    op.payload->>'hsn_code',
                    COALESCE((op.payload->>'reorder_threshold')::INTEGER, 0),
                    COALESCE((op.payload->>'gst_rate')::REAL, 0),
                    COALESCE(NULLIF(op.payload->>'category', ''), 'General'),
                    now()
                )
                ON CONFLICT (uuid) DO UPDATE SET
                    barcode = COALESCE(op.payload->>'barcode', products_cloud.barcode),
                    name = CASE 
                        WHEN op.payload->>'name' IS NOT NULL AND op.payload->>'name' != '' AND op.payload->>'name' != 'Product' 
                        THEN op.payload->>'name' 
                        ELSE products_cloud.name 
                    END,
                    mrp = CASE WHEN op.payload ? 'mrp' AND (op.payload->>'mrp')::REAL > 0 THEN (op.payload->>'mrp')::REAL ELSE products_cloud.mrp END,
                    price = CASE WHEN op.payload ? 'price' AND (op.payload->>'price')::REAL > 0 THEN (op.payload->>'price')::REAL ELSE products_cloud.price END,
                    cost_price = CASE WHEN op.payload ? 'cost_price' AND (op.payload->>'cost_price')::REAL > 0 THEN (op.payload->>'cost_price')::REAL ELSE products_cloud.cost_price END,
                    stock = CASE WHEN op.payload ? 'stock' THEN (op.payload->>'stock')::INTEGER ELSE products_cloud.stock END,
                    category = COALESCE(NULLIF(op.payload->>'category', ''), products_cloud.category),
                    updated_at = now();

            ELSIF op.table_name = 'customers' AND op.operation IN ('INSERT', 'UPDATE') THEN
                INSERT INTO customers_cloud (uuid, shop_id, name, phone, address, loyalty_points, dues, updated_at)
                VALUES (
                    (op.record_uuid)::UUID,
                    op.shop_id,
                    COALESCE(op.payload->>'name', 'Customer'),
                    op.payload->>'phone',
                    op.payload->>'address',
                    COALESCE((op.payload->>'loyalty_points')::REAL, 0),
                    COALESCE((op.payload->>'dues')::REAL, 0),
                    now()
                )
                ON CONFLICT (uuid) DO NOTHING;

            ELSIF op.table_name = 'sales' AND op.operation IN ('INSERT', 'UPDATE') THEN
                INSERT INTO sales_cloud (uuid, shop_id, counter_id, invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, updated_at)
                VALUES (
                    (op.record_uuid)::UUID,
                    op.shop_id,
                    op.counter_id,
                    COALESCE(op.payload->>'invoice_no', 'INV-UNKNOWN'),
                    op.payload->>'customer_name',
                    op.payload->>'customer_phone',
                    COALESCE((op.payload->>'total_amount')::REAL, 0),
                    COALESCE((op.payload->>'discount')::REAL, 0),
                    COALESCE((op.payload->>'tax_amount')::REAL, 0),
                    COALESCE((op.payload->>'grand_total')::REAL, 0),
                    COALESCE(op.payload->>'payment_mode', 'Cash'),
                    now()
                )
                ON CONFLICT (uuid) DO NOTHING;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip invalid row during backfill
        END;
    END LOOP;
END $$;
