import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { createProduct, fetchProducts } from "../features/inventory/services/inventoryService";
import { createPurchase } from "../features/purchases/services/purchaseService";
import { createSale } from "../features/billing/services/billingService";
import {
  fetchGstTallyReportBundle,
  getStateFromGstin,
  isValidGstin,
} from "../features/reports/services/gstTallyService";
import { exportGstTallyPdf } from "../features/reports/services/gstTallyPdfService";
import { GstPageId } from "../features/reports/types/gstTallyTypes";

describe("GST Reports & PDF Suite", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  it("validates Indian GSTIN and extracts state codes", () => {
    expect(isValidGstin("19AABCU9603R1ZM")).toBe(true);
    expect(isValidGstin("INVALID123")).toBe(false);
    expect(getStateFromGstin("19AABCU9603R1ZM")).toEqual({ code: "19", name: "West Bengal" });
    expect(getStateFromGstin("27AABCA1234F1Z5")).toEqual({ code: "27", name: "Maharashtra" });
  });

  it("computes GSTR-1, GSTR-3B, HSN, Rate-wise, Input vs Output, and Reconciliation", async () => {
    // Purchase with 5% GST
    await createPurchase({
      supplier_name: "Metro Traders",
      invoice_no: "PUR-001",
      purchase_date: "2026-10-05",
      gst_no: "19AABCA1234F1Z5",
      contact_no: "9876543210",
      items: [
        {
          product_name: "Sunflower Oil 1L",
          barcode: "8901001",
          batch_no: "B1",
          hsn_code: "1512",
          category: "Grocery",
          purchase_price: 105,
          selling_price: 120,
          gst_rate: 5,
          quantity: 10,
          subtotal: 1050, // taxable 1000, GST 50
        },
      ],
    });

    // Product with HSN (included in GSTR-1) and product without HSN (incomplete)
    await createProduct({
      name: "Tea Gold 500g",
      barcode: "8901002",
      price: 224,
      cost_price: 180,
      stock: 20,
      hsn_code: "0902",
      gst_rate: 12,
    });
    await createProduct({
      name: "No HSN Snack",
      barcode: "8901003",
      price: 105,
      cost_price: 80,
      stock: 20,
      hsn_code: "",
      gst_rate: 5,
    });

    const prods = await fetchProducts();
    const tea = prods.find((p) => p.barcode === "8901002")!;
    const snack = prods.find((p) => p.barcode === "8901003")!;

    await createSale({
      customer_name: "Customer One",
      total_mrp: 224,
      payment_mode: "Cash",
      items: [
        {
          product_id: tea.id,
          product_name: tea.name,
          barcode: tea.barcode,
          price: tea.price,
          quantity: 1,
          gst_rate: tea.gst_rate,
        },
      ],
    });

    await createSale({
      customer_name: "Customer Two",
      total_mrp: 105,
      payment_mode: "UPI",
      items: [
        {
          product_id: snack.id,
          product_name: snack.name,
          barcode: snack.barcode,
          price: snack.price,
          quantity: 1,
          gst_rate: snack.gst_rate,
        },
      ],
    });

    const bundle = await fetchGstTallyReportBundle();

    // Outward vouchers: 2 total
    expect(bundle.gstr1.totalVouchers).toBe(2);
    // Notice: if store has no GSTIN/state, both might be incomplete ("Missing Place of Supply") or snack has "Missing HSN"
    expect(bundle.gstr1.incompleteCount).toBeGreaterThanOrEqual(1);
    expect(bundle.gstr1.incompleteVouchers.some((v) => v.mismatchReasons.includes("Missing HSN"))).toBe(true);

    // Rate-wise summary must contain all 7 standard slabs
    expect(bundle.rateSummary.map((r) => r.gstRate)).toEqual([0, 0.25, 3, 5, 12, 18, 28]);
    const slab12 = bundle.rateSummary.find((r) => r.gstRate === 12)!;
    expect(slab12.taxableValue).toBeCloseTo(200, 1);
    expect(slab12.totalAmount).toBeCloseTo(224, 1);

    // HSN Summary (Sales & Purchases)
    expect(bundle.hsnSummary.some((h) => h.hsnCode === "0902")).toBe(true);
    expect(bundle.purchaseHsnSummary.some((h) => h.hsnCode === "1512")).toBe(true);

    // Input vs Output
    const totalIo = bundle.inputVsOutput.find((r) => r.taxHead === "Total")!;
    expect(totalIo.inputTax).toBeCloseTo(50, 1);
    expect(totalIo.outputTax).toBeCloseTo(29, 1); // 24 (12% on 200) + 5 (5% on 100)

    // GSTR-3B Tables
    expect(bundle.gstr3b.table31.length).toBe(5);
    expect(bundle.gstr3b.table4.length).toBe(4);
    expect(bundle.gstr3b.table5.length).toBe(2);
    expect(bundle.gstr3b.table61.length).toBe(4);

    // Reconciliation: booksTotal > returnTotal when incomplete vouchers exist
    expect(bundle.reconciliation.outward.booksTotal).toBeCloseTo(329, 1);
    expect(bundle.reconciliation.outward.diffTotal).toBeGreaterThan(0);
  });

  it("exports PDFs for all 9 GST report pages without errors", async () => {
    const bundle = await fetchGstTallyReportBundle();
    const pages: GstPageId[] = [
      "home",
      "gstr1_summary",
      "gstr1_section",
      "voucher_register",
      "invoice_view",
      "gstr3b",
      "hsn_summary",
      "rate_summary",
      "input_output",
    ];

    for (const page of pages) {
      await expect(
        exportGstTallyPdf(bundle, {
          page,
          counter: "ALL",
          sectionId: page === "gstr1_section" ? "b2cs" : undefined,
        })
      ).resolves.toEqual({ success: true });
    }
  });
});
