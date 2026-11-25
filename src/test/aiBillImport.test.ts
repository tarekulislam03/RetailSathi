import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { createProduct, fetchProducts } from "../features/inventory/services/inventoryService";
import {
  createAiBillImport,
  getPendingAiBillImports,
  verifyAndImportAiBill,
  dismissAiBillImport,
} from "../features/purchases/services/aiBillImportService";
import { getPurchaseWithItems } from "../features/purchases/services/purchaseService";

describe("AI Bill Import Verification & Batch/Barcode Sync", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  it("should queue pending AI bill imports, import matched barcodes as new batches, and save changed barcodes as new batches", async () => {
    // Seed existing inventory products
    const existingUnchanged = await createProduct({
      name: "Parle-G Gold 100g",
      category: "Biscuits",
      price: 10,
      mrp: 10,
      cost_price: 8,
      stock: 20,
      unit: "pcs",
      barcode: "8901719101010",
      batch_no: "OLD-B1",
    });

    const existingChangedBarcode = await createProduct({
      name: "Amul Butter 100g",
      category: "Dairy",
      price: 56,
      mrp: 58,
      cost_price: 50,
      stock: 10,
      unit: "pcs",
      barcode: "8901262010016",
      batch_no: "OLD-B2",
    });

    // 1. Queue an AI-scanned bill import
    const importId = await createAiBillImport({
      supplier_name: "Metro Cash & Carry",
      invoice_no: "AI-INV-501",
      purchase_date: "2026-11-25",
      gst_no: "29ABCDE1234F1Z5",
      source_note: "AI Bill Scan",
      items: [
        {
          product_name: "PARLE G GOLD 100G",
          barcode: "",
          batch_no: "",
          hsn_code: "1905",
          category: "Biscuits",
          purchase_price: 8,
          mrp: 10,
          selling_price: 10,
          gst_rate: 18,
          quantity: 30,
          subtotal: 240,
        },
        {
          product_name: "AMUL BUTTER 100G",
          barcode: "",
          batch_no: "",
          hsn_code: "0405",
          category: "Dairy",
          purchase_price: 51,
          mrp: 60,
          selling_price: 58,
          gst_rate: 12,
          quantity: 15,
          subtotal: 765,
        },
      ],
    });

    let pending = await getPendingAiBillImports();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(importId);
    expect(pending[0].items.length).toBe(2);

    // 2. Simulate user review:
    // - Item 1: scanned barcode matched existingUnchanged -> unchanged barcode, import as new batch
    // - Item 2: scanned new barcode 8901262999999 not found -> searched by name -> matched existingChangedBarcode -> save new barcode + new batch
    const purchaseId = await verifyAndImportAiBill(importId, {
      supplier_name: "Metro Cash & Carry",
      invoice_no: "AI-INV-501",
      purchase_date: "2026-11-25",
      gst_no: "29ABCDE1234F1Z5",
      contact_no: "",
      items: [
        {
          ...pending[0].items[0],
          product_id: existingUnchanged.id,
          product_name: existingUnchanged.name,
          barcode: existingUnchanged.barcode,
          batch_no: "NEW-B1",
          verification_status: "matched_existing",
        },
        {
          ...pending[0].items[1],
          product_id: existingChangedBarcode.id,
          product_name: existingChangedBarcode.name,
          barcode: "8901262999999",
          old_barcode: existingChangedBarcode.barcode,
          batch_no: "NEW-B2",
          verification_status: "new_barcode_batch",
        },
      ],
    });

    expect(purchaseId).toBeGreaterThan(0);

    // Pending imports should now be empty
    pending = await getPendingAiBillImports();
    expect(pending.length).toBe(0);

    // Purchase & purchase_items should be recorded
    const { purchase, items } = await getPurchaseWithItems(purchaseId);
    expect(purchase?.invoice_no).toBe("AI-INV-501");
    expect(items.length).toBe(2);

    // Inventory should have both old batches intact AND both new batches created (with new barcode for Amul Butter)
    const allProducts = await fetchProducts();
    const parleBatches = allProducts.filter((p) => p.barcode === "8901719101010");
    expect(parleBatches.length).toBe(2);
    expect(parleBatches.find((b) => b.batch_no === "OLD-B1")?.stock).toBe(20);
    expect(parleBatches.find((b) => b.batch_no === "NEW-B1")?.stock).toBe(30);

    const amulOldBatch = allProducts.find((p) => p.barcode === "8901262010016");
    const amulNewBatch = allProducts.find((p) => p.barcode === "8901262999999");
    expect(amulOldBatch?.stock).toBe(10);
    expect(amulNewBatch).toBeDefined();
    expect(amulNewBatch?.name).toBe("Amul Butter 100g");
    expect(amulNewBatch?.batch_no).toBe("NEW-B2");
    expect(amulNewBatch?.stock).toBe(15);
  });

  it("should allow dismissing a pending AI bill import", async () => {
    const id = await createAiBillImport({
      supplier_name: "Test Supplier",
      invoice_no: "AI-DISMISS-1",
      purchase_date: "2026-11-25",
      items: [
        {
          product_name: "Sample Item",
          barcode: "",
          batch_no: "",
          hsn_code: "",
          category: "General",
          purchase_price: 10,
          mrp: 12,
          selling_price: 11,
          gst_rate: 0,
          quantity: 5,
          subtotal: 50,
        },
      ],
    });

    expect((await getPendingAiBillImports()).length).toBe(1);
    await dismissAiBillImport(id);
    expect((await getPendingAiBillImports()).length).toBe(0);
  });
});
