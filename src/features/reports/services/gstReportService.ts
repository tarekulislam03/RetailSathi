import { getDb } from "../../../services/database";
import { getActiveOrFirstStore } from "../../stores/services/storeService";
import {
  GstInwardItem,
  GstOutwardItem,
  GstReportData,
  GstReportFilter,
  GstTaxSummary,
  StoreReportInfo,
} from "../types";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

/**
 * Normalizes date string into YYYY-MM-DD or standard display format
 */
function normalizeDate(rawDate?: string): string {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return rawDate.slice(0, 10);
}

/**
 * Checks if a record date is within the specified start and end date range.
 */
function isDateInRange(
  recordDateStr?: string,
  startDate?: string,
  endDate?: string
): boolean {
  if (!recordDateStr) return true;
  const normRec = normalizeDate(recordDateStr);
  if (startDate && normRec < startDate) return false;
  if (endDate && normRec > endDate) return false;
  return true;
}

/**
 * Checks if string contains non-ASCII characters (e.g. Bengali / Hindi / Unicode).
 */
export function containsUnicode(text?: string): boolean {
  if (!text) return false;
  return /[^\u0000-\u007F]/.test(text);
}

/**
 * Renders any Unicode / Bengali / Indic text onto an HTML canvas and returns a high-res PNG dataUrl.
 * Essential for rendering non-ASCII scripts (like Bengali "আপন বাজার") in jsPDF,
 * since jsPDF built-in fonts only support Latin-1 (WinAnsiEncoding).
 */
export function renderUnicodeTextToCanvas(
  text: string,
  fontSizePx: number = 24,
  fontWeight: string = "bold",
  color: string = "#000000"
): { dataUrl: string; widthMm: number; heightMm: number } {
  if (typeof document === "undefined") {
    return { dataUrl: "", widthMm: 0, heightMm: 0 };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: "", widthMm: 0, heightMm: 0 };

  const fontStr = `${fontWeight} ${fontSizePx}px "Noto Sans Bengali", "Noto Serif Bengali", "Kalpurush", "SolaimanLipi", "Mukti", "Lohit Bengali", "Segoe UI", Tahoma, Arial, sans-serif`;
  ctx.font = fontStr;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width) + 8;
  const textHeight = Math.ceil(fontSizePx * 1.35);

  // 3x resolution for crisp, sharp rendering in print/PDF
  const scale = 3;
  canvas.width = textWidth * scale;
  canvas.height = textHeight * scale;

  ctx.scale(scale, scale);
  ctx.font = fontStr;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 2, textHeight / 2);

  const widthMm = textWidth * 0.264583;
  const heightMm = textHeight * 0.264583;

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm,
    heightMm,
  };
}

const canvasCache = new Map<string, { dataUrl: string; widthMm: number; heightMm: number }>();

export function getCachedUnicodeCanvas(
  text: string,
  fontSizePx: number = 18,
  fontWeight: string = "normal",
  color: string = "#000000"
) {
  const key = `${text}__${fontSizePx}__${fontWeight}__${color}`;
  let item = canvasCache.get(key);
  if (!item) {
    item = renderUnicodeTextToCanvas(text, fontSizePx, fontWeight, color);
    canvasCache.set(key, item);
  }
  return item;
}

/**
 * Saves binary bytes directly to user's Downloads folder via Tauri command,
 * falling back to browser Blob download if running outside Tauri.
 */
