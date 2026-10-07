export type UserRole = "admin" | "cashier" | "manager";

export interface User {
  id: number;
  username: string;
  password_hash?: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  store_id?: number | null;
  store_name?: string | null;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  store_id?: number | null;
  is_active?: boolean;
}

export interface UpdateUserInput {
  full_name?: string;
  password?: string;
  role?: UserRole;
  phone?: string;
  store_id?: number | null;
  is_active?: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeCashiers: number;
  totalAdmins: number;
  inactiveUsers: number;
}
