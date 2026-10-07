export interface GstInwardItem {
  id: string | number;
  date: string;
  invoice_no: string;
  supplier_name: string;
  supplier_gstin: string;
  product_id?: number | null;
  product_name: string;
  barcode: string;
  batch_no: string;
  hsn_code: string;
  category: string;
  quantity: number;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  total_amount: number;
}

export interface GstOutwardItem {
  id: string | number;
  date: string;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  product_id?: number | null;
  product_name: string;
  barcode: string;
  hsn_code: string;
  category: string;
  quantity: number;
  rate: number;
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  total_amount: number;
}

export interface GstTaxSummary {
  // Stock In (Purchases / Inward)
  totalInwardQty: number;
  totalInwardTaxable: number;
  totalInwardCgst: number;
  totalInwardSgst: number;
  totalInwardGst: number;
  totalInwardAmount: number;

  // Stock Out (Sales / Outward)
  totalOutwardQty: number;
  totalOutwardTaxable: number;
  totalOutwardCgst: number;
  totalOutwardSgst: number;
  totalOutwardGst: number;
  totalOutwardAmount: number;

  // Net GST Liability
  netCgstPayable: number;
  netSgstPayable: number;
  netGstPayable: number; // positive = payable, negative = input credit carry forward
}

export interface StoreReportInfo {
  name: string;
  legal_name?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface GstReportData {
  store: StoreReportInfo;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
  inwardItems: GstInwardItem[];
  outwardItems: GstOutwardItem[];
  summary: GstTaxSummary;
}

export interface GstReportFilter {
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}
