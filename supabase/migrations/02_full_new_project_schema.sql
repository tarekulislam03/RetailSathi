-- ============================================================================
-- RETAIL SATHI — COMPLETE SUPABASE SCHEMA & LOW-EGRESS SYNC OPTIMIZATION
-- Run this entire script in the Supabase SQL Editor of your new project.
-- ============================================================================

-- 1. AUTOMATIC updated_at TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. STORES TABLE
CREATE TABLE IF NOT EXISTS public.stores (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  setup_cost REAL DEFAULT 0,
  amc REAL DEFAULT 0,
  is_active BIGINT NOT NULL DEFAULT 1,
  upi_id TEXT,
  upi_name TEXT,
  gstin TEXT,
  receipt_footer TEXT,
  paper_width BIGINT DEFAULT 80,
  default_printer TEXT,
  show_barcode BIGINT DEFAULT 1,
  show_upi_qr BIGINT DEFAULT 1,
  tagline TEXT,
  promo_text TEXT,
  fssai TEXT,
  logo_url TEXT,
  return_policy TEXT,
  show_header BIGINT DEFAULT 1,
  show_customer BIGINT DEFAULT 1,
  show_savings BIGINT DEFAULT 1,
  show_tax BIGINT DEFAULT 1,
  show_return_policy BIGINT DEFAULT 1,
  mandatory_bill_note BIGINT DEFAULT 1,
  barcode_printer TEXT,
  label_width_mm REAL DEFAULT 50,
  label_height_mm REAL DEFAULT 30,
  label_gap_mm REAL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  store_id BIGINT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_ms BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, key)
);

-- 4. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  phone TEXT,
  store_id BIGINT REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  barcode TEXT,
  name TEXT NOT NULL,
  batch_no TEXT,
  mrp REAL DEFAULT 0,
  price REAL NOT NULL,
  cost_price REAL DEFAULT 0,
  stock BIGINT NOT NULL DEFAULT 0,
  hsn_code TEXT,
  reorder_threshold BIGINT DEFAULT 0,
  gst_rate REAL DEFAULT 0,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. MARKETING TABLE
CREATE TABLE IF NOT EXISTS public.marketing (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  area TEXT,
  sales REAL DEFAULT 0,
  commission REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  gst_no TEXT,
  contact_no TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  purchase_item_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  loyalty_points REAL DEFAULT 0,
  lucky_draw_used BIGINT DEFAULT 0,
  dues REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
  id BIGSERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  gst_no TEXT,
  contact_no TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  item_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. PURCHASE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id BIGINT,
  product_name TEXT NOT NULL,
  barcode TEXT,
  batch_no TEXT,
  hsn_code TEXT,
  category TEXT DEFAULT 'General',
  purchase_price REAL NOT NULL,
  mrp REAL DEFAULT 0,
  selling_price REAL NOT NULL,
  gst_rate REAL DEFAULT 0,
  quantity BIGINT NOT NULL,
  subtotal REAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. SALES TABLE
CREATE TABLE IF NOT EXISTS public.sales (
  id BIGSERIAL PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount REAL NOT NULL,
  discount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  marketing_person_id BIGINT REFERENCES public.marketing(id) ON DELETE SET NULL,
  customer_id BIGINT,
  loyalty_points REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. SALE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  invoice_no TEXT,
  product_id BIGINT,
  product_name TEXT NOT NULL,
  barcode TEXT,
  batch_no TEXT,
  price REAL NOT NULL,
  quantity BIGINT NOT NULL,
  total_price REAL NOT NULL,
  mrp REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. ADD updated_at COLUMNS IF MIGRATING AN EXISTING DATABASE
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.marketing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lucky_draw_used INTEGER DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS loyalty_points REAL DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS batch_no TEXT;
ALTER TABLE public.stores ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.users ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.users ALTER COLUMN store_id TYPE BIGINT;
ALTER TABLE public.products ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.products ALTER COLUMN stock TYPE BIGINT;
ALTER TABLE public.products ALTER COLUMN reorder_threshold TYPE BIGINT;
ALTER TABLE public.marketing ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.suppliers ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.customers ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.customers ALTER COLUMN purchase_item_id TYPE BIGINT;
ALTER TABLE public.purchases ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.purchase_items ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.purchase_items ALTER COLUMN purchase_id TYPE BIGINT;
ALTER TABLE public.purchase_items ALTER COLUMN product_id TYPE BIGINT;
ALTER TABLE public.purchase_items ALTER COLUMN quantity TYPE BIGINT;
ALTER TABLE public.sales ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.sales ALTER COLUMN marketing_person_id TYPE BIGINT;
ALTER TABLE public.sales ALTER COLUMN customer_id TYPE BIGINT;
ALTER TABLE public.sale_items ALTER COLUMN id TYPE BIGINT;
ALTER TABLE public.sale_items ALTER COLUMN sale_id TYPE BIGINT;
ALTER TABLE public.sale_items ALTER COLUMN product_id TYPE BIGINT;
ALTER TABLE public.sale_items ALTER COLUMN quantity TYPE BIGINT;
ALTER SEQUENCE IF EXISTS public.stores_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.users_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.products_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.marketing_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.suppliers_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.customers_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.purchases_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.purchase_items_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.sales_id_seq AS BIGINT;
ALTER SEQUENCE IF EXISTS public.sale_items_id_seq AS BIGINT;
NOTIFY pgrst, 'reload schema';

-- 14. ATTACH BEFORE UPDATE TRIGGERS SO updated_at UPDATES AUTOMATICALLY
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores', 'users', 'products', 'marketing', 'suppliers',
    'customers', 'purchases', 'purchase_items', 'sales', 'sale_items'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- 15. INDEXES FOR FAST INCREMENTAL SYNC & 60-DAY WINDOW QUERIES
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON public.customers (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON public.sales (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_updated_at ON public.sale_items (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_invoice_no ON public.sale_items (invoice_no);
CREATE INDEX IF NOT EXISTS idx_purchases_updated_at ON public.purchases (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_updated_at ON public.purchase_items (updated_at DESC);

-- 16. RPC FUNCTION FOR EXECUTING SYNC QUERIES (exec_sql)
CREATE OR REPLACE FUNCTION public.exec_sql(query_text TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query_text;
END;
$$;

-- 17. PERMISSIONS & RLS POLICIES FOR ANON & AUTHENTICATED ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'stores', 'settings', 'users', 'products', 'marketing', 'suppliers',
    'customers', 'purchases', 'purchase_items', 'sales', 'sale_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%I" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "allow_all_%I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END;
$$;
