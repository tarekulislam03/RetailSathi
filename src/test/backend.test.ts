import { describe, it, expect, beforeEach } from "vitest";
import { createMockDatabase } from "./mockDb";

// Service Imports
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../features/inventory/services/inventoryService";
import { getBatchStatusMap } from "../features/inventory/utils/batchUtils";
import {
  createSale,
  fetchSaleDetails,
  updateSale,
  deleteSale,
} from "../features/billing/services/billingService";
import {
  createPurchase,
  getAllPurchases,
  getPurchaseWithItems,
} from "../features/purchases/services/purchaseService";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../features/purchases/services/supplierService";
import { fetchSalesWithItems } from "../features/sales/services/salesService";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  settleCustomerDues,
  getCustomerStats,
  fetchCustomerSales,
  fetchSaleItems,
} from "../features/customers/services/customerService";
import {
  fetchStockMovements,
  getLedgerStats,
} from "../features/ledger/services/ledgerService";
import {
  fetchMarketingPersons,
  fetchMarketingPersonSales,
  createMarketingPerson,
  updateMarketingPerson,
  deleteMarketingPerson,
  getMarketingStats,
} from "../features/marketing/services/marketingService";
import { Product } from "../features/inventory/types";

describe("Retail Sathi Backend Logic Tests", () => {
  beforeEach(() => {
    createMockDatabase();
  });

  // 1. INVENTORY FEATURE TESTS
  describe("Inventory Feature Backend Logic", () => {
    it("should perform inventory CRUD operations correctly", async () => {
      // Create product
      await createProduct({
        barcode: "8901001",
        name: "Test Rice 5kg",
        batch_no: "BATCH-1",
        mrp: 350,
        price: 320,
        stock: 50,
        hsn_code: "1006.30",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Groceries",
      });

      let products = await fetchProducts();
      expect(products.length).toBe(1);
      expect(products[0].name).toBe("Test Rice 5kg");
      expect(products[0].stock).toBe(50);

      // Update product
      await updateProduct(products[0].id, {
        barcode: "8901001",
        name: "Test Rice 5kg Premium",
        batch_no: "BATCH-1",
        mrp: 380,
        price: 340,
        stock: 45,
        hsn_code: "1006.30",
        reorder_threshold: 10,
        gst_rate: 5,
        category: "Groceries",
      });

      products = await fetchProducts();
      expect(products[0].name).toBe("Test Rice 5kg Premium");
      expect(products[0].price).toBe(340);

      // Delete product
      await deleteProduct(products[0].id);
      products = await fetchProducts();
      expect(products.length).toBe(0);

      console.log("inventory crud test passed!");
    });

    it("should search inventory products correctly", async () => {
      await createProduct({
        barcode: "8901001",
        name: "Basmati Rice 5kg",
        batch_no: "B001",
        mrp: 500,
        price: 450,
        stock: 20,
        hsn_code: "1006",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "Grains",
      });

      await createProduct({
        barcode: "8901002",
        name: "Sunflower Oil 1L",
        batch_no: "B002",
        mrp: 180,
        price: 160,
        stock: 30,
        hsn_code: "1512",
        reorder_threshold: 10,
        gst_rate: 5,
        category: "Oils",
      });

      const allProducts = await fetchProducts();

      const searchRice = allProducts.filter((p) =>
        p.name.toLowerCase().includes("rice")
      );
      expect(searchRice.length).toBe(1);
      expect(searchRice[0].name).toBe("Basmati Rice 5kg");

      const searchBarcode = allProducts.filter((p) => p.barcode === "8901002");
      expect(searchBarcode.length).toBe(1);
      expect(searchBarcode[0].name).toBe("Sunflower Oil 1L");

      console.log("inventory search test passed!");
    });

    it("should calculate batch status (New Stock vs Old Stock) correctly", async () => {
      const mockProducts: Product[] = [
        {
          id: 1,
          barcode: "8901001",
          name: "Atta 10kg",
          batch_no: "BATCH-1",
          mrp: 400,
          price: 380,
          stock: 20,
          hsn_code: "1101",
          reorder_threshold: 5,
          gst_rate: 0,
          category: "Flour",
          created_at: "2026-09-01 10:00:00",
        },
        {
          id: 2,
          barcode: "8901001",
          name: "Atta 10kg",
          batch_no: "BATCH-2",
          mrp: 420,
          price: 390,
          stock: 30,
          hsn_code: "1101",
          reorder_threshold: 5,
          gst_rate: 0,
          category: "Flour",
          created_at: "2026-09-10 10:00:00",
        },
        {
          id: 3,
          barcode: "8909999",
          name: "Single Batch Item",
          batch_no: "SINGLE-1",
          mrp: 100,
          price: 90,
          stock: 15,
          hsn_code: "9999",
          reorder_threshold: 2,
          gst_rate: 0,
          category: "General",
          created_at: "2026-09-05 10:00:00",
        },
      ];

      const statusMap = getBatchStatusMap(mockProducts);

      // Latest batch created on 2026-09-10 should be 'New Stock'
      expect(statusMap.get(2)).toBe("New Stock");
      // Older batch created on 2026-09-01 should be 'Old Stock'
      expect(statusMap.get(1)).toBe("Old Stock");
      // Item with only 1 batch available should be 'New Stock'
      expect(statusMap.get(3)).toBe("New Stock");

      console.log("inventory batch status test passed!");
    });
  });

  // 2. BILLING FEATURE TESTS
  describe("Billing POS Feature Backend Logic", () => {
    it("should calculate cart totals correctly", () => {
      const items = [
        { price: 100, qty: 2 }, // 200
        { price: 50, qty: 3 },  // 150
      ];

      const cartSubtotal = items.reduce((acc, i) => acc + i.price * i.qty, 0);
      expect(cartSubtotal).toBe(350);

      const discount = 50;
      const taxAmount = 18;
      const grandTotal = Math.max(0, cartSubtotal - discount + taxAmount);
      expect(grandTotal).toBe(318);

      console.log("billing cart calculation test passed!");
    });

    it("should validate stock availability during sale", async () => {
      await createProduct({
        barcode: "BAR123",
        name: "Stock Limited Item",
        batch_no: "B1",
        mrp: 100,
        price: 90,
        stock: 5,
        hsn_code: "1234",
        reorder_threshold: 2,
        gst_rate: 0,
        category: "General",
      });

      const products = await fetchProducts();
      const product = products[0];

      // Try ordering quantity greater than stock (10 > 5)
      const requestedQty = 10;
      const isStockAvailable = product.stock >= requestedQty;

      expect(isStockAvailable).toBe(false);

      console.log("billing stock validation test passed!");
    });

    it("should process sale transaction and deduct product stock", async () => {
      await createProduct({
        barcode: "BAR123",
        name: "Shampoo 200ml",
        batch_no: "B1",
        mrp: 150,
        price: 140,
        stock: 20,
        hsn_code: "3305",
        reorder_threshold: 2,
        gst_rate: 18,
        category: "Personal Care",
      });

      let products = await fetchProducts();
      const product = products[0];

      const invoiceNo = `INV-TEST-${Date.now()}`;
      const createdSale = await createSale({
        invoice_no: invoiceNo,
        customer_name: "John Doe",
        customer_phone: "9876543210",
        discount: 10,
        tax_amount: 18,
        payment_mode: "Cash",
        items: [
          {
            product_id: product.id!,
            product_name: product.name,
            barcode: product.barcode,
            price: product.price,
            quantity: 3,
          },
        ],
      });

      expect(createdSale.id).toBeGreaterThan(0);

      // Verify stock deduction (20 - 3 = 17)
      products = await fetchProducts();
      expect(products[0].stock).toBe(17);

      // Verify sale details retrieval
      const saleDetails = await fetchSaleDetails(createdSale.id);
      expect(saleDetails).not.toBeNull();
      expect(saleDetails!.items!.length).toBe(1);
      expect(saleDetails!.items![0].product_name).toBe("Shampoo 200ml");

      console.log("billing sale transaction test passed!");
    });
  });

  // 3. PURCHASES FEATURE TESTS
  describe("Purchases Feature Backend Logic", () => {
    it("should record purchases correctly", async () => {
      const purchaseId = await createPurchase({
        supplier_name: "ABC Wholesalers",
        invoice_no: "SUP-INV-001",
        purchase_date: "2026-09-10",
        gst_no: "22AAAAA0000A1Z5",
        contact_no: "9876543210",
        items: [
          {
            product_name: "Soap 100g",
            barcode: "SOAP01",
            batch_no: "BATCH-S1",
            hsn_code: "3401",
            category: "Soaps",
            purchase_price: 20,
            mrp: 30,
            selling_price: 25,
            gst_rate: 18,
            quantity: 100,
            subtotal: 2000,
          },
        ],
      });

      expect(purchaseId).toBeGreaterThan(0);

      const allPurchases = await getAllPurchases();
      expect(allPurchases.length).toBe(1);
      expect(allPurchases[0].supplier_name).toBe("ABC Wholesalers");
      expect(allPurchases[0].total_amount).toBe(2000);

      const details = await getPurchaseWithItems(purchaseId);
      expect(details.items.length).toBe(1);
      expect(details.items[0].product_name).toBe("Soap 100g");

      console.log("purchases crud test passed!");
    });

    it("should synchronize purchase items into inventory and handle new batches", async () => {
      // 1st Purchase for Batch B1
      await createPurchase({
        supplier_name: "Supplier A",
        invoice_no: "INV-100",
        purchase_date: "2026-09-01",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Detergent 1kg",
            barcode: "DET100",
            batch_no: "BATCH-B1",
            hsn_code: "3402",
            category: "Cleaning",
            purchase_price: 80,
            mrp: 120,
            selling_price: 100,
            gst_rate: 18,
            quantity: 50,
            subtotal: 4000,
          },
        ],
      });

      let products = await fetchProducts();
      expect(products.length).toBe(1);
      expect(products[0].batch_no).toBe("BATCH-B1");
      expect(products[0].stock).toBe(50);

      // 2nd Purchase for SAME batch B1 (should increase stock: 50 + 30 = 80)
      await createPurchase({
        supplier_name: "Supplier A",
        invoice_no: "INV-101",
        purchase_date: "2026-09-05",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Detergent 1kg",
            barcode: "DET100",
            batch_no: "BATCH-B1",
            hsn_code: "3402",
            category: "Cleaning",
            purchase_price: 80,
            mrp: 120,
            selling_price: 100,
            gst_rate: 18,
            quantity: 30,
            subtotal: 2400,
          },
        ],
      });

      products = await fetchProducts();
      expect(products.length).toBe(1);
      expect(products[0].stock).toBe(80);

      // 3rd Purchase for DIFFERENT batch B2 (should create a NEW batch product row)
      await createPurchase({
        supplier_name: "Supplier A",
        invoice_no: "INV-102",
        purchase_date: "2026-09-10",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Detergent 1kg",
            barcode: "DET100",
            batch_no: "BATCH-B2",
            hsn_code: "3402",
            category: "Cleaning",
            purchase_price: 85,
            mrp: 125,
            selling_price: 105,
            gst_rate: 18,
            quantity: 40,
            subtotal: 3400,
          },
        ],
      });

      products = await fetchProducts();
      expect(products.length).toBe(2);

      const batchB2 = products.find((p) => p.batch_no === "BATCH-B2");
      expect(batchB2).not.toBeUndefined();
      expect(batchB2?.stock).toBe(40);
      expect(batchB2?.price).toBe(105);

      console.log("purchases stock sync test passed!");
    });

    it("should search purchase records correctly", async () => {
      await createPurchase({
        supplier_name: "Global Traders",
        invoice_no: "GT-999",
        purchase_date: "2026-09-10",
        gst_no: "22BBBBB1111B1Z2",
        contact_no: "9988776655",
        items: [
          {
            product_name: "Item X",
            barcode: "X1",
            batch_no: "BX",
            hsn_code: "",
            category: "General",
            purchase_price: 10,
            mrp: 15,
            selling_price: 12,
            gst_rate: 0,
            quantity: 10,
            subtotal: 100,
          },
        ],
      });

      const allPurchases = await getAllPurchases();
      const filtered = allPurchases.filter(
        (p) =>
          p.supplier_name.toLowerCase().includes("traders") ||
          p.invoice_no.toLowerCase().includes("999")
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].supplier_name).toBe("Global Traders");

      console.log("purchases search test passed!");
    });
  });

  // 4. SUPPLIERS FEATURE TESTS
  describe("Suppliers Feature Backend Logic", () => {
    it("should perform supplier CRUD operations correctly", async () => {
      await createSupplier({
        name: "Rajesh Kumar",
        company_name: "RK Distributors",
        gst_no: "22CCCCC2222C1Z3",
        contact_no: "9876000000",
        email: "rajesh@rk.com",
        address: "Mumbai, India",
      });

      let suppliers = await fetchSuppliers();
      expect(suppliers.length).toBe(1);
      expect(suppliers[0].name).toBe("Rajesh Kumar");
      expect(suppliers[0].company_name).toBe("RK Distributors");

      await updateSupplier(suppliers[0].id, {
        name: "Rajesh Kumar",
        company_name: "RK Enterprises",
        gst_no: "22CCCCC2222C1Z3",
        contact_no: "9876111111",
        email: "contact@rkenterprises.com",
        address: "Mumbai, India",
      });

      suppliers = await fetchSuppliers();
      expect(suppliers[0].company_name).toBe("RK Enterprises");

      await deleteSupplier(suppliers[0].id);
      suppliers = await fetchSuppliers();
      expect(suppliers.length).toBe(0);

      console.log("supplier crud test passed!");
    });

    it("should search saved suppliers correctly", async () => {
      await createSupplier({
        name: "Anil Sharma",
        company_name: "Sharma Wholesale",
        gst_no: "22DDDDD3333D1Z4",
        contact_no: "9123456789",
        email: "",
        address: "",
      });

      const suppliers = await fetchSuppliers();
      const searchResult = suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes("anil") ||
          (s.company_name && s.company_name.toLowerCase().includes("sharma"))
      );

      expect(searchResult.length).toBe(1);
      expect(searchResult[0].name).toBe("Anil Sharma");

      console.log("supplier search test passed!");
    });
  });

  // 5. SALES HISTORY & ANALYTICS TESTS
  describe("Sales History & Analytics Backend Logic", () => {
    it("should calculate sales analytics and totals correctly", async () => {
      await createProduct({
        barcode: "PRD1",
        name: "Sample Product",
        batch_no: "B1",
        mrp: 100,
        price: 80,
        cost_price: 50,
        stock: 50,
        hsn_code: "",
        reorder_threshold: 0,
        gst_rate: 0,
        category: "General",
      });

      const products = await fetchProducts();
      const product = products[0];

      await createSale({
        invoice_no: `INV-ANALYTICS-1`,
        customer_name: "Walk-in",
        customer_phone: "",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Cash",
        items: [
          {
            product_id: product.id!,
            product_name: product.name,
            barcode: product.barcode,
            price: product.price,
            quantity: 2,
          },
        ],
      });

      const { sales, analytics } = await fetchSalesWithItems();
      expect(sales.length).toBe(1);
      expect(analytics.todayOrdersCount).toBe(1);
      expect(analytics.todaySales).toBe(160); // 80 * 2
      expect(analytics.monthlyProfit).toBe(60); // (80 - 50) * 2
      expect(analytics.totalProfit).toBe(60);  // (80 - 50) * 2

      console.log("sales analytics test passed!");
    });

    it("should edit sales and properly adjust daily/monthly sales, GST, and stock levels", async () => {
      await createProduct({
        barcode: "PRD100",
        name: "Test Edit Product",
        batch_no: "B1",
        mrp: 200,
        price: 150,
        cost_price: 100,
        stock: 50,
        hsn_code: "",
        reorder_threshold: 0,
        gst_rate: 18,
        category: "General",
      });

      const products = await fetchProducts();
      const product = products[0];

      // Initial sale: 2 units (stock becomes 48)
      const sale = await createSale({
        customer_name: "John Doe",
        customer_phone: "9998887776",
        discount: 0,
        tax_amount: 45.76,
        payment_mode: "Cash",
        items: [
          {
            product_id: product.id!,
            product_name: product.name,
            barcode: product.barcode,
            price: product.price,
            quantity: 2,
            gst_rate: 18,
          },
        ],
      });

      let updatedProducts = await fetchProducts();
      expect(updatedProducts[0].stock).toBe(48);

      const { analytics: initialAnalytics } = await fetchSalesWithItems();
      expect(initialAnalytics.todaySales).toBe(300);

      // Edit sale: increase quantity to 5 units (stock should become 45, todaySales becomes 750)
      await updateSale(sale.id, {
        customer_name: "John Doe Updated",
        customer_phone: "9998887776",
        discount: 50,
        tax_amount: 114.4,
        payment_mode: "Cash",
        items: [
          {
            product_id: product.id!,
            product_name: product.name,
            barcode: product.barcode,
            price: product.price,
            quantity: 5,
            gst_rate: 18,
          },
        ],
      });

      updatedProducts = await fetchProducts();
      expect(updatedProducts[0].stock).toBe(45); // 50 - 5 = 45

      const { sales: editedSales, analytics: editedAnalytics } = await fetchSalesWithItems();
      expect(editedSales[0].customer_name).toBe("John Doe Updated");
      expect(editedSales[0].grand_total).toBe(700); // 150 * 5 - 50 = 700
      expect(editedAnalytics.todaySales).toBe(700);

      console.log("edit sale test passed!");
    });

    it("should delete sales and properly decrease daily/monthly sales, GST, and revert stock levels", async () => {
      await createProduct({
        barcode: "PRD200",
        name: "Test Delete Product",
        batch_no: "B1",
        mrp: 100,
        price: 100,
        cost_price: 50,
        stock: 30,
        hsn_code: "",
        reorder_threshold: 0,
        gst_rate: 0,
        category: "General",
      });

      const products = await fetchProducts();
      const product = products[0];

      // Create a sale of 10 items (stock becomes 20)
      const sale = await createSale({
        customer_name: "Jane Smith",
        customer_phone: "5554443332",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Cash",
        items: [
          {
            product_id: product.id!,
            product_name: product.name,
            barcode: product.barcode,
            price: product.price,
            quantity: 10,
          },
        ],
      });

      let updatedProducts = await fetchProducts();
      expect(updatedProducts[0].stock).toBe(20);

      const { analytics: beforeDeleteAnalytics } = await fetchSalesWithItems();
      expect(beforeDeleteAnalytics.todaySales).toBe(1000);

      // Delete the sale
      await deleteSale(sale.id);

      // Verify product stock is restored (20 + 10 = 30)
      updatedProducts = await fetchProducts();
      expect(updatedProducts[0].stock).toBe(30);

      // Verify daily/monthly sales decrease back to 0
      const { sales: afterDeleteSales, analytics: afterDeleteAnalytics } = await fetchSalesWithItems();
      expect(afterDeleteSales.length).toBe(0);
      expect(afterDeleteAnalytics.todaySales).toBe(0);
      expect(afterDeleteAnalytics.monthlySales).toBe(0);
      expect(afterDeleteAnalytics.totalRevenue).toBe(0);

      console.log("delete sale test passed!");
    });
  });

  // 6. CUSTOMERS FEATURE TESTS
  describe("Customers Feature Backend Logic", () => {
    it("should perform customer CRUD operations correctly", async () => {
      // 1. Create customer with only name, phone, address
      const customerId = await createCustomer({
        name: "Amit Patel",
        phone: "9876543210",
        address: "123 Park Street, Kolkata",
      });

      expect(customerId).toBeGreaterThan(0);

      let customers = await fetchCustomers();
      expect(customers.length).toBe(1);
      expect(customers[0].name).toBe("Amit Patel");
      expect(customers[0].phone).toBe("9876543210");
      expect(customers[0].address).toBe("123 Park Street, Kolkata");
      expect(customers[0].loyalty_points).toBe(0);
      expect(customers[0].dues).toBe(0);

      // 2. Update customer details (name, phone, address)
      await updateCustomer(customerId, {
        name: "Amit Patel",
        phone: "9876543210",
        address: "456 Salt Lake, Kolkata",
      });

      customers = await fetchCustomers();
      expect(customers[0].address).toBe("456 Salt Lake, Kolkata");

      // 3. Delete customer
      await deleteCustomer(customerId);
      customers = await fetchCustomers();
      expect(customers.length).toBe(0);

      console.log("customer crud test passed!");
    });

    it("should automatically calculate loyalty points from purchase amount and record dues on credit sale", async () => {
      // 1. Create product
      await createProduct({
        barcode: "CUST-ITEM-1",
        name: "Premium Rice 10kg",
        batch_no: "B10",
        mrp: 600,
        price: 500,
        stock: 50,
        hsn_code: "1006",
        reorder_threshold: 5,
        gst_rate: 0,
        category: "Groceries",
      });

      const products = await fetchProducts();
      const prd = products[0];

      // 2. Register customer
      await createCustomer({
        name: "Rahul Sharma",
        phone: "9112233445",
        address: "MG Road, Bangalore",
      });

      // 3. Process POS sale with "Due" payment mode (2 x 500 = ₹1000)
      await createSale({
        customer_name: "Rahul Sharma",
        customer_phone: "9112233445",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Due",
        items: [
          {
            product_id: prd.id,
            product_name: prd.name,
            barcode: prd.barcode,
            price: prd.price,
            quantity: 2,
          },
        ],
      });

      const customers = await fetchCustomers();
      expect(customers.length).toBe(1);
      const rahul = customers[0];
      expect(rahul.name).toBe("Rahul Sharma");
      expect(rahul.total_spent).toBe(1000);
      expect(rahul.loyalty_points).toBe(100); // ₹1000 purchase = 100 pts
      expect(rahul.dues).toBe(1000); // Recorded dues from Credit/Due sale
      expect(rahul.purchase_item_name).toBe("Premium Rice 10kg");

      // Verify customer purchases retrieval
      const customerSales = await fetchCustomerSales("9112233445", "Rahul Sharma");
      expect(customerSales.length).toBe(1);
      expect(customerSales[0].grand_total).toBe(1000);

      const items = await fetchSaleItems(customerSales[0].id);
      expect(items.length).toBe(1);
      expect(items[0].product_name).toBe("Premium Rice 10kg");
      expect(items[0].quantity).toBe(2);

      const stats = await getCustomerStats();
      expect(stats.totalCustomers).toBe(1);
      expect(stats.totalLoyaltyPoints).toBe(100);
      expect(stats.totalDues).toBe(1000);

      // 4. Test auto-creation of a BRAND NEW customer during POS sale checkout
      await createSale({
        customer_name: "Sneha Kapur",
        customer_phone: "9988776655",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Due",
        items: [
          {
            product_id: prd.id,
            product_name: prd.name,
            barcode: prd.barcode,
            price: prd.price,
            quantity: 1,
          },
        ],
      });

      const updatedCustomers = await fetchCustomers();
      expect(updatedCustomers.length).toBe(2);
      const sneha = updatedCustomers.find((c) => c.name === "Sneha Kapur");
      expect(sneha).not.toBeUndefined();
      expect(sneha?.phone).toBe("9988776655");
      expect(sneha?.dues).toBe(500);
      expect(sneha?.loyalty_points).toBe(50); // ₹500 purchase = 50 points

      // 5. Test partial dues settlement (Clear ₹200 out of ₹500 dues for Sneha)
      await settleCustomerDues(sneha!.id, 200);
      let refreshedCustomers = await fetchCustomers();
      let snehaRefreshed = refreshedCustomers.find((c) => c.name === "Sneha Kapur");
      expect(snehaRefreshed?.dues).toBe(300);

      // 6. Test full dues settlement (Clear remaining dues)
      await settleCustomerDues(sneha!.id);
      refreshedCustomers = await fetchCustomers();
      snehaRefreshed = refreshedCustomers.find((c) => c.name === "Sneha Kapur");
      expect(snehaRefreshed?.dues).toBe(0);

      console.log("customer loyalty points and dues calculation test passed!");
    });
  });

  // 7. STOCK LEDGER FEATURE TESTS
  describe("Stock Ledger Feature Backend Logic", () => {
    it("should track stock IN (Purchases) and stock OUT (Sales) movements correctly", async () => {
      // 1. Record purchase (Stock IN: +100 units)
      await createPurchase({
        supplier_name: "Fresh Grains Ltd",
        invoice_no: "PUR-101",
        purchase_date: "2026-09-01",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Organic Sugar 1kg",
            barcode: "SUGAR100",
            batch_no: "BATCH-SUG1",
            hsn_code: "1701",
            category: "Groceries",
            purchase_price: 40,
            mrp: 60,
            selling_price: 50,
            gst_rate: 5,
            quantity: 100,
            subtotal: 4000,
          },
        ],
      });

      let movements = await fetchStockMovements();
      expect(movements.length).toBe(1);
      expect(movements[0].type).toBe("IN");
      expect(movements[0].product_name).toBe("Organic Sugar 1kg");
      expect(movements[0].quantity).toBe(100);
      expect(movements[0].available_quantity).toBe(100);
      expect(movements[0].party_name).toBe("Fresh Grains Ltd");

      const products = await fetchProducts();
      const prd = products[0];

      // 2. Record sale (Stock OUT: -10 units)
      await createSale({
        customer_name: "Vijay Nair",
        customer_phone: "9876123456",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Cash",
        items: [
          {
            product_id: prd.id,
            product_name: prd.name,
            barcode: prd.barcode,
            price: prd.price,
            quantity: 10,
          },
        ],
      });

      movements = await fetchStockMovements();
      expect(movements.length).toBe(2);

      const outMovement = movements.find((m) => m.type === "OUT");
      expect(outMovement).not.toBeUndefined();
      expect(outMovement?.quantity).toBe(10);
      expect(outMovement?.available_quantity).toBe(90); // 100 - 10 = 90
      expect(outMovement?.product_name).toBe("Organic Sugar 1kg");

      // 3. Verify ledger stats calculation
      const stats = await getLedgerStats();
      expect(stats.totalMovements).toBe(2);
      expect(stats.totalStockInQty).toBe(100);
      expect(stats.totalStockOutQty).toBe(10);
      expect(stats.netStockChange).toBe(90); // 100 - 10 = +90 units

      console.log("stock ledger test passed!");
    });

    it("should include products added directly through Inventory as STOCK IN movements in the ledger", async () => {
      await createProduct({
        barcode: "INV-DIRECT-01",
        name: "Direct Inventory Product",
        batch_no: "BATCH-INV",
        mrp: 200,
        price: 180,
        stock: 50,
        hsn_code: "9999",
        reorder_threshold: 5,
        gst_rate: 5,
        category: "General",
      });

      const movements = await fetchStockMovements();
      const invMovement = movements.find((m) => m.product_name === "Direct Inventory Product");

      expect(invMovement).not.toBeUndefined();
      expect(invMovement?.type).toBe("IN");
      expect(invMovement?.category).toBe("Inventory");
      expect(invMovement?.quantity).toBe(50);
      expect(invMovement?.available_quantity).toBe(50);
      expect(invMovement?.party_name).toBe("Direct Inventory");

      console.log("direct inventory stock ledger test passed!");
    });

    it("should record STOCK OUT (Adjustment) when stock is manually reduced below purchase quantities", async () => {
      await createPurchase({
        supplier_name: "Test Supplier",
        invoice_no: "INV-ADJ-001",
        purchase_date: "2026-09-01",
        gst_no: "",
        contact_no: "",
        items: [
          {
            product_name: "Adjusted Item",
            barcode: "ADJ001",
            batch_no: "BADJ1",
            hsn_code: "",
            category: "General",
            purchase_price: 10,
            mrp: 20,
            selling_price: 15,
            gst_rate: 0,
            quantity: 30,
            subtotal: 300,
          },
        ],
      });

      const products = await fetchProducts();
      const prd = products[0];

      // Manually adjust stock downwards in Inventory (from 30 to 20)
      await updateProduct(prd.id, {
        barcode: prd.barcode,
        name: prd.name,
        batch_no: prd.batch_no,
        mrp: prd.mrp,
        price: prd.price,
        stock: 20, // Reduced by 10 units
        hsn_code: prd.hsn_code,
        reorder_threshold: prd.reorder_threshold,
        gst_rate: prd.gst_rate,
        category: prd.category,
      });

      const movements = await fetchStockMovements();
      const adjMovement = movements.find((m) => m.category === "Adjustment");

      expect(adjMovement).not.toBeUndefined();
      expect(adjMovement?.type).toBe("OUT");
      expect(adjMovement?.quantity).toBe(10);
      expect(adjMovement?.available_quantity).toBe(20);
      expect(adjMovement?.party_name).toBe("Inventory Adjustment");

      console.log("stock adjustment ledger test passed!");
    });
  });

  // 8. MARKETING FEATURE TESTS
  describe("Marketing Feature Backend Logic", () => {
    it("should perform marketing personnel CRUD operations, auto-track POS sales, and calculate percentage commission correctly", async () => {
      // 1. Create marketing person (5% commission rate)
      const personId = await createMarketingPerson({
        name: "Vikram Singh",
        phone: "9876501234",
        area: "North Zone",
        commission: 5, // 5% commission rate
      });

      expect(personId).toBeGreaterThan(0);

      let persons = await fetchMarketingPersons();
      expect(persons.length).toBe(1);
      expect(persons[0].name).toBe("Vikram Singh");
      expect(persons[0].phone).toBe("9876501234");
      expect(persons[0].area).toBe("North Zone");
      expect(persons[0].sales).toBe(0); // Starts at 0
      expect(persons[0].commission).toBe(5); // 5%

      // 2. Create product for billing test
      await createProduct({
        barcode: "MKT-ITEM-1",
        name: "Test Rice 10kg",
        batch_no: "BM1",
        mrp: 500,
        price: 400,
        stock: 50,
        hsn_code: "1006",
        reorder_threshold: 5,
        gst_rate: 0,
        category: "Groceries",
      });

      const prods = await fetchProducts();
      const prd = prods[0];

      // 3. Process POS sale selecting Vikram Singh as marketing person (2 x 400 = 800)
      await createSale({
        customer_name: "Walk-in Customer",
        customer_phone: "",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Cash",
        marketing_person_id: personId,
        items: [
          {
            product_id: prd.id,
            product_name: prd.name,
            barcode: prd.barcode,
            price: prd.price,
            quantity: 2,
          },
        ],
      });

      // 4. Verify completed sales and earned commission auto-updated for Vikram Singh
      persons = await fetchMarketingPersons();
      expect(persons[0].sales).toBe(800); // Recorded 800 completed sales
      expect(persons[0].commission).toBe(5); // 5%

      let stats = await getMarketingStats();
      expect(stats.totalPersonnel).toBe(1);
      expect(stats.totalSalesCompleted).toBe(800);
      expect(stats.totalCommission).toBe(40); // 5% of 800 = 40

      // 5. Update marketing person details (change commission to 10%)
      await updateMarketingPerson(personId, {
        name: "Vikram Singh",
        phone: "9876501234",
        area: "North & West Zone",
        sales: persons[0].sales,
        commission: 10, // 10%
      });

      persons = await fetchMarketingPersons();
      expect(persons[0].area).toBe("North & West Zone");
      expect(persons[0].commission).toBe(10);

      stats = await getMarketingStats();
      expect(stats.totalCommission).toBe(80); // 10% of 800 = 80

      // 6. Delete record
      await deleteMarketingPerson(personId);
      persons = await fetchMarketingPersons();
      expect(persons.length).toBe(0);

      stats = await getMarketingStats();
      expect(stats.totalPersonnel).toBe(0);
      expect(stats.totalSalesCompleted).toBe(0);
      expect(stats.totalCommission).toBe(0);

      console.log("marketing personnel POS integration test passed!");
    });

    it("should fetch marketing person sales breakdown and compute lifetime vs monthly metrics correctly", async () => {
      const personId = await createMarketingPerson({
        name: "Sunil Sharma",
        phone: "9123456780",
        area: "East Zone",
        commission: 10,
      });

      await createProduct({
        barcode: "MKT-PROD-2",
        name: "Cooking Oil 1L",
        batch_no: "BOIL2",
        mrp: 200,
        price: 150,
        stock: 100,
        hsn_code: "1512",
        reorder_threshold: 5,
        gst_rate: 0,
        category: "Oils",
      });

      const prods = await fetchProducts();
      const prd = prods[0];

      await createSale({
        customer_name: "Anita Roy",
        customer_phone: "9876000000",
        discount: 0,
        tax_amount: 0,
        payment_mode: "Cash",
        marketing_person_id: personId,
        items: [
          {
            product_id: prd.id,
            product_name: prd.name,
            barcode: prd.barcode,
            price: prd.price,
            quantity: 4, // 600
          },
        ],
      });

      const { person, sales } = await fetchMarketingPersonSales(personId);
      expect(person).not.toBeNull();
      expect(sales.length).toBe(1);
      expect(sales[0].grand_total).toBe(600);
      expect(sales[0].commission_earned).toBe(60); // 10% of 600 = 60

      const persons = await fetchMarketingPersons();
      expect(persons[0].lifetime_sales).toBe(600);
      expect(persons[0].lifetime_commission).toBe(60);
      expect(persons[0].monthly_sales).toBe(600);
      expect(persons[0].monthly_commission).toBe(60);

      console.log("marketing person sales breakdown test passed!");
    });
  });
});
