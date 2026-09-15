import { getDb } from "../../../services/database";
import { User, CreateUserInput, UpdateUserInput, UserStats } from "../types";

export async function fetchUsers(searchQuery = ""): Promise<User[]> {
  const db = await getDb();
  const trimmed = searchQuery.trim().toLowerCase();

  let query = `
    SELECT id, username, full_name, role, phone, is_active, created_at, updated_at
    FROM users
  `;
  const params: any[] = [];

  if (trimmed) {
    query += ` WHERE LOWER(username) LIKE $1 OR LOWER(full_name) LIKE $2 OR phone LIKE $3`;
    params.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);
  }

  query += ` ORDER BY id DESC`;

  const rows = await db.select<User[]>(query, params);
  return rows || [];
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; id?: number; error?: string }> {
  const cleanUsername = input.username.trim().toLowerCase();
  const cleanPassword = input.password.trim();
  const cleanFullName = input.full_name.trim();

  if (!cleanUsername) {
    return { success: false, error: "Username is required." };
  }
  if (!cleanPassword) {
    return { success: false, error: "Password is required." };
  }
  if (!cleanFullName) {
    return { success: false, error: "Full Name is required." };
  }

  const db = await getDb();

  // Check if username already exists
  const existing = await db.select<User[]>(
    "SELECT id FROM users WHERE LOWER(username) = $1",
    [cleanUsername]
  );

  if (existing && existing.length > 0) {
    return { success: false, error: "A user with this username already exists." };
  }

  const role = input.role || "cashier";
  const phone = input.phone?.trim() || null;
  const isActive = input.is_active === false ? 0 : 1;

  const result = await db.execute(
    `INSERT INTO users (username, password_hash, full_name, role, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [cleanUsername, cleanPassword, cleanFullName, role, phone, isActive]
  );

  return {
    success: true,
    id: result.lastInsertId,
  };
}

export async function updateUser(
  id: number,
  input: UpdateUserInput
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.full_name !== undefined) {
    const cleanName = input.full_name.trim();
    if (!cleanName) return { success: false, error: "Full name cannot be empty." };
    updates.push(`full_name = $${paramIdx++}`);
    params.push(cleanName);
  }

  if (input.password !== undefined && input.password.trim()) {
    updates.push(`password_hash = $${paramIdx++}`);
    params.push(input.password.trim());
  }

  if (input.role !== undefined) {
    updates.push(`role = $${paramIdx++}`);
    params.push(input.role);
  }

  if (input.phone !== undefined) {
    updates.push(`phone = $${paramIdx++}`);
    params.push(input.phone?.trim() || null);
  }

  if (input.is_active !== undefined) {
    updates.push(`is_active = $${paramIdx++}`);
    params.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return { success: true };
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx}`;
  await db.execute(query, params);

  return { success: true };
}

export async function deleteUser(id: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  // Safety check: Don't delete if it's the last active admin
  const admins = await db.select<User[]>(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = 1"
  );
  if (admins && admins.length === 1 && admins[0].id === id) {
    return {
      success: false,
      error: "Cannot delete the only active Admin account in the system.",
    };
  }

  await db.execute("DELETE FROM users WHERE id = $1", [id]);
  return { success: true };
}

export function calculateUserStats(users: User[]): UserStats {
  let activeCashiers = 0;
  let totalAdmins = 0;
  let inactiveUsers = 0;

  for (const u of users) {
    const isActive = u.is_active === 1 || u.is_active === true;
    if (!isActive) {
      inactiveUsers++;
    } else if (u.role === "cashier") {
      activeCashiers++;
    } else if (u.role === "admin") {
      totalAdmins++;
    }
  }

  return {
    totalUsers: users.length,
    activeCashiers,
    totalAdmins,
    inactiveUsers,
  };
}
