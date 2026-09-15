export interface MarketingPerson {
  id: number;
  name: string;
  phone: string;
  area: string;
  sales: number; // lifetime sales stored on table
  commission: number; // commission percentage rate
  monthly_sales?: number;
  monthly_commission?: number;
  lifetime_sales?: number;
  lifetime_commission?: number;
  created_at?: string;
}

export interface MarketingPersonInput {
  name: string;
  phone?: string;
  area?: string;
  sales?: number;
  commission?: number;
}

export interface MarketingSaleRecord {
  id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  grand_total: number;
  payment_mode: string;
  created_at: string;
  commission_earned: number;
}

export interface MarketingStatsData {
  totalPersonnel: number;
  totalSalesCompleted: number;
  totalCommission: number;
}
