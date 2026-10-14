import { describe, it, expect, beforeEach } from "vitest";
import {
  getHeldBills,
  saveHeldBill,
  removeHeldBill,
  clearAllHeldBills,
} from "../features/billing/services/heldBillsService";
import { CartItem } from "../features/billing/types";

describe("Hold and Resume Bill Service Tests", () => {
  const mockCart: CartItem[] = [
    {
      product: {
        id: 1,
        name: "Basmati Rice 1kg",
        price: 110,
        mrp: 140,
        stock: 50,
        barcode: "8901234567890",
        category: "Grocery",
        cost_price: 90,
      },
      quantity: 2,
    },
    {
      product: {
        id: 2,
        name: "Tata Salt 1kg",
        price: 28,
        mrp: 30,
        stock: 100,
        barcode: "8901234567891",
        category: "Grocery",
        cost_price: 22,
      },
      quantity: 1,
    },
  ];

  beforeEach(() => {
    clearAllHeldBills();
  });

  it("should initialize with empty held bills", () => {
    const list = getHeldBills();
    expect(list).toEqual([]);
  });

  it("should park/hold a bill and persist into storage", () => {
    const held = saveHeldBill({
      customer_name: "Rahul Sharma",
      customer_phone: "9876543210",
      payment_mode: "Cash",
      cart: mockCart,
      total_mrp: 310,
      grand_total: 248,
      total_items: 2,
      total_qty: 3,
    });

    expect(held.id).toMatch(/^HOLD-\d+-\d+$/);
    expect(held.heldAt).toBeDefined();
    expect(held.customer_name).toBe("Rahul Sharma");
    expect(held.grand_total).toBe(248);

    const stored = getHeldBills();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(held.id);
    expect(stored[0].cart).toHaveLength(2);
  });

  it("should support holding multiple bills simultaneously", () => {
    const bill1 = saveHeldBill({
      customer_name: "Customer One",
      customer_phone: "9111111111",
      cart: [mockCart[0]],
      total_mrp: 140,
      grand_total: 110,
      total_items: 1,
      total_qty: 1,
    });

    const bill2 = saveHeldBill({
      customer_name: "Customer Two",
      customer_phone: "9222222222",
      cart: [mockCart[1]],
      total_mrp: 30,
      grand_total: 28,
      total_items: 1,
      total_qty: 1,
    });

    const stored = getHeldBills();
    expect(stored).toHaveLength(2);
    // Newest held bill appears first
    expect(stored[0].id).toBe(bill2.id);
    expect(stored[1].id).toBe(bill1.id);
  });

  it("should resume (remove from held list) a specific bill", () => {
    const bill1 = saveHeldBill({
      customer_name: "Customer A",
      cart: mockCart,
      total_mrp: 310,
      grand_total: 248,
      total_items: 2,
      total_qty: 3,
    });

    const bill2 = saveHeldBill({
      customer_name: "Customer B",
      cart: mockCart,
      total_mrp: 310,
      grand_total: 248,
      total_items: 2,
      total_qty: 3,
    });

    const remaining = removeHeldBill(bill1.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(bill2.id);
  });

  it("should clear all held bills", () => {
    saveHeldBill({
      customer_name: "Customer X",
      cart: mockCart,
      total_mrp: 310,
      grand_total: 248,
      total_items: 2,
      total_qty: 3,
    });
    saveHeldBill({
      customer_name: "Customer Y",
      cart: mockCart,
      total_mrp: 310,
      grand_total: 248,
      total_items: 2,
      total_qty: 3,
    });

    clearAllHeldBills();
    expect(getHeldBills()).toEqual([]);
  });
});
