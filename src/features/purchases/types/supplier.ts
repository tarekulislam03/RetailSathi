export interface Supplier {
  id: number;
  name: string;
  company_name?: string;
  gst_no?: string;
  contact_no?: string;
  email?: string;
  address?: string;
  created_at?: string;
}

export type SupplierInput = Omit<Supplier, "id" | "created_at">;
