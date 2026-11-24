import { getDb } from "../../../services/database";
import { round2, STANDARD_GST_RATES } from "./gstTallyService";
import {
  GstHsnRow,
  GstRateSlabRow,
  GstStoreHeader,
  GstTallyReportBundle,
  GstVoucher,
  Gstr3bData,
  ReconciliationSummary,
} from "../types/gstTallyTypes";

export interface CaPackSyncInfo {
  lastSyncTime: string;
  unsyncedCount: number;
  hasUnsyncedWarning: boolean;
}

export interface CaPackRateSplit {
  b2b: GstRateSlabRow[];
  b2c: GstRateSlabRow[];
  combined: GstRateSlabRow[];
}

export interface CaPackCreditNoteRow {
  date: string;
  noteNo: string;
  originalInvoice: string;
  taxableValue: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CaPackItcReversalRow {
  date: string;
  referenceNo: string;
  partyOrItem: string;
  reason: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface CaPackCancelledBillRow {
  billNo: string;
  date: string;
  amount: number;
  cancelledBy: string;
  reason: string;
}

export interface CaPackCounterRow {
  counter: string;
  billCount: number;
  cash: number;
  upi: number;
  card: number;
  creditDue: number;
  totalSales: number;
}

export interface GstCaPackData {
  store: GstStoreHeader;
  periodLabel: string;
  generatedAt: string;
  amountThreshold: number;
  syncInfo: CaPackSyncInfo;
  reconciliation: ReconciliationSummary;
  mismatchVouchers: GstVoucher[];
  // Page 2
  salesRateSplit: CaPackRateSplit;
  // Page 3
  b2bSales: GstVoucher[];
  // Page 4
  salesReturns: CaPackCreditNoteRow[];
  // Page 5
  hsnSummary: GstHsnRow[];
  // Page 6
  docsIssued: {
    counter: string;
    documentType: string;
    seriesFrom: string;
    seriesTo: string;
    total: number;
    cancelled: number;
    netIssued: number;
  }[];
  // Page 7
  purchaseRegister: GstVoucher[];
  // Page 8
  purchaseReturns: GstVoucher[];
  // Page 9
  exemptSales: {
    voucherCount: number;
    nilRatedTaxable: number;
    exemptTaxable: number;
    nonGstTaxable: number;
    totalExemptSales: number;
  };
  // Page 10
  itcReversals: CaPackItcReversalRow[];
  ineligibleItc: GstVoucher[];
  // Page 11
  cancelledBills: CaPackCancelledBillRow[];
  // Page 12
  counterSummary: CaPackCounterRow[];
  // Page 13
  gstr3b: Gstr3bData;
}

/**
 * Formats a number using Indian digit grouping (e.g., 1,23,456.78).
 */
export function formatInr(val: number): string {
  const num = Number.isFinite(val) ? val : 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function buildRateRowsFromVouchers(vouchers: GstVoucher[]): GstRateSlabRow[] {
  const map = new Map<number, GstRateSlabRow>();
  for (const rate of STANDARD_GST_RATES) {
    map.set(rate, {
      gstRate: rate,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalAmount: 0,
      voucherIds: [],
    });
  }
  for (const v of vouchers) {
    for (const item of v.items) {
      const rate = Number(item.gstRate) || 0;
      let row = map.get(rate);
      if (!row) {
        row = {
          gstRate: rate,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
          totalAmount: 0,
          voucherIds: [],
        };
        map.set(rate, row);
      }
      row.taxableValue = round2(row.taxableValue + item.taxableValue);
      row.igst = round2(row.igst + item.igst);
      row.cgst = round2(row.cgst + item.cgst);
      row.sgst = round2(row.sgst + item.sgst);
      row.cess = round2(row.cess + item.cess);
      row.totalAmount = round2(row.totalAmount + item.totalAmount);
      if (!row.voucherIds.includes(v.id)) {
        row.voucherIds.push(v.id);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.gstRate - b.gstRate);
}

function parsePaymentBreakdown(
  paymentMode: string,
  grandTotal: number
): { cash: number; upi: number; card: number; creditDue: number } {
  const mode = (paymentMode || "").trim();
  const lower = mode.toLowerCase();

  let cash = 0;
  let upi = 0;
  let card = 0;
  let creditDue = 0;

  if (lower.includes("split")) {
    const cashMatch = mode.match(/Cash:\s*₹?\s*([\d.]+)/i);
    const upiMatch = mode.match(/UPI:\s*₹?\s*([\d.]+)/i);
    const cardMatch = mode.match(/Card:\s*₹?\s*([\d.]+)/i);
    const dueMatch = mode.match(/Due:\s*₹?\s*([\d.]+)/i);
    cash = cashMatch ? parseFloat(cashMatch[1]) || 0 : 0;
    upi = upiMatch ? parseFloat(upiMatch[1]) || 0 : 0;
    card = cardMatch ? parseFloat(cardMatch[1]) || 0 : 0;
    creditDue = dueMatch ? parseFloat(dueMatch[1]) || 0 : 0;
    return { cash: round2(cash), upi: round2(upi), card: round2(card), creditDue: round2(creditDue) };
  }

  const dueMatch = mode.match(/Due:\s*₹?\s*([\d.]+)/i);
  if (dueMatch) {
    creditDue = parseFloat(dueMatch[1]) || 0;
  }
  const paid = Math.max(0, round2(grandTotal - creditDue));

  if (lower.includes("upi")) upi = paid;
  else if (lower.includes("card")) card = paid;
  else if (lower === "due" || lower === "credit") creditDue = round2(grandTotal);
  else cash = paid;

  return { cash, upi, card, creditDue };
}

/**
 * Builds the 13-page CA Audit GST Report Pack from the Tally report bundle + local SQLite sync & payment data.
 */
export async function buildGstCaPackData(
  bundle: GstTallyReportBundle,
  amountThreshold: number = 500000
): Promise<GstCaPackData> {
  const db = await getDb();

  // 1. Sync info (offline check)
  let unsyncedCount = 0;
  let lastSyncTime = "Offline / Local Only";
  try {
    const syncRows = await db.select<{ cnt: number; last_ts: string | null }[]>(
      "SELECT COUNT(*) AS cnt, MAX(created_at) AS last_ts FROM sync_jobs"
    );
    if (syncRows.length > 0) {
      unsyncedCount = Number(syncRows[0].cnt) || 0;
    }
    const dsRows = await db.select<{ value: string }[]>(
      "SELECT value FROM device_settings WHERE key IN ('last_sync_at', 'last_synced_at') LIMIT 1"
    );
    if (dsRows.length > 0 && dsRows[0].value) {
      lastSyncTime = dsRows[0].value;
    } else if (unsyncedCount === 0) {
      lastSyncTime = "All local records synced";
    }
  } catch {
    // ignore if sync_jobs or device_settings not present
  }

  // 2. Payment modes for sales (for Page 12 Counter-wise summary)
  const paymentModeBySaleId = new Map<number, string>();
  try {
    const pmRows = await db.select<{ id: number; payment_mode: string }[]>(
      "SELECT id, payment_mode FROM sales"
    );
    for (const r of pmRows) {
      paymentModeBySaleId.set(r.id, r.payment_mode || "Cash");
    }
  } catch {
    // ignore
  }

  // 3. Filter out cancelled/draft bills only (do not exclude any valid vouchers)
  const cancelledBills: CaPackCancelledBillRow[] = [];
  const mismatchVouchers: GstVoucher[] = [];
  const validOutward: GstVoucher[] = [];

  for (const v of bundle.outwardVouchers) {
    const pm = (paymentModeBySaleId.get(v.rawId) || "").toLowerCase();
    const isCancelledOrDraft =
      pm.includes("cancel") ||
      pm.includes("draft") ||
      v.voucherNo.toUpperCase().startsWith("DRAFT-") ||
      v.voucherNo.toUpperCase().startsWith("CANC-");

    if (isCancelledOrDraft) {
      cancelledBills.push({
        billNo: v.voucherNo,
        date: v.date,
        amount: v.totalAmount,
        cancelledBy: "Cashier",
        reason: pm.includes("draft") ? "Draft" : "Cancelled",
      });
      continue;
    }

    validOutward.push(v);
  }

  const validInward: GstVoucher[] = [...bundle.inwardVouchers];

  // Reconciliation (Books vs Return)
  const booksOut = validOutward.concat(mismatchVouchers.filter((v) => v.direction === "outward"));
  const returnOut = validOutward.filter((v) => v.includedInReturn);
  const sumList = (list: GstVoucher[]) => ({
    taxable: round2(list.reduce((a, v) => a + v.taxableValue, 0)),
    tax: round2(list.reduce((a, v) => a + v.totalTax, 0)),
    total: round2(list.reduce((a, v) => a + v.totalAmount, 0)),
  });
  const booksSum = sumList(booksOut);
  const retSum = sumList(returnOut);

  const reconciliation: ReconciliationSummary = {
    booksTaxable: booksSum.taxable,
    booksTax: booksSum.tax,
    booksTotal: booksSum.total,
    returnTaxable: retSum.taxable,
    returnTax: retSum.tax,
    returnTotal: retSum.total,
    diffTaxable: round2(booksSum.taxable - retSum.taxable),
    diffTax: round2(booksSum.tax - retSum.tax),
    diffTotal: round2(booksSum.total - retSum.total),
  };

  // Page 2: Sales Summary Rate-wise (B2B vs B2C)
  const salesOnly = validOutward.filter((v) => v.voucherType === "Sales");
  const b2bSales = salesOnly.filter((v) => v.partyGstinValid);
  const b2cSales = salesOnly.filter((v) => !v.partyGstinValid);

  const salesRateSplit: CaPackRateSplit = {
    b2b: buildRateRowsFromVouchers(b2bSales),
    b2c: buildRateRowsFromVouchers(b2cSales),
    combined: buildRateRowsFromVouchers(salesOnly),
  };

  // Page 4: Sales Returns / Credit Notes
  const salesReturns: CaPackCreditNoteRow[] = validOutward
    .filter((v) => v.voucherType === "Credit Note")
    .map((v) => ({
      date: v.date,
      noteNo: v.voucherNo,
      originalInvoice: "-",
      taxableValue: v.taxableValue,
      taxAmount: v.totalTax,
      totalAmount: v.totalAmount,
    }));

  // Page 6: Documents Issued per counter
  const docsByCounter = new Map<string, string[]>();
  const cancelledByCounter = new Map<string, number>();
  for (const v of salesOnly) {
    const arr = docsByCounter.get(v.counter) || [];
    arr.push(v.voucherNo);
    docsByCounter.set(v.counter, arr);
  }
  for (const c of cancelledBills) {
    cancelledByCounter.set("Main Counter", (cancelledByCounter.get("Main Counter") || 0) + 1);
  }
  const docsIssued = Array.from(docsByCounter.entries()).map(([counter, nos]) => {
    const sorted = [...nos].sort();
    const cancelled = cancelledByCounter.get(counter) || 0;
    return {
      counter,
      documentType: "Tax Invoice (Outward Supply)",
      seriesFrom: sorted[0] || "-",
      seriesTo: sorted[sorted.length - 1] || "-",
      total: sorted.length + cancelled,
      cancelled,
      netIssued: sorted.length,
    };
  });
  if (docsIssued.length === 0) {
    docsIssued.push({
      counter: "Main Counter",
      documentType: "Tax Invoice (Outward Supply)",
      seriesFrom: "-",
      seriesTo: "-",
      total: cancelledBills.length,
      cancelled: cancelledBills.length,
      netIssued: 0,
    });
  }

  // Page 7 & 8: Purchases & Purchase Returns
  const purchaseRegister = validInward.filter((v) => v.voucherType === "Purchase");
  const purchaseReturns = validInward.filter((v) => v.voucherType === "Debit Note");

  // Page 9: Exempt / Nil-Rated Sales
  const zeroRateSales = salesOnly.filter((v) => v.totalTax === 0);
  const nilRatedTaxable = round2(zeroRateSales.reduce((a, v) => a + v.taxableValue, 0));

  // Page 10: ITC Reversal & Ineligible ITC
  const itcReversals: CaPackItcReversalRow[] = [];
  const ineligibleItc = purchaseRegister.filter((v) => !v.partyGstinValid && v.totalTax > 0);

  // Page 12: Counter-wise Sales Summary tied to day-end cash/UPI/card totals
  const counterMap = new Map<string, CaPackCounterRow>();
  for (const v of salesOnly) {
    let row = counterMap.get(v.counter);
    if (!row) {
      row = {
        counter: v.counter,
        billCount: 0,
        cash: 0,
        upi: 0,
        card: 0,
        creditDue: 0,
        totalSales: 0,
      };
      counterMap.set(v.counter, row);
    }
    const pm = paymentModeBySaleId.get(v.rawId) || "Cash";
    const split = parsePaymentBreakdown(pm, v.totalAmount);
    row.billCount += 1;
    row.cash = round2(row.cash + split.cash);
    row.upi = round2(row.upi + split.upi);
    row.card = round2(row.card + split.card);
    row.creditDue = round2(row.creditDue + split.creditDue);
    row.totalSales = round2(row.totalSales + v.totalAmount);
  }
  const counterSummary = Array.from(counterMap.values());

  return {
    store: bundle.store,
    periodLabel: bundle.periodLabel,
    generatedAt: bundle.generatedAt,
    amountThreshold,
    syncInfo: {
      lastSyncTime,
      unsyncedCount,
      hasUnsyncedWarning: unsyncedCount > 0,
    },
    reconciliation,
    mismatchVouchers,
    salesRateSplit,
    b2bSales,
    salesReturns,
    hsnSummary: bundle.hsnSummary,
    docsIssued,
    purchaseRegister,
    purchaseReturns,
    exemptSales: {
      voucherCount: zeroRateSales.length,
      nilRatedTaxable,
      exemptTaxable: 0,
      nonGstTaxable: 0,
      totalExemptSales: nilRatedTaxable,
    },
    itcReversals,
    ineligibleItc,
    cancelledBills,
    counterSummary,
    gstr3b: bundle.gstr3b,
  };
}
