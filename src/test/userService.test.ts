import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  calculateUserStats,
} from "../features/users/services/userService";

describe("Retail Sathi User & Cashier Management Tests", () => {
  let sqliteDb: any;

  beforeEach(() => {
    const mock = createMockDatabase();
    sqliteDb = mock.sqliteDb;

    // Seed test users
    sqliteDb.exec(`
      DELETE FROM users;
      INSERT INTO users (id, username, password_hash, full_name, role, phone, is_active)
      VALUES 
        (1, 'admin', 'admin123', 'Store Admin', 'admin', '8101402916', 1),
        (2, 'cashier1', 'cashier123', 'John Cashier', 'cashier', '9876543210', 1),
        (3, 'cashier2', 'cashier123', 'Jane Cashier', 'cashier', '9123456780', 0);
    `);
  });

  it("should fetch all users and filter by search query", async () => {
    const allUsers = await fetchUsers();
    expect(allUsers.length).toBe(3);

    const searched = await fetchUsers("John");
    expect(searched.length).toBe(1);
    expect(searched[0].username).toBe("cashier1");
  });

  it("should create a new cashier user successfully", async () => {
    const res = await createUser({
      username: "cashier3",
      password: "password123",
      full_name: "Bob Cashier",
      role: "cashier",
      phone: "9988776655",
      is_active: true,
    });

    expect(res.success).toBe(true);
    expect(res.id).toBeDefined();

    const users = await fetchUsers("cashier3");
    expect(users.length).toBe(1);
    expect(users[0].full_name).toBe("Bob Cashier");
    expect(users[0].role).toBe("cashier");
  });

  it("should reject creating a user with duplicate username", async () => {
    const res = await createUser({
      username: "admin",
      password: "newpassword",
      full_name: "Duplicate Admin",
      role: "admin",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("already exists");
  });

  it("should update user details successfully", async () => {
    const res = await updateUser(2, {
      full_name: "John Updated",
      phone: "9999999999",
      is_active: false,
    });

    expect(res.success).toBe(true);

    const users = await fetchUsers("John Updated");
    expect(users.length).toBe(1);
    expect(users[0].phone).toBe("9999999999");
    expect(users[0].is_active).toBe(0);
  });

  it("should delete a cashier user", async () => {
    const res = await deleteUser(2);
    expect(res.success).toBe(true);

    const users = await fetchUsers();
    expect(users.length).toBe(2);
    expect(users.find((u) => u.id === 2)).toBeUndefined();
  });

  it("should prevent deleting the only active admin", async () => {
    const res = await deleteUser(1);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Cannot delete the only active Admin account");
  });

  it("should calculate user statistics correctly", async () => {
    const users = await fetchUsers();
    const stats = calculateUserStats(users);

    expect(stats.totalUsers).toBe(3);
    expect(stats.totalAdmins).toBe(1);
    expect(stats.activeCashiers).toBe(1);
    expect(stats.inactiveUsers).toBe(1);
  });
});
