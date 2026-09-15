import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { authenticate, setStoredSession, getStoredSession, clearStoredSession } from "../features/auth/services/authService";

// Simple in-memory localStorage mock for node test environment
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, val),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

describe("Retail Sathi Authentication & Role Access Tests", () => {
  let sqliteDb: any;

  beforeEach(async () => {
    const mock = createMockDatabase();
    sqliteDb = mock.sqliteDb;
    clearStoredSession();

    // Seed test users
    sqliteDb.exec(`
      DELETE FROM users;
      INSERT INTO users (id, username, password_hash, full_name, role, phone, is_active)
      VALUES 
        (1, 'admin', 'admin123', 'Store Admin', 'admin', '8101402916', 1),
        (2, 'cashier1', 'cashier123', 'Counter Cashier', 'cashier', '9876543210', 1),
        (3, 'inactive_user', 'pass123', 'Inactive Staff', 'cashier', '1112223333', 0);
    `);
  });

  it("should authenticate active admin user with valid credentials", async () => {
    const res = await authenticate("admin", "admin123");
    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.username).toBe("admin");
    expect(res.user?.role).toBe("admin");
  });

  it("should authenticate active cashier user with valid credentials", async () => {
    const res = await authenticate("cashier1", "cashier123");
    expect(res.success).toBe(true);
    expect(res.user?.role).toBe("cashier");
  });

  it("should reject incorrect password", async () => {
    const res = await authenticate("admin", "wrong_password");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Incorrect password");
  });

  it("should reject inactive/deactivated users", async () => {
    const res = await authenticate("inactive_user", "pass123");
    expect(res.success).toBe(false);
    expect(res.error).toContain("User not found or account is deactivated");
  });

  it("should handle session storage and retrieval", () => {
    const testUser = {
      id: 1,
      username: "admin",
      full_name: "Store Admin",
      role: "admin" as const,
      is_active: true,
    };

    setStoredSession(testUser);
    const session = getStoredSession();
    expect(session).toEqual(testUser);

    clearStoredSession();
    expect(getStoredSession()).toBeNull();
  });
});
