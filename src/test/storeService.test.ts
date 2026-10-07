import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import {
  fetchStores,
  getStoreById,
  getStoreUsers,
  createStore,
  updateStore,
  deleteStore,
} from "../features/stores/services/storeService";
import {
  fetchUsers,
  createUser,
  updateUser,
  getUsersByStoreId,
} from "../features/users/services/userService";

describe("Retail Sathi Stores & User Relations Tests", () => {
  let sqliteDb: any;

  beforeEach(() => {
    const mock = createMockDatabase();
    sqliteDb = mock.sqliteDb;

    // Seed test stores and users
    sqliteDb.exec(`
      DELETE FROM users;
      DELETE FROM stores;

      INSERT INTO stores (id, name, code, address, phone, email, is_active)
      VALUES 
        (1, 'Main Branch', 'STORE-01', '123 Market St', '9876543210', 'main@example.com', 1),
        (2, 'Downtown Outlet', 'STORE-02', '456 Center Ave', '9123456780', 'downtown@example.com', 1);

      INSERT INTO users (id, username, password_hash, full_name, role, phone, store_id, is_active)
      VALUES 
        (1, 'admin', 'admin123', 'Store Admin', 'admin', '8101402916', 1, 1),
        (2, 'cashier1', 'cashier123', 'John Main Branch', 'cashier', '9876543210', 1, 1),
        (3, 'cashier2', 'cashier123', 'Jane Main Branch', 'cashier', '9876543211', 1, 1),
        (4, 'cashier3', 'cashier123', 'Bob Downtown', 'cashier', '9123456780', 2, 1),
        (5, 'cashier4', 'cashier123', 'Alice Float', 'cashier', '9123456781', NULL, 1);
    `);
  });

  it("should fetch all stores and filter by search query", async () => {
    const allStores = await fetchStores();
    expect(allStores.length).toBe(2);
    expect(allStores[0].name).toBe("Main Branch");

    const searchRes = await fetchStores("downtown");
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].code).toBe("STORE-02");
  });

  it("should retrieve a store by ID", async () => {
    const store = await getStoreById(1);
    expect(store).not.toBeNull();
    expect(store?.name).toBe("Main Branch");
    expect(store?.code).toBe("STORE-01");
  });

  it("should create a new store with setup_cost and amc, and prevent duplicate codes", async () => {
    const createRes = await createStore({
      name: "Airport Plaza",
      code: "STORE-03",
      address: "Terminal 2",
      phone: "9988776655",
      setup_cost: 15000,
      amc: 3000,
      is_active: true,
    });

    expect(createRes.success).toBe(true);
    expect(createRes.id).toBeDefined();

    const stores = await fetchStores("Airport");
    expect(stores.length).toBe(1);
    expect(stores[0].name).toBe("Airport Plaza");
    expect(stores[0].setup_cost).toBe(15000);
    expect(stores[0].amc).toBe(3000);

    // Try creating duplicate code
    const duplicateRes = await createStore({
      name: "Another Branch",
      code: "STORE-03",
    });
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.error).toContain("already exists");
  });

  it("should update store information including setup_cost and amc", async () => {
    const updateRes = await updateStore(1, {
      name: "Main Flagship Store",
      phone: "1112223333",
      setup_cost: 25000,
      amc: 5000,
    });
    expect(updateRes.success).toBe(true);

    const store = await getStoreById(1);
    expect(store?.name).toBe("Main Flagship Store");
    expect(store?.phone).toBe("1112223333");
    expect(store?.setup_cost).toBe(25000);
    expect(store?.amc).toBe(5000);
  });

  it("should connect multiple users to one store (1-to-N relation)", async () => {
    // Store 1 (Main Branch) has users: admin (1), cashier1 (2), cashier2 (3)
    const store1Users = await getStoreUsers(1);
    expect(store1Users.length).toBe(3);
    const usernames = store1Users.map((u) => u.username);
    expect(usernames).toContain("admin");
    expect(usernames).toContain("cashier1");
    expect(usernames).toContain("cashier2");

    // Also check via getUsersByStoreId
    const store2Users = await getUsersByStoreId(2);
    expect(store2Users.length).toBe(1);
    expect(store2Users[0].username).toBe("cashier3");
  });

  it("should create a new user assigned to a store", async () => {
    const res = await createUser({
      username: "cashier_downtown_2",
      password: "pass12345",
      full_name: "Charlie Downtown",
      role: "cashier",
      store_id: 2,
    });

    expect(res.success).toBe(true);

    const store2Users = await getStoreUsers(2);
    expect(store2Users.length).toBe(2);
    expect(store2Users.map((u) => u.username)).toContain("cashier_downtown_2");
  });

  it("should update a user's assigned store", async () => {
    // Move cashier4 from NULL store to Store 2
    const updateRes = await updateUser(5, {
      store_id: 2,
    });
    expect(updateRes.success).toBe(true);

    const store2Users = await getStoreUsers(2);
    expect(store2Users.map((u) => u.id)).toContain(5);
  });

  it("should populate store_name when fetching users with join", async () => {
    const users = await fetchUsers();
    const user1 = users.find((u) => u.id === 1);
    expect(user1?.store_id).toBe(1);
    expect(user1?.store_name).toBe("Main Branch");

    const user5 = users.find((u) => u.id === 5);
    expect(user5?.store_id).toBeNull();
    expect(user5?.store_name).toBeNull();
  });

  it("should handle deleting a store and nullify store_id on connected users", async () => {
    const delRes = await deleteStore(1);
    expect(delRes.success).toBe(true);

    const deletedStore = await getStoreById(1);
    expect(deletedStore).toBeNull();

    // Check that users previously in Store 1 now have store_id as NULL and still exist
    const users = await fetchUsers();
    const user1 = users.find((u) => u.id === 1);
    const user2 = users.find((u) => u.id === 2);
    expect(user1).toBeDefined();
    expect(user1?.store_id).toBeNull();
    expect(user2).toBeDefined();
    expect(user2?.store_id).toBeNull();
  });
});
