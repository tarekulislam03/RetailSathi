import { describe, it, expect } from "vitest";
import { buildReceiptEscPos, createReceiptCanvas } from "../services/escposService";
import { Sale } from "../features/billing/types";
import { generateCode128Svg, encodeCode128 } from "../utils/code128";
import {
  generateUpiUri,
  generateQrSvg,
  generateQrMatrix,
} from "../utils/qrCodeGenerator";

describe("Image-Based Receipt Generator Tests", () => {
  const mockSale: Sale = {
    id: 1,
    invoice_no: "INV-2026-001",
    customer_name: "John Doe",
    customer_phone: "9876543210",
    total_amount: 550,
    discount: 50,
    tax_amount: 25,
    grand_total: 500,
    payment_mode: "Cash",
    paid_amount: 500,
    cash_paid: 500,
    due_amount: 0,
    created_at: "2026-09-24 10:30:00",
    items: [
      {
        product_id: 10,
        product_name: "Organic Milk 1L",
        barcode: "8901234567890",
        price: 70,
        quantity: 2,
        total_price: 140,
      },
      {
        product_id: 11,
        product_name: "Whole Wheat Bread 400g Premium Sliced",
        barcode: "8901234567891",
        price: 45,
        quantity: 8,
        total_price: 360,
      },
    ],
  };

  it("should generate valid GS v 0 raster image byte stream for 80mm paper", () => {
    const bytes = buildReceiptEscPos(mockSale, {
      paperWidth: 80,
      storeInfo: {
        name: "My Retail Store",
        address: "Main Market Road",
        phone: "0123456789",
      },
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    // Initial ESC @ command: [0x1B, 0x40]
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);

    // Should contain GS v 0 raster bitmap header [0x1D, 0x76, 0x30, 0x00]
    const arr = Array.from(bytes);
    let foundGsV0 = false;
    for (let i = 0; i < arr.length - 4; i++) {
      if (
        arr[i] === 0x1d &&
        arr[i + 1] === 0x76 &&
        arr[i + 2] === 0x30 &&
        arr[i + 3] === 0x00
      ) {
        foundGsV0 = true;
        break;
      }
    }
    expect(foundGsV0).toBe(true);

    // Ends with cut command (GS V -> 0x1D, 0x56)
    const endSlice = Array.from(bytes.slice(bytes.length - 10));
    expect(endSlice).toContain(0x1d);
    expect(endSlice).toContain(0x56);
  });

  it("should generate 58mm canvas layout when paperWidth=58", () => {
    const canvas = createReceiptCanvas(mockSale, {
      paperWidth: 58,
    });

    expect(canvas.width).toBe(384);
    expect(canvas.height).toBeGreaterThan(200);

    const bytes = buildReceiptEscPos(mockSale, {
      paperWidth: 58,
    });
    expect(bytes.length).toBeGreaterThan(50);
  });

  it("should include cash drawer kick command for cash sales", () => {
    const bytes = buildReceiptEscPos(mockSale);
    const arr = Array.from(bytes);

    // Look for ESC p 0 25 250 -> [0x1B, 0x70, 0x00, 0x19, 0xFA]
    let foundKick = false;
    for (let i = 0; i < arr.length - 4; i++) {
      if (
        arr[i] === 0x1b &&
        arr[i + 1] === 0x70 &&
        arr[i + 2] === 0x00 &&
        arr[i + 3] === 0x19 &&
        arr[i + 4] === 0xfa
      ) {
        foundKick = true;
        break;
      }
    }
    expect(foundKick).toBe(true);
  });

  it("should render receipt canvas with barcode and QR options enabled", () => {
    const canvas = createReceiptCanvas(mockSale, {
      showBarcode: true,
      showUpiQr: true,
      storeInfo: {
        name: "My Retail Store",
        upi_id: "merchant@okhdfcbank",
        upi_name: "My Retail Store",
      },
    });

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBeGreaterThan(400);
  });
});

describe("Code 128 Barcode Generator Tests", () => {
  it("should encode Code 128 modules correctly", () => {
    const res = encodeCode128("INV-1001");
    expect(res.modules.length).toBeGreaterThan(0);
    expect(res.text).toBe("INV-1001");
  });

  it("should generate valid SVG markup for Code 128", () => {
    const svg = generateCode128Svg("INV-2026-001");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
    expect(svg).toContain("INV-2026-001");
  });
});

describe("Dynamic UPI QR Code Generator Tests", () => {
  it("should generate valid standard UPI URI format", () => {
    const uri = generateUpiUri({
      upiId: "merchant@okhdfcbank",
      payeeName: "Retail Sathi Supermarket",
      amount: 499.5,
      invoiceNo: "INV-999",
    });

    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=merchant%40okhdfcbank");
    expect(uri).toContain("am=499.50");
    expect(uri).toContain("cu=INR");
    expect(uri).toContain("tn=Invoice%20INV-999");
  });

  it("should generate 2D QR matrix and SVG element", () => {
    const qr = generateQrMatrix("upi://pay?pa=test@upi&pn=Test&am=100.00&cu=INR");
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.get(0, 0)).toBe(true);

    const svg = generateQrSvg("upi://pay?pa=test@upi&pn=Test&am=100.00&cu=INR");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(svg).toContain("</svg>");
  });
});
