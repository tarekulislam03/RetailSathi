export type GstPageId =
  | "home"
  | "gstr1_summary"
  | "gstr1_section"
  | "voucher_register"
  | "invoice_view"
  | "gstr3b"
  | "hsn_summary"
  | "rate_summary"
  | "input_output"
  | "ca_pack";

export type Gstr1SectionId =
  | "b2b"
  | "b2cl"
  | "b2cs"
  | "nil_exempt"
  | "cdnr"
  | "hsn"
  | "docs"
  | "incomplete"
  | "not_relevant";

export type PeriodMode = "month" | "quarter" | "custom";

export interface GstTallyFilter {
  periodMode: PeriodMode;
  startDate: string;
  endDate: string;
  counter: string; // "ALL" or specific counter name
}

export interface BreadcrumbItem {
  label: string;
  page: GstPageId;
  sectionId?: Gstr1SectionId;
  voucherId?: string;
  filterContext?: VoucherFilterContext;
}

export interface VoucherFilterContext {
  title?: string;
  direction?: "inward" | "outward" | "all";
  sectionId?: Gstr1SectionId;
  hsnCode?: string;
  gstRate?: number;
  stateName?: string;
  onlyIncomplete?: boolean;
  voucherIds?: string[];
}

export interface GstStoreHeader {
  name: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  address: string;
}

export type MismatchReason =
  | "Missing GSTIN"
  | "Invalid GSTIN"
  | "Missing HSN"
  | "Missing GST Rate"
  | "Missing Place of Supply"
  | "Outlier / Suspicious Amount";

export interface GstVoucherLineItem {
  id: string;
  productName: string;
  barcode: string;
  hsnCode: string;
  uqc: string;
  quantity: number;
  rate: number;
  taxableValue: number;
  gstRate: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalAmount: number;
  hasMissingHsn: boolean;
  hasMissingRate: boolean;
}

export interface GstVoucher {
  id: string; // e.g., "S-12" or "P-5"
  rawId: number;
  direction: "outward" | "inward";
  voucherType: "Sales" | "Credit Note" | "Purchase" | "Debit Note";
  voucherNo: string;
  date: string; // YYYY-MM-DD
  counter: string;
  partyName: string;
  partyGstin: string;
  partyGstinValid: boolean;
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  isInterState: boolean;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTax: number;
  totalAmount: number;
  items: GstVoucherLineItem[];
  mismatchReasons: MismatchReason[];
  includedInReturn: boolean;
  notRelevantForReturn: boolean;
  gstr1Section: Gstr1SectionId | null;
}

export interface Gstr1SectionRow {
  sectionId: Gstr1SectionId;
  tableNo: string;
  particulars: string;
  voucherCount: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  invoiceAmount: number;
}

export interface Gstr1B2csRow {
  stateCode: string;
  stateName: string;
  gstRate: number;
  voucherCount: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalAmount: number;
  voucherIds: string[];
}

export interface GstHsnRow {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQty: number;
  totalValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  voucherIds: string[];
}

export interface GstDocIssuedRow {
  documentType: string;
  seriesFrom: string;
  seriesTo: string;
  totalIssued: number;
  cancelled: number;
  netIssued: number;
}

export interface Gstr1SummaryData {
  totalVouchers: number;
  includedInReturn: number;
  notRelevant: number;
  incompleteCount: number;
  sections: Gstr1SectionRow[];
  b2bVouchers: GstVoucher[];
  b2clVouchers: GstVoucher[];
  b2csRows: Gstr1B2csRow[];
  nilExemptVouchers: GstVoucher[];
  cdnrVouchers: GstVoucher[];
  hsnRows: GstHsnRow[];
  docsIssued: GstDocIssuedRow[];
  incompleteVouchers: GstVoucher[];
  notRelevantVouchers: GstVoucher[];
}

export interface Gstr3bTaxRow {
  code: string;
  particulars: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  voucherIds: string[];
}

export interface Gstr3bStateRow {
  stateCode: string;
  stateName: string;
  taxableValue: number;
  igst: number;
  voucherIds: string[];
}

export interface Gstr3bPaymentRow {
  taxHead: "IGST" | "CGST" | "SGST" | "Cess";
  taxPayable: number;
  itcUsed: number;
  cashPaid: number;
}

export interface Gstr3bData {
  table31: Gstr3bTaxRow[];
  table32: Gstr3bStateRow[];
  table4: Gstr3bTaxRow[];
  table5: {
    code: string;
    particulars: string;
    interState: number;
    intraState: number;
    voucherIds: string[];
  }[];
  table61: Gstr3bPaymentRow[];
}

export interface GstRateSlabRow {
  gstRate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalAmount: number;
  voucherIds: string[];
}

export interface InputOutputRow {
  taxHead: "IGST" | "CGST" | "SGST" | "Cess" | "Total";
  outputTax: number;
  inputTax: number;
  netPayable: number; // positive = payable, negative = carry forward
}

export interface ReconciliationSummary {
  booksTaxable: number;
  booksTax: number;
  booksTotal: number;
  returnTaxable: number;
  returnTax: number;
  returnTotal: number;
  diffTaxable: number;
  diffTax: number;
  diffTotal: number;
}

export interface GstTallyReportBundle {
  store: GstStoreHeader;
  generatedAt: string;
  periodLabel: string;
  counters: string[];
  allVouchers: GstVoucher[];
  outwardVouchers: GstVoucher[];
  inwardVouchers: GstVoucher[];
  gstr1: Gstr1SummaryData;
  gstr3b: Gstr3bData;
  hsnSummary: GstHsnRow[];
  purchaseHsnSummary: GstHsnRow[];
  rateSummary: GstRateSlabRow[];
  inputVsOutput: InputOutputRow[];
  reconciliation: {
    outward: ReconciliationSummary;
    inward: ReconciliationSummary;
    combined: ReconciliationSummary;
  };
}