export async function saveAndDownloadFile(
  filename: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<{ success: boolean; filePath?: string }> {
  const isTauri =
    typeof window !== "undefined" &&
    (Boolean((window as any).__TAURI_INTERNALS__) || Boolean((window as any).__TAURI__));

  if (isTauri) {
    try {
      const filePath = await invoke<string>("save_report_file", {
        filename,
        bytes: Array.from(bytes),
      });

      try {
        await revealItemInDir(filePath);
      } catch (revealErr) {
        console.warn("Could not reveal file in directory:", revealErr);
      }

      return { success: true, filePath };
    } catch (tauriErr) {
      console.warn("Tauri save_report_file invoke failed, falling back to browser download:", tauriErr);
    }
  }

  // Browser Fallback (Blob + <a download>)
  if (typeof document !== "undefined") {
    try {
      const blob = new Blob([bytes as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { success: true };
    } catch (err: any) {
      console.error("Browser download failed:", err);
      throw new Error(`Failed to download ${filename}: ${err?.message || err}`);
    }
  }

  return { success: true };
}

/**
 * Fetches all Stock IN (Purchases) and Stock OUT (Sales) data with GST calculations.
 */
export async function fetchGstReportData(
  filter?: GstReportFilter
): Promise<GstReportData> {
  const db = await getDb();

  // 1. Fetch Active Store Info
  let storeInfo: StoreReportInfo = {
    name: "Retail Sathi",
    gstin: "Not Provided",
  };

  try {
    const store = await getActiveOrFirstStore();
    if (store) {
      storeInfo = {
        name: store.name || "Retail Sathi",
        gstin: store.gstin || "Not Registered / Composition",
        address: store.address || "",
        phone: store.phone || "",
        email: store.email || "",
      };
    }
  } catch (err) {
    console.warn("[GST-Report] Could not load store info:", err);
  }

  // 2. Query Inward Stock (Purchases)
  const purchaseRows = await db.select<any[]>(`
    SELECT 
      pi.id AS item_id,
      pi.purchase_id,
      pi.product_id,
      pi.product_name,
      pi.barcode,
      pi.batch_no,
      pi.hsn_code,
      pi.category,
      pi.purchase_price,
      pi.quantity,
      pi.subtotal,
      COALESCE(pi.gst_rate, pr.gst_rate, 0) AS gst_rate,
      p.invoice_no,
      p.supplier_name,
      p.gst_no AS supplier_gstin,
      COALESCE(p.purchase_date, p.created_at) AS date_str
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN products pr ON (pi.product_id = pr.id OR (pi.barcode = pr.barcode AND pr.barcode IS NOT NULL AND pr.barcode != ''))
    ORDER BY COALESCE(p.purchase_date, p.created_at) DESC, p.id DESC
  `);

  // 3. Query Outward Stock (Sales)
  const saleRows = await db.select<any[]>(`
    SELECT 
      si.id AS item_id,
      si.sale_id,
      si.product_id,
      si.product_name,
      si.barcode,
      si.price AS selling_price,
      si.quantity,
      si.total_price,
      s.invoice_no,
      s.customer_name,
      s.customer_phone,
      s.payment_mode,
      s.created_at AS date_str,
      COALESCE(pr.hsn_code, '') AS hsn_code,
      COALESCE(pr.gst_rate, 0) AS gst_rate,
      COALESCE(pr.category, 'General') AS category
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products pr ON si.product_id = pr.id
    ORDER BY s.created_at DESC, s.id DESC
  `);

  // Process Inward Items
  const inwardItems: GstInwardItem[] = [];
  for (const r of purchaseRows) {
    if (!isDateInRange(r.date_str, filter?.startDate, filter?.endDate)) {
      continue;
    }

    const qty = Number(r.quantity) || 0;
    const rate = Number(r.purchase_price) || 0;
    const totalAmount = Number(r.subtotal) || rate * qty;
    const gstRate = Number(r.gst_rate) || 0;

    let taxableValue = totalAmount;
    let totalGst = 0;

    if (gstRate > 0) {
      taxableValue = Math.round((totalAmount / (1 + gstRate / 100)) * 100) / 100;
      totalGst = Math.round((totalAmount - taxableValue) * 100) / 100;
    }

    const cgst = Math.round((totalGst / 2) * 100) / 100;
    const sgst = Math.round((totalGst - cgst) * 100) / 100;

    inwardItems.push({
      id: `IN-${r.item_id}`,
      date: normalizeDate(r.date_str),
      invoice_no: r.invoice_no || "-",
      supplier_name: r.supplier_name || "Supplier",
      supplier_gstin: r.supplier_gstin || "-",
      product_id: r.product_id || null,
      product_name: r.product_name || "Unknown Product",
      barcode: r.barcode || "",
      batch_no: r.batch_no || "",
      hsn_code: r.hsn_code || "",
      category: r.category || "General",
      quantity: qty,
      rate: rate,
      taxable_value: taxableValue,
      gst_rate: gstRate,
      cgst,
      sgst,
      total_amount: totalAmount,
    });
  }

  // Process Outward Items
  const outwardItems: GstOutwardItem[] = [];
  for (const r of saleRows) {
    if (!isDateInRange(r.date_str, filter?.startDate, filter?.endDate)) {
      continue;
    }

    const qty = Number(r.quantity) || 0;
    const rate = Number(r.selling_price) || 0;
    const totalAmount = Number(r.total_price) || rate * qty;
    const gstRate = Number(r.gst_rate) || 0;

    let taxableValue = totalAmount;
    let totalGst = 0;

    if (gstRate > 0) {
      taxableValue = Math.round((totalAmount / (1 + gstRate / 100)) * 100) / 100;
      totalGst = Math.round((totalAmount - taxableValue) * 100) / 100;
    }

    const cgst = Math.round((totalGst / 2) * 100) / 100;
    const sgst = Math.round((totalGst - cgst) * 100) / 100;

    outwardItems.push({
      id: `OUT-${r.item_id}`,
      date: normalizeDate(r.date_str),
      invoice_no: r.invoice_no || "-",
      customer_name: r.customer_name || "Walk-in Customer",
      customer_phone: r.customer_phone || "",
      product_id: r.product_id || null,
      product_name: r.product_name || "Unknown Product",
      barcode: r.barcode || "",
      hsn_code: r.hsn_code || "",
      category: r.category || "General",
      quantity: qty,
      rate: rate,
      taxable_value: taxableValue,
      gst_rate: gstRate,
      cgst,
      sgst,
      total_amount: totalAmount,
    });
  }

  // Calculate Aggregated Summaries
  const totalInwardQty = inwardItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalInwardTaxable = inwardItems.reduce((acc, i) => acc + i.taxable_value, 0);
  const totalInwardCgst = inwardItems.reduce((acc, i) => acc + i.cgst, 0);
  const totalInwardSgst = inwardItems.reduce((acc, i) => acc + i.sgst, 0);
  const totalInwardGst = totalInwardCgst + totalInwardSgst;
  const totalInwardAmount = inwardItems.reduce((acc, i) => acc + i.total_amount, 0);

  const totalOutwardQty = outwardItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalOutwardTaxable = outwardItems.reduce((acc, i) => acc + i.taxable_value, 0);
  const totalOutwardCgst = outwardItems.reduce((acc, i) => acc + i.cgst, 0);
  const totalOutwardSgst = outwardItems.reduce((acc, i) => acc + i.sgst, 0);
  const totalOutwardGst = totalOutwardCgst + totalOutwardSgst;
  const totalOutwardAmount = outwardItems.reduce((acc, i) => acc + i.total_amount, 0);

  const netCgstPayable = totalOutwardCgst - totalInwardCgst;
  const netSgstPayable = totalOutwardSgst - totalInwardSgst;
  const netGstPayable = totalOutwardGst - totalInwardGst;

  const summary: GstTaxSummary = {
    totalInwardQty,
    totalInwardTaxable: Math.round(totalInwardTaxable * 100) / 100,
    totalInwardCgst: Math.round(totalInwardCgst * 100) / 100,
    totalInwardSgst: Math.round(totalInwardSgst * 100) / 100,
    totalInwardGst: Math.round(totalInwardGst * 100) / 100,
    totalInwardAmount: Math.round(totalInwardAmount * 100) / 100,

    totalOutwardQty,
    totalOutwardTaxable: Math.round(totalOutwardTaxable * 100) / 100,
    totalOutwardCgst: Math.round(totalOutwardCgst * 100) / 100,
    totalOutwardSgst: Math.round(totalOutwardSgst * 100) / 100,
    totalOutwardGst: Math.round(totalOutwardGst * 100) / 100,
    totalOutwardAmount: Math.round(totalOutwardAmount * 100) / 100,

    netCgstPayable: Math.round(netCgstPayable * 100) / 100,
    netSgstPayable: Math.round(netSgstPayable * 100) / 100,
    netGstPayable: Math.round(netGstPayable * 100) / 100,
  };

  const now = new Date();
  const generatedAt = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    store: storeInfo,
    startDate: filter?.startDate,
    endDate: filter?.endDate,
    generatedAt,
    inwardItems,
    outwardItems,
    summary,
  };
}

/**
 * Generates and downloads a clean, multi-sheet Excel (.xlsx) GST & Stock Register report.
 */
export async function exportGstReportToExcel(
  reportData: GstReportData,
  filename?: string
): Promise<{ success: boolean; filePath?: string }> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: GST & Stock Summary
  const summaryRows = [
    ["RETAIL SATHI - GST COMPLIANCE & STOCK REGISTER REPORT"],
    [`Store Name: ${reportData.store.name}`],
    [`GSTIN: ${reportData.store.gstin || "N/A"}`],
    [`Address: ${reportData.store.address || "N/A"}`],
    [`Phone: ${reportData.store.phone || "N/A"}`],
    [`Period: ${reportData.startDate || "All Time"} to ${reportData.endDate || "Present"}`],
    [`Generated On: ${reportData.generatedAt}`],
    [],
    ["TAX RECONCILIATION & STOCK SUMMARY", "", "", "", "", ""],
    [
      "Movement Category",
      "Total Qty",
      "Taxable Value (₹)",
      "CGST (₹)",
      "SGST (₹)",
      "Total GST (₹)",
      "Total Value (₹)",
    ],
    [
      "Stock IN (Purchases / Inward ITC)",
      reportData.summary.totalInwardQty,
      reportData.summary.totalInwardTaxable,
      reportData.summary.totalInwardCgst,
      reportData.summary.totalInwardSgst,
      reportData.summary.totalInwardGst,
      reportData.summary.totalInwardAmount,
    ],
    [
      "Stock OUT (Sales / Outward Liability)",
      reportData.summary.totalOutwardQty,
      reportData.summary.totalOutwardTaxable,
      reportData.summary.totalOutwardCgst,
      reportData.summary.totalOutwardSgst,
      reportData.summary.totalOutwardGst,
      reportData.summary.totalOutwardAmount,
    ],
    [
      "NET GST POSITION (Output - Input)",
      "-",
      reportData.summary.totalOutwardTaxable - reportData.summary.totalInwardTaxable,
      reportData.summary.netCgstPayable,
      reportData.summary.netSgstPayable,
      reportData.summary.netGstPayable,
      reportData.summary.totalOutwardAmount - reportData.summary.totalInwardAmount,
    ],
    [],
    [
      reportData.summary.netGstPayable >= 0
        ? "STATUS: NET GST PAYABLE TO TAX AUTHORITY"
        : "STATUS: NET INPUT TAX CREDIT (ITC) BALANCE CARRY FORWARD",
      "",
      "",
      "",
      "",
      "",
      Math.abs(reportData.summary.netGstPayable),
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "GST Summary");

  // Sheet 2: Stock IN (Inward Purchases)
  const inwardHeader = [
    "Sl No",
    "Date",
    "Invoice No",
    "Supplier Name",
    "Supplier GSTIN",
    "Product Name",
    "Barcode",
    "Batch No",
    "HSN Code",
    "Category",
    "Qty",
    "Unit Rate (₹)",
    "Taxable Value (₹)",
    "GST Rate (%)",
    "CGST (₹)",
    "SGST (₹)",
    "Total Inward Amount (₹)",
  ];

  const inwardDataRows = reportData.inwardItems.map((item, idx) => [
    idx + 1,
    item.date,
    item.invoice_no,
    item.supplier_name,
    item.supplier_gstin,
    item.product_name,
    item.barcode,
    item.batch_no,
    item.hsn_code,
    item.category,
    item.quantity,
    item.rate,
    item.taxable_value,
    `${item.gst_rate}%`,
    item.cgst,
    item.sgst,
    item.total_amount,
  ]);

  // Append Total Row for Inward
  inwardDataRows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    reportData.summary.totalInwardQty,
    "",
    reportData.summary.totalInwardTaxable,
    "",
    reportData.summary.totalInwardCgst,
    reportData.summary.totalInwardSgst,
    reportData.summary.totalInwardAmount,
  ]);

  const wsInward = XLSX.utils.aoa_to_sheet([inwardHeader, ...inwardDataRows]);
  XLSX.utils.book_append_sheet(wb, wsInward, "Stock IN (Purchases)");

  // Sheet 3: Stock OUT (Outward Sales)
  const outwardHeader = [
    "Sl No",
    "Date",
    "Bill / Invoice No",
    "Customer Name",
    "Customer Phone",
    "Product Name",
    "Barcode",
    "HSN Code",
    "Category",
    "Qty",
    "Unit Rate (₹)",
    "Taxable Value (₹)",
    "GST Rate (%)",
    "CGST (₹)",
    "SGST (₹)",
    "Total Outward Amount (₹)",
  ];

  const outwardDataRows = reportData.outwardItems.map((item, idx) => [
    idx + 1,
    item.date,
    item.invoice_no,
    item.customer_name,
    item.customer_phone,
    item.product_name,
    item.barcode,
    item.hsn_code,
    item.category,
    item.quantity,
    item.rate,
    item.taxable_value,
    `${item.gst_rate}%`,
    item.cgst,
    item.sgst,
    item.total_amount,
  ]);

  // Append Total Row for Outward
  outwardDataRows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    reportData.summary.totalOutwardQty,
    "",
    reportData.summary.totalOutwardTaxable,
    "",
    reportData.summary.totalOutwardCgst,
    reportData.summary.totalOutwardSgst,
    reportData.summary.totalOutwardAmount,
  ]);

  const wsOutward = XLSX.utils.aoa_to_sheet([outwardHeader, ...outwardDataRows]);
  XLSX.utils.book_append_sheet(wb, wsOutward, "Stock OUT (Sales)");

  const outFileName =
    filename ||
    `GST_Report_${reportData.startDate || "All"}_to_${reportData.endDate || "Present"}.xlsx`;

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const excelBytes = new Uint8Array(excelBuffer);

  return await saveAndDownloadFile(
    outFileName,
    excelBytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/**
 * Generates and downloads a clean, professional, black and white, small texts PDF GST report
 * in standard A4 portrait format (210mm x 297mm) with full Bengali/Unicode font support.
 */
export async function exportGstReportToPdf(
  reportData: GstReportData,
  filename?: string
): Promise<{ success: boolean; filePath?: string }> {
  // Standard A4 Portrait: 210mm wide x 297mm high
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const leftMargin = 10;
  const rightMargin = 10;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 190mm
  let currentY = 12;

  // Header Section (Black & White, Professional)
  doc.setTextColor(0, 0, 0);

  // Store Name (with native Bengali / Unicode Canvas rendering)
  if (containsUnicode(reportData.store.name)) {
    const storeCanvas = getCachedUnicodeCanvas(reportData.store.name, 28, "bold", "#000000");
    if (storeCanvas.dataUrl) {
      let imgW = storeCanvas.widthMm;
      let imgH = storeCanvas.heightMm;
      if (imgW > contentWidth) {
        const ratio = contentWidth / imgW;
        imgW = contentWidth;
        imgH = imgH * ratio;
      }
      doc.addImage(storeCanvas.dataUrl, "PNG", leftMargin, currentY, imgW, imgH);
      currentY += imgH + 2;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(reportData.store.name, leftMargin, currentY + 4);
      currentY += 6;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(reportData.store.name.toUpperCase(), leftMargin, currentY + 4);
    currentY += 6;
  }

  // Store Subtitle (GSTIN, Address, Phone)
  const storeSub = [
    reportData.store.gstin ? `GSTIN: ${reportData.store.gstin}` : "",
    reportData.store.address ? `Address: ${reportData.store.address}` : "",
    reportData.store.phone ? `Phone: ${reportData.store.phone}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  if (storeSub) {
    if (containsUnicode(storeSub)) {
      const subCanvas = getCachedUnicodeCanvas(storeSub, 14, "normal", "#333333");
      if (subCanvas.dataUrl) {
        let subW = subCanvas.widthMm;
        let subH = subCanvas.heightMm;
        if (subW > contentWidth) {
          const ratio = contentWidth / subW;
          subW = contentWidth;
          subH = subH * ratio;
        }
        doc.addImage(subCanvas.dataUrl, "PNG", leftMargin, currentY, subW, subH);
        currentY += subH + 2;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(storeSub, leftMargin, currentY + 3);
        currentY += 4.5;
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(storeSub, leftMargin, currentY + 3);
      currentY += 4.5;
    }
  }

  // Report Title Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "GST COMPLIANCE & STOCK MOVEMENT REGISTER",
    leftMargin,
    currentY + 2
  );

  // Period on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let periodLabel = `${reportData.startDate || "Beginning"} to ${reportData.endDate || "Present"}`;
  const fullMonth = /^(\d{4})-(\d{2})-01$/.exec(reportData.startDate || "");
  if (fullMonth && reportData.endDate) {
    const y = Number(fullMonth[1]);
    const m = Number(fullMonth[2]);
    const last = `${fullMonth[1]}-${fullMonth[2]}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    if (reportData.endDate === last) {
      periodLabel = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    }
  }
  const periodText = `Period: ${periodLabel}  |  Generated: ${reportData.generatedAt}`;
  doc.text(periodText, pageWidth - rightMargin, currentY + 2, { align: "right" });

  currentY += 4;
  // Solid black horizontal rule
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
  currentY += 4;

  // 1. RECONCILIATION SUMMARY TABLE (B&W Small Text)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("1. TAX LIABILITY & STOCK AUDIT SUMMARY", leftMargin, currentY);
  currentY += 2;

  const summaryHead = [
    [
      "SUPPLY CATEGORY",
      "TOTAL QTY",
      "TAXABLE VALUE (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "TOTAL GST (INR)",
      "GROSS VALUE (INR)",
    ],
  ];

  const summaryBody = [
    [
      "STOCK IN (Purchases - Input Tax Credit)",
      String(reportData.summary.totalInwardQty),
      reportData.summary.totalInwardTaxable.toFixed(2),
      reportData.summary.totalInwardCgst.toFixed(2),
      reportData.summary.totalInwardSgst.toFixed(2),
      reportData.summary.totalInwardGst.toFixed(2),
      reportData.summary.totalInwardAmount.toFixed(2),
    ],
    [
      "STOCK OUT (Sales - Outward Tax Liability)",
      String(reportData.summary.totalOutwardQty),
      reportData.summary.totalOutwardTaxable.toFixed(2),
      reportData.summary.totalOutwardCgst.toFixed(2),
      reportData.summary.totalOutwardSgst.toFixed(2),
      reportData.summary.totalOutwardGst.toFixed(2),
      reportData.summary.totalOutwardAmount.toFixed(2),
    ],
    [
      reportData.summary.netGstPayable >= 0
        ? "NET GST PAYABLE (Output - Input)"
        : "NET INPUT TAX CREDIT (ITC) BALANCE",
      "-",
      (reportData.summary.totalOutwardTaxable - reportData.summary.totalInwardTaxable).toFixed(2),
      reportData.summary.netCgstPayable.toFixed(2),
      reportData.summary.netSgstPayable.toFixed(2),
      reportData.summary.netGstPayable.toFixed(2),
      (reportData.summary.totalOutwardAmount - reportData.summary.totalInwardAmount).toFixed(2),
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: summaryHead,
    body: summaryBody,
    theme: "plain",
    styles: {
      fontSize: 6.8,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      font: "helvetica",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: "center",
      fontSize: 6.8,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 62 },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "right", cellWidth: 20 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", fontStyle: "bold", cellWidth: 22 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 28 },
    },
    margin: { left: leftMargin, right: rightMargin },
  });

  // Cell draw hooks to render Bengali / Unicode text inside table cells without escape codes
  const handleUnicodeCellWillDraw = (data: any) => {
    if (data.section === "body" && containsUnicode(String(data.cell.raw ?? ""))) {
      data.cell.text = [];
    }
  };

  const handleUnicodeCellDidDraw = (data: any) => {
    if (data.section === "body") {
      const rawVal = String(data.cell.raw ?? "");
      if (containsUnicode(rawVal)) {
        const isBold = data.cell.styles.fontStyle === "bold";
        const cached = getCachedUnicodeCanvas(rawVal, 12, isBold ? "bold" : "normal");
        if (cached.dataUrl) {
          const pad = 1;
          const maxW = data.cell.width - pad * 2;
          const maxH = data.cell.height - pad * 2;
          let w = cached.widthMm;
          let h = cached.heightMm;
          if (w > maxW) {
            const r = maxW / w;
            w = maxW;
            h = h * r;
          }
          if (h > maxH) {
            const r = maxH / h;
            h = maxH;
            w = w * r;
          }
          const posX = data.cell.x + pad;
          const posY = data.cell.y + (data.cell.height - h) / 2;
          doc.addImage(cached.dataUrl, "PNG", posX, posY, w, h);
        }
      }
    }
  };

  // 2. STOCK IN (PURCHASES REGISTER) TABLE
  const lastTableY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  let inwardStartY = lastTableY + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    `2. INWARD SUPPLIES REGISTER - STOCK IN (Purchases: ${reportData.inwardItems.length} items)`,
    leftMargin,
    inwardStartY
  );
  inwardStartY += 2;

  const inwardHead = [
    [
      "#",
      "DATE",
      "INV NO",
      "SUPPLIER",
      "PRODUCT DESCRIPTION",
      "HSN",
      "QTY",
      "RATE",
      "TAXABLE",
      "GST%",
      "CGST",
      "SGST",
      "TOTAL",
    ],
  ];

  const inwardRows = reportData.inwardItems.map((item, idx) => [
    String(idx + 1),
    item.date,
    item.invoice_no,
    item.supplier_name.slice(0, 20),
    item.product_name.slice(0, 24),
    item.hsn_code,
    String(item.quantity),
    item.rate.toFixed(2),
    item.taxable_value.toFixed(2),
    `${item.gst_rate}%`,
    item.cgst.toFixed(2),
    item.sgst.toFixed(2),
    item.total_amount.toFixed(2),
  ]);

  if (inwardRows.length === 0) {
    inwardRows.push([
      "-",
      "-",
      "-",
      "No inward stock purchases recorded",
      "",
      "",
      "0",
      "0.00",
      "0.00",
      "0%",
      "0.00",
      "0.00",
      "0.00",
    ]);
  } else {
    inwardRows.push([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      String(reportData.summary.totalInwardQty),
      "",
      reportData.summary.totalInwardTaxable.toFixed(2),
      "",
      reportData.summary.totalInwardCgst.toFixed(2),
      reportData.summary.totalInwardSgst.toFixed(2),
      reportData.summary.totalInwardAmount.toFixed(2),
    ]);
  }

  autoTable(doc, {
    startY: inwardStartY,
    head: inwardHead,
    body: inwardRows,
    theme: "plain",
    styles: {
      fontSize: 6.2,
      cellPadding: 1,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      font: "helvetica",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: "center",
      fontSize: 6.2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 6 },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "left", cellWidth: 16 },
      3: { halign: "left", cellWidth: 26 },
      4: { halign: "left", cellWidth: 32 },
      5: { halign: "center", cellWidth: 12 },
      6: { halign: "center", cellWidth: 8 },
      7: { halign: "right", cellWidth: 12 },
      8: { halign: "right", cellWidth: 14 },
      9: { halign: "center", cellWidth: 9 },
      10: { halign: "right", cellWidth: 11 },
      11: { halign: "right", cellWidth: 11 },
      12: { halign: "right", cellWidth: 17, fontStyle: "bold" },
    },
    margin: { left: leftMargin, right: rightMargin },
    willDrawCell: handleUnicodeCellWillDraw,
    didDrawCell: handleUnicodeCellDidDraw,
  });

  // 3. STOCK OUT (SALES REGISTER) TABLE
  const afterInwardY = (doc as any).lastAutoTable?.finalY || 100;
  let outwardStartY = afterInwardY + 5;

  if (outwardStartY > 240) {
    doc.addPage();
    outwardStartY = 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    `3. OUTWARD SUPPLIES REGISTER - STOCK OUT (Sales: ${reportData.outwardItems.length} items)`,
    leftMargin,
    outwardStartY
  );
  outwardStartY += 2;

  const outwardHead = [
    [
      "#",
      "DATE",
      "BILL NO",
      "CUSTOMER",
      "PRODUCT DESCRIPTION",
      "HSN",
      "QTY",
      "RATE",
      "TAXABLE",
      "GST%",
      "CGST",
      "SGST",
      "TOTAL",
    ],
  ];

  const outwardRows = reportData.outwardItems.map((item, idx) => [
    String(idx + 1),
    item.date,
    item.invoice_no,
    item.customer_name.slice(0, 20),
    item.product_name.slice(0, 24),
    item.hsn_code,
    String(item.quantity),
    item.rate.toFixed(2),
    item.taxable_value.toFixed(2),
    `${item.gst_rate}%`,
    item.cgst.toFixed(2),
    item.sgst.toFixed(2),
    item.total_amount.toFixed(2),
  ]);

  if (outwardRows.length === 0) {
    outwardRows.push([
      "-",
      "-",
      "-",
      "No outward stock sales recorded",
      "",
      "",
      "0",
      "0.00",
      "0.00",
      "0%",
      "0.00",
      "0.00",
      "0.00",
    ]);
  } else {
    outwardRows.push([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      String(reportData.summary.totalOutwardQty),
      "",
      reportData.summary.totalOutwardTaxable.toFixed(2),
      "",
      reportData.summary.totalOutwardCgst.toFixed(2),
      reportData.summary.totalOutwardSgst.toFixed(2),
      reportData.summary.totalOutwardAmount.toFixed(2),
    ]);
  }

  autoTable(doc, {
    startY: outwardStartY,
    head: outwardHead,
    body: outwardRows,
    theme: "plain",
    styles: {
      fontSize: 6.2,
      cellPadding: 1,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      font: "helvetica",
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: "center",
      fontSize: 6.2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 6 },
      1: { halign: "center", cellWidth: 16 },
      2: { halign: "left", cellWidth: 18 },
      3: { halign: "left", cellWidth: 24 },
      4: { halign: "left", cellWidth: 32 },
      5: { halign: "center", cellWidth: 12 },
      6: { halign: "center", cellWidth: 8 },
      7: { halign: "right", cellWidth: 12 },
      8: { halign: "right", cellWidth: 14 },
      9: { halign: "center", cellWidth: 9 },
      10: { halign: "right", cellWidth: 11 },
      11: { halign: "right", cellWidth: 11 },
      12: { halign: "right", cellWidth: 17, fontStyle: "bold" },
    },
    margin: { left: leftMargin, right: rightMargin },
    willDrawCell: handleUnicodeCellWillDraw,
    didDrawCell: handleUnicodeCellDidDraw,
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);

    doc.text(
      "CONFIDENTIAL - FOR TAX COMPLIANCE & ACCOUNTING AUDIT PURPOSES ONLY",
      leftMargin,
      290
    );

    doc.text(
      `Retail Sathi v3 POS  |  Page ${i} of ${totalPages}`,
      pageWidth - rightMargin,
      290,
      { align: "right" }
    );
  }

  const outFileName =
    filename ||
    `GST_Report_${reportData.startDate || "All"}_to_${reportData.endDate || "Present"}.pdf`;

  const pdfArrayBuffer = doc.output("arraybuffer");
  const pdfBytes = new Uint8Array(pdfArrayBuffer);

  return await saveAndDownloadFile(outFileName, pdfBytes, "application/pdf");
}
