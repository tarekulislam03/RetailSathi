import { getDb } from "../../../services/database";
import {
  Purchase,
  PurchaseItem,
  CreatePurchaseInput,
  PurchaseStatsData,
} from "../types";
import { Product } from "../../inventory/types";

export async function getAllPurchases(): Promise<Purchase[]> {
  const db = await getDb();
  return await db.select<Purchase[]>(
    "SELECT * FROM purchases ORDER BY id DESC"
  );
}

export async function getPurchaseWithItems(purchaseId: number): Promise<{
  purchase: Purchase | null;
  items: PurchaseItem[];
}> {
  const db = await getDb();
  const purchases = await db.select<Purchase[]>(
    "SELECT * FROM purchases WHERE id = $1",
    [purchaseId]
  );
  if (!purchases || purchases.length === 0) {
    return { purchase: null, items: [] };
  }

  const items = await db.select<PurchaseItem[]>(
    "SELECT * FROM purchase_items WHERE purchase_id = $1 ORDER BY id ASC",
    [purchaseId]
  );

  return { purchase: purchases[0], items };
}

export async function createPurchase(
  input: CreatePurchaseInput
): Promise<number> {
  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot create purchase without any items");
  }

  const db = await getDb();

  const totalAmount = input.items.reduce(
    (acc, item) => acc + (item.subtotal || item.purchase_price * item.quantity),
    0
  );

  const now = new Date();
  const formattedDate = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const insertRes = await db.execute(
    `INSERT INTO purchases (supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, item_count, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.supplier_name.trim(),
      input.invoice_no.trim(),
      input.purchase_date.trim(),
      input.gst_no.trim(),
      input.contact_no.trim(),
      totalAmount,
      input.items.length,
      formattedDate,
    ]
  );

  const purchaseId = insertRes.lastInsertId;
  if (!purchaseId) {
    throw new Error("Failed to record purchase entry in database");
  }

  for (const item of input.items) {
    const subtotal = item.subtotal || item.purchase_price * item.quantity;

    await db.execute(
      `INSERT INTO purchase_items (purchase_id, product_id, product_name, barcode, batch_no, hsn_code, category, purchase_price, mrp, selling_price, gst_rate, quantity, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        purchaseId,
        item.product_id || null,
        item.product_name.trim(),
        item.barcode.trim(),
        item.batch_no.trim(),
        item.hsn_code ? item.hsn_code.trim() : "",
        item.category.trim() || "General",
        item.purchase_price,
        item.mrp || 0,
        item.selling_price,
        item.gst_rate || 0,
        item.quantity,
        subtotal,
      ]
    );

    // Sync Inventory stock, prices, batch_no, HSN, MRP & GST rate
    const itemBarcode = item.barcode.trim();
    const itemName = item.product_name.trim();
    const itemBatch = item.batch_no.trim();

    let existingProd: Product | null = null;

    if (itemBatch) {
      // Search for an existing product entry matching THAT EXACT batch_no!
      if (itemBarcode) {
        const prods = await db.select<Product[]>(
          "SELECT * FROM products WHERE barcode = $1 AND batch_no = $2 LIMIT 1",
          [itemBarcode, itemBatch]
        );
        if (prods && prods.length > 0) existingProd = prods[0];
      }
      if (!existingProd && itemName) {
        const prods = await db.select<Product[]>(
          "SELECT * FROM products WHERE LOWER(name) = LOWER($1) AND batch_no = $2 LIMIT 1",
          [itemName, itemBatch]
        );
        if (prods && prods.length > 0) existingProd = prods[0];
      }
    } else {
      // Search for existing product without batch_no
      if (itemBarcode) {
        const prods = await db.select<Product[]>(
          "SELECT * FROM products WHERE barcode = $1 AND (batch_no IS NULL OR batch_no = '') LIMIT 1",
          [itemBarcode]
        );
        if (prods && prods.length > 0) existingProd = prods[0];
      }
      if (!existingProd && itemName) {
        const prods = await db.select<Product[]>(
          "SELECT * FROM products WHERE LOWER(name) = LOWER($1) AND (batch_no IS NULL OR batch_no = '') LIMIT 1",
          [itemName]
        );
        if (prods && prods.length > 0) existingProd = prods[0];
      }
    }

    if (existingProd) {
      // Update existing batch stock, prices, HSN, mrp & gst_rate
      await db.execute(
        `UPDATE products 
         SET stock = stock + $1, 
             price = $2, 
             cost_price = $3,
             mrp = $4,
             batch_no = COALESCE(NULLIF($5, ''), batch_no),
             hsn_code = COALESCE(NULLIF($6, ''), hsn_code),
             gst_rate = $7,
             category = COALESCE(NULLIF($8, ''), category)
         WHERE id = $9`,
        [
          item.quantity,
          item.selling_price,
          item.purchase_price,
          item.mrp || 0,
          itemBatch,
          item.hsn_code ? item.hsn_code.trim() : "",
          item.gst_rate || 0,
          item.category.trim(),
          existingProd.id,
        ]
      );
    } else {
      // Create new product in inventory automatically
      await db.execute(
        `INSERT INTO products (barcode, name, batch_no, hsn_code, mrp, price, cost_price, stock, gst_rate, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          item.barcode.trim(),
          item.product_name.trim(),
          item.batch_no.trim(),
          item.hsn_code ? item.hsn_code.trim() : "",
          item.mrp || 0,
          item.selling_price,
          item.purchase_price,
          item.quantity,
          item.gst_rate || 0,
          item.category.trim() || "General",
          formattedDate,
        ]
      );
    }
  }

  return purchaseId;
}

export async function getPurchaseStats(): Promise<PurchaseStatsData> {
  const db = await getDb();
  const purchases = await db.select<Purchase[]>("SELECT * FROM purchases");

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentMonthStr = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  let totalSpend = 0;
  let todaySpend = 0;
  let monthlySpend = 0;

  for (const p of purchases) {
    totalSpend += p.total_amount || 0;
    if (p.purchase_date && p.purchase_date.startsWith(todayStr)) {
      todaySpend += p.total_amount || 0;
    }
    if (p.purchase_date && p.purchase_date.startsWith(currentMonthStr)) {
      monthlySpend += p.total_amount || 0;
    }
  }

  return {
    totalPurchasesCount: purchases.length,
    totalSpend,
    todaySpend,
    monthlySpend,
  };
}
