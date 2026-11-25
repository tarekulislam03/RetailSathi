import { getDb } from "../../../services/database";
import { getRealTime } from "../../../services/realTimeService";
import {
  AiBillImport,
  AiBillImportItem,
  CreateAiBillImportInput,
} from "../types";
import { createPurchase } from "./purchaseService";

interface AiBillImportRow {
  id: number;
  supplier_name: string;
  invoice_no: string;
  purchase_date: string;
  gst_no: string | null;
  contact_no: string | null;
  total_amount: number;
  items_json: string;
  status: string;
  source_note: string | null;
  purchase_id: number | null;
  created_at: string;
  verified_at: string | null;
}

function parseItemsJson(raw: string): AiBillImportItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRowToImport(row: AiBillImportRow): AiBillImport {
  return {
    id: row.id,
    supplier_name: row.supplier_name,
    invoice_no: row.invoice_no,
    purchase_date: row.purchase_date,
    gst_no: row.gst_no || "",
    contact_no: row.contact_no || "",
    total_amount: Number(row.total_amount) || 0,
    items: parseItemsJson(row.items_json),
    status: (row.status as AiBillImport["status"]) || "pending",
    source_note: row.source_note || undefined,
    purchase_id: row.purchase_id ?? null,
    created_at: row.created_at,
    verified_at: row.verified_at ?? null,
  };
}

/**
 * Fetches all pending AI bill imports awaiting barcode/batch review.
 */
export async function getPendingAiBillImports(): Promise<AiBillImport[]> {
  const db = await getDb();
  const rows = await db.select<AiBillImportRow[]>(
    "SELECT * FROM ai_bill_imports WHERE status = 'pending' ORDER BY id DESC"
  );
  return rows.map(mapRowToImport);
}

/**
 * Queues a new AI-scanned purchase bill for user verification before importing to inventory.
 */
export async function createAiBillImport(
  input: CreateAiBillImportInput
): Promise<number> {
  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot create AI bill import without any items.");
  }

  const db = await getDb();
  const normalizedItems: AiBillImportItem[] = input.items.map((item) => ({
    ...item,
    barcode: (item.barcode || "").trim(),
    batch_no: (item.batch_no || "").trim(),
    hsn_code: (item.hsn_code || "").trim(),
    category: (item.category || "General").trim() || "General",
    subtotal:
      item.subtotal ||
      (Number(item.purchase_price) || 0) * (Number(item.quantity) || 0),
    verification_status: item.verification_status || "pending",
  }));

  const totalAmount = normalizedItems.reduce(
    (sum, it) => sum + (Number(it.subtotal) || 0),
    0
  );
  const nowIso = getRealTime().toISOString();

  const res = await db.execute(
    `INSERT INTO ai_bill_imports (
      supplier_name, invoice_no, purchase_date, gst_no, contact_no,
      total_amount, items_json, status, source_note, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)`,
    [
      input.supplier_name.trim(),
      input.invoice_no.trim(),
      input.purchase_date.trim(),
      (input.gst_no || "").trim(),
      (input.contact_no || "").trim(),
      totalAmount,
      JSON.stringify(normalizedItems),
      (input.source_note || "AI Bill Scan").trim(),
      nowIso,
    ]
  );

  if (!res.lastInsertId) {
    throw new Error("Failed to save AI bill import.");
  }
  return res.lastInsertId;
}

/**
 * Persists intermediate verification progress for a pending AI bill import.
 */
export async function updateAiBillImportItems(
  importId: number,
  items: AiBillImportItem[]
): Promise<void> {
  const db = await getDb();
  const totalAmount = items.reduce(
    (sum, it) =>
      sum +
      (Number(it.subtotal) ||
        (Number(it.purchase_price) || 0) * (Number(it.quantity) || 0)),
    0
  );
  await db.execute(
    "UPDATE ai_bill_imports SET items_json = $1, total_amount = $2 WHERE id = $3",
    [JSON.stringify(items), totalAmount, importId]
  );
}

/**
 * Dismisses a pending AI bill import without importing it into purchases.
 */
export async function dismissAiBillImport(importId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE ai_bill_imports SET status = 'dismissed' WHERE id = $1",
    [importId]
  );
}

/**
 * Imports a reviewed AI bill into purchases & inventory (creating new batches / saving new barcodes)
 * and marks the AI bill import as verified.
 */
export async function verifyAndImportAiBill(
  importId: number,
  payload: {
    supplier_name: string;
    invoice_no: string;
    purchase_date: string;
    gst_no: string;
    contact_no: string;
    items: AiBillImportItem[];
  }
): Promise<number> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Cannot import an AI bill without items.");
  }

  const fallbackBatchSuffix =
    payload.invoice_no.trim().replace(/[^a-zA-Z0-9_-]/g, "") ||
    payload.purchase_date.trim().replace(/[^0-9]/g, "") ||
    String(importId);

  const finalizedItems: AiBillImportItem[] = payload.items.map((item, idx) => {
    const cleanBatch = (item.batch_no || "").trim();
    const needsNewBatch =
      item.verification_status === "matched_existing" ||
      item.verification_status === "new_barcode_batch";
    const resolvedBatch =
      cleanBatch || (needsNewBatch ? `B-${fallbackBatchSuffix}-${idx + 1}` : "");

    const qty = Number(item.quantity) || 0;
    const rate = Number(item.purchase_price) || 0;
    return {
      ...item,
      batch_no: resolvedBatch,
      subtotal: item.subtotal || rate * qty,
    };
  });

  const purchaseId = await createPurchase({
    supplier_name: payload.supplier_name,
    invoice_no: payload.invoice_no,
    purchase_date: payload.purchase_date,
    gst_no: payload.gst_no,
    contact_no: payload.contact_no,
    items: finalizedItems,
  });

  const db = await getDb();
  const totalAmount = finalizedItems.reduce(
    (sum, it) => sum + (Number(it.subtotal) || 0),
    0
  );
  const verifiedAt = getRealTime().toISOString();

  await db.execute(
    `UPDATE ai_bill_imports
     SET status = 'verified',
         purchase_id = $1,
         verified_at = $2,
         items_json = $3,
         total_amount = $4
     WHERE id = $5`,
    [
      purchaseId,
      verifiedAt,
      JSON.stringify(finalizedItems),
      totalAmount,
      importId,
    ]
  );

  return purchaseId;
}
