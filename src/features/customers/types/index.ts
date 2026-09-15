export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  purchase_item_id: number | null;
  purchase_item_name?: string;
  total_purchases_count?: number;
  total_spent?: number;
  loyalty_points: number;
  dues: number;
  created_at?: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
}

export interface CustomerStatsData {
  totalCustomers: number;
  totalLoyaltyPoints: number;
  totalDues: number;
  customersWithDues: number;
}
