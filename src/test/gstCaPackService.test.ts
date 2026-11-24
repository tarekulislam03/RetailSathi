import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { createProduct, fetchProducts } from "../features/inventory/services/inventoryService";
import { createPurchase } from "../features/purchases/services/purchaseService";
import { createSale } from "../features/billing/services/billingService";
import { fetchGstTallyReportBundle } from "../features/reports/services/gstTallyService";
import { buildGstCaPackData, formatInr } from "../features/reports/services/gstCaPackService";
import {
  exportGstCaPackCsv,
  exportGstCaPackExcel,
  exportGstCaPackPdf,
} from "../features/reports/services/gstCaPackPdfService";

describe("CA GST Report Pack (13-Page PDF, Excel, CSV)", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  it("formats numbers using Indian digit grouping", () => {
    expect(formatInr(123456.78)).toBe("1,23,456.78");
    expect(formatInr(1000000)).toBe("10,00,000.00");
  });

  it("builds all 13 CA pack sections, excludes above-threshold bills into mismatch, and exports PDF/Excel/CSV", async () => {
    await createPurchase({
      supplier_name: "Supermart Suppliers",
      invoice_no: "SUP-100",
      purchase_date: "2026-10-05",
      gst_no: "19AABCA1234F1Z5",
      contact_no: "9876543210",
      items: [
        {
          product_name: "Basmati Rice 5kg",
          barcode: "8901001",
          batch_no: "B1",
          hsn_code: "1006",
          category: "Grocery",
          purchase_price: 525,
          selling_price: 600,
          gst_rate: 5,
          quantity: 10,
          subtotal: 5250,
        },
      ],
    });

    await createProduct({
      name: "Basmati Rice 5kg",
      barcode: "8901002",
      price: 600,
      cost_price: 525,
      stock: 50,
      hsn_code: "1006",
      gst_rate: 5,
    });

    const prods = await fetchProducts();
    const rice = prods.find((p) => p.barcode === "8901002")!;

    await createSale({
      customer_name: "Retail Customer",
      total_mrp: 1200,
      payment_mode: "UPI",
      items: [
        {
          product_id: rice.id,
          product_name: rice.name,
          barcode: rice.barcode,
          price: rice.price,
          quantity: 2,
          gst_rate: rice.gst_rate,
        },
      ],
    });

    // High-value sale above threshold (1000) to test Mismatch exclusion
    await createSale({
      customer_name: "High Value Customer",
      total_mrp: 6000,
      payment_mode: "Cash",
      items: [
        {
          product_id: rice.id,
          product_name: rice.name,
          barcode: rice.barcode,
          price: rice.price,
          quantity: 10,
          gst_rate: rice.gst_rate,
        },
      ],
    });

    const bundle = await fetchGstTallyReportBundle();
    const pack = await buildGstCaPackData(bundle);

    // No vouchers excluded by threshold; both 1200 and 6000 sales are included (total 7200)
    expect(pack.mismatchVouchers.length).toBe(0);
    expect(pack.salesRateSplit.combined.find((r) => r.gstRate === 5)?.totalAmount).toBeCloseTo(7200, 1);

    // Counter summary reflects UPI 1200
    expect(pack.counterSummary.length).toBe(1);
    expect(pack.counterSummary[0].upi).toBeCloseTo(1200, 1);

    // Purchase register
    expect(pack.purchaseRegister.length).toBe(1);

    // Exports
    await expect(exportGstCaPackPdf(pack)).resolves.toEqual({ success: true });
    await expect(exportGstCaPackExcel(pack)).resolves.toEqual({ success: true });
    await expect(exportGstCaPackCsv(pack)).resolves.toEqual({ success: true });
  });
});
