import jsPDF from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAndDownloadFile } from "./gstReportService";
import { formatInr, GstCaPackData } from "./gstCaPackService";
import { GstRateSlabRow, GstVoucher } from "../types/gstTallyTypes";

function drawHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(text, 10, y);
  return y + 3.5;
}

function drawSubHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(text, 10, y);
  return y + 3;
}

function drawTable(
  doc: jsPDF,
  startY: number,
  options: Omit<UserOptions, "startY" | "margin">
): number {
  autoTable(doc, {
    startY,
    margin: { top: 26, left: 10, right: 10, bottom: 14 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.8,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    ...options,
  });
  return ((doc as any).lastAutoTable?.finalY ?? startY) + 5;
}

function rateRowsToTable(
  doc: jsPDF,
  title: string,
  rows: GstRateSlabRow[],
  startY: number
): number {
  const y = drawSubHeading(doc, title, startY);
  return drawTable(doc, y, {
    head: [["Rate (%)", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total"]],
    body: rows.map((r) => [
      `${r.gstRate}%`,
      formatInr(r.taxableValue),
      formatInr(r.cgst),
      formatInr(r.sgst),
      formatInr(r.igst),
      formatInr(r.cess),
      formatInr(r.totalAmount),
    ]),
    foot: [[
      "TOTAL",
      formatInr(rows.reduce((a, r) => a + r.taxableValue, 0)),
      formatInr(rows.reduce((a, r) => a + r.cgst, 0)),
      formatInr(rows.reduce((a, r) => a + r.sgst, 0)),
      formatInr(rows.reduce((a, r) => a + r.igst, 0)),
      formatInr(rows.reduce((a, r) => a + r.cess, 0)),
      formatInr(rows.reduce((a, r) => a + r.totalAmount, 0)),
    ]],
    columnStyles: {
      0: { halign: "right" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });
}

function voucherRegisterTable(
  doc: jsPDF,
  rows: GstVoucher[],
  emptyText: string,
  startY: number,
  partyLabel: string
): number {
  return drawTable(doc, startY, {
    head: [["Date", partyLabel, `${partyLabel} GSTIN`, "Invoice No", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total"]],
    body:
      rows.length > 0
        ? rows.map((v) => [
            v.date,
            v.partyName,
            v.partyGstin || "-",
            v.voucherNo,
            formatInr(v.taxableValue),
            formatInr(v.cgst),
            formatInr(v.sgst),
            formatInr(v.igst),
            formatInr(v.cess),
            formatInr(v.totalAmount),
          ])
        : [["-", emptyText, "-", "-", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      `${rows.length} vouchers`,
      "",
      "",
      formatInr(rows.reduce((a, v) => a + v.taxableValue, 0)),
      formatInr(rows.reduce((a, v) => a + v.cgst, 0)),
      formatInr(rows.reduce((a, v) => a + v.sgst, 0)),
      formatInr(rows.reduce((a, v) => a + v.igst, 0)),
      formatInr(rows.reduce((a, v) => a + v.cess, 0)),
      formatInr(rows.reduce((a, v) => a + v.totalAmount, 0)),
    ]],
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });
}

function applyCaHeadersAndFooters(doc: jsPDF, pack: GstCaPackData) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(pack.store.name.toUpperCase(), 10, 9.5);

    doc.setFontSize(9);
    doc.text("CA GST AUDIT PACK", pageWidth - 10, 9.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text(
      `GSTIN: ${pack.store.gstin || "Not Set"}  |  State: ${
        pack.store.stateCode ? `${pack.store.stateCode} - ` : ""
      }${pack.store.stateName}`,
      10,
      14.5
    );
    doc.text(`Period: ${pack.periodLabel}`, pageWidth - 10, 14.5, { align: "right" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(10, 17.5, pageWidth - 10, 17.5);

    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 10.5, pageWidth - 10, pageHeight - 10.5);
    doc.setFontSize(7.5);
    doc.text(`Generated: ${pack.generatedAt} | RetailSathi ERP`, 10, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: "right" });
  }
}

/**
 * Generates the 13-page A4 CA GST Audit PDF Pack.
 */
export async function exportGstCaPackPdf(
  pack: GstCaPackData
): Promise<{ success: boolean; filePath?: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const hasDiff =
    Math.abs(pack.reconciliation.diffTaxable) > 0.01 ||
    Math.abs(pack.reconciliation.diffTax) > 0.01 ||
    Math.abs(pack.reconciliation.diffTotal) > 0.01;

  // PAGE 1: COVER SHEET
  let y = 25;
  y = drawHeading(doc, "1. COVER SHEET & AUDIT RECONCILIATION", y);
  y = drawTable(doc, y, {
    head: [["Particulars", "Details"]],
    body: [
      ["Store Name", pack.store.name],
      ["GSTIN", pack.store.gstin || "Not Set"],
      ["State", pack.store.stateCode ? `${pack.store.stateCode} - ${pack.store.stateName}` : pack.store.stateName],
      ["Report Period", pack.periodLabel],
      ["Generated Date", pack.generatedAt],
      ["Last Sync Time", pack.syncInfo.lastSyncTime],
      [
        "Sync Status",
        pack.syncInfo.hasUnsyncedWarning
          ? `WARNING: ${pack.syncInfo.unsyncedCount} unsynced local record(s) pending`
          : "All local bills synced",
      ],
    ],
  });

  y = drawSubHeading(doc, "BOOKS TOTAL vs RETURN TOTAL RECONCILIATION", y);
  y = drawTable(doc, y, {
    head: [["Particulars", "Taxable Value", "Total Tax", "Invoice Total"]],
    body: [
      ["As per Books", formatInr(pack.reconciliation.booksTaxable), formatInr(pack.reconciliation.booksTax), formatInr(pack.reconciliation.booksTotal)],
      ["Included in Return", formatInr(pack.reconciliation.returnTaxable), formatInr(pack.reconciliation.returnTax), formatInr(pack.reconciliation.returnTotal)],
      ["Difference (Books - Return)", formatInr(pack.reconciliation.diffTaxable), formatInr(pack.reconciliation.diffTax), formatInr(pack.reconciliation.diffTotal)],
    ],
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 2 && hasDiff) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = "bold";
      }
    },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  if (pack.mismatchVouchers.length > 0) {
    y = drawSubHeading(doc, "MISMATCH / ABOVE-THRESHOLD VOUCHERS (EXCLUDED FROM TOTALS)", y);
    drawTable(doc, y, {
      head: [["Date", "Voucher No", "Party", "Reason(s)", "Total"]],
      body: pack.mismatchVouchers.map((v) => [
        v.date,
        v.voucherNo,
        v.partyName,
        v.mismatchReasons.join(", ") || `Above Rs. ${formatInr(pack.amountThreshold)}`,
        formatInr(v.totalAmount),
      ]),
      columnStyles: { 4: { halign: "right" } },
    });
  }

  // PAGE 2: SALES SUMMARY RATE-WISE (B2B & B2C)
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "2. SALES SUMMARY — RATE-WISE (B2B & B2C SPLIT)", y);
  y = rateRowsToTable(doc, "2A. B2B SALES (REGISTERED)", pack.salesRateSplit.b2b, y);
  y = rateRowsToTable(doc, "2B. B2C SALES (UNREGISTERED)", pack.salesRateSplit.b2c, y);
  rateRowsToTable(doc, "2C. TOTAL SALES (B2B + B2C)", pack.salesRateSplit.combined, y);

  // PAGE 3: B2B SALES REGISTER
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "3. B2B SALES REGISTER", y);
  drawTable(doc, y, {
    head: [["Date", "Invoice No", "Customer", "GSTIN", "Taxable", "Tax", "Total"]],
    body:
      pack.b2bSales.length > 0
        ? pack.b2bSales.map((v) => [
            v.date,
            v.voucherNo,
            v.partyName,
            v.partyGstin,
            formatInr(v.taxableValue),
            formatInr(v.totalTax),
            formatInr(v.totalAmount),
          ])
        : [["-", "-", "No B2B sales in selected period", "-", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      `${pack.b2bSales.length} bills`,
      "",
      "",
      formatInr(pack.b2bSales.reduce((a, v) => a + v.taxableValue, 0)),
      formatInr(pack.b2bSales.reduce((a, v) => a + v.totalTax, 0)),
      formatInr(pack.b2bSales.reduce((a, v) => a + v.totalAmount, 0)),
    ]],
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  // PAGE 4: SALES RETURNS / CREDIT NOTES
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "4. SALES RETURNS / CREDIT NOTES", y);
  drawTable(doc, y, {
    head: [["Date", "Note No", "Original Invoice", "Taxable", "Tax", "Total"]],
    body:
      pack.salesReturns.length > 0
        ? pack.salesReturns.map((r) => [
            r.date,
            r.noteNo,
            r.originalInvoice,
            formatInr(r.taxableValue),
            formatInr(r.taxAmount),
            formatInr(r.totalAmount),
          ])
        : [["-", "-", "No sales returns / credit notes", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      `${pack.salesReturns.length} notes`,
      "",
      formatInr(pack.salesReturns.reduce((a, r) => a + r.taxableValue, 0)),
      formatInr(pack.salesReturns.reduce((a, r) => a + r.taxAmount, 0)),
      formatInr(pack.salesReturns.reduce((a, r) => a + r.totalAmount, 0)),
    ]],
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  // PAGE 5: HSN SUMMARY
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "5. HSN-WISE SUMMARY OF OUTWARD SUPPLIES", y);
  drawTable(doc, y, {
    head: [["HSN", "Description", "UQC", "Qty", "Taxable", "CGST", "SGST", "IGST", "Cess"]],
    body:
      pack.hsnSummary.length > 0
        ? pack.hsnSummary.map((r) => [
            r.hsnCode,
            r.description,
            r.uqc,
            String(r.totalQty),
            formatInr(r.taxableValue),
            formatInr(r.cgst),
            formatInr(r.sgst),
            formatInr(r.igst),
            formatInr(r.cess),
          ])
        : [["-", "No HSN records", "-", "0", "0.00", "0.00", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      "",
      "",
      String(pack.hsnSummary.reduce((a, r) => a + r.totalQty, 0)),
      formatInr(pack.hsnSummary.reduce((a, r) => a + r.taxableValue, 0)),
      formatInr(pack.hsnSummary.reduce((a, r) => a + r.cgst, 0)),
      formatInr(pack.hsnSummary.reduce((a, r) => a + r.sgst, 0)),
      formatInr(pack.hsnSummary.reduce((a, r) => a + r.igst, 0)),
      formatInr(pack.hsnSummary.reduce((a, r) => a + r.cess, 0)),
    ]],
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
  });

  // PAGE 6: DOCUMENTS ISSUED
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "6. DOCUMENTS ISSUED (PER COUNTER)", y);
  drawTable(doc, y, {
    head: [["Counter", "Document Type", "Series From", "Series To", "Total", "Cancelled", "Net Issued"]],
    body: pack.docsIssued.map((d) => [
      d.counter,
      d.documentType,
      d.seriesFrom,
      d.seriesTo,
      String(d.total),
      String(d.cancelled),
      String(d.netIssued),
    ]),
    foot: [[
      "TOTAL",
      "",
      "",
      "",
      String(pack.docsIssued.reduce((a, d) => a + d.total, 0)),
      String(pack.docsIssued.reduce((a, d) => a + d.cancelled, 0)),
      String(pack.docsIssued.reduce((a, d) => a + d.netIssued, 0)),
    ]],
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  // PAGE 7: PURCHASE REGISTER (FOR ITC)
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "7. PURCHASE REGISTER (FOR ITC)", y);
  voucherRegisterTable(doc, pack.purchaseRegister, "No purchases in selected period", y, "Supplier");

  // PAGE 8: PURCHASE RETURNS / DEBIT NOTES
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "8. PURCHASE RETURNS / DEBIT NOTES", y);
  voucherRegisterTable(doc, pack.purchaseReturns, "No purchase returns / debit notes", y, "Supplier");

  // PAGE 9: EXEMPT / NIL-RATED SALES TOTAL
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "9. EXEMPT / NIL-RATED SALES TOTAL", y);
  drawTable(doc, y, {
    head: [["Category", "Voucher Count", "Taxable / Exempt Value"]],
    body: [
      ["Nil Rated Supplies (0% GST)", String(pack.exemptSales.voucherCount), formatInr(pack.exemptSales.nilRatedTaxable)],
      ["Exempted Supplies", "0", formatInr(pack.exemptSales.exemptTaxable)],
      ["Non-GST Supplies", "0", formatInr(pack.exemptSales.nonGstTaxable)],
    ],
    foot: [["TOTAL EXEMPT / NIL-RATED", String(pack.exemptSales.voucherCount), formatInr(pack.exemptSales.totalExemptSales)]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  // PAGE 10: ITC REVERSAL LIST & INELIGIBLE ITC
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "10. ITC REVERSAL LIST & INELIGIBLE ITC", y);
  y = drawSubHeading(doc, "10A. ITC REVERSALS (EXPIRED / DAMAGED / WRITTEN-OFF STOCK)", y);
  y = drawTable(doc, y, {
    head: [["Date", "Reference No", "Item / Party", "Reason", "Taxable", "CGST", "SGST", "IGST", "Cess"]],
    body:
      pack.itcReversals.length > 0
        ? pack.itcReversals.map((r) => [
            r.date,
            r.referenceNo,
            r.partyOrItem,
            r.reason,
            formatInr(r.taxableValue),
            formatInr(r.cgst),
            formatInr(r.sgst),
            formatInr(r.igst),
            formatInr(r.cess),
          ])
        : [["-", "-", "No ITC reversals recorded", "-", "0.00", "0.00", "0.00", "0.00", "0.00"]],
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });
  y = drawSubHeading(doc, "10B. INELIGIBLE ITC (MISSING / INVALID SUPPLIER GSTIN)", y);
  voucherRegisterTable(doc, pack.ineligibleItc, "No ineligible ITC purchases", y, "Supplier");

  // PAGE 11: CANCELLED / DELETED BILLS LIST
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "11. CANCELLED / DRAFT / DELETED BILLS LIST", y);
  drawTable(doc, y, {
    head: [["Bill No", "Date", "Amount", "Cancelled By", "Status / Reason"]],
    body:
      pack.cancelledBills.length > 0
        ? pack.cancelledBills.map((c) => [c.billNo, c.date, formatInr(c.amount), c.cancelledBy, c.reason])
        : [["-", "-", "0.00", "-", "No cancelled or draft bills"]],
    foot: [["TOTAL", `${pack.cancelledBills.length} bills`, formatInr(pack.cancelledBills.reduce((a, c) => a + c.amount, 0)), "", ""]],
    columnStyles: { 2: { halign: "right" } },
  });

  // PAGE 12: COUNTER-WISE SALES SUMMARY
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "12. COUNTER-WISE SALES SUMMARY (DAY-END RECONCILIATION)", y);
  drawTable(doc, y, {
    head: [["Counter", "Bills", "Cash", "UPI", "Card", "Credit / Due", "Total Sales"]],
    body:
      pack.counterSummary.length > 0
        ? pack.counterSummary.map((c) => [
            c.counter,
            String(c.billCount),
            formatInr(c.cash),
            formatInr(c.upi),
            formatInr(c.card),
            formatInr(c.creditDue),
            formatInr(c.totalSales),
          ])
        : [["Main Counter", "0", "0.00", "0.00", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      String(pack.counterSummary.reduce((a, c) => a + c.billCount, 0)),
      formatInr(pack.counterSummary.reduce((a, c) => a + c.cash, 0)),
      formatInr(pack.counterSummary.reduce((a, c) => a + c.upi, 0)),
      formatInr(pack.counterSummary.reduce((a, c) => a + c.card, 0)),
      formatInr(pack.counterSummary.reduce((a, c) => a + c.creditDue, 0)),
      formatInr(pack.counterSummary.reduce((a, c) => a + c.totalSales, 0)),
    ]],
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  // PAGE 13: GSTR-3B WORKING SHEET
  doc.addPage();
  y = 25;
  y = drawHeading(doc, "13. GSTR-3B WORKING SHEET", y);
  y = drawSubHeading(doc, "3.1 OUTWARD & RCM SUPPLIES", y);
  y = drawTable(doc, y, {
    head: [["Table", "Nature of Supplies", "Taxable", "IGST", "CGST", "SGST", "Cess"]],
    body: pack.gstr3b.table31.map((r) => [
      r.code,
      r.particulars,
      formatInr(r.taxableValue),
      formatInr(r.igst),
      formatInr(r.cgst),
      formatInr(r.sgst),
      formatInr(r.cess),
    ]),
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  y = drawSubHeading(doc, "4. ELIGIBLE ITC (AVAILABLE / REVERSED / NET / INELIGIBLE)", y);
  y = drawTable(doc, y, {
    head: [["Table", "Details", "Taxable", "IGST", "CGST", "SGST", "Cess"]],
    body: pack.gstr3b.table4.map((r) => [
      r.code,
      r.particulars,
      formatInr(r.taxableValue),
      formatInr(r.igst),
      formatInr(r.cgst),
      formatInr(r.sgst),
      formatInr(r.cess),
    ]),
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  y = drawSubHeading(doc, "6.1 PAYMENT OF TAX (PAYABLE vs ITC USED vs CASH PAID)", y);
  drawTable(doc, y, {
    head: [["Tax Head", "Tax Payable", "ITC Used", "Cash Paid"]],
    body: pack.gstr3b.table61.map((r) => [
      r.taxHead,
      formatInr(r.taxPayable),
      formatInr(r.itcUsed),
      formatInr(r.cashPaid),
    ]),
    foot: [[
      "TOTAL",
      formatInr(pack.gstr3b.table61.reduce((a, r) => a + r.taxPayable, 0)),
      formatInr(pack.gstr3b.table61.reduce((a, r) => a + r.itcUsed, 0)),
      formatInr(pack.gstr3b.table61.reduce((a, r) => a + r.cashPaid, 0)),
    ]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  applyCaHeadersAndFooters(doc, pack);

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const filename = `RetailSathi_CA_GST_Pack_${new Date().toISOString().slice(0, 10)}.pdf`;
  return saveAndDownloadFile(filename, bytes, "application/pdf");
}

/**
 * Exports all 13 CA Pack tables as a multi-sheet Excel (.xlsx) workbook.
 */
export async function exportGstCaPackExcel(
  pack: GstCaPackData
): Promise<{ success: boolean; filePath?: string }> {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Field: "Store Name", Value: pack.store.name },
      { Field: "GSTIN", Value: pack.store.gstin },
      { Field: "State", Value: pack.store.stateName },
      { Field: "Period", Value: pack.periodLabel },
      { Field: "Books Total", Value: pack.reconciliation.booksTotal },
      { Field: "Return Total", Value: pack.reconciliation.returnTotal },
      { Field: "Difference", Value: pack.reconciliation.diffTotal },
      { Field: "Last Sync", Value: pack.syncInfo.lastSyncTime },
      { Field: "Unsynced Bills", Value: pack.syncInfo.unsyncedCount },
    ]),
    "1_Cover"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      ...pack.salesRateSplit.b2b.map((r) => ({ Segment: "B2B", ...r })),
      ...pack.salesRateSplit.b2c.map((r) => ({ Segment: "B2C", ...r })),
    ]),
    "2_Sales_Rate_Wise"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      pack.b2bSales.map((v) => ({
        Date: v.date,
        InvoiceNo: v.voucherNo,
        Customer: v.partyName,
        GSTIN: v.partyGstin,
        Taxable: v.taxableValue,
        Tax: v.totalTax,
        Total: v.totalAmount,
      }))
    ),
    "3_B2B_Sales"
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pack.salesReturns), "4_Sales_Returns");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pack.hsnSummary), "5_HSN_Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pack.docsIssued), "6_Docs_Issued");

  const mapVouchers = (list: GstVoucher[]) =>
    list.map((v) => ({
      Date: v.date,
      Party: v.partyName,
      GSTIN: v.partyGstin,
      InvoiceNo: v.voucherNo,
      Taxable: v.taxableValue,
      CGST: v.cgst,
      SGST: v.sgst,
      IGST: v.igst,
      Cess: v.cess,
      Total: v.totalAmount,
    }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapVouchers(pack.purchaseRegister)), "7_Purchases");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapVouchers(pack.purchaseReturns)), "8_Purchase_Returns");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([pack.exemptSales]), "9_Exempt_Sales");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapVouchers(pack.ineligibleItc)), "10_Ineligible_ITC");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pack.cancelledBills), "11_Cancelled_Bills");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pack.counterSummary), "12_Counter_Summary");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      ...pack.gstr3b.table31,
      ...pack.gstr3b.table4,
    ]),
    "13_GSTR3B"
  );

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const bytes = new Uint8Array(out);
  const filename = `RetailSathi_CA_GST_Pack_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return saveAndDownloadFile(
    filename,
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/**
 * Exports the CA Pack summary & registers as CSV.
 */
export async function exportGstCaPackCsv(
  pack: GstCaPackData
): Promise<{ success: boolean; filePath?: string }> {
  const lines: string[] = [];
  const pushSection = (title: string, headers: string[], rows: (string | number)[][]) => {
    lines.push(`"${title}"`);
    lines.push(headers.map((h) => `"${h}"`).join(","));
    for (const r of rows) {
      lines.push(r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    }
    lines.push("");
  };

  pushSection(
    "1. COVER & RECONCILIATION",
    ["Particulars", "Taxable", "Tax", "Total"],
    [
      ["Books Total", pack.reconciliation.booksTaxable, pack.reconciliation.booksTax, pack.reconciliation.booksTotal],
      ["Return Total", pack.reconciliation.returnTaxable, pack.reconciliation.returnTax, pack.reconciliation.returnTotal],
      ["Difference", pack.reconciliation.diffTaxable, pack.reconciliation.diffTax, pack.reconciliation.diffTotal],
    ]
  );

  pushSection(
    "2. SALES RATE-WISE (COMBINED)",
    ["Rate%", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total"],
    pack.salesRateSplit.combined.map((r) => [r.gstRate, r.taxableValue, r.cgst, r.sgst, r.igst, r.cess, r.totalAmount])
  );

  pushSection(
    "5. HSN SUMMARY",
    ["HSN", "Description", "UQC", "Qty", "Taxable", "CGST", "SGST", "IGST", "Cess"],
    pack.hsnSummary.map((r) => [r.hsnCode, r.description, r.uqc, r.totalQty, r.taxableValue, r.cgst, r.sgst, r.igst, r.cess])
  );

  pushSection(
    "7. PURCHASE REGISTER",
    ["Date", "Supplier", "GSTIN", "Invoice", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total"],
    pack.purchaseRegister.map((v) => [v.date, v.partyName, v.partyGstin, v.voucherNo, v.taxableValue, v.cgst, v.sgst, v.igst, v.cess, v.totalAmount])
  );

  pushSection(
    "12. COUNTER SUMMARY",
    ["Counter", "Bills", "Cash", "UPI", "Card", "CreditDue", "TotalSales"],
    pack.counterSummary.map((c) => [c.counter, c.billCount, c.cash, c.upi, c.card, c.creditDue, c.totalSales])
  );

  const bytes = new TextEncoder().encode(lines.join("\n"));
  const filename = `RetailSathi_CA_GST_Pack_${new Date().toISOString().slice(0, 10)}.csv`;
  return saveAndDownloadFile(filename, bytes, "text/csv;charset=utf-8");
}
