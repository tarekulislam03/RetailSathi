export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  purchase_item_id: number | null;
  purchase_item_name?: string;
  total_purchases_count?: number;
  total_spent?: number;
  loyalty_points: number; // Lifetime Points
  active_points: number;  // Resets every 10 points (loyalty_points % 10)
  lucky_draw_used: number; // How many lucky draws the customer has used
  lucky_draw_count: number; // Remaining eligible lucky draws: max(0, floor(loyalty_points / 10) - lucky_draw_used)
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
