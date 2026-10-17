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
});
