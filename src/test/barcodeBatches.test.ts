import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";
import {
  createProduct,
  updateProduct,
  fetchProducts,
} from "../features/inventory/services/inventoryService";
import { createSale } from "../features/billing/services/billingService";

describe("Barcode & Multi-Batch Inventory and Billing Tests", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  describe("Inventory Barcode & Batch Uniqueness Rules", () => {
    it("should allow same barcode for same product with different batch numbers", async () => {
      // Batch 1
      const prod1 = await createProduct({
        barcode: "8901234567890",
        name: "Tata Salt 1kg",
        batch_no: "BATCH-2026A",
        mrp: 28,
        price: 26,
        stock: 50,
        hsn_code: "2501",
        reorder_threshold: 10,
        gst_rate: 0,
        category: "Groceries",
      });

      expect(prod1.id).toBeGreaterThan(0);

      // Batch 2 with same barcode and same product name, different batch_no and different MRP
      const prod2 = await createProduct({
        barcode: "8901234567890",
        name: "Tata Salt 1kg",
        batch_no: "BATCH-2026B",
        mrp: 30,
        price: 28,
        stock: 40,
        hsn_code: "2501",
        reorder_threshold: 10,
        gst_rate: 0,
        category: "Groceries",
      });

      expect(prod2.id).toBeGreaterThan(0);
      expect(prod2.id).not.toBe(prod1.id);

      const all = await fetchProducts();
      const saltBatches = all.filter((p) => p.barcode === "8901234567890");
      expect(saltBatches.length).toBe(2);
      expect(saltBatches.map((b) => b.batch_no)).toEqual(
        expect.arrayContaining(["BATCH-2026A", "BATCH-2026B"])
      );
    });

    it("should reject adding product with same barcode but duplicate batch_no", async () => {
      await createProduct({
        barcode: "8901234567890",
        name: "Tata Salt 1kg",
        batch_no: "BATCH-2026A",
        mrp: 28,
        price: 26,
        stock: 50,
        hsn_code: "2501",
        reorder_threshold: 10,
        gst_rate: 0,
        category: "Groceries",
      });

      // Try adding another with same barcode and same batch_no
      await expect(
        createProduct({
          barcode: "8901234567890",
          name: "Tata Salt 1kg",
          batch_no: "BATCH-2026A",
          mrp: 28,
          price: 26,
          stock: 20,
          hsn_code: "2501",
          reorder_threshold: 10,
          gst_rate: 0,
          category: "Groceries",
        })
      ).rejects.toThrow(/already exists.*Batch number must be unique/i);
    });

    it("should reject adding product with same barcode but different product name", async () => {
      await createProduct({
        barcode: "8901234567890",
        name: "Tata Salt 1kg",
        batch_no: "BATCH-2026A",
        mrp: 28,
        price: 26,
        stock: 50,
        hsn_code: "2501",
        reorder_threshold: 10,
        gst_rate: 0,
        category: "Groceries",
      });

      // Try adding different product with same barcode
      await expect(
        createProduct({
          barcode: "8901234567890",
          name: "Washing Soap 200g",
          batch_no: "BATCH-NEW",
          mrp: 40,
          price: 35,
          stock: 20,
          hsn_code: "3401",
          reorder_threshold: 5,
          gst_rate: 18,
          category: "Cleaning",
        })
      ).rejects.toThrow(/already registered to.*same name/i);
    });

    it("should reject update that creates duplicate batch for same barcode", async () => {
      const prod1 = await createProduct({
        barcode: "890999900001",
        name: "Basmati Rice 5kg",
        batch_no: "BATCH-1",
        mrp: 450,
        price: 400,
        stock: 30,
        hsn_code: "1006",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Grains",
      });

      const prod2 = await createProduct({
        barcode: "890999900001",
        name: "Basmati Rice 5kg",
        batch_no: "BATCH-2",
        mrp: 480,
        price: 430,
        stock: 25,
        hsn_code: "1006",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Grains",
      });

      // Try updating prod2's batch_no to "BATCH-1"
      await expect(
        updateProduct(prod2.id, {
          barcode: "890999900001",
          name: "Basmati Rice 5kg",
          batch_no: "BATCH-1",
          mrp: 480,
          price: 430,
          stock: 25,
          hsn_code: "1006",
          reorder_threshold: 5,
          gst_rate: 5,
          category: "Grains",
        })
      ).rejects.toThrow(/already exists.*Batch number must be unique/i);

      // Updating prod2 with its own batch or another unique batch should succeed
      await expect(
        updateProduct(prod2.id, {
          barcode: "890999900001",
          name: "Basmati Rice 5kg",
          batch_no: "BATCH-2-REV",
          mrp: 490,
          price: 440,
          stock: 25,
          hsn_code: "1006",
          reorder_threshold: 5,
          gst_rate: 5,
          category: "Grains",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Billing Multi-Batch POS Logic", () => {
    it("should correctly sell and deduct stock from the user-selected batch", async () => {
      // Setup: Same barcode, 2 different batches with different MRPs and prices
      const barcode = "890555566667";
      const batchA = await createProduct({
        barcode,
        name: "Sunflower Oil 1L",
        batch_no: "BATCH-AUG26",
        mrp: 180,
        price: 160,
        stock: 20,
        hsn_code: "1512",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Oils",
      });

      const batchB = await createProduct({
        barcode,
        name: "Sunflower Oil 1L",
        batch_no: "BATCH-OCT26",
        mrp: 195,
        price: 175,
        stock: 35,
        hsn_code: "1512",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Oils",
      });

      // Cashier selects Batch B (mrp 195, price 175) to sell 3 units
      const sale = await createSale({
        customer_name: "Rahul Verma",
        customer_phone: "9876543210",
        payment_mode: "Cash",
        items: [
          {
            product_id: batchB.id,
            product_name: batchB.name,
            barcode: batchB.barcode,
            batch_no: batchB.batch_no,
            price: batchB.price,
            mrp: batchB.mrp,
            quantity: 3,
            gst_rate: 5,
          },
        ],
      });

      expect(sale.grand_total).toBe(175 * 3);
      expect(sale.items?.[0].batch_no).toBe("BATCH-OCT26");

      // Verify stock in inventory:
      // Batch A stock remains 20 (untouched)
      // Batch B stock reduced by 3 (35 - 3 = 32)
      const freshProducts = await fetchProducts();
      const updatedBatchA = freshProducts.find((p) => p.id === batchA.id)!;
      const updatedBatchB = freshProducts.find((p) => p.id === batchB.id)!;

      expect(updatedBatchA.stock).toBe(20);
      expect(updatedBatchB.stock).toBe(32);
    });
  });
});
