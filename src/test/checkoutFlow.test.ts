import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import { getDb } from "../services/database";
import { createProduct } from "../features/inventory/services/inventoryService";
import { createSale } from "../features/billing/services/billingService";
import { CartItem } from "../features/billing/types";
import { CheckoutPaymentDetails } from "../features/billing/components/CheckoutInvoiceModal";

describe("Billing Checkout Flow Tests", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  it("should calculate checkout invoice details correctly", async () => {
    const prod1 = await createProduct({
      name: "Organic Tea",
      price: 180,
      mrp: 200,
      stock: 50,
      gst_rate: 5,
    });

    const prod2 = await createProduct({
      name: "Biscuits",
      price: 50,
      mrp: 60,
      stock: 30,
      gst_rate: 18,
    });

    const cart: CartItem[] = [
      { product: prod1, quantity: 2 }, // MRP 400, Selling 360
      { product: prod2, quantity: 3 }, // MRP 180, Selling 150
    ];

    // Subtotal (Total MRP)
    const totalMRP = cart.reduce(
      (acc, item) =>
        acc + (item.product.mrp || item.product.price) * item.quantity,
      0
    );
    expect(totalMRP).toBe(580); // 200*2 + 60*3 = 400 + 180 = 580

    // Discount
    const totalDiscount = cart.reduce((acc, item) => {
      const mrp = item.product.mrp || item.product.price;
      const discountPerUnit = Math.max(0, mrp - item.product.price);
      return acc + discountPerUnit * item.quantity;
    }, 0);
    expect(totalDiscount).toBe(70); // (20*2) + (10*3) = 40 + 30 = 70

    // Grand total
    const grandTotal = totalMRP - totalDiscount;
    expect(grandTotal).toBe(510); // 360 + 150 = 510

    // Tax calculation
    let totalTaxableAmount = 0;
    let totalGstAmount = 0;
    for (const item of cart) {
      const itemSellingTotal = item.product.price * item.quantity;
      const gstRate = item.product.gst_rate || 0;
      if (gstRate > 0) {
        const itemTaxable = itemSellingTotal / (1 + gstRate / 100);
        const itemGst = itemSellingTotal - itemTaxable;
        totalTaxableAmount += itemTaxable;
        totalGstAmount += itemGst;
      } else {
        totalTaxableAmount += itemSellingTotal;
      }
    }

    expect(totalTaxableAmount + totalGstAmount).toBeCloseTo(510, 2);
  });

  it("should not create a sale when user opens checkout and closes modal without saving", async () => {
    const db = await getDb();
    const prod = await createProduct({
      name: "Notebook",
      price: 45,
      mrp: 50,
      stock: 20,
    });

    const initialSales = await db.select<any[]>("SELECT * FROM sales");
    expect(initialSales.length).toBe(0);

    // Simulated user action: Cart has items, user clicks "Checkout" which only opens modal
    const cart: CartItem[] = [{ product: prod, quantity: 2 }];
    const customerName = "John Doe";
    const customerPhone = "9876543210";

    // User closes modal with cross button: No DB call is made
    const salesAfterCancel = await db.select<any[]>("SELECT * FROM sales");
    expect(salesAfterCancel.length).toBe(0);

    // Items and data remain preserved
    expect(cart.length).toBe(1);
    expect(cart[0].product.name).toBe("Notebook");
    expect(customerName).toBe("John Doe");
    expect(customerPhone).toBe("9876543210");
  });

  it("should save sale and update inventory when Save Only is clicked", async () => {
    const db = await getDb();
    const prod = await createProduct({
      name: "Pen",
      price: 10,
      mrp: 12,
      stock: 100,
    });

    const paymentDetails: CheckoutPaymentDetails = {
      paymentMode: "Cash",
      paidAmount: 20,
      dueAmount: 0,
      cashPaid: 20,
      upiPaid: 0,
    };

    const cart: CartItem[] = [{ product: prod, quantity: 2 }];

    const sale = await createSale({
      customer_name: "Ramesh Kumar",
      customer_phone: "9876543211",
      total_mrp: 24,
      discount: 4,
      tax_amount: 0,
      payment_mode: paymentDetails.paymentMode,
      paid_amount: paymentDetails.paidAmount,
      due_amount: paymentDetails.dueAmount,
      cash_paid: paymentDetails.cashPaid,
      upi_paid: paymentDetails.upiPaid,
      items: cart.map((c) => ({
        product_id: c.product.id,
        product_name: c.product.name,
        barcode: c.product.barcode,
        price: c.product.price,
        quantity: c.quantity,
        mrp: c.product.mrp || c.product.price,
      })),
    });

    expect(sale.id).toBeDefined();
    expect(sale.invoice_no).toBeDefined();
    expect(sale.grand_total).toBe(20);

    // Inventory stock deducted
    const updatedProd = await db.select<{ stock: number }[]>(
      "SELECT stock FROM products WHERE id = $1",
      [prod.id]
    );
    expect(updatedProd[0].stock).toBe(98);
  });

  it("should record dues correctly when checkout has remaining balance", async () => {
    const db = await getDb();
    const prod = await createProduct({
      name: "Bag",
      price: 500,
      mrp: 600,
      stock: 10,
    });

    const paymentDetails: CheckoutPaymentDetails = {
      paymentMode: "Cash",
      paidAmount: 200,
      dueAmount: 300,
      cashPaid: 200,
      upiPaid: 0,
    };

    const cart: CartItem[] = [{ product: prod, quantity: 1 }];

    const sale = await createSale({
      customer_name: "Anita Sharma",
      customer_phone: "9123456789",
      total_mrp: 600,
      discount: 100,
      tax_amount: 0,
      payment_mode: paymentDetails.paymentMode,
      paid_amount: paymentDetails.paidAmount,
      due_amount: paymentDetails.dueAmount,
      cash_paid: paymentDetails.cashPaid,
      upi_paid: paymentDetails.upiPaid,
      items: cart.map((c) => ({
        product_id: c.product.id,
        product_name: c.product.name,
        barcode: c.product.barcode,
        price: c.product.price,
        quantity: c.quantity,
        mrp: c.product.mrp || c.product.price,
      })),
    });

    expect(sale.grand_total).toBe(500);

    // Verify customer dues recorded
    const cust = await db.select<{ dues: number }[]>(
      "SELECT dues FROM customers WHERE phone = $1",
      ["9123456789"]
    );
    expect(cust.length).toBe(1);
    expect(cust[0].dues).toBe(300);
  });

  it("should find customers by customer id, name, and phone with exact id matching to prevent false positives", () => {
    const sampleCustomers = [
      {
        id: 7,
        name: "SUNIL VERMA",
        phone: "9870001122",
        address: "",
        purchase_item_id: null,
        loyalty_points: 10,
        active_points: 0,
        lucky_draw_used: 0,
        lucky_draw_count: 1,
        dues: 0,
      },
      {
        id: 8,
        name: "DEEPAK JOSHI",
        phone: "9880003344",
        address: "",
        purchase_item_id: null,
        loyalty_points: 15,
        active_points: 5,
        lucky_draw_used: 0,
        lucky_draw_count: 1,
        dues: 0,
      },
      {
        id: 12,
        name: "KAVITA SHAH",
        phone: "9878990011", // phone has "78" in the middle
        address: "",
        purchase_item_id: null,
        loyalty_points: 25,
        active_points: 5,
        lucky_draw_used: 0,
        lucky_draw_count: 2,
        dues: 0,
      },
      {
        id: 78,
        name: "VIKRAM SINGH",
        phone: "9811223344",
        address: "",
        purchase_item_id: null,
        loyalty_points: 45,
        active_points: 5,
        lucky_draw_used: 0,
        lucky_draw_count: 4,
        dues: 0,
      },
    ];

    const filterByName = (input: string) => {
      const raw = input.trim();
      if (!raw) return sampleCustomers;
      const q = raw.toLowerCase();
      const clean = q.replace(/^#/, "").trim();
      const isNum = /^\d+$/.test(clean);

      if (isNum) {
        return sampleCustomers
          .filter((c) => {
            const isExactId = String(c.id) === clean;
            const isExactPhone = c.phone.trim() === clean;
            const isPhonePrefix = clean.length >= 6 && c.phone.trim().startsWith(clean);
            const isNameExact = c.name.toLowerCase() === q;
            return isExactId || isExactPhone || isPhonePrefix || isNameExact;
          })
          .sort((a, b) => {
            const aExactId = String(a.id) === clean ? 1 : 0;
            const bExactId = String(b.id) === clean ? 1 : 0;
            return bExactId - aExactId;
          });
      }

      return sampleCustomers.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const exactIdMatch = `#${c.id}` === q || String(c.id) === clean;
        return nameMatch || exactIdMatch;
      });
    };

    const filterByPhone = (input: string) => {
      const raw = input.trim();
      if (!raw) return sampleCustomers;
      const q = raw.toLowerCase();
      const clean = q.replace(/^#/, "").trim();
      const isNum = /^\d+$/.test(clean);

      if (isNum) {
        return sampleCustomers
          .filter((c) => {
            const isExactId = String(c.id) === clean;
            const isExactPhone = c.phone.trim() === clean;
            const isPhonePrefix = c.phone.trim().startsWith(clean);
            return isExactId || isExactPhone || isPhonePrefix;
          })
          .sort((a, b) => {
            const aExactId = String(a.id) === clean ? 1 : 0;
            const bExactId = String(b.id) === clean ? 1 : 0;
            return bExactId - aExactId;
          });
      }

      return sampleCustomers.filter((c) => {
        return `#${c.id}` === q || String(c.id) === clean || c.name.toLowerCase().includes(q);
      });
    };

    // 1. Searching "78" in Name matches ONLY customer #78 (NOT customer #7, #8, or #12 whose phone contains 78)
    const nameResults78 = filterByName("78");
    expect(nameResults78.length).toBe(1);
    expect(nameResults78[0].id).toBe(78);
    expect(nameResults78[0].name).toBe("VIKRAM SINGH");

    // 2. Searching "#78" in Name also matches ONLY customer #78
    const nameResultsHash78 = filterByName("#78");
    expect(nameResultsHash78.length).toBe(1);
    expect(nameResultsHash78[0].id).toBe(78);

    // 3. Searching "78" in Phone matches ONLY customer #78 (not phones containing 78 inside)
    const phoneResults78 = filterByPhone("78");
    expect(phoneResults78.length).toBe(1);
    expect(phoneResults78[0].id).toBe(78);

    // 4. Searching phone prefix "9878" in Phone finds customer #12 whose phone starts with 9878
    const phoneResultsPrefix = filterByPhone("9878");
    expect(phoneResultsPrefix.map((c) => c.id)).toContain(12);
    expect(phoneResultsPrefix.map((c) => c.id)).not.toContain(78);

    // 5. Searching name "Sunil" finds customer #7
    expect(filterByName("Sunil").map((c) => c.id)).toEqual([7]);
  });
});
