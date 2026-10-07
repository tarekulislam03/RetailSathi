import { isTauri, invoke } from "@tauri-apps/api/core";
import { Sale } from "../features/billing/types";
import { getActiveOrFirstStore } from "../features/stores/services/storeService";
import { generateUpiUri, generateQrMatrix } from "../utils/qrCodeGenerator";
import { encodeCode128 } from "../utils/code128";

export interface PrinterDevice {
  name: string;
  is_default: boolean;
  status: string;
}

export interface StoreReceiptInfo {
  name?: string;
  code?: string;
  tagline?: string;
  promo_text?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  fssai?: string;
  logo_url?: string;
  return_policy?: string;
  upi_id?: string;
  upi_name?: string;
  receipt_footer?: string;
  paper_width?: number;
  default_printer?: string;
  show_barcode?: boolean;
  show_upi_qr?: boolean;
  show_header?: boolean;
  show_customer?: boolean;
  show_savings?: boolean;
  show_tax?: boolean;
  show_return_policy?: boolean;
  mandatory_bill_note?: boolean;
}

export interface PrintReceiptOptions {
  printerName?: string;
  storeInfo?: StoreReceiptInfo;
  paperWidth?: 58 | 80;
  kickDrawer?: boolean;
  showBarcode?: boolean;
  showUpiQr?: boolean;
  logoBytes?: number[];
  logoImage?: HTMLImageElement;
}

