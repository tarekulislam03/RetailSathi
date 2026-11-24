import { getDb } from "../../../services/database";
import { getActiveOrFirstStore } from "../../stores/services/storeService";
import {
  GstDocIssuedRow,
  GstHsnRow,
  GstRateSlabRow,
  GstStoreHeader,
  GstTallyFilter,
  GstTallyReportBundle,
  GstVoucher,
  GstVoucherLineItem,
  Gstr1B2csRow,
  Gstr1SectionId,
  Gstr1SectionRow,
  Gstr1SummaryData,
  Gstr3bData,
  Gstr3bPaymentRow,
  Gstr3bStateRow,
  Gstr3bTaxRow,
  InputOutputRow,
  MismatchReason,
  ReconciliationSummary,
} from "../types/gstTallyTypes";

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const STANDARD_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function isValidGstin(gstin?: string | null): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(clean)) return false;
  return Boolean(GST_STATE_CODES[clean.slice(0, 2)]);
}

export function getStateFromGstin(gstin?: string | null): { code: string; name: string } | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length < 2) return null;
  const code = clean.slice(0, 2);
  const name = GST_STATE_CODES[code];
  if (!name) return null;
  return { code, name };
}

export function inferStateFromAddress(address?: string | null): { code: string; name: string } | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const [code, name] of Object.entries(GST_STATE_CODES)) {
    if (lower.includes(name.toLowerCase())) {
      return { code, name };
    }
  }
  return null;
}

function normalizeDate(rawDate?: string | null): string {
  if (!rawDate) return "";
  const trimmed = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return trimmed.slice(0, 10);
}

function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!dateStr) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

