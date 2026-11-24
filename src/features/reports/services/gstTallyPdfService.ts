import jsPDF from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { saveAndDownloadFile } from "./gstReportService";
import { round2 } from "./gstTallyService";
import {
  GstHsnRow,
  GstPageId,
  GstRateSlabRow,
  GstTallyReportBundle,
  GstVoucher,
  Gstr1SectionId,
  ReconciliationSummary,
  VoucherFilterContext,
} from "../types/gstTallyTypes";

export interface PdfExportContext {
  page: GstPageId;
  counter: string;
  sectionId?: Gstr1SectionId;
  voucher?: GstVoucher | null;
  filteredVouchers?: GstVoucher[];
  voucherContext?: VoucherFilterContext;
}

const fmt = (n: number) => n.toFixed(2);

function getReportTitle(ctx: PdfExportContext): string {
  switch (ctx.page) {
    case "home":
      return "GST REPORTS SUMMARY";
    case "gstr1_summary":
      return "GSTR-1 RETURN SUMMARY";
    case "gstr1_section":
      return `GSTR-1 SECTION VIEW (${(ctx.sectionId || "").toUpperCase()})`;
    case "voucher_register":
      return ctx.voucherContext?.title || "GST VOUCHER REGISTER";
    case "invoice_view":
      return `TAX INVOICE / VOUCHER VIEW — ${ctx.voucher?.voucherNo || ""}`;
    case "gstr3b":
      return "GSTR-3B SUMMARY RETURN";
    case "hsn_summary":
      return "HSN-WISE SUMMARY OF OUTWARD SUPPLIES";
    case "rate_summary":
      return "TAX RATE-WISE SUMMARY";
    case "input_output":
      return "INPUT vs OUTPUT TAX RECONCILIATION";
    default:
      return "GST REPORT";
  }
}

function getReconciliationForPage(
  bundle: GstTallyReportBundle,
  ctx: PdfExportContext
): ReconciliationSummary {
  if (ctx.page === "gstr3b" || ctx.page === "input_output") {
    return bundle.reconciliation.combined;
  }
  return bundle.reconciliation.outward;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 30) {
    doc.addPage();
    y = 30;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 10, y);
  return y + 3;
}

