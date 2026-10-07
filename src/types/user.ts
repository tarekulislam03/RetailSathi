export type UserRole = "admin" | "cashier" | "manager";

export interface User {
  id?: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  store_id?: number | null;
  store_name?: string | null;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  store_id?: number | null;
  store_name?: string | null;
  is_active: boolean;
  created_at?: string;
}
