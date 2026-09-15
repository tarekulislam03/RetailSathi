export interface Product {
  id: number;
  barcode: string;
  name: string;
  batch_no: string;
  mrp: number;
  price: number;
  stock: number;
  hsn_code: string;
  reorder_threshold: number;
  gst_rate: number;
  category: string;
  cost_price?: number;
  created_at?: string;
}

export type ProductInput = Omit<Product, "id" | "created_at">;
