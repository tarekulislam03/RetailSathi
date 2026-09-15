import { getDb } from "../../../services/database";
import { StockMovement, LedgerStatsData } from "../types";

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const db = await getDb();

  // 1. Fetch Stock OUT movements from POS Sales
  const salesOutRows = await db.select<any[]>(`
    SELECT 
      si.id AS item_id,
      si.product_id,
      si.product_name,
      si.barcode,
      si.quantity,
      COALESCE(pr.stock, 0) AS available_quantity,
      s.invoice_no AS reference_no,
      s.customer_name AS party_name,
      s.payment_mode AS category,
      s.created_at AS timestamp
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products pr ON si.product_id = pr.id
    ORDER BY s.id DESC
  `);

  // 2. Fetch Stock IN movements from Stock Purchases
  const purchasesInRows = await db.select<any[]>(`
    SELECT 
      pi.id AS item_id,
      pi.product_id,
      pi.product_name,
      pi.barcode,
      pi.batch_no,
      pi.quantity,
      COALESCE(pr.stock, 0) AS available_quantity,
      p.invoice_no AS reference_no,
      p.supplier_name AS party_name,
      pi.category,
      COALESCE(p.created_at, p.purchase_date) AS timestamp
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN products pr ON (pi.product_id = pr.id OR (pi.barcode = pr.barcode AND pr.barcode IS NOT NULL AND pr.barcode != ''))
    ORDER BY p.id DESC
  `);

  // 3. Fetch products to calculate Direct Inventory stock additions
  const products = await db.select<any[]>("SELECT * FROM products ORDER BY id DESC");

  const purchasedQtyByProductId: Record<number, number> = {};
  const purchasedQtyByBarcode: Record<string, number> = {};
  const purchasedQtyByName: Record<string, number> = {};

  for (const pi of purchasesInRows) {
    const qty = Number(pi.quantity) || 0;
    if (pi.product_id) {
      purchasedQtyByProductId[pi.product_id] = (purchasedQtyByProductId[pi.product_id] || 0) + qty;
    } else if (pi.barcode && pi.barcode.trim()) {
      purchasedQtyByBarcode[pi.barcode.trim()] = (purchasedQtyByBarcode[pi.barcode.trim()] || 0) + qty;
    } else if (pi.product_name && pi.product_name.trim()) {
      const nameKey = pi.product_name.trim().toLowerCase();
      purchasedQtyByName[nameKey] = (purchasedQtyByName[nameKey] || 0) + qty;
    }
  }

  const soldQtyByProductId: Record<number, number> = {};
  const soldQtyByBarcode: Record<string, number> = {};
  const soldQtyByName: Record<string, number> = {};

  for (const si of salesOutRows) {
    const qty = Number(si.quantity) || 0;
    if (si.product_id) {
      soldQtyByProductId[si.product_id] = (soldQtyByProductId[si.product_id] || 0) + qty;
    } else if (si.barcode && si.barcode.trim()) {
      soldQtyByBarcode[si.barcode.trim()] = (soldQtyByBarcode[si.barcode.trim()] || 0) + qty;
    } else if (si.product_name && si.product_name.trim()) {
      const nameKey = si.product_name.trim().toLowerCase();
      soldQtyByName[nameKey] = (soldQtyByName[nameKey] || 0) + qty;
    }
  }

  const movements: StockMovement[] = [];

  for (const r of purchasesInRows) {
    movements.push({
      id: `IN-${r.item_id}`,
      type: "IN",
      product_name: r.product_name || "Unknown Product",
      barcode: r.barcode || "",
      batch_no: r.batch_no || "",
      quantity: Number(r.quantity) || 0,
      available_quantity: Number(r.available_quantity) || 0,
      reference_no: r.reference_no || "",
      party_name: r.party_name || "Supplier",
      category: r.category || "Purchase",
      timestamp: r.timestamp || "",
    });
  }

  for (const r of salesOutRows) {
    movements.push({
      id: `OUT-${r.item_id}`,
      type: "OUT",
      product_name: r.product_name || "Unknown Product",
      barcode: r.barcode || "",
      batch_no: "",
      quantity: Number(r.quantity) || 0,
      available_quantity: Number(r.available_quantity) || 0,
      reference_no: r.reference_no || "",
      party_name: r.party_name || "Customer",
      category: r.category || "Sale",
      timestamp: r.timestamp || "",
    });
  }

  for (const pr of products) {
    const prId = Number(pr.id);
    const prBarcode = pr.barcode ? pr.barcode.trim() : "";
    const prNameKey = pr.name ? pr.name.trim().toLowerCase() : "";

    const purchased =
      (purchasedQtyByProductId[prId] || 0) +
      (prBarcode ? purchasedQtyByBarcode[prBarcode] || 0 : 0) +
      (prNameKey ? purchasedQtyByName[prNameKey] || 0 : 0);

    const sold =
      (soldQtyByProductId[prId] || 0) +
      (prBarcode ? soldQtyByBarcode[prBarcode] || 0 : 0) +
      (prNameKey ? soldQtyByName[prNameKey] || 0 : 0);

    const currentStock = Number(pr.stock) || 0;
    const inventoryInitialStock = currentStock + sold - purchased;

    const now = new Date();
    const formattedNow = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    if (inventoryInitialStock > 0) {
      movements.push({
        id: `INV-${prId}`,
        type: "IN",
        product_name: pr.name || "Unknown Product",
        barcode: pr.barcode || "",
        batch_no: pr.batch_no || "",
        quantity: inventoryInitialStock,
        available_quantity: currentStock,
        reference_no: `INV-${prId}`,
        party_name: "Direct Inventory",
        category: "Inventory",
        timestamp: pr.created_at || formattedNow,
      });
    } else if (inventoryInitialStock < 0) {
      movements.push({
        id: `INV-ADJ-${prId}`,
        type: "OUT",
        product_name: pr.name || "Unknown Product",
        barcode: pr.barcode || "",
        batch_no: pr.batch_no || "",
        quantity: Math.abs(inventoryInitialStock),
        available_quantity: currentStock,
        reference_no: `ADJ-${prId}`,
        party_name: "Inventory Adjustment",
        category: "Adjustment",
        timestamp: pr.created_at || formattedNow,
      });
    }
  }

  // Sort all movements by timestamp in descending order
  return movements.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || Date.parse(a.timestamp) || 0;
    const timeB = new Date(b.timestamp).getTime() || Date.parse(b.timestamp) || 0;
    return timeB - timeA;
  });
}

export async function getLedgerStats(): Promise<LedgerStatsData> {
  const movements = await fetchStockMovements();
  let totalStockInQty = 0;
  let totalStockOutQty = 0;

  for (const m of movements) {
    if (m.type === "IN") {
      totalStockInQty += m.quantity;
    } else {
      totalStockOutQty += m.quantity;
    }
  }

  return {
    totalMovements: movements.length,
    totalStockInQty,
    totalStockOutQty,
    netStockChange: totalStockInQty - totalStockOutQty,
  };
}
