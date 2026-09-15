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