/** Load the store logo (data URL or path) so it can be drawn on the receipt canvas. */
export function loadLogoImage(src?: string | null): Promise<HTMLImageElement | undefined> {
  if (!src || typeof Image === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

export interface EscPosBarcodeItem {
  name: string;
  barcode: string;
  price: number;
  mrp?: number;
  batch_no?: string;
  storeName?: string;
}

export async function getAvailablePrinters(): Promise<PrinterDevice[]> {
  if (!isTauri()) {
    return [];
  }
  try {
    const list = await invoke<PrinterDevice[]>("list_printers");
    return list || [];
  } catch (err) {
    console.warn("[Image-Print] Failed to list printers:", err);
    return [];
  }
}

export async function getActiveStoreInfo(): Promise<StoreReceiptInfo> {
  try {
    const store = await getActiveOrFirstStore();
    if (store) {
      return {
        name: store.name || "Retail Sathi Supermarket",
        code: store.code || "STORE-01",
        tagline: store.tagline || "",
        promo_text: store.promo_text || "",
        address: store.address || "",
        phone: store.phone || "",
        email: store.email || "",
        gstin: store.gstin || "",
        fssai: store.fssai || "",
        logo_url: store.logo_url || "/Retail Sathi.png",
        return_policy: store.return_policy ?? "Exchange within 7 days with original bill.",
        upi_id: store.upi_id || undefined,
        upi_name: store.upi_name || store.name || undefined,
        receipt_footer: store.receipt_footer ?? "Thank you for shopping with us!\nPlease visit again!",
        show_barcode: store.show_barcode !== 0 && store.show_barcode !== false,
        show_upi_qr: store.show_upi_qr !== 0 && store.show_upi_qr !== false,
        show_header: store.show_header !== 0 && store.show_header !== false,
        show_customer: store.show_customer !== 0 && store.show_customer !== false,
        show_savings: store.show_savings !== 0 && store.show_savings !== false,
        show_tax: store.show_tax !== 0 && store.show_tax !== false,
        show_return_policy: store.show_return_policy !== 0 && store.show_return_policy !== false,
        mandatory_bill_note: store.mandatory_bill_note !== 0 && store.mandatory_bill_note !== false,
        paper_width: store.paper_width || 80,
        default_printer: store.default_printer || undefined,
      };
    }
  } catch (err) {
    console.warn("[Image-Print] Could not load active store info:", err);
  }
  return {
    name: "Retail Sathi Supermarket",
    code: "STORE-01",
    tagline: "Your Daily Grocery & Supermarket",
    promo_text: "Fresh Items * Best Prices Every Day",
    address: "123 Commercial Street, Market Area",
    phone: "+91 98765 43210",
    email: "contact@retailsathi.com",
    gstin: "29AAAAA0000A1Z5",
    fssai: "10019043000000",
    logo_url: "/Retail Sathi.png",
    return_policy: "Exchange within 7 days with original bill.",
    receipt_footer: "Thank you for shopping with us!\nPlease visit again!",
    paper_width: 80,
    show_header: true,
    show_customer: true,
    show_savings: true,
    show_tax: true,
    show_return_policy: true,
    mandatory_bill_note: true,
    show_barcode: true,
    show_upi_qr: true,
  };
}

/**
 * Render complete receipt visually onto HTML Canvas for image-based printing with 3rem Store Name and 1.8rem Details.
 */
export function createReceiptCanvas(
  sale: Sale,
  options?: PrintReceiptOptions
): HTMLCanvasElement {
  const paperWidth = options?.paperWidth || 80;
  const canvasWidth = paperWidth === 58 ? 384 : 576;
  const store = options?.storeInfo;

  const showHeader = store?.show_header !== false;
  const showCustomer = store?.show_customer !== false;
  const showSavings = store?.show_savings !== false;
  const showTax = store?.show_tax !== false;
  const showReturnPolicy = store?.show_return_policy !== false;
  const mandatoryBillNote = store?.mandatory_bill_note !== false;
  const showBarcode = options?.showBarcode ?? (store?.show_barcode !== false);
  const showUpiQr = options?.showUpiQr ?? (store?.show_upi_qr !== false);

  const items = sale.items || [];
  const baseHeight =
    850 +
    items.length * 60 +
    (showBarcode ? 140 : 0) +
    (showUpiQr ? 280 : 0) +
    (showHeader ? 300 : 0) +
    (showHeader && options?.logoImage ? 280 : 0);

  let canvas: HTMLCanvasElement;
  if (typeof document !== "undefined" && document.createElement) {
    canvas = document.createElement("canvas");
  } else {
    canvas = {
      width: canvasWidth,
      height: baseHeight,
      getContext: () => null,
    } as any;
    return canvas;
  }

  canvas.width = canvasWidth;
  canvas.height = Math.max(500, baseHeight);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return canvas;
  }

  // Fill white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";

  let y = 40;
  const margin = 12;
  const contentWidth = canvasWidth - margin * 2;

  const drawDashedLine = (currY: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.moveTo(margin, currY);
    ctx.lineTo(canvasWidth - margin, currY);
    ctx.stroke();
    ctx.restore();
  };

  const drawSolidLine = (currY: number, width = 1.5) => {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(margin, currY);
    ctx.lineTo(canvasWidth - margin, currY);
    ctx.stroke();
    ctx.restore();
  };

  const drawCenteredText = (text: string, font: string, currY: number): number => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(text, canvasWidth / 2, currY);
    ctx.restore();
    const fontSize = parseInt(font.match(/\d+/)?.[0] || "28", 10);
    return currY + fontSize + 8;
  };

  const drawTwoColumnText = (left: string, right: string, font: string, currY: number): number => {
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(left, margin, currY);
    ctx.textAlign = "right";
    ctx.fillText(right, canvasWidth - margin, currY);
    ctx.restore();
    const fontSize = parseInt(font.match(/\d+/)?.[0] || "28", 10);
    return currY + fontSize + 8;
  };

  // 1. STORE HEADER (Store Name enlarged 2x: 96px for 80mm / 72px for 58mm)
  if (showHeader) {
    const logo = options?.logoImage;
    if (logo && logo.width > 0 && logo.height > 0) {
      const maxW = Math.min(contentWidth, (canvasWidth === 384 ? 220 : 320) * 3);
      const maxH = 240;
      const scale = Math.min(maxW / logo.width, maxH / logo.height);
      const w = Math.round(logo.width * scale);
      const h = Math.round(logo.height * scale);
      ctx.drawImage(logo, Math.round((canvasWidth - w) / 2), y, w, h);
      y += h + 12;
    }
    const storeName = store?.name || "RETAIL SATHI SUPERMARKET";
    const nameFontSize = canvasWidth === 384 ? 72 : 96; // 2x store name
    y = drawCenteredText(storeName, `bold ${nameFontSize}px sans-serif`, y);

    if (store?.tagline) {
      y = drawCenteredText(store.tagline, "20px sans-serif", y);
    }
    if (store?.promo_text) {
      y = drawCenteredText(`* ${store.promo_text} *`, "bold 20px sans-serif", y);
    }
    if (store?.address) {
      y = drawCenteredText(store.address, "20px sans-serif", y);
    }
    if (store?.phone || store?.email) {
      const contactStr = [
        store?.phone ? `Ph: ${store.phone}` : "",
        store?.email ? `Email: ${store.email}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      y = drawCenteredText(contactStr, "20px sans-serif", y);
    }
    if (store?.gstin || store?.fssai) {
      const taxStr = [
        store?.gstin ? `GSTIN: ${store.gstin}` : "",
        store?.fssai ? `FSSAI: ${store.fssai}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      y = drawCenteredText(taxStr, "bold 20px sans-serif", y);
    }
    y += 8;
  }

  // 2. INVOICE META
  drawDashedLine(y);
  y += 18;
  y = drawCenteredText("RECEIPT", "bold 32px sans-serif", y);
  drawDashedLine(y);
  y += 18;

  const dateStr = sale.created_at || new Date().toLocaleString();
  y = drawTwoColumnText(`Bill No: #${sale.invoice_no}`, dateStr, "20px sans-serif", y); // 1.8rem

  if (showCustomer && (sale.customer_name || sale.customer_phone)) {
    if (sale.customer_name && sale.customer_name !== "Walk-in Customer") {
      y = drawTwoColumnText("Customer Name:", sale.customer_name, "20px sans-serif", y); // 1.8rem
    }
    if (sale.customer_phone) {
      y = drawTwoColumnText("Customer Phone:", sale.customer_phone, "20px sans-serif", y); // 1.8rem
    }
  }

  drawDashedLine(y);
  y += 18;

  // 3. ITEMS TABLE HEADER (1.8rem = 28px Details)
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";

  if (canvasWidth === 576) {
    ctx.fillText("S#", margin, y);
    ctx.fillText("Item Name", margin + 45, y);
    ctx.textAlign = "right";
    ctx.fillText("Qty", margin + 310, y);
    ctx.fillText("Rate", margin + 420, y);
    ctx.fillText("Amount", canvasWidth - margin, y);
  } else {
    ctx.fillText("Item Name", margin, y);
    ctx.textAlign = "right";
    ctx.fillText("Qty", margin + 200, y);
    ctx.fillText("Rate", margin + 280, y);
    ctx.fillText("Amt", canvasWidth - margin, y);
  }
  y += 10;
  drawSolidLine(y, 2);
  y += 26;

  let totalQty = 0;
  ctx.font = "20px sans-serif"; // 1.8rem

  items.forEach((item, index) => {
    totalQty += item.quantity;
    const sNo = String(index + 1);
    const name = item.product_name || "Item";
    const qtyStr = String(item.quantity);
    const rateStr = item.price.toFixed(2);
    const amtStr = item.total_price.toFixed(2);

    if (canvasWidth === 576) {
      const maxNameWidth = 200;
      ctx.textAlign = "left";
      ctx.fillText(sNo, margin, y);

      if (ctx.measureText(name).width <= maxNameWidth) {
        ctx.fillText(name, margin + 45, y);
        ctx.textAlign = "right";
        ctx.fillText(qtyStr, margin + 310, y);
        ctx.fillText(rateStr, margin + 420, y);
        ctx.fillText(amtStr, canvasWidth - margin, y);
        y += 36;
      } else {
        ctx.fillText(name, margin + 45, y);
        y += 32;
        ctx.textAlign = "right";
        ctx.fillText(qtyStr, margin + 310, y);
        ctx.fillText(rateStr, margin + 420, y);
        ctx.fillText(amtStr, canvasWidth - margin, y);
        y += 36;
      }
    } else {
      const maxNameWidth = 150;
      ctx.textAlign = "left";
      if (ctx.measureText(name).width <= maxNameWidth) {
        ctx.fillText(name, margin, y);
        ctx.textAlign = "right";
        ctx.fillText(qtyStr, margin + 200, y);
        ctx.fillText(rateStr, margin + 280, y);
        ctx.fillText(amtStr, canvasWidth - margin, y);
        y += 36;
      } else {
        ctx.fillText(name, margin, y);
        y += 32;
        ctx.textAlign = "right";
        ctx.fillText(qtyStr, margin + 200, y);
        ctx.fillText(rateStr, margin + 280, y);
        ctx.fillText(amtStr, canvasWidth - margin, y);
        y += 36;
      }
    }
  });

  drawDashedLine(y);
  y += 18;

  // 4. TOTALS SECTION (1.8rem = 28px Details)
  y = drawTwoColumnText(`Total Items: ${items.length}`, `Total Qty: ${totalQty}`, "20px sans-serif", y);

  const totalMrp = sale.total_amount || (sale.grand_total + (sale.discount || 0));
  const totalSavings = sale.discount || Math.max(0, totalMrp - sale.grand_total);
  const taxAmount = sale.tax_amount || 0;
  const taxableAmount = Math.max(0, sale.grand_total - taxAmount);

  y = drawTwoColumnText("Subtotal (Total MRP):", `Rs. ${totalMrp.toFixed(2)}`, "28px sans-serif", y);


  // GRAND TOTAL / NET PAYABLE HIGHLIGHT BOX
  const gtBoxH = 56;
  ctx.fillStyle = "#000000";
  ctx.fillRect(margin, y, contentWidth, gtBoxH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NET PAYABLE:", margin + 14, y + 39);
  ctx.textAlign = "right";
  ctx.fillText(`Rs. ${sale.grand_total.toFixed(2)}`, canvasWidth - margin - 14, y + 39);
  ctx.fillStyle = "#000000";
  y += gtBoxH + 18;

  // Payment Details Breakdown
  if (sale.payment_mode) {
    y = drawTwoColumnText("Payment Mode:", sale.payment_mode, "bold 20px sans-serif", y);
  }
  if (sale.cash_paid !== undefined && sale.cash_paid > 0) {
    y = drawTwoColumnText("  Cash Paid:", `Rs. ${sale.cash_paid.toFixed(2)}`, "20px sans-serif", y);
  }
  if (sale.upi_paid !== undefined && sale.upi_paid > 0) {
    y = drawTwoColumnText("  UPI Paid:", `Rs. ${sale.upi_paid.toFixed(2)}`, "20px sans-serif", y);
  }
  if (sale.due_amount !== undefined && sale.due_amount > 0) {
    y = drawTwoColumnText("Remaining Due:", `Rs. ${sale.due_amount.toFixed(2)}`, "bold 20px sans-serif", y);
  }

  // 5. SAVINGS BANNER
  if (showSavings && totalSavings > 0) {
    drawDashedLine(y);
    y += 18;
    y = drawCenteredText(`*** YOU HAVE SAVED Rs. ${totalSavings.toFixed(2)} ***`, "bold 30px sans-serif", y);
  }

  // 6. FOOTER NOTES & RETURN POLICY (1.8rem = 28px Details)
  drawDashedLine(y);
  y += 18;

  const footerMsg = store?.receipt_footer || "Thank you for shopping with us!\nPlease visit again!";
  for (const line of footerMsg.split("\n")) {
    if (line.trim()) {
      y = drawCenteredText(line.trim(), "20px sans-serif", y);
    }
  }

  if (showReturnPolicy && store?.return_policy) {
    y = drawCenteredText(store.return_policy, "20px sans-serif", y);
  }
  if (mandatoryBillNote) {
    y = drawCenteredText("* Barcode and Bill is mandatory for exchange *", "bold 20px sans-serif", y);
  }

  // 7. INVOICE CODE 128 BARCODE
  if (showBarcode && sale.invoice_no) {
    y += 14;
    const barcodeData = encodeCode128(sale.invoice_no);
    const moduleWidth = canvasWidth === 384 ? 2 : 2.5;
    const barcodeH = 65;
    const totalBcW = barcodeData.modules.length * moduleWidth;
    const startX = (canvasWidth - totalBcW) / 2;

    ctx.fillStyle = "#000000";
    for (let i = 0; i < barcodeData.modules.length; i++) {
      if (barcodeData.modules[i]) {
        ctx.fillRect(startX + i * moduleWidth, y, moduleWidth, barcodeH);
      }
    }
    y += barcodeH + 20;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(sale.invoice_no, canvasWidth / 2, y);
    y += 14;
  }

  // 8. DYNAMIC UPI QR CODE
  if (showUpiQr && store?.upi_id) {
    y += 14;
    y = drawCenteredText("SCAN & PAY VIA UPI", "bold 16px sans-serif", y);
    try {
      const upiUri = generateUpiUri({
        upiId: store.upi_id,
        payeeName: store.upi_name || store.name,
        amount: sale.grand_total,
        invoiceNo: sale.invoice_no,
      });
      const qr = generateQrMatrix(upiUri);
      const moduleSize = canvasWidth === 384 ? 4 : 5;
      const qrW = qr.size * moduleSize;
      const startX = (canvasWidth - qrW) / 2;

      ctx.fillStyle = "#000000";
      for (let r = 0; r < qr.size; r++) {
        for (let c = 0; c < qr.size; c++) {
          if (qr.get(r, c)) {
            ctx.fillRect(startX + c * moduleSize, y + r * moduleSize, moduleSize, moduleSize);
          }
        }
      }
      y += qrW + 16;
    } catch {
      // ignore
    }
    y = drawCenteredText(`UPI ID: ${store.upi_id}`, "16px sans-serif", y);
    y = drawCenteredText("GPay | PhonePe | Paytm | BHIM", "24px sans-serif", y);
    y = drawCenteredText(`Powered by Retail Sathi`,  "16px sans-serif", y);
  }

  y += 32;

  const finalHeight = Math.ceil(y);
  if (typeof document !== "undefined" && document.createElement) {
    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = canvasWidth;
    trimmedCanvas.height = finalHeight;
    const trimmedCtx = trimmedCanvas.getContext("2d");
    if (trimmedCtx) {
      trimmedCtx.drawImage(canvas, 0, 0);
      return trimmedCanvas;
    }
  }

  return canvas;
}

/**
 * Render barcode label sticker onto HTML Canvas for POS thermal printers.
 */
export function createBarcodeLabelCanvas(
  item: EscPosBarcodeItem,
  options?: { paperWidth?: 58 | 80; storeName?: string }
): HTMLCanvasElement {
  const paperWidth = options?.paperWidth || 80;
  const canvasWidth = paperWidth === 58 ? 384 : 576;
  const storeName = item.storeName || options?.storeName || "RETAIL SATHI";

  let canvas: HTMLCanvasElement;
  if (typeof document !== "undefined" && document.createElement) {
    canvas = document.createElement("canvas");
  } else {
    canvas = {
      width: canvasWidth,
      height: 350,
      getContext: () => null,
    } as any;
    return canvas;
  }

  canvas.width = canvasWidth;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";

  // 2-Column geometry
  const margin = 8;
  const middleGap = 12;
  const colWidth = Math.floor((canvasWidth - 2 * margin - middleGap) / 2);

  const col1Left = margin;
  const col1Right = col1Left + colWidth;
  const col1Center = Math.round((col1Left + col1Right) / 2);

  const col2Left = col1Right + middleGap;
  const col2Right = col2Left + colWidth;
  const col2Center = Math.round((col2Left + col2Right) / 2);

  const columns = [
    { left: col1Left, right: col1Right, width: colWidth, center: col1Center },
    { left: col2Left, right: col2Right, width: colWidth, center: col2Center },
  ];

  const mrpValue = item.mrp && item.mrp > 0 ? item.mrp : item.price;
  const mrpText = `MRP: Rs. ${mrpValue.toFixed(2)}`;

  // Barcode encoding
  let barcodeData: { modules: boolean[] } | null = null;
  if (item.barcode) {
    try {
      barcodeData = encodeCode128(item.barcode);
    } catch {
      barcodeData = null;
    }
  }

  const is58 = paperWidth === 58;
  const storeFont = is58 ? "bold 16px sans-serif" : "bold 20px sans-serif";
  const nameFont = is58 ? "bold 15px sans-serif" : "bold 18px sans-serif";
  const bcFont = is58 ? "bold 14px monospace" : "bold 16px monospace";
  const mrpFont = is58 ? "bold 18px sans-serif" : "bold 22px sans-serif";
  const barcodeH = is58 ? 40 : 50;

  let maxY = 0;

  columns.forEach((col) => {
    let y = 20;

    // 1. Store Header (centered)
    ctx.font = storeFont;
    ctx.textAlign = "center";
    ctx.fillText(storeName, col.center, y);
    y += is58 ? 16 : 20;

    // Divider
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(col.left, y);
    ctx.lineTo(col.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += is58 ? 16 : 18;

    // 2. Product Name (centered, truncated to fit column)
    ctx.font = nameFont;
    ctx.textAlign = "center";
    const maxChars = is58 ? 16 : 22;
    const displayName = (item.name || "Item").slice(0, maxChars);
    ctx.fillText(displayName, col.center, y);
    y += is58 ? 18 : 22;

    if (item.batch_no) {
      ctx.font = is58 ? "12px sans-serif" : "14px sans-serif";
      ctx.fillText(`Batch: ${item.batch_no}`, col.center, y);
      y += is58 ? 14 : 16;
    }

    // 3. Barcode (Code 128) (centered)
    if (barcodeData && item.barcode) {
      const moduleWidth = Math.max(1, Math.min(is58 ? 1.4 : 2, Math.floor((col.width - 6) / barcodeData.modules.length)));
      const totalBcW = barcodeData.modules.length * moduleWidth;
      const startX = col.center - totalBcW / 2;

      ctx.fillStyle = "#000000";
      for (let i = 0; i < barcodeData.modules.length; i++) {
        if (barcodeData.modules[i]) {
          ctx.fillRect(startX + i * moduleWidth, y, moduleWidth, barcodeH);
        }
      }
      y += barcodeH + (is58 ? 14 : 18);

      ctx.font = bcFont;
      ctx.textAlign = "center";
      ctx.fillText(item.barcode, col.center, y);
      y += is58 ? 14 : 18;
    }

    // Divider
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(col.left, y);
    ctx.lineTo(col.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += is58 ? 16 : 18;

    // 4. MRP at centre (Selling price removed)
    ctx.font = mrpFont;
    ctx.textAlign = "center";
    ctx.fillText(mrpText, col.center, y);
    y += is58 ? 18 : 22;

    if (y > maxY) maxY = y;
  });

  // Vertical separator between columns
  ctx.beginPath();
  ctx.setLineDash([2, 4]);
  ctx.moveTo(col1Right + Math.floor(middleGap / 2), 10);
  ctx.lineTo(col1Right + Math.floor(middleGap / 2), maxY - 4);
  ctx.stroke();
  ctx.setLineDash([]);

  const finalHeight = Math.ceil(maxY + 10);
  if (typeof document !== "undefined" && document.createElement) {
    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = canvasWidth;
    trimmedCanvas.height = finalHeight;
    const trimmedCtx = trimmedCanvas.getContext("2d");
    if (trimmedCtx) {
      trimmedCtx.drawImage(canvas, 0, 0);
      return trimmedCanvas;
    }
  }

  return canvas;
}

/**
 * Converts an HTML Canvas element to GS v 0 raster bitmap ESC/POS bytes
 */
export function canvasToEscPosRaster(
  canvas: HTMLCanvasElement,
  options?: { kickDrawer?: boolean }
): Uint8Array {
  const width = canvas.width || 576;
  const height = canvas.height || 300;

  const widthBytes = Math.ceil(width / 8);
  const buffer: number[] = [];

  // 1. ESC @ (Initialize printer)
  buffer.push(0x1b, 0x40);

  // 2. GS v 0 (Raster bitmap command)
  const m = 0;
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  buffer.push(0x1d, 0x76, 0x30, m, xL, xH, yL, yH);

  let pixels: Uint8ClampedArray | null = null;
  try {
    const ctx = canvas.getContext?.("2d");
    if (ctx) {
      pixels = ctx.getImageData(0, 0, width, height).data;
    }
  } catch {
    // Canvas context reading fallback
  }

  if (pixels) {
    for (let y = 0; y < height; y++) {
      for (let xb = 0; xb < widthBytes; xb++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x < width) {
            const pxIdx = (y * width + x) * 4;
            const r = pixels[pxIdx];
            const g = pixels[pxIdx + 1];
            const b = pixels[pxIdx + 2];
            const a = pixels[pxIdx + 3];

            const lum = a < 128 ? 255 : r * 0.299 + g * 0.587 + b * 0.114;
            if (lum < 180) {
              byteVal |= 1 << (7 - bit);
            }
          }
        }
        buffer.push(byteVal);
      }
    }
  } else {
    const totalBytes = widthBytes * height;
    for (let i = 0; i < totalBytes; i++) {
      buffer.push(0x00);
    }
  }

  // 3. Cash drawer kick
  if (options?.kickDrawer) {
    buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  // 4. Paper feed & cut
  buffer.push(0x1b, 0x64, 0x04);
  buffer.push(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(buffer);
}

/**
 * Generate image-based receipt printing raster byte payload
 */
export function buildReceiptEscPos(
  sale: Sale,
  options?: PrintReceiptOptions
): Uint8Array {
  const canvas = createReceiptCanvas(sale, options);
  const isCash =
    sale.payment_mode === "Cash" ||
    (sale.cash_paid !== undefined && sale.cash_paid > 0) ||
    options?.kickDrawer;

  return canvasToEscPosRaster(canvas, { kickDrawer: isCash });
}

/**
 * Generate image-based barcode label sticker raster byte payload
 */
export function buildBarcodeLabelEscPos(
  item: EscPosBarcodeItem,
  options?: { paperWidth?: 58 | 80; storeName?: string }
): Uint8Array {
  const canvas = createBarcodeLabelCanvas(item, options);
  return canvasToEscPosRaster(canvas);
}

export async function printReceiptEscPos(
  sale: Sale,
  options?: PrintReceiptOptions
): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    if (typeof window !== "undefined") {
      window.print();
      return { success: true, message: "Browser print dialog opened." };
    }
    return { success: false, message: "Tauri native environment not detected." };
  }

  try {
    const storeInfo = options?.storeInfo || (await getActiveStoreInfo());
    const paperWidth =
      options?.paperWidth ||
      (storeInfo.paper_width as 58 | 80) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("pos_paper_width") === "58"
        ? 58
        : 80);

    const printerName =
      options?.printerName ||
      storeInfo.default_printer ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("selected_pos_printer") || undefined
        : undefined);

    const logoImage =
      options?.logoImage ||
      (storeInfo.show_header !== false ? await loadLogoImage(storeInfo.logo_url) : undefined);

    const bytes = buildReceiptEscPos(sale, {
      ...options,
      paperWidth,
      storeInfo,
      logoImage,
    });

    const result = await invoke<string>("print_raw_escpos", {
      bytes: Array.from(bytes),
      printerName: printerName,
    });

    return {
      success: true,
      message: result || "Receipt printed successfully.",
    };
  } catch (err: any) {
    console.error("[Image-Print] Error:", err);
    const errMsg = err?.message || String(err);
    return {
      success: false,
      message: `Printer Error: ${errMsg}`,
    };
  }
}

export async function printBarcodeLabelEscPos(
  item: EscPosBarcodeItem,
  options?: { printerName?: string; paperWidth?: 58 | 80 }
): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    return { success: false, message: "Desktop app required to print to POS printer." };
  }

  try {
    const storeInfo = await getActiveStoreInfo();
    const printerName =
      options?.printerName ||
      storeInfo.default_printer ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("selected_pos_printer") || undefined
        : undefined);

    const paperWidth = options?.paperWidth || (storeInfo.paper_width as 58 | 80) || 80;

    const bytes = buildBarcodeLabelEscPos(item, {
      paperWidth,
      storeName: item.storeName || storeInfo.name,
    });

    const res = await invoke<string>("print_raw_escpos", {
      bytes: Array.from(bytes),
      printerName: printerName,
    });

    return {
      success: true,
      message: res || "Barcode label printed to POS thermal printer.",
    };
  } catch (err: any) {
    console.error("[Image-Print] Label Error:", err);
    return {
      success: false,
      message: err?.message || String(err),
    };
  }
}
