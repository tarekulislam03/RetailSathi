import { Product } from "../../inventory/types";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  discount: number;
  tax_amount: number;
  grand_total: number;
  payment_mode: string;
  paid_amount?: number;
  due_amount?: number;
  cash_paid?: number;
  upi_paid?: number;
  marketing_person_id?: number | null;
  created_at?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
  total_price: number;
}

export interface CreateSaleInput {
  invoice_no?: string;
  customer_name: string;
  customer_phone: string;
  discount?: number;
  tax_amount?: number;
  total_mrp?: number;
  payment_mode: string;
  paid_amount?: number;
  due_amount?: number;
  cash_paid?: number;
  upi_paid?: number;
  marketing_person_id?: number | null;
  items: {
    product_id: number;
    product_name: string;
    barcode: string;
    price: number;
    quantity: number;
    mrp?: number;
    gst_rate?: number;
  }[];
}

export interface UpdateSaleInput {
  customer_name?: string;
  customer_phone?: string;
  discount?: number;
  tax_amount?: number;
  total_mrp?: number;
  payment_mode?: string;
  paid_amount?: number;
  due_amount?: number;
  cash_paid?: number;
  upi_paid?: number;
  marketing_person_id?: number | null;
  items: {
    product_id: number;
    product_name: string;
    barcode: string;
    price: number;
    quantity: number;
    mrp?: number;
    gst_rate?: number;
  }[];
}

