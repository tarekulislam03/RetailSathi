export interface Purchase {
  id: number;
  supplier_name: string;
  invoice_no: string;
  purchase_date: string;
  gst_no: string;
  contact_no: string;
  total_amount: number;
  item_count: number;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id?: number | null;
  product_name: string;
  barcode: string;
  batch_no: string;
  hsn_code?: string;
  category: string;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  gst_rate: number;
  quantity: number;
  subtotal: number;
}

export interface PurchaseItemDraft {
  product_id?: number | null;
  product_name: string;
  barcode: string;
  batch_no: string;
  hsn_code: string;
  category: string;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  gst_rate: number;
  quantity: number;
  subtotal: number;
}

export interface CreatePurchaseInput {
  supplier_name: string;
  invoice_no: string;
  purchase_date: string;
  gst_no: string;
  contact_no: string;
  items: PurchaseItemDraft[];
}

export interface PurchaseStatsData {
  totalPurchasesCount: number;
  totalSpend: number;
  todaySpend: number;
  monthlySpend: number;
}

export type AiBillImportStatus = "pending" | "verified" | "dismissed";

export type AiBillItemVerificationStatus =
  | "pending"
  | "matched_existing"
  | "new_barcode_batch"
  | "new_product";

export interface AiBillImportItem extends PurchaseItemDraft {
  verification_status?: AiBillItemVerificationStatus;
  matched_product_id?: number | null;
  matched_product_name?: string;
  old_barcode?: string;
}

export interface AiBillImport {
  id: number;
  supplier_name: string;
  invoice_no: string;
  purchase_date: string;
  gst_no: string;
  contact_no: string;
  total_amount: number;
  items: AiBillImportItem[];
  status: AiBillImportStatus;
  source_note?: string;
  purchase_id?: number | null;
  created_at: string;
  verified_at?: string | null;
}

export interface CreateAiBillImportInput {
  supplier_name: string;
  invoice_no: string;
  purchase_date: string;
  gst_no?: string;
  contact_no?: string;
  source_note?: string;
  items: AiBillImportItem[];
}
