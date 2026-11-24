import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { createProduct, fetchProducts } from "../features/inventory/services/inventoryService";
import { createPurchase } from "../features/purchases/services/purchaseService";
import { createSale } from "../features/billing/services/billingService";
import {
  fetchGstReportData,
  exportGstReportToExcel,
  exportGstReportToPdf,
  computeGstRateBreakdown,
} from "../features/reports/services/gstReportService";

describe("GST Compliance & Stock Register Report Tests", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  it("should fetch empty GST report data when no transactions exist", async () => {
    const report = await fetchGstReportData();

    expect(report.inwardItems).toEqual([]);
    expect(report.outwardItems).toEqual([]);
    expect(report.summary.totalInwardQty).toBe(0);
    expect(report.summary.totalOutwardQty).toBe(0);
    expect(report.summary.netGstPayable).toBe(0);
  });

  it("should calculate inward stock (purchases) and Input Tax Credit (ITC) correctly", async () => {
    // 1. Create a purchase with GST items
    await createPurchase({
      supplier_name: "Apex Wholesalers Ltd",
      invoice_no: "APEX-2026-001",
      purchase_date: "2026-10-01",
      gst_no: "27AABCA1234F1Z5",
      contact_no: "9876543210",
      items: [
        {
          product_name: "Fortune Sunflower Oil 1L",
          barcode: "8901234001",
          batch_no: "B-OIL-01",
          hsn_code: "1512",
          category: "Grocery",
          purchase_price: 105.0, // inclusive
          mrp: 140.0,
          selling_price: 130.0,
          gst_rate: 5,
          quantity: 20,
          subtotal: 2100.0,
        },
      ],
    });

    const report = await fetchGstReportData();

    expect(report.inwardItems.length).toBe(1);
    const item = report.inwardItems[0];
    expect(item.supplier_name).toBe("Apex Wholesalers Ltd");
    expect(item.supplier_gstin).toBe("27AABCA1234F1Z5");
    expect(item.quantity).toBe(20);
    expect(item.total_amount).toBe(2100.0);
    expect(item.gst_rate).toBe(5);

    // 2100 / 1.05 = 2000 taxable value
    expect(item.taxable_value).toBeCloseTo(2000.0, 1);
    // GST = 100 => CGST = 50, SGST = 50
    expect(item.cgst).toBeCloseTo(50.0, 1);
    expect(item.sgst).toBeCloseTo(50.0, 1);

    expect(report.summary.totalInwardQty).toBe(20);
    expect(report.summary.totalInwardTaxable).toBeCloseTo(2000.0, 1);
    expect(report.summary.totalInwardGst).toBeCloseTo(100.0, 1);
  });

  it("should calculate outward stock (sales) and Output GST liability correctly", async () => {
    // 1. Create product with GST rate
    await createProduct({
      name: "Tata Tea Gold 500g",
      barcode: "8901234002",
      batch_no: "B-TEA-01",
      mrp: 350.0,
      price: 336.0, // Selling price
      cost_price: 250.0,
      stock: 50,
      hsn_code: "0902",
      gst_rate: 12, // 12% GST
      category: "Beverages",
    });

    const prods = await fetchProducts();
    const prod = prods[0];

    // 2. Complete a sale
    await createSale({
      customer_name: "Rahul Sharma",
      customer_phone: "9123456789",
      total_mrp: 700.0,
      discount: 28.0,
      tax_amount: 72.0,
      payment_mode: "UPI",
      items: [
        {
          product_id: prod.id,
          product_name: prod.name,
          barcode: prod.barcode,
          price: prod.price,
          quantity: 2,
          mrp: prod.mrp,
          gst_rate: prod.gst_rate,
        },
      ],
    });

    const report = await fetchGstReportData();

    expect(report.outwardItems.length).toBe(1);
    const item = report.outwardItems[0];
    expect(item.customer_name).toBe("Rahul Sharma");
    expect(item.quantity).toBe(2);
    expect(item.total_amount).toBe(672.0); // 336 * 2
    expect(item.gst_rate).toBe(12);

    // 672 / 1.12 = 600 taxable value
    expect(item.taxable_value).toBeCloseTo(600.0, 1);
    // GST = 72 => CGST = 36, SGST = 36
    expect(item.cgst).toBeCloseTo(36.0, 1);
    expect(item.sgst).toBeCloseTo(36.0, 1);

    expect(report.summary.totalOutwardQty).toBe(2);
    expect(report.summary.totalOutwardTaxable).toBeCloseTo(600.0, 1);
    expect(report.summary.totalOutwardGst).toBeCloseTo(72.0, 1);
  });

  it("should calculate Net GST Payable / ITC Reconciliation between Inward and Outward", async () => {
    // Inward: Buy items with 50 GST
    await createPurchase({
      supplier_name: "Metro Cash & Carry",
      invoice_no: "METRO-101",
      purchase_date: "2026-10-02",
      gst_no: "27AABC1234F1Z1",
      contact_no: "9876543210",
      items: [
        {
          product_name: "Product A",
          barcode: "8901001",
          batch_no: "B1",
          category: "General",
          purchase_price: 105.0,
          selling_price: 150.0,
          gst_rate: 5,
          quantity: 10,
          subtotal: 1050.0, // Taxable 1000, GST 50
        },
      ],
    });

    // Outward: Sell items with 180 GST
    await createProduct({
      name: "Product B",
      barcode: "8901002",
      price: 1180.0, // 1000 taxable + 180 GST (18%)
      cost_price: 900.0,
      stock: 10,
      gst_rate: 18,
    });

    const prods = await fetchProducts();
    const prodB = prods.find((p) => p.barcode === "8901002")!;

    await createSale({
      customer_name: "Customer B",
      total_mrp: 1180.0,
      payment_mode: "Cash",
      items: [
        {
          product_id: prodB.id,
          product_name: prodB.name,
          barcode: prodB.barcode,
          price: prodB.price,
          quantity: 1,
          gst_rate: prodB.gst_rate,
        },
      ],
    });

    const report = await fetchGstReportData();

    // Input GST = 50 (from Purchase)
    // Output GST = 180 (from Sale)
    // Net GST Payable = 180 - 50 = 130
    expect(report.summary.totalInwardGst).toBeCloseTo(50.0, 1);
    expect(report.summary.totalOutwardGst).toBeCloseTo(180.0, 1);
    expect(report.summary.netGstPayable).toBeCloseTo(130.0, 1);
  });

  it("should filter report transactions by date range", async () => {
    // Purchase in September
    await createPurchase({
      supplier_name: "Sep Supplier",
      invoice_no: "SEP-01",
      purchase_date: "2026-09-15",
      gst_no: "",
      contact_no: "",
      items: [
        {
          product_name: "Sep Item",
          barcode: "8900001",
          batch_no: "B-SEP",
          category: "General",
          purchase_price: 100.0,
          selling_price: 120.0,
          quantity: 5,
          subtotal: 500.0,
        },
      ],
    });

    // Purchase in October
    await createPurchase({
      supplier_name: "Oct Supplier",
      invoice_no: "OCT-01",
      purchase_date: "2026-10-05",
      gst_no: "",
      contact_no: "",
      items: [
        {
          product_name: "Oct Item",
          barcode: "8900002",
          batch_no: "B-OCT",
          category: "General",
          purchase_price: 200.0,
          selling_price: 250.0,
          quantity: 10,
          subtotal: 2000.0,
        },
      ],
    });

    // Filter only October
    const octReport = await fetchGstReportData({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });

    expect(octReport.inwardItems.length).toBe(1);
    expect(octReport.inwardItems[0].invoice_no).toBe("OCT-01");
  });

  it("should export GST report to Excel and PDF without errors", async () => {
    const report = await fetchGstReportData();

    // Verify calling exports does not throw
    expect(() => {
      exportGstReportToExcel(report, "test_report.xlsx");
    }).not.toThrow();

    expect(() => {
      exportGstReportToPdf(report, "test_report.pdf");
    }).not.toThrow();
  });

  it("should compute GST rate-wise breakdown sorted ascending by rate", () => {
    const empty = computeGstRateBreakdown([], []);
    expect(empty).toEqual([]);

    const breakdown = computeGstRateBreakdown(
      [
        {
          id: 1,
          date: "2026-10-01",
          invoice_no: "P1",
          supplier_name: "Sup",
          supplier_gstin: "",
          product_name: "Zero Rated",
          barcode: "1",
          batch_no: "B1",
          hsn_code: "",
          category: "Cat",
          quantity: 1,
          rate: 100,
          taxable_value: 100,
          gst_rate: 0,
          cgst: 0,
          sgst: 0,
          total_amount: 100,
        },
        {
          id: 2,
          date: "2026-10-01",
          invoice_no: "P2",
          supplier_name: "Sup",
          supplier_gstin: "",
          product_name: "Five Pct",
          barcode: "2",
          batch_no: "B2",
          hsn_code: "",
          category: "Cat",
          quantity: 1,
          rate: 105,
          taxable_value: 100,
          gst_rate: 5,
          cgst: 2.5,
          sgst: 2.5,
          total_amount: 105,
        },
      ],
      [
        {
          id: 10,
          date: "2026-10-02",
          invoice_no: "S1",
          customer_name: "Cust",
          customer_phone: "",
          product_name: "Five Pct Sale",
          barcode: "2",
          hsn_code: "",
          category: "Cat",
          quantity: 2,
          rate: 105,
          taxable_value: 200,
          gst_rate: 5,
          cgst: 5,
          sgst: 5,
          total_amount: 210,
        },
        {
          id: 11,
          date: "2026-10-02",
          invoice_no: "S2",
          customer_name: "Cust",
          customer_phone: "",
          product_name: "Eighteen Pct Sale",
          barcode: "3",
          hsn_code: "",
          category: "Cat",
          quantity: 1,
          rate: 118,
          taxable_value: 100,
          gst_rate: 18,
          cgst: 9,
          sgst: 9,
          total_amount: 118,
        },
      ]
    );

    expect(breakdown.map((r) => r.gstRate)).toEqual([0, 5, 18]);

    expect(breakdown[0].inwardTaxable).toBe(100);
    expect(breakdown[0].inwardGst).toBe(0);
    expect(breakdown[0].outwardGst).toBe(0);
    expect(breakdown[0].netGst).toBe(0);

    expect(breakdown[1].inwardGst).toBe(5);
    expect(breakdown[1].outwardCgst).toBe(5);
    expect(breakdown[1].outwardSgst).toBe(5);
    expect(breakdown[1].outwardGst).toBe(10);
    expect(breakdown[1].netGst).toBe(5);

    expect(breakdown[2].inwardGst).toBe(0);
    expect(breakdown[2].outwardCgst).toBe(9);
    expect(breakdown[2].outwardSgst).toBe(9);
    expect(breakdown[2].outwardGst).toBe(18);
    expect(breakdown[2].netGst).toBe(18);
  });

  it("should not duplicate inward or outward items when multiple product batches share a barcode", async () => {
    // Create 3 batches of the same barcode
    for (const batch of ["B1", "B2", "B3"]) {
      await createPurchase({
        supplier_name: "Batch Supplier",
        invoice_no: `INV-${batch}`,
        purchase_date: "2026-10-10",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Multi-Batch Item",
            barcode: "8909999999",
            batch_no: batch,
            category: "General",
            purchase_price: 105.0,
            selling_price: 120.0,
            gst_rate: 5,
            quantity: 1,
            subtotal: 105.0,
          },
        ],
      });
    }

    const report = await fetchGstReportData();
    // Should be 3 purchase items total, NOT 3 * 3 = 9
    expect(report.inwardItems.length).toBe(3);
    expect(report.summary.totalInwardQty).toBe(3);
    expect(report.summary.totalInwardAmount).toBeCloseTo(315.0, 2);
  });
});