function runTable(
  doc: jsPDF,
  startY: number,
  options: Omit<UserOptions, "startY" | "margin">
): number {
  autoTable(doc, {
    startY,
    margin: { top: 28, left: 10, right: 10, bottom: 15 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 2,
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
  return ((doc as any).lastAutoTable?.finalY ?? startY) + 6;
}

function applyHeadersAndFooters(
  doc: jsPDF,
  bundle: GstTallyReportBundle,
  title: string,
  counter: string
) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(bundle.store.name.toUpperCase(), 10, 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, pageWidth - 10, 10, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const gstinStr = `GSTIN: ${bundle.store.gstin || "Not Set"}  |  State: ${
      bundle.store.stateCode ? `${bundle.store.stateCode} - ` : ""
    }${bundle.store.stateName}`;
    doc.text(gstinStr, 10, 15.5);

    const periodStr = `Period: ${bundle.periodLabel}  |  Counter: ${
      counter === "ALL" ? "All Counters" : counter
    }`;
    doc.text(periodStr, pageWidth - 10, 15.5, { align: "right" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(10, 19, pageWidth - 10, 19);

    // Footer
    doc.setLineWidth(0.2);
    doc.line(10, pageHeight - 11, pageWidth - 10, pageHeight - 11);
    doc.setFontSize(7.5);
    doc.text(`Generated: ${bundle.generatedAt} | RetailSathi GST`, 10, pageHeight - 6.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6.5, { align: "right" });
  }
}

function renderHsnTable(
  doc: jsPDF,
  title: string,
  rows: GstHsnRow[],
  startY: number
): number {
  let y = drawSectionTitle(doc, title, startY);
  return runTable(doc, y, {
    head: [["HSN", "Description", "UQC", "Total Qty", "Total Value", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]],
    body:
      rows.length > 0
        ? rows.map((r) => [
            r.hsnCode,
            r.description,
            r.uqc,
            String(r.totalQty),
            fmt(r.totalValue),
            fmt(r.taxableValue),
            fmt(r.igst),
            fmt(r.cgst),
            fmt(r.sgst),
            fmt(r.cess),
          ])
        : [["-", "No HSN records in selected period", "-", "0", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"]],
    foot: [[
      "TOTAL",
      "",
      "",
      String(rows.reduce((a, r) => a + r.totalQty, 0)),
      fmt(rows.reduce((a, r) => a + r.totalValue, 0)),
      fmt(rows.reduce((a, r) => a + r.taxableValue, 0)),
      fmt(rows.reduce((a, r) => a + r.igst, 0)),
      fmt(rows.reduce((a, r) => a + r.cgst, 0)),
      fmt(rows.reduce((a, r) => a + r.sgst, 0)),
      fmt(rows.reduce((a, r) => a + r.cess, 0)),
    ]],
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });
}

function renderRateSummaryTable(
  doc: jsPDF,
  title: string,
  rows: GstRateSlabRow[],
  startY: number
): number {
  const y = drawSectionTitle(doc, title, startY);
  return runTable(doc, y, {
    head: [["Rate (%)", "Taxable Value", "IGST", "CGST", "SGST", "Cess", "Total"]],
    body: rows.map((r) => [
      `${r.gstRate}%`,
      fmt(r.taxableValue),
      fmt(r.igst),
      fmt(r.cgst),
      fmt(r.sgst),
      fmt(r.cess),
      fmt(r.totalAmount),
    ]),
    foot: [[
      "TOTAL",
      fmt(rows.reduce((a, r) => a + r.taxableValue, 0)),
      fmt(rows.reduce((a, r) => a + r.igst, 0)),
      fmt(rows.reduce((a, r) => a + r.cgst, 0)),
      fmt(rows.reduce((a, r) => a + r.sgst, 0)),
      fmt(rows.reduce((a, r) => a + r.cess, 0)),
      fmt(rows.reduce((a, r) => a + r.totalAmount, 0)),
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

export async function exportGstTallyPdf(
  bundle: GstTallyReportBundle,
  ctx: PdfExportContext
): Promise<{ success: boolean; filePath?: string }> {
  const isLandscape =
    ctx.page === "gstr1_summary" ||
    ctx.page === "gstr1_section" ||
    ctx.page === "hsn_summary" ||
    ctx.page === "voucher_register" ||
    ctx.page === "invoice_view";

  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const title = getReportTitle(ctx);
  let y = 26;

  if (ctx.page === "home") {
    const rec = getReconciliationForPage(bundle, ctx);
    y = renderRateSummaryTable(doc, "TAX RATE-WISE SUMMARY", bundle.rateSummary, y);
    y = drawSectionTitle(doc, "RECONCILIATION: BOOKS TOTAL vs RETURN TOTAL", y);
    y = runTable(doc, y, {
      head: [["Particulars", "Taxable Value", "Total Tax", "Invoice Total"]],
      body: [
        ["As per Books", fmt(rec.booksTaxable), fmt(rec.booksTax), fmt(rec.booksTotal)],
        ["Included in Return", fmt(rec.returnTaxable), fmt(rec.returnTax), fmt(rec.returnTotal)],
        ["Difference (Books - Return)", fmt(rec.diffTaxable), fmt(rec.diffTax), fmt(rec.diffTotal)],
      ],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = renderHsnTable(doc, "SALES DATA — HSN-WISE SUMMARY (OUTWARD)", bundle.hsnSummary, y);
    y = renderHsnTable(doc, "PURCHASE DATA — HSN-WISE SUMMARY (INWARD)", bundle.purchaseHsnSummary, y);
  } else if (ctx.page === "gstr1_summary") {
    y = drawSectionTitle(doc, "GSTR-1 VOUCHER STATUS SUMMARY", y);
    y = runTable(doc, y, {
      head: [["Particulars", "Voucher Count"]],
      body: [
        ["Total Vouchers", String(bundle.gstr1.totalVouchers)],
        ["Included in Return", String(bundle.gstr1.includedInReturn)],
        ["Not Relevant for Return", String(bundle.gstr1.notRelevant)],
        ["Incomplete / Mismatch in Information", String(bundle.gstr1.incompleteCount)],
      ],
      columnStyles: { 1: { halign: "right" } },
    });

    y = drawSectionTitle(doc, "GSTR-1 SECTION-WISE SUMMARY", y);
    const supplySections = bundle.gstr1.sections.filter(
      (r) => r.sectionId !== "hsn" && r.sectionId !== "docs"
    );
    const totals = supplySections.reduce(
      (acc, r) => ({
        count: acc.count + r.voucherCount,
        taxable: round2(acc.taxable + r.taxableValue),
        igst: round2(acc.igst + r.igst),
        cgst: round2(acc.cgst + r.cgst),
        sgst: round2(acc.sgst + r.sgst),
        cess: round2(acc.cess + r.cess),
        inv: round2(acc.inv + r.invoiceAmount),
      }),
      { count: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, inv: 0 }
    );
    y = runTable(doc, y, {
      head: [["Table No.", "Particulars", "Vouchers", "Taxable Value", "IGST", "CGST", "SGST", "Cess", "Invoice Amt"]],
      body: bundle.gstr1.sections.map((r) => [
        r.tableNo,
        r.particulars,
        String(r.voucherCount),
        fmt(r.taxableValue),
        fmt(r.igst),
        fmt(r.cgst),
        fmt(r.sgst),
        fmt(r.cess),
        fmt(r.invoiceAmount),
      ]),
      foot: [[
        "",
        "TOTAL",
        String(totals.count),
        fmt(totals.taxable),
        fmt(totals.igst),
        fmt(totals.cgst),
        fmt(totals.sgst),
        fmt(totals.cess),
        fmt(totals.inv),
      ]],
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
    });
  } else if (ctx.page === "gstr1_section") {
    const sec = ctx.sectionId || "b2b";
    if (sec === "b2cs") {
      y = drawSectionTitle(doc, "TABLE 7: B2C (SMALL) — STATE & RATE-WISE", y);
      const rows = bundle.gstr1.b2csRows;
      y = runTable(doc, y, {
        head: [["State", "Rate (%)", "Vouchers", "Taxable Value", "IGST", "CGST", "SGST", "Cess", "Total"]],
        body: rows.map((r) => [
          `${r.stateCode} - ${r.stateName}`,
          `${r.gstRate}%`,
          String(r.voucherCount),
          fmt(r.taxableValue),
          fmt(r.igst),
          fmt(r.cgst),
          fmt(r.sgst),
          fmt(r.cess),
          fmt(r.totalAmount),
        ]),
        foot: [[
          "TOTAL",
          "",
          String(rows.reduce((a, r) => a + r.voucherCount, 0)),
          fmt(rows.reduce((a, r) => a + r.taxableValue, 0)),
          fmt(rows.reduce((a, r) => a + r.igst, 0)),
          fmt(rows.reduce((a, r) => a + r.cgst, 0)),
          fmt(rows.reduce((a, r) => a + r.sgst, 0)),
          fmt(rows.reduce((a, r) => a + r.cess, 0)),
          fmt(rows.reduce((a, r) => a + r.totalAmount, 0)),
        ]],
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
        },
      });
    } else if (sec === "hsn") {
      y = drawSectionTitle(doc, "TABLE 12: HSN-WISE SUMMARY", y);
      const rows = bundle.gstr1.hsnRows;
      y = runTable(doc, y, {
        head: [["HSN", "Description", "UQC", "Total Qty", "Total Value", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]],
        body: rows.map((r) => [
          r.hsnCode,
          r.description,
          r.uqc,
          String(r.totalQty),
          fmt(r.totalValue),
          fmt(r.taxableValue),
          fmt(r.igst),
          fmt(r.cgst),
          fmt(r.sgst),
          fmt(r.cess),
        ]),
        foot: [[
          "TOTAL",
          "",
          "",
          String(rows.reduce((a, r) => a + r.totalQty, 0)),
          fmt(rows.reduce((a, r) => a + r.totalValue, 0)),
          fmt(rows.reduce((a, r) => a + r.taxableValue, 0)),
          fmt(rows.reduce((a, r) => a + r.igst, 0)),
          fmt(rows.reduce((a, r) => a + r.cgst, 0)),
          fmt(rows.reduce((a, r) => a + r.sgst, 0)),
          fmt(rows.reduce((a, r) => a + r.cess, 0)),
        ]],
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
          9: { halign: "right" },
        },
      });
    } else if (sec === "docs") {
      y = drawSectionTitle(doc, "TABLE 13: DOCUMENTS ISSUED", y);
      y = runTable(doc, y, {
        head: [["Document Type", "Series From", "Series To", "Total", "Cancelled", "Net Issued"]],
        body: bundle.gstr1.docsIssued.map((d) => [
          d.documentType,
          d.seriesFrom,
          d.seriesTo,
          String(d.totalIssued),
          String(d.cancelled),
          String(d.netIssued),
        ]),
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
      });
    } else {
      const list =
        sec === "b2b"
          ? bundle.gstr1.b2bVouchers
          : sec === "b2cl"
          ? bundle.gstr1.b2clVouchers
          : sec === "nil_exempt"
          ? bundle.gstr1.nilExemptVouchers
          : sec === "cdnr"
          ? bundle.gstr1.cdnrVouchers
          : sec === "incomplete"
          ? bundle.gstr1.incompleteVouchers
          : bundle.gstr1.notRelevantVouchers;
      y = drawSectionTitle(doc, `GSTR-1 SECTION: ${sec.toUpperCase()}`, y);
      y = runTable(doc, y, {
        head: [["Party Name", "GSTIN", "Invoice No", "Date", "Taxable", "IGST", "CGST", "SGST", "Cess", "Total"]],
        body: list.map((v) => [
          v.partyName,
          v.partyGstin || "-",
          v.voucherNo,
          v.date,
          fmt(v.taxableValue),
          fmt(v.igst),
          fmt(v.cgst),
          fmt(v.sgst),
          fmt(v.cess),
          fmt(v.totalAmount),
        ]),
        foot: [[
          "TOTAL",
          "",
          "",
          "",
          fmt(list.reduce((a, v) => a + v.taxableValue, 0)),
          fmt(list.reduce((a, v) => a + v.igst, 0)),
          fmt(list.reduce((a, v) => a + v.cgst, 0)),
          fmt(list.reduce((a, v) => a + v.sgst, 0)),
          fmt(list.reduce((a, v) => a + v.cess, 0)),
          fmt(list.reduce((a, v) => a + v.totalAmount, 0)),
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
  } else if (ctx.page === "voucher_register") {
    const list = ctx.filteredVouchers || bundle.allVouchers;
    y = drawSectionTitle(doc, ctx.voucherContext?.title || "VOUCHER REGISTER", y);
    y = runTable(doc, y, {
      head: [["Date", "Particulars", "Voucher Type", "Voucher No.", "Counter", "Party GSTIN", "Taxable", "Tax", "Total"]],
      body: list.map((v) => [
        v.date,
        v.partyName,
        v.voucherType,
        v.voucherNo,
        v.counter,
        v.partyGstin || "-",
        fmt(v.taxableValue),
        fmt(v.totalTax),
        fmt(v.totalAmount),
      ]),
      foot: [[
        "TOTAL",
        `${list.length} vouchers`,
        "",
        "",
        "",
        "",
        fmt(list.reduce((a, v) => a + v.taxableValue, 0)),
        fmt(list.reduce((a, v) => a + v.totalTax, 0)),
        fmt(list.reduce((a, v) => a + v.totalAmount, 0)),
      ]],
      columnStyles: {
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
    });
  } else if (ctx.page === "invoice_view" && ctx.voucher) {
    const v = ctx.voucher;
    y = drawSectionTitle(
      doc,
      `${v.voucherType.toUpperCase()} #${v.voucherNo} | Date: ${v.date} | Party: ${v.partyName} (${v.partyGstin || "Unregistered"}) | POS: ${v.placeOfSupplyName}`,
      y
    );
    y = runTable(doc, y, {
      head: [["#", "Item", "HSN", "UQC", "Qty", "Rate", "Taxable", "GST%", "CGST", "SGST", "IGST", "Cess", "Total"]],
      body: v.items.map((it, idx) => [
        String(idx + 1),
        it.productName,
        it.hsnCode || "-",
        it.uqc,
        String(it.quantity),
        fmt(it.rate),
        fmt(it.taxableValue),
        `${it.gstRate}%`,
        fmt(it.cgst),
        fmt(it.sgst),
        fmt(it.igst),
        fmt(it.cess),
        fmt(it.totalAmount),
      ]),
      foot: [[
        "",
        "TOTAL",
        "",
        "",
        String(v.items.reduce((a, i) => a + i.quantity, 0)),
        "",
        fmt(v.taxableValue),
        "",
        fmt(v.cgst),
        fmt(v.sgst),
        fmt(v.igst),
        fmt(v.cess),
        fmt(v.totalAmount),
      ]],
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
        12: { halign: "right" },
      },
    });
  } else if (ctx.page === "gstr3b") {
    y = drawSectionTitle(doc, "3.1 OUTWARD SUPPLIES AND REVERSE-CHARGE INWARD SUPPLIES", y);
    y = runTable(doc, y, {
      head: [["Table", "Nature of Supplies", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]],
      body: bundle.gstr3b.table31.map((r) => [
        r.code,
        r.particulars,
        fmt(r.taxableValue),
        fmt(r.igst),
        fmt(r.cgst),
        fmt(r.sgst),
        fmt(r.cess),
      ]),
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });

    y = drawSectionTitle(doc, "3.2 INTER-STATE SUPPLIES TO UNREGISTERED PERSONS", y);
    y = runTable(doc, y, {
      head: [["Place of Supply (State)", "Taxable Value", "IGST"]],
      body:
        bundle.gstr3b.table32.length > 0
          ? bundle.gstr3b.table32.map((r) => [`${r.stateCode} - ${r.stateName}`, fmt(r.taxableValue), fmt(r.igst)])
          : [["No inter-state unregistered supplies", "0.00", "0.00"]],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });

    y = drawSectionTitle(doc, "4. ELIGIBLE ITC", y);
    y = runTable(doc, y, {
      head: [["Table", "Details", "Taxable Value", "IGST", "CGST", "SGST", "Cess"]],
      body: bundle.gstr3b.table4.map((r) => [
        r.code,
        r.particulars,
        fmt(r.taxableValue),
        fmt(r.igst),
        fmt(r.cgst),
        fmt(r.sgst),
        fmt(r.cess),
      ]),
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });

    y = drawSectionTitle(doc, "5. EXEMPT, NIL-RATED AND NON-GST INWARD SUPPLIES", y);
    y = runTable(doc, y, {
      head: [["Table", "Nature of Supplies", "Inter-State", "Intra-State"]],
      body: bundle.gstr3b.table5.map((r) => [r.code, r.particulars, fmt(r.interState), fmt(r.intraState)]),
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    });

    y = drawSectionTitle(doc, "6.1 PAYMENT OF TAX", y);
    y = runTable(doc, y, {
      head: [["Description", "Tax Payable", "ITC Used", "Cash Paid"]],
      body: bundle.gstr3b.table61.map((r) => [
        r.taxHead,
        fmt(r.taxPayable),
        fmt(r.itcUsed),
        fmt(r.cashPaid),
      ]),
      foot: [[
        "TOTAL",
        fmt(bundle.gstr3b.table61.reduce((a, r) => a + r.taxPayable, 0)),
        fmt(bundle.gstr3b.table61.reduce((a, r) => a + r.itcUsed, 0)),
        fmt(bundle.gstr3b.table61.reduce((a, r) => a + r.cashPaid, 0)),
      ]],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = renderHsnTable(doc, "SALES DATA — HSN-WISE SUMMARY (OUTWARD)", bundle.hsnSummary, y);
    y = renderHsnTable(doc, "PURCHASE DATA — HSN-WISE SUMMARY (INWARD)", bundle.purchaseHsnSummary, y);
    y = renderRateSummaryTable(doc, "TAX RATE-WISE SUMMARY", bundle.rateSummary, y);
  } else if (ctx.page === "hsn_summary") {
    y = renderHsnTable(doc, "TABLE 12: SALES DATA — HSN-WISE SUMMARY (OUTWARD SUPPLIES)", bundle.hsnSummary, y);
    y = renderHsnTable(doc, "PURCHASE DATA — HSN-WISE SUMMARY (INWARD SUPPLIES)", bundle.purchaseHsnSummary, y);
    y = renderRateSummaryTable(doc, "TAX RATE-WISE SUMMARY", bundle.rateSummary, y);
  } else if (ctx.page === "rate_summary") {
    y = renderRateSummaryTable(doc, "TAX RATE-WISE SUMMARY", bundle.rateSummary, y);
  } else if (ctx.page === "input_output") {
    y = drawSectionTitle(doc, "INPUT vs OUTPUT TAX RECONCILIATION", y);
    y = runTable(doc, y, {
      head: [["Tax Head", "Output Tax (Sales)", "Input Tax (ITC)", "Net Payable / (Carry Forward)"]],
      body: bundle.inputVsOutput.map((r) => [
        r.taxHead,
        fmt(r.outputTax),
        fmt(r.inputTax),
        fmt(r.netPayable),
      ]),
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });
    y = renderHsnTable(doc, "SALES DATA — HSN-WISE SUMMARY (OUTWARD)", bundle.hsnSummary, y);
    y = renderHsnTable(doc, "PURCHASE DATA — HSN-WISE SUMMARY (INWARD)", bundle.purchaseHsnSummary, y);
    y = renderRateSummaryTable(doc, "TAX RATE-WISE SUMMARY", bundle.rateSummary, y);
  }

  // Reconciliation Block at the end of every PDF (except home, where it is placed at the top)
  if (ctx.page !== "home") {
    const rec = getReconciliationForPage(bundle, ctx);
    y = drawSectionTitle(doc, "RECONCILIATION: BOOKS TOTAL vs RETURN TOTAL", y);
    runTable(doc, y, {
      head: [["Particulars", "Taxable Value", "Total Tax", "Invoice Total"]],
      body: [
        ["As per Books", fmt(rec.booksTaxable), fmt(rec.booksTax), fmt(rec.booksTotal)],
        ["Included in Return", fmt(rec.returnTaxable), fmt(rec.returnTax), fmt(rec.returnTotal)],
        ["Difference (Books - Return)", fmt(rec.diffTaxable), fmt(rec.diffTax), fmt(rec.diffTotal)],
      ],
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }

  applyHeadersAndFooters(doc, bundle, title, ctx.counter);

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const filename = `RetailSathi_${ctx.page}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return saveAndDownloadFile(filename, bytes, "application/pdf");
}
