import { getDb } from "../../../services/database";
import { Product, ProductInput } from "../types";

export async function fetchProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM products ORDER BY id DESC");
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid || "",
    barcode: r.barcode || "",
    name: r.name || "",
    batch_no: r.batch_no || "",
    mrp: r.mrp ?? 0,
    price: r.price ?? 0,
    stock: r.stock ?? 0,
    hsn_code: r.hsn_code || "",
    reorder_threshold: r.reorder_threshold ?? 0,
    gst_rate: r.gst_rate ?? 0,
    category: r.category || "General",
    created_at: r.created_at,
  }));
}

export async function createProduct(product: ProductInput): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  await db.execute(
    `INSERT INTO products (barcode, name, batch_no, mrp, price, cost_price, stock, hsn_code, reorder_threshold, gst_rate, category, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      product.barcode,
      product.name,
      product.batch_no,
      product.mrp,
      product.price,
      product.cost_price ?? 0,
      product.stock,
      product.hsn_code,
      product.reorder_threshold,
      product.gst_rate,
      product.category,
      formattedDate,
    ]
  );
}

export async function updateProduct(
  id: number,
  product: ProductInput
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE products 
     SET barcode = $1, name = $2, batch_no = $3, mrp = $4, price = $5, cost_price = $6, stock = $7, hsn_code = $8, reorder_threshold = $9, gst_rate = $10, category = $11 
     WHERE id = $12`,
    [
      product.barcode,
      product.name,
      product.batch_no,
      product.mrp,
      product.price,
      product.cost_price ?? 0,
      product.stock,
      product.hsn_code,
      product.reorder_threshold,
      product.gst_rate,
      product.category,
      id,
    ]
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM products WHERE id = $1", [id]);
}