function formatPeriodLabel(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Up to ${endDate}`;
  return "All Time";
}

function computeLineTax(
  totalAmount: number,
  gstRate: number,
  isInterState: boolean
): { taxableValue: number; igst: number; cgst: number; sgst: number; totalTax: number } {
  if (gstRate <= 0) {
    return {
      taxableValue: round2(totalAmount),
      igst: 0,
      cgst: 0,
      sgst: 0,
      totalTax: 0,
    };
  }
  const taxableValue = round2(totalAmount / (1 + gstRate / 100));
  const totalTax = round2(totalAmount - taxableValue);
  if (isInterState) {
    return { taxableValue, igst: totalTax, cgst: 0, sgst: 0, totalTax };
  }
  const cgst = round2(totalTax / 2);
  const sgst = round2(totalTax - cgst);
  return { taxableValue, igst: 0, cgst, sgst, totalTax };
}

function buildReconciliation(
  booksVouchers: GstVoucher[],
  returnVouchers: GstVoucher[]
): ReconciliationSummary {
  const sum = (list: GstVoucher[]) =>
    list.reduce(
      (acc, v) => ({
        taxable: round2(acc.taxable + v.taxableValue),
        tax: round2(acc.tax + v.totalTax),
        total: round2(acc.total + v.totalAmount),
      }),
      { taxable: 0, tax: 0, total: 0 }
    );

  const books = sum(booksVouchers);
  const ret = sum(returnVouchers);
  return {
    booksTaxable: books.taxable,
    booksTax: books.tax,
    booksTotal: books.total,
    returnTaxable: ret.taxable,
    returnTax: ret.tax,
    returnTotal: ret.total,
    diffTaxable: round2(books.taxable - ret.taxable),
    diffTax: round2(books.tax - ret.tax),
    diffTotal: round2(books.total - ret.total),
  };
}

/**
 * Fetches and computes the complete GST report bundle.
 */
export async function fetchGstTallyReportBundle(
  filter?: Partial<GstTallyFilter>
): Promise<GstTallyReportBundle> {
  const db = await getDb();

  // 1. Store info & state resolution
  let storeHeader: GstStoreHeader = {
    name: "Retail Sathi",
    gstin: "",
    stateCode: "",
    stateName: "State Not Set",
    address: "",
  };

  try {
    const store = await getActiveOrFirstStore();
    if (store) {
      const gstin = (store.gstin || "").trim().toUpperCase();
      const stateFromGstin = getStateFromGstin(gstin) || inferStateFromAddress(store.address);
      storeHeader = {
        name: store.name || "Retail Sathi",
        gstin,
        stateCode: stateFromGstin?.code || "",
        stateName: stateFromGstin?.name || "State Not Set",
        address: store.address || "",
      };
    }
  } catch (err) {
    console.warn("[GST-Tally] Could not load store:", err);
  }

  // 2. Fetch sales & sale_items safely
  const salesRows = await db.select<any[]>(`
    SELECT id, invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, created_at
    FROM sales
    ORDER BY created_at DESC, id DESC
  `);

  const saleItemRows = await db.select<any[]>(`
    SELECT 
      si.id AS item_id,
      si.sale_id,
      si.invoice_no,
      si.product_id,
      si.product_name,
      si.barcode,
      si.price,
      si.quantity,
      si.total_price,
      COALESCE(pr.hsn_code, '') AS hsn_code,
      pr.gst_rate AS raw_gst_rate,
      COALESCE(pr.gst_rate, 0) AS gst_rate
    FROM sale_items si
    LEFT JOIN products pr ON si.product_id = pr.id
    ORDER BY si.id ASC
  `);

  // Group sale items by sale_id or invoice_no (deduplicated by item_id)
  const itemsBySaleId = new Map<number, any[]>();
  const itemsByInvoiceNo = new Map<string, any[]>();
  const seenSaleItemIds = new Set<number>();

  for (const item of saleItemRows) {
    if (item.item_id != null) {
      if (seenSaleItemIds.has(item.item_id)) continue;
      seenSaleItemIds.add(item.item_id);
    }
    if (item.sale_id != null) {
      const arr = itemsBySaleId.get(item.sale_id) || [];
      arr.push(item);
      itemsBySaleId.set(item.sale_id, arr);
    } else if (item.invoice_no) {
      const arr = itemsByInvoiceNo.get(item.invoice_no) || [];
      arr.push(item);
      itemsByInvoiceNo.set(item.invoice_no, arr);
    }
  }

  // 3. Fetch purchases & purchase_items safely
  const purchaseRows = await db.select<any[]>(`
    SELECT id, supplier_name, invoice_no, purchase_date, gst_no, contact_no, total_amount, created_at
    FROM purchases
    ORDER BY COALESCE(purchase_date, created_at) DESC, id DESC
  `);

  const purchaseItemRows = await db.select<any[]>(`
    SELECT 
      pi.id AS item_id,
      pi.purchase_id,
      pi.product_id,
      pi.product_name,
      pi.barcode,
      pi.hsn_code,
      pi.purchase_price,
      pi.gst_rate AS raw_gst_rate,
      pi.quantity,
      pi.subtotal,
      COALESCE(
        pi.gst_rate,
        pr.gst_rate,
        (SELECT pr2.gst_rate FROM products pr2 WHERE pr2.barcode = pi.barcode AND pi.barcode IS NOT NULL AND pi.barcode != '' LIMIT 1),
        0
      ) AS gst_rate
    FROM purchase_items pi
    LEFT JOIN products pr ON pi.product_id = pr.id
    ORDER BY pi.id ASC
  `);

  const itemsByPurchaseId = new Map<number, any[]>();
  const seenPurchaseItemIds = new Set<number>();
  for (const item of purchaseItemRows) {
    if (item.item_id != null) {
      if (seenPurchaseItemIds.has(item.item_id)) continue;
      seenPurchaseItemIds.add(item.item_id);
    }
    const arr = itemsByPurchaseId.get(item.purchase_id) || [];
    arr.push(item);
    itemsByPurchaseId.set(item.purchase_id, arr);
  }

  // 4. Build Outward Vouchers
  const allOutward: GstVoucher[] = [];
  const counterSet = new Set<string>(["Main Counter"]);

  for (const s of salesRows) {
    const dateStr = normalizeDate(s.created_at);
    if (!isDateInRange(dateStr, filter?.startDate, filter?.endDate)) continue;

    const counter = "Main Counter";
    counterSet.add(counter);

    const rawItems =
      itemsBySaleId.get(s.id) ||
      (s.invoice_no ? itemsByInvoiceNo.get(s.invoice_no) : undefined) ||
      [];

    const invNo = String(s.invoice_no || `S-${s.id}`);
    const isCreditNote = Number(s.grand_total) < 0 || invNo.toUpperCase().startsWith("CN-");
    const voucherType: GstVoucher["voucherType"] = isCreditNote ? "Credit Note" : "Sales";

    const partyGstin = String(s.customer_gstin || "").trim().toUpperCase();
    const partyGstinValid = isValidGstin(partyGstin);
    const posState = getStateFromGstin(partyGstin) || (storeHeader.stateCode ? { code: storeHeader.stateCode, name: storeHeader.stateName } : null);
    const isInterState = Boolean(
      storeHeader.stateCode && posState?.code && posState.code !== storeHeader.stateCode
    );

    const mismatchSet = new Set<MismatchReason>();
    if (partyGstin && !partyGstinValid) {
      mismatchSet.add("Invalid GSTIN");
    }
    if (!posState?.code) {
      mismatchSet.add("Missing Place of Supply");
    }

    const lineItems: GstVoucherLineItem[] = rawItems.map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.price) || 0;
      const total =
        it.total_price !== null && it.total_price !== undefined
          ? Number(it.total_price) || 0
          : round2(rate * qty);
      const gstRate = Number(it.gst_rate) || 0;
      const hsnCode = String(it.hsn_code || "").trim();
      const hasMissingHsn = !hsnCode;
      const hasMissingRate = it.raw_gst_rate === null || it.raw_gst_rate === undefined;
      if (hasMissingHsn) mismatchSet.add("Missing HSN");
      if (hasMissingRate) mismatchSet.add("Missing GST Rate");

      const tax = computeLineTax(total, gstRate, isInterState);
      return {
        id: `SL-${it.item_id ?? idx}`,
        productName: it.product_name || "Unknown Item",
        barcode: it.barcode || "",
        hsnCode,
        uqc: "PCS",
        quantity: qty,
        rate,
        taxableValue: tax.taxableValue,
        gstRate,
        igst: tax.igst,
        cgst: tax.cgst,
        sgst: tax.sgst,
        cess: 0,
        totalAmount: round2(total),
        hasMissingHsn,
        hasMissingRate,
      };
    });

    const taxableValue = round2(lineItems.reduce((a, i) => a + i.taxableValue, 0));
    const igst = round2(lineItems.reduce((a, i) => a + i.igst, 0));
    const cgst = round2(lineItems.reduce((a, i) => a + i.cgst, 0));
    const sgst = round2(lineItems.reduce((a, i) => a + i.sgst, 0));
    const totalTax = round2(igst + cgst + sgst);
    const totalAmount = round2(lineItems.reduce((a, i) => a + i.totalAmount, 0) || Number(s.grand_total) || 0);

    const mismatchReasons = Array.from(mismatchSet);
    const notRelevantForReturn = lineItems.length === 0 && totalAmount === 0;
    const includedInReturn = !notRelevantForReturn && mismatchReasons.length === 0;

    let gstr1Section: Gstr1SectionId | null = null;
    if (notRelevantForReturn) {
      gstr1Section = "not_relevant";
    } else if (!includedInReturn) {
      gstr1Section = "incomplete";
    } else if (isCreditNote) {
      gstr1Section = "cdnr";
    } else if (partyGstinValid) {
      gstr1Section = "b2b";
    } else if (isInterState && Math.abs(totalAmount) > 250000) {
      gstr1Section = "b2cl";
    } else if (lineItems.length > 0 && lineItems.every((i) => i.gstRate === 0)) {
      gstr1Section = "nil_exempt";
    } else {
      gstr1Section = "b2cs";
    }

    allOutward.push({
      id: `S-${s.id}`,
      rawId: s.id,
      direction: "outward",
      voucherType,
      voucherNo: invNo,
      date: dateStr,
      counter,
      partyName: s.customer_name || "Walk-in Customer",
      partyGstin,
      partyGstinValid,
      placeOfSupplyCode: posState?.code || "",
      placeOfSupplyName: posState?.name || "Unknown",
      isInterState,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess: 0,
      totalTax,
      totalAmount,
      items: lineItems,
      mismatchReasons,
      includedInReturn,
      notRelevantForReturn,
      gstr1Section,
    });
  }

  // 5. Build Inward Vouchers (Purchases)
  const allInward: GstVoucher[] = [];
  for (const p of purchaseRows) {
    const dateStr = normalizeDate(p.purchase_date || p.created_at);
    if (!isDateInRange(dateStr, filter?.startDate, filter?.endDate)) continue;

    const counter = "Main Counter";
    const rawItems = itemsByPurchaseId.get(p.id) || [];
    const invNo = String(p.invoice_no || `P-${p.id}`);
    const isDebitNote = Number(p.total_amount) < 0 || invNo.toUpperCase().startsWith("DN-");
    const voucherType: GstVoucher["voucherType"] = isDebitNote ? "Debit Note" : "Purchase";

    const partyGstin = String(p.gst_no || "").trim().toUpperCase();
    const partyGstinValid = isValidGstin(partyGstin);
    const posState = getStateFromGstin(partyGstin) || (storeHeader.stateCode ? { code: storeHeader.stateCode, name: storeHeader.stateName } : null);
    const isInterState = Boolean(
      storeHeader.stateCode && posState?.code && posState.code !== storeHeader.stateCode
    );

    const mismatchSet = new Set<MismatchReason>();
    if (!partyGstin) {
      mismatchSet.add("Missing GSTIN");
    } else if (!partyGstinValid) {
      mismatchSet.add("Invalid GSTIN");
    }

    const lineItems: GstVoucherLineItem[] = rawItems.map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.purchase_price) || 0;
      const total = Number(it.subtotal) || round2(rate * qty);
      const gstRate = Number(it.gst_rate) || 0;
      const hsnCode = String(it.hsn_code || "").trim();
      const hasMissingHsn = !hsnCode;
      const hasMissingRate = it.raw_gst_rate === null || it.raw_gst_rate === undefined;
      if (hasMissingHsn) mismatchSet.add("Missing HSN");
      if (hasMissingRate) mismatchSet.add("Missing GST Rate");

      const tax = computeLineTax(total, gstRate, isInterState);
      return {
        id: `PL-${it.item_id ?? idx}`,
        productName: it.product_name || "Unknown Item",
        barcode: it.barcode || "",
        hsnCode,
        uqc: "PCS",
        quantity: qty,
        rate,
        taxableValue: tax.taxableValue,
        gstRate,
        igst: tax.igst,
        cgst: tax.cgst,
        sgst: tax.sgst,
        cess: 0,
        totalAmount: round2(total),
        hasMissingHsn,
        hasMissingRate,
      };
    });

    const taxableValue = round2(lineItems.reduce((a, i) => a + i.taxableValue, 0));
    const igst = round2(lineItems.reduce((a, i) => a + i.igst, 0));
    const cgst = round2(lineItems.reduce((a, i) => a + i.cgst, 0));
    const sgst = round2(lineItems.reduce((a, i) => a + i.sgst, 0));
    const totalTax = round2(igst + cgst + sgst);
    const totalAmount = round2(lineItems.reduce((a, i) => a + i.totalAmount, 0) || Number(p.total_amount) || 0);

    const mismatchReasons = Array.from(mismatchSet);
    const notRelevantForReturn = lineItems.length === 0 && totalAmount === 0;
    const includedInReturn = !notRelevantForReturn && partyGstinValid;

    allInward.push({
      id: `P-${p.id}`,
      rawId: p.id,
      direction: "inward",
      voucherType,
      voucherNo: invNo,
      date: dateStr,
      counter,
      partyName: p.supplier_name || "Supplier",
      partyGstin,
      partyGstinValid,
      placeOfSupplyCode: posState?.code || "",
      placeOfSupplyName: posState?.name || "Unknown",
      isInterState,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess: 0,
      totalTax,
      totalAmount,
      items: lineItems,
      mismatchReasons,
      includedInReturn,
      notRelevantForReturn,
      gstr1Section: null,
    });
  }

  // Apply counter filter
  const selectedCounter = filter?.counter && filter.counter !== "ALL" ? filter.counter : "ALL";
  const outwardVouchers =
    selectedCounter === "ALL"
      ? allOutward
      : allOutward.filter((v) => v.counter === selectedCounter);
  const inwardVouchers =
    selectedCounter === "ALL"
      ? allInward
      : allInward.filter((v) => v.counter === selectedCounter);
  const allVouchers = [...outwardVouchers, ...inwardVouchers].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // 6. Compute GSTR-1 Summary & Sections
  const gstr1 = buildGstr1Summary(outwardVouchers);

  // 7. Compute HSN Summary (Sales Outward & Purchases Inward)
  const hsnSummary = buildHsnSummary(outwardVouchers);
  const purchaseHsnSummary = buildHsnSummary(inwardVouchers);

  // 8. Compute Tax Rate-wise Summary (0, 0.25, 3, 5, 12, 18, 28)
  const rateSummary = buildRateSummary(outwardVouchers);

  // 9. Compute GSTR-3B
  const gstr3b = buildGstr3b(outwardVouchers, inwardVouchers);

  // 10. Compute Input vs Output Tax
  const inputVsOutput = buildInputVsOutput(outwardVouchers, inwardVouchers);

  // 11. Reconciliation
  const outwardBooks = outwardVouchers;
  const outwardReturn = outwardVouchers.filter((v) => v.includedInReturn);
  const inwardBooks = inwardVouchers;
  const inwardReturn = inwardVouchers.filter((v) => v.includedInReturn);

  return {
    store: storeHeader,
    generatedAt: new Date().toLocaleString("en-IN"),
    periodLabel: formatPeriodLabel(filter?.startDate, filter?.endDate),
    counters: Array.from(counterSet),
    allVouchers,
    outwardVouchers,
    inwardVouchers,
    gstr1,
    gstr3b,
    hsnSummary,
    purchaseHsnSummary,
    rateSummary,
    inputVsOutput,
    reconciliation: {
      outward: buildReconciliation(outwardBooks, outwardReturn),
      inward: buildReconciliation(inwardBooks, inwardReturn),
      combined: buildReconciliation([...outwardBooks, ...inwardBooks], [...outwardReturn, ...inwardReturn]),
    },
  };
}

function summarizeSection(
  sectionId: Gstr1SectionId,
  tableNo: string,
  particulars: string,
  vouchers: GstVoucher[]
): Gstr1SectionRow {
  return {
    sectionId,
    tableNo,
    particulars,
    voucherCount: vouchers.length,
    taxableValue: round2(vouchers.reduce((a, v) => a + v.taxableValue, 0)),
    igst: round2(vouchers.reduce((a, v) => a + v.igst, 0)),
    cgst: round2(vouchers.reduce((a, v) => a + v.cgst, 0)),
    sgst: round2(vouchers.reduce((a, v) => a + v.sgst, 0)),
    cess: round2(vouchers.reduce((a, v) => a + v.cess, 0)),
    invoiceAmount: round2(vouchers.reduce((a, v) => a + v.totalAmount, 0)),
  };
}

function buildHsnSummary(vouchers: GstVoucher[]): GstHsnRow[] {
  const map = new Map<string, GstHsnRow>();
  for (const v of vouchers) {
    for (const item of v.items) {
      const hsn = item.hsnCode || "UNSPECIFIED";
      const key = `${hsn}::${item.uqc}`;
      let row = map.get(key);
      if (!row) {
        row = {
          hsnCode: hsn,
          description: item.productName,
          uqc: item.uqc || "PCS",
          totalQty: 0,
          totalValue: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
          voucherIds: [],
        };
        map.set(key, row);
      }
      row.totalQty += item.quantity;
      row.totalValue = round2(row.totalValue + item.totalAmount);
      row.taxableValue = round2(row.taxableValue + item.taxableValue);
      row.igst = round2(row.igst + item.igst);
      row.cgst = round2(row.cgst + item.cgst);
      row.sgst = round2(row.sgst + item.sgst);
      row.cess = round2(row.cess + item.cess);
      if (!row.voucherIds.includes(v.id)) {
        row.voucherIds.push(v.id);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
}

function buildGstr1Summary(outwardVouchers: GstVoucher[]): Gstr1SummaryData {
  const includedVouchers = outwardVouchers.filter((v) => v.includedInReturn);
  const notRelevantVouchers = outwardVouchers.filter((v) => v.notRelevantForReturn);
  const incompleteVouchers = outwardVouchers.filter(
    (v) => !v.includedInReturn && !v.notRelevantForReturn
  );

  const b2bVouchers = includedVouchers.filter((v) => v.gstr1Section === "b2b");
  const b2clVouchers = includedVouchers.filter((v) => v.gstr1Section === "b2cl");
  const b2csVouchers = includedVouchers.filter((v) => v.gstr1Section === "b2cs");
  const nilExemptVouchers = includedVouchers.filter((v) => v.gstr1Section === "nil_exempt");
  const cdnrVouchers = includedVouchers.filter((v) => v.gstr1Section === "cdnr");

  // B2C Small grouped by State & Rate
  const b2csMap = new Map<string, Gstr1B2csRow>();
  for (const v of b2csVouchers) {
    for (const item of v.items) {
      const key = `${v.placeOfSupplyCode || "NA"}::${item.gstRate}`;
      let row = b2csMap.get(key);
      if (!row) {
        row = {
          stateCode: v.placeOfSupplyCode || "-",
          stateName: v.placeOfSupplyName || "Unknown",
          gstRate: item.gstRate,
          voucherCount: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
          totalAmount: 0,
          voucherIds: [],
        };
        b2csMap.set(key, row);
      }
      row.taxableValue = round2(row.taxableValue + item.taxableValue);
      row.igst = round2(row.igst + item.igst);
      row.cgst = round2(row.cgst + item.cgst);
      row.sgst = round2(row.sgst + item.sgst);
      row.cess = round2(row.cess + item.cess);
      row.totalAmount = round2(row.totalAmount + item.totalAmount);
      if (!row.voucherIds.includes(v.id)) {
        row.voucherIds.push(v.id);
        row.voucherCount += 1;
      }
    }
  }
  const b2csRows = Array.from(b2csMap.values()).sort(
    (a, b) => a.stateName.localeCompare(b.stateName) || a.gstRate - b.gstRate
  );

  const hsnRows = buildHsnSummary(includedVouchers);

  // Table 13: Documents Issued
  const salesSorted = outwardVouchers
    .filter((v) => v.voucherType === "Sales")
    .map((v) => v.voucherNo)
    .sort();
  const cnSorted = outwardVouchers
    .filter((v) => v.voucherType === "Credit Note")
    .map((v) => v.voucherNo)
    .sort();

  const docsIssued: GstDocIssuedRow[] = [
    {
      documentType: "Invoices for outward supply",
      seriesFrom: salesSorted[0] || "-",
      seriesTo: salesSorted[salesSorted.length - 1] || "-",
      totalIssued: salesSorted.length,
      cancelled: 0,
      netIssued: salesSorted.length,
    },
    {
      documentType: "Credit Note",
      seriesFrom: cnSorted[0] || "-",
      seriesTo: cnSorted[cnSorted.length - 1] || "-",
      totalIssued: cnSorted.length,
      cancelled: 0,
      netIssued: cnSorted.length,
    },
  ];

  const hsnSectionRow: Gstr1SectionRow = {
    sectionId: "hsn",
    tableNo: "12",
    particulars: "HSN-wise Summary of outward supplies",
    voucherCount: hsnRows.length,
    taxableValue: round2(hsnRows.reduce((a, r) => a + r.taxableValue, 0)),
    igst: round2(hsnRows.reduce((a, r) => a + r.igst, 0)),
    cgst: round2(hsnRows.reduce((a, r) => a + r.cgst, 0)),
    sgst: round2(hsnRows.reduce((a, r) => a + r.sgst, 0)),
    cess: round2(hsnRows.reduce((a, r) => a + r.cess, 0)),
    invoiceAmount: round2(hsnRows.reduce((a, r) => a + r.totalValue, 0)),
  };

  const docsSectionRow: Gstr1SectionRow = {
    sectionId: "docs",
    tableNo: "13",
    particulars: "Documents Issued",
    voucherCount: docsIssued.reduce((a, d) => a + d.netIssued, 0),
    taxableValue: 0,
    igst: 0,
    cgst: 0,
    sgst: 0,
    cess: 0,
    invoiceAmount: 0,
  };

  const sections: Gstr1SectionRow[] = [
    summarizeSection("b2b", "4A/4B/4C/6B/6C", "B2B Invoices", b2bVouchers),
    summarizeSection("b2cl", "5", "B2C (Large) Invoices", b2clVouchers),
    summarizeSection("b2cs", "7", "B2C (Small) Invoices", b2csVouchers),
    summarizeSection("nil_exempt", "8", "Nil Rated, Exempted and Non-GST outward supplies", nilExemptVouchers),
    summarizeSection("cdnr", "9B", "Credit / Debit Notes (Sales Returns)", cdnrVouchers),
    hsnSectionRow,
    docsSectionRow,
  ];

  return {
    totalVouchers: outwardVouchers.length,
    includedInReturn: includedVouchers.length,
    notRelevant: notRelevantVouchers.length,
    incompleteCount: incompleteVouchers.length,
    sections,
    b2bVouchers,
    b2clVouchers,
    b2csRows,
    nilExemptVouchers,
    cdnrVouchers,
    hsnRows,
    docsIssued,
    incompleteVouchers,
    notRelevantVouchers,
  };
}

function buildRateSummary(outwardVouchers: GstVoucher[]): GstRateSlabRow[] {
  const map = new Map<number, GstRateSlabRow>();
  for (const r of STANDARD_GST_RATES) {
    map.set(r, {
      gstRate: r,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalAmount: 0,
      voucherIds: [],
    });
  }

  for (const v of outwardVouchers) {
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

function buildGstr3b(outwardVouchers: GstVoucher[], inwardVouchers: GstVoucher[]): Gstr3bData {
  // 3.1 Outward supplies
  const taxableOut: GstVoucher[] = [];
  const nilOut: GstVoucher[] = [];
  for (const v of outwardVouchers) {
    if (v.totalTax > 0) taxableOut.push(v);
    else nilOut.push(v);
  }

  const makeRow = (code: string, particulars: string, list: GstVoucher[]): Gstr3bTaxRow => ({
    code,
    particulars,
    taxableValue: round2(list.reduce((a, v) => a + v.taxableValue, 0)),
    igst: round2(list.reduce((a, v) => a + v.igst, 0)),
    cgst: round2(list.reduce((a, v) => a + v.cgst, 0)),
    sgst: round2(list.reduce((a, v) => a + v.sgst, 0)),
    cess: round2(list.reduce((a, v) => a + v.cess, 0)),
    voucherIds: list.map((v) => v.id),
  });

  const table31: Gstr3bTaxRow[] = [
    makeRow("3.1(a)", "Outward taxable supplies (other than zero rated, nil rated and exempted)", taxableOut),
    makeRow("3.1(b)", "Outward taxable supplies (zero rated)", []),
    makeRow("3.1(c)", "Other outward supplies (Nil rated, exempted)", nilOut),
    makeRow("3.1(d)", "Inward supplies (liable to reverse charge)", []),
    makeRow("3.1(e)", "Non-GST outward supplies", []),
  ];

  // 3.2 Inter-state supplies to unregistered persons (state-wise)
  const stateMap = new Map<string, Gstr3bStateRow>();
  for (const v of outwardVouchers) {
    if (!v.partyGstinValid && v.isInterState) {
      const key = v.placeOfSupplyCode || "NA";
      let row = stateMap.get(key);
      if (!row) {
        row = {
          stateCode: key,
          stateName: v.placeOfSupplyName,
          taxableValue: 0,
          igst: 0,
          voucherIds: [],
        };
        stateMap.set(key, row);
      }
      row.taxableValue = round2(row.taxableValue + v.taxableValue);
      row.igst = round2(row.igst + v.igst);
      row.voucherIds.push(v.id);
    }
  }
  const table32 = Array.from(stateMap.values()).sort((a, b) => a.stateName.localeCompare(b.stateName));

  // 4 Eligible ITC
  const eligibleInward = inwardVouchers.filter((v) => v.includedInReturn && v.totalTax > 0);
  const ineligibleInward = inwardVouchers.filter((v) => !v.includedInReturn && v.totalTax > 0);
  const nilInward = inwardVouchers.filter((v) => v.totalTax === 0);

  const itcAvail = makeRow("4(A)", "ITC Available (All other ITC from B2B Purchases)", eligibleInward);
  const itcReversed = makeRow("4(B)", "ITC Reversed", []);
  const netItc: Gstr3bTaxRow = {
    code: "4(C)",
    particulars: "Net ITC Available (A) - (B)",
    taxableValue: round2(itcAvail.taxableValue - itcReversed.taxableValue),
    igst: round2(itcAvail.igst - itcReversed.igst),
    cgst: round2(itcAvail.cgst - itcReversed.cgst),
    sgst: round2(itcAvail.sgst - itcReversed.sgst),
    cess: round2(itcAvail.cess - itcReversed.cess),
    voucherIds: itcAvail.voucherIds,
  };
  const itcIneligible = makeRow("4(D)", "Ineligible ITC (Missing/Invalid Supplier GSTIN)", ineligibleInward);

  const table4: Gstr3bTaxRow[] = [itcAvail, itcReversed, netItc, itcIneligible];

  // 5 Exempt, Nil-rated and Non-GST inward supplies
  const nilInter = nilInward.filter((v) => v.isInterState);
  const nilIntra = nilInward.filter((v) => !v.isInterState);
  const table5 = [
    {
      code: "5(a)",
      particulars: "From a supplier under composition scheme, Exempt and Nil rated supply",
      interState: round2(nilInter.reduce((a, v) => a + v.taxableValue, 0)),
      intraState: round2(nilIntra.reduce((a, v) => a + v.taxableValue, 0)),
      voucherIds: nilInward.map((v) => v.id),
    },
    {
      code: "5(b)",
      particulars: "Non GST supply",
      interState: 0,
      intraState: 0,
      voucherIds: [],
    },
  ];

  // 6.1 Payment of Tax
  const outIgst = round2(outwardVouchers.reduce((a, v) => a + v.igst, 0));
  const outCgst = round2(outwardVouchers.reduce((a, v) => a + v.cgst, 0));
  const outSgst = round2(outwardVouchers.reduce((a, v) => a + v.sgst, 0));
  const outCess = round2(outwardVouchers.reduce((a, v) => a + v.cess, 0));

  const makePayRow = (
    head: Gstr3bPaymentRow["taxHead"],
    payable: number,
    itcAvailAmt: number
  ): Gstr3bPaymentRow => {
    const itcUsed = round2(Math.min(payable, Math.max(0, itcAvailAmt)));
    const cashPaid = round2(Math.max(0, payable - itcUsed));
    return { taxHead: head, taxPayable: payable, itcUsed, cashPaid };
  };

  const table61: Gstr3bPaymentRow[] = [
    makePayRow("IGST", outIgst, netItc.igst),
    makePayRow("CGST", outCgst, netItc.cgst),
    makePayRow("SGST", outSgst, netItc.sgst),
    makePayRow("Cess", outCess, netItc.cess),
  ];

  return { table31, table32, table4, table5, table61 };
}

function buildInputVsOutput(
  outwardVouchers: GstVoucher[],
  inwardVouchers: GstVoucher[]
): InputOutputRow[] {
  const outIgst = round2(outwardVouchers.reduce((a, v) => a + v.igst, 0));
  const outCgst = round2(outwardVouchers.reduce((a, v) => a + v.cgst, 0));
  const outSgst = round2(outwardVouchers.reduce((a, v) => a + v.sgst, 0));
  const outCess = round2(outwardVouchers.reduce((a, v) => a + v.cess, 0));

  const inIgst = round2(inwardVouchers.reduce((a, v) => a + v.igst, 0));
  const inCgst = round2(inwardVouchers.reduce((a, v) => a + v.cgst, 0));
  const inSgst = round2(inwardVouchers.reduce((a, v) => a + v.sgst, 0));
  const inCess = round2(inwardVouchers.reduce((a, v) => a + v.cess, 0));

  const outTotal = round2(outIgst + outCgst + outSgst + outCess);
  const inTotal = round2(inIgst + inCgst + inSgst + inCess);

  return [
    { taxHead: "IGST", outputTax: outIgst, inputTax: inIgst, netPayable: round2(outIgst - inIgst) },
    { taxHead: "CGST", outputTax: outCgst, inputTax: inCgst, netPayable: round2(outCgst - inCgst) },
    { taxHead: "SGST", outputTax: outSgst, inputTax: inSgst, netPayable: round2(outSgst - inSgst) },
    { taxHead: "Cess", outputTax: outCess, inputTax: inCess, netPayable: round2(outCess - inCess) },
    { taxHead: "Total", outputTax: outTotal, inputTax: inTotal, netPayable: round2(outTotal - inTotal) },
  ];
}
