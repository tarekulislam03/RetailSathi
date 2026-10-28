import { getDb } from "../../../services/database";
import { notifyDbUpdated } from "../../../services/syncProcessor";
import { Sale, SaleItem, CreateSaleInput, UpdateSaleInput } from "../types";
import { recordCustomerSale, calculateLoyaltyPoints } from "../../customers/services/customerService";
import { generateInvoiceInfo, getRealTime } from "../../../services/realTimeService";
import { parseSaleDate } from "../../../utils/dateUtils";
import { invoiceToEan13 } from "../../../utils/ean13";

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const db = await getDb();

  if (input.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  // 1. Verify stock availability for all items
  for (const item of input.items) {
    const rows = await db.select<{ stock: number }[]>(
      "SELECT stock FROM products WHERE id = $1",
      [item.product_id]
    );
    if (rows.length === 0) {
      throw new Error(`Product ID #${item.product_id} not found.`);
    }
    if (rows[0].stock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${item.product_name}". Available: ${rows[0].stock}, Requested: ${item.quantity}`
      );
    }
  }

  // Calibrated real-world invoice number and timestamp (in Asia/Kolkata timezone)
  const { invoiceNo, localCreatedAt } = generateInvoiceInfo();

  // Subtotal (Total MRP), Discount, Inclusive GST, and Grand Total
  let sellingTotal = 0;
  let totalMrp = input.total_mrp || 0;
  let calculatedGst = 0;

  for (const item of input.items) {
    const itemSellingTotal = item.price * item.quantity;
    sellingTotal += itemSellingTotal;
    const itemMrp = item.mrp !== undefined ? item.mrp : item.price;
    if (!input.total_mrp) {
      totalMrp += itemMrp * item.quantity;
    }

    const gstRate = item.gst_rate || 0;
    if (gstRate > 0) {
      const itemTaxable = itemSellingTotal / (1 + gstRate / 100);
      calculatedGst += itemSellingTotal - itemTaxable;
    }
  }

  const discountVal =
    input.discount !== undefined
      ? input.discount
      : Math.max(0, totalMrp - sellingTotal);
  const taxAmountVal =
    input.tax_amount !== undefined ? input.tax_amount : calculatedGst;

  const dbTotalAmount = totalMrp > 0 ? totalMrp : sellingTotal;
  const grandTotal = Math.max(0, dbTotalAmount - discountVal);

  let formattedPaymentMode = input.payment_mode || "Cash";
  const dueAmt = input.due_amount !== undefined ? input.due_amount : 0;
  const cashPaidAmt = input.cash_paid !== undefined ? input.cash_paid : 0;
  const upiPaidAmt = input.upi_paid !== undefined ? input.upi_paid : 0;

  if (input.payment_mode.toLowerCase().includes("split")) {
    if (dueAmt > 0) {
      formattedPaymentMode = `Split (Cash: ₹${cashPaidAmt.toFixed(2)}, UPI: ₹${upiPaidAmt.toFixed(2)}, Due: ₹${dueAmt.toFixed(2)})`;
    } else {
      formattedPaymentMode = `Split (Cash: ₹${cashPaidAmt.toFixed(2)}, UPI: ₹${upiPaidAmt.toFixed(2)})`;
    }
  } else if (dueAmt > 0 && !formattedPaymentMode.toLowerCase().includes("due")) {
    formattedPaymentMode = `${formattedPaymentMode} (Due: ₹${dueAmt.toFixed(2)})`;
  }

  // 2. Insert master sale record & retrieve lastInsertId
  const insertSaleRes = await db.execute(
    `INSERT INTO sales (invoice_no, customer_name, customer_phone, total_amount, discount, tax_amount, grand_total, payment_mode, marketing_person_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      invoiceNo,
      input.customer_name || "Walk-in Customer",
      input.customer_phone || "",
      dbTotalAmount,
      discountVal,
      taxAmountVal,
      grandTotal,
      formattedPaymentMode,
      input.marketing_person_id || null,
      localCreatedAt,
    ]
  );

  let saleId = insertSaleRes.lastInsertId;
  if (!saleId) {
    const rows = await db.select<{ id: number }[]>(
      "SELECT id FROM sales WHERE invoice_no = $1",
      [invoiceNo]
    );
    if (!rows || rows.length === 0) {
      throw new Error("Failed to retrieve invoice record ID.");
    }
    saleId = rows[0].id;
  }

  // If marketing person selected, record sales amount to their account
  if (input.marketing_person_id) {
    try {
      await db.execute(
        "UPDATE marketing SET sales = sales + $1 WHERE id = $2",
        [grandTotal, input.marketing_person_id]
      );
    } catch (mktErr) {
      console.error("Failed to update marketing personnel sales:", mktErr);
    }
  }

  // 3. Insert sale items & deduct stock
  const saleItems: SaleItem[] = [];
  for (const item of input.items) {
    const itemTotal = item.price * item.quantity;
    const itemMrp = item.mrp !== undefined && item.mrp > 0 ? item.mrp : item.price;
    await db.execute(
      `INSERT INTO sale_items (sale_id, invoice_no, product_id, product_name, barcode, batch_no, price, quantity, total_price, mrp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        saleId,
        invoiceNo,
        item.product_id,
        item.product_name,
        item.barcode || "",
        item.batch_no || "",
        item.price,
        item.quantity,
        itemTotal,
        itemMrp,
      ]
    );

    // Deduct stock and update mrp & price in products table if modified
    if (item.mrp !== undefined && item.mrp > 0) {
      await db.execute(
        "UPDATE products SET stock = stock - $1, price = $2, mrp = $3 WHERE id = $4",
        [item.quantity, item.price, item.mrp, item.product_id]
      );
    } else {
      await db.execute(
        "UPDATE products SET stock = stock - $1, price = $2 WHERE id = $3",
        [item.quantity, item.price, item.product_id]
      );
    }

    saleItems.push({
      sale_id: saleId,
      invoice_no: invoiceNo,
      product_id: item.product_id,
      product_name: item.product_name,
      barcode: item.barcode || "",
      batch_no: item.batch_no || "",
      price: item.price,
      quantity: item.quantity,
      total_price: itemTotal,
      mrp: item.mrp !== undefined ? item.mrp : item.price,
    });
  }

  // 4. Record sale on customer profile (update loyalty points, dues & purchased item)
  let updatedLoyaltyPoints: number | undefined;
  let earnedLoyaltyPoints: number | undefined;
  let customerId: number | undefined;
  try {
    const firstProductId = input.items[0]?.product_id;
    const custResult = await recordCustomerSale(
      input.customer_phone || "",
      input.customer_name || "",
      grandTotal,
      input.payment_mode || "Cash",
      firstProductId,
      input.due_amount
    );
    if (custResult) {
      customerId = custResult.customerId;
      updatedLoyaltyPoints = custResult.updatedPoints;
      earnedLoyaltyPoints = custResult.earnedPoints;
      await db.execute(
        "UPDATE sales SET loyalty_points = $1, customer_id = $2 WHERE id = $3",
        [updatedLoyaltyPoints, customerId, saleId]
      );
    }
  } catch (custErr) {
    console.error("Failed to sync customer sale record:", custErr);
  }

  return {
    id: saleId,
    invoice_no: invoiceNo,
    customer_id: customerId,
    customer_name: input.customer_name || "Walk-in Customer",
    customer_phone: input.customer_phone || "",
    total_amount: dbTotalAmount,
    discount: discountVal,
    tax_amount: taxAmountVal,
    grand_total: grandTotal,
    payment_mode: formattedPaymentMode,
    paid_amount: input.paid_amount,
    due_amount: input.due_amount,
    cash_paid: input.cash_paid,
    upi_paid: input.upi_paid,
    loyalty_points: updatedLoyaltyPoints,
    points_earned: earnedLoyaltyPoints,
    created_at: localCreatedAt,
    items: saleItems,
  };
}

export async function fetchSales(): Promise<Sale[]> {
  const db = await getDb();
  const sales = await db.select<Sale[]>(
    "SELECT * FROM sales ORDER BY id DESC"
  );
  return sales;
}

export async function fetchTodayBillsCount(): Promise<number> {
  const db = await getDb();
  const sales = await db.select<{ created_at: string; invoice_no: string }[]>(
    "SELECT created_at, invoice_no FROM sales"
  );
  const now = getRealTime();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const todayStr = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let count = 0;
  for (const s of sales) {
    const saleDate = parseSaleDate(s.created_at, s.invoice_no);
    const isToday =
      saleDate &&
      !isNaN(saleDate.getTime()) &&
      saleDate.getDate() === todayDay &&
      saleDate.getMonth() === todayMonth &&
      saleDate.getFullYear() === todayYear;
    if (isToday || (s.created_at && s.created_at.includes(todayStr))) {
      count++;
    }
  }
  return count;
}

export async function fetchSaleDetails(saleId: number): Promise<Sale | null> {
  const db = await getDb();
  const sales = await db.select<Sale[]>(
    "SELECT * FROM sales WHERE id = $1",
    [saleId]
  );
  if (sales.length === 0) return null;

  const sale = sales[0];
  const items = await db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1",
    [saleId]
  );
  sale.items = items;

  // Fallback to customer table loyalty points and customer ID if not stored on historical sale
  if (
    (!sale.customer_id || sale.loyalty_points === undefined || sale.loyalty_points === null || sale.loyalty_points === 0) &&
    (sale.customer_phone || (sale.customer_name && sale.customer_name.toLowerCase() !== "walk-in customer"))
  ) {
    try {
      const custRows = await db.select<{ id: number; loyalty_points: number }[]>(
        "SELECT id, loyalty_points FROM customers WHERE (phone = $1 AND phone != '') OR (LOWER(name) = LOWER($2) AND name != '') LIMIT 1",
        [sale.customer_phone || "", sale.customer_name || ""]
      );
      if (custRows.length > 0) {
        if (!sale.customer_id) {
          sale.customer_id = custRows[0].id;
        }
        if (
          (sale.loyalty_points === undefined || sale.loyalty_points === null || sale.loyalty_points === 0) &&
          custRows[0].loyalty_points > 0
        ) {
          sale.loyalty_points = custRows[0].loyalty_points;
        }
      }
    } catch {
      // ignore
    }
  }

  return sale;
}

export async function fetchSaleByInvoice(invoiceNo: string): Promise<Sale | null> {
  const db = await getDb();
  const trimmed = invoiceNo.trim();
  if (!trimmed) return null;

  // 1. Exact match by invoice_no
  let sales = await db.select<Sale[]>(
    "SELECT * FROM sales WHERE LOWER(invoice_no) = LOWER($1) LIMIT 1",
    [trimmed]
  );

  // 2. EAN-13 barcode scan match (13 digits)
  if (sales.length === 0 && /^\d{13}$/.test(trimmed)) {
    // If derived from INV-YYYYMMDD-HHMMSS-RRR (YYMMDDHHMMSS + C)
    const yy = trimmed.slice(0, 2);
    const mm = trimmed.slice(2, 4);
    const dd = trimmed.slice(4, 6);
    const hh = trimmed.slice(6, 8);
    const min = trimmed.slice(8, 10);
    const ss = trimmed.slice(10, 12);
    const invPrefix = `INV-20${yy}${mm}${dd}-${hh}${min}${ss}%`;

    sales = await db.select<Sale[]>(
      "SELECT * FROM sales WHERE invoice_no LIKE $1 LIMIT 1",
      [invPrefix]
    );

    // Fallback: match against recent sales using invoiceToEan13
    if (sales.length === 0) {
      const recent = await db.select<Sale[]>(
        "SELECT * FROM sales ORDER BY id DESC LIMIT 200"
      );
      const match = recent.find((s) => invoiceToEan13(s.invoice_no, s.id) === trimmed);
      if (match) {
        sales = [match];
      }
    }
  }

  // 3. Fallback: match by partial invoice or ID
  if (sales.length === 0) {
    sales = await db.select<Sale[]>(
      "SELECT * FROM sales WHERE invoice_no LIKE '%' || $1 || '%' OR id = $2 LIMIT 1",
      [trimmed, parseInt(trimmed, 10) || 0]
    );
  }

  if (sales.length === 0) return null;

  const sale = sales[0];
  const items = await db.select<SaleItem[]>(
    `SELECT * FROM sale_items 
     WHERE (invoice_no IS NOT NULL AND invoice_no != '' AND invoice_no = $1) OR sale_id = $2
     ORDER BY id ASC`,
    [sale.invoice_no, sale.id]
  );
  sale.items = items;

  // Fallback to customer table loyalty points and customer ID if not stored on historical sale
  if (
    (!sale.customer_id || sale.loyalty_points === undefined || sale.loyalty_points === null || sale.loyalty_points === 0) &&
    (sale.customer_phone || (sale.customer_name && sale.customer_name.toLowerCase() !== "walk-in customer"))
  ) {
    try {
      const custRows = await db.select<{ id: number; loyalty_points: number }[]>(
        "SELECT id, loyalty_points FROM customers WHERE (phone = $1 AND phone != '') OR (LOWER(name) = LOWER($2) AND name != '') LIMIT 1",
        [sale.customer_phone || "", sale.customer_name || ""]
      );
      if (custRows.length > 0) {
        if (!sale.customer_id) {
          sale.customer_id = custRows[0].id;
        }
        if (
          (sale.loyalty_points === undefined || sale.loyalty_points === null || sale.loyalty_points === 0) &&
          custRows[0].loyalty_points > 0
        ) {
          sale.loyalty_points = custRows[0].loyalty_points;
        }
      }
    } catch {
      // ignore
    }
  }

  return sale;
}

export async function updateSale(
  saleId: number,
  input: UpdateSaleInput
): Promise<Sale> {
  const db = await getDb();

  if (input.items.length === 0) {
    throw new Error("Sale must contain at least one product item.");
  }

  // 1. Fetch old sale & old sale items
  const oldSales = await db.select<Sale[]>("SELECT * FROM sales WHERE id = $1", [
    saleId,
  ]);
  if (oldSales.length === 0) {
    throw new Error("Sale record not found.");
  }
  const oldSale = oldSales[0];
  const oldItems = await db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1",
    [saleId]
  );

  // 2. Compute net stock changes per product
  const stockChanges: Record<number, number> = {};
  for (const oldItem of oldItems) {
    if (oldItem.product_id) {
      stockChanges[oldItem.product_id] =
        (stockChanges[oldItem.product_id] || 0) - oldItem.quantity;
    }
  }
  for (const newItem of input.items) {
    if (newItem.product_id) {
      stockChanges[newItem.product_id] =
        (stockChanges[newItem.product_id] || 0) + newItem.quantity;
    }
  }

  // Validate stock availability for products where requirement increased
  for (const [pIdStr, diff] of Object.entries(stockChanges)) {
    const pId = Number(pIdStr);
    if (diff > 0) {
      const rows = await db.select<{ name: string; stock: number }[]>(
        "SELECT name, stock FROM products WHERE id = $1",
        [pId]
      );
      if (rows.length === 0) {
        throw new Error(`Product ID #${pId} not found.`);
      }
      if (rows[0].stock < diff) {
        throw new Error(
          `Insufficient stock for "${rows[0].name}". Required additional: ${diff}, Available: ${rows[0].stock}`
        );
      }
    }
  }

  // 3. Recalculate Totals, Discounts, and Inclusive GST
  let sellingTotal = 0;
  let totalMrp = input.total_mrp || 0;
  let calculatedGst = 0;

  for (const item of input.items) {
    const itemSellingTotal = item.price * item.quantity;
    sellingTotal += itemSellingTotal;
    const itemMrp = item.mrp !== undefined && item.mrp > 0 ? item.mrp : item.price;
    if (!input.total_mrp) {
      totalMrp += itemMrp * item.quantity;
    }

    const gstRate = item.gst_rate || 0;
    if (gstRate > 0) {
      const itemTaxable = itemSellingTotal / (1 + gstRate / 100);
      calculatedGst += itemSellingTotal - itemTaxable;
    }
  }

  const additionalDiscount = Math.max(0, input.discount || 0);
  const mrpDiscount = Math.max(0, totalMrp - sellingTotal);
  const discountVal = mrpDiscount + additionalDiscount;
  const taxAmountVal =
    input.tax_amount !== undefined ? input.tax_amount : calculatedGst;

  const dbTotalAmount = totalMrp > 0 ? totalMrp : sellingTotal;
  const grandTotal = Math.max(0, sellingTotal - additionalDiscount);

  let formattedPaymentMode = input.payment_mode || oldSale.payment_mode || "Cash";
  const dueAmt = input.due_amount !== undefined ? input.due_amount : 0;
  const cashPaidAmt = input.cash_paid !== undefined ? input.cash_paid : 0;
  const upiPaidAmt = input.upi_paid !== undefined ? input.upi_paid : 0;

  if (formattedPaymentMode.toLowerCase().includes("split")) {
    if (dueAmt > 0) {
      formattedPaymentMode = `Split (Cash: ₹${cashPaidAmt.toFixed(2)}, UPI: ₹${upiPaidAmt.toFixed(2)}, Due: ₹${dueAmt.toFixed(2)})`;
    } else {
      formattedPaymentMode = `Split (Cash: ₹${cashPaidAmt.toFixed(2)}, UPI: ₹${upiPaidAmt.toFixed(2)})`;
    }
  } else if (dueAmt > 0 && !formattedPaymentMode.toLowerCase().includes("due")) {
    formattedPaymentMode = `${formattedPaymentMode} (Due: ₹${dueAmt.toFixed(2)})`;
  }

  // 4. Update products stock
  for (const [pIdStr, diff] of Object.entries(stockChanges)) {
    const pId = Number(pIdStr);
    if (diff !== 0) {
      await db.execute("UPDATE products SET stock = stock - $1 WHERE id = $2", [
        diff,
        pId,
      ]);
    }
  }

  // 5. Update Marketing person sales
  const oldMktId = oldSale.marketing_person_id;
  const newMktId = input.marketing_person_id;
  if (oldMktId && oldMktId !== newMktId) {
    try {
      await db.execute(
        "UPDATE marketing SET sales = MAX(0, sales - $1) WHERE id = $2",
        [oldSale.grand_total, oldMktId]
      );
    } catch (e) {
      console.error("Failed to revert old marketing sales:", e);
    }
  }
  if (newMktId) {
    const salesDiff =
      oldMktId === newMktId ? grandTotal - oldSale.grand_total : grandTotal;
    try {
      if (salesDiff >= 0) {
        await db.execute(
          "UPDATE marketing SET sales = sales + $1 WHERE id = $2",
          [salesDiff, newMktId]
        );
      } else {
        await db.execute(
          "UPDATE marketing SET sales = MAX(0, sales - $1) WHERE id = $2",
          [Math.abs(salesDiff), newMktId]
        );
      }
    } catch (e) {
      console.error("Failed to update marketing sales:", e);
    }
  }

  // 6. Update master sale record
  await db.execute(
    `UPDATE sales 
     SET customer_name = $1,
         customer_phone = $2,
         total_amount = $3,
         discount = $4,
         tax_amount = $5,
         grand_total = $6,
         payment_mode = $7,
         marketing_person_id = $8
     WHERE invoice_no = $9`,
    [
      input.customer_name || "Walk-in Customer",
      input.customer_phone || "",
      dbTotalAmount,
      discountVal,
      taxAmountVal,
      grandTotal,
      formattedPaymentMode,
      newMktId || null,
      oldSale.invoice_no,
    ]
  );

  // 7. Update sale_items
  await db.execute("DELETE FROM sale_items WHERE invoice_no = $1", [oldSale.invoice_no]);
  const newSaleItems: SaleItem[] = [];
  for (const item of input.items) {
    const itemTotal = item.price * item.quantity;
    const itemMrp = item.mrp !== undefined && item.mrp > 0 ? item.mrp : item.price;
    await db.execute(
      `INSERT INTO sale_items (sale_id, invoice_no, product_id, product_name, barcode, batch_no, price, quantity, total_price, mrp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        saleId,
        oldSale.invoice_no,
        item.product_id,
        item.product_name,
        item.barcode || "",
        item.batch_no || "",
        item.price,
        item.quantity,
        itemTotal,
        itemMrp,
      ]
    );
    newSaleItems.push({
      sale_id: saleId,
      invoice_no: oldSale.invoice_no,
      product_id: item.product_id,
      product_name: item.product_name,
      barcode: item.barcode || "",
      batch_no: item.batch_no || "",
      price: item.price,
      quantity: item.quantity,
      total_price: itemTotal,
      mrp: itemMrp,
    });
  }

  // 8. Record sale on customer profile
  try {
    const firstProductId = input.items[0]?.product_id;
    await recordCustomerSale(
      input.customer_phone || "",
      input.customer_name || "",
      grandTotal,
      input.payment_mode || "Cash",
      firstProductId,
      input.due_amount
    );
  } catch (custErr) {
    console.error("Failed to sync customer sale record on update:", custErr);
  }

  return {
    id: saleId,
    invoice_no: oldSale.invoice_no,
    customer_name: input.customer_name || "Walk-in Customer",
    customer_phone: input.customer_phone || "",
    total_amount: dbTotalAmount,
    discount: discountVal,
    tax_amount: taxAmountVal,
    grand_total: grandTotal,
    payment_mode: formattedPaymentMode,
    paid_amount: input.paid_amount,
    due_amount: input.due_amount,
    cash_paid: input.cash_paid,
    upi_paid: input.upi_paid,
    marketing_person_id: newMktId,
    created_at: oldSale.created_at,
    items: newSaleItems,
  };
}

export async function deleteSale(saleId: number): Promise<void> {
  const db = await getDb();

  // 1. Get sale record
  const sales = await db.select<Sale[]>("SELECT * FROM sales WHERE id = $1", [
    saleId,
  ]);
  if (!sales || sales.length === 0) {
    throw new Error("Sale record not found.");
  }
  const sale = sales[0];

  // 2. Get sale items
  const saleItems = await db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1",
    [saleId]
  );

  // 3. Return stock to products table (increase stock for each sale item)
  for (const item of saleItems) {
    let restored = false;
    // Attempt 1: by product_id if valid
    if (item.product_id && item.product_id > 0) {
      try {
        const res = await db.execute(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [item.quantity, item.product_id]
        );
        if (res && res.rowsAffected && res.rowsAffected > 0) {
          restored = true;
        }
      } catch (err) {
        console.error(`Failed to revert stock for product ID #${item.product_id}:`, err);
      }
    }

    // Attempt 2: fallback by barcode (and batch_no if available) if product_id was not matched
    if (!restored && item.barcode && item.barcode.trim()) {
      try {
        if (item.batch_no && item.batch_no.trim()) {
          const res = await db.execute(
            "UPDATE products SET stock = stock + $1 WHERE barcode = $2 AND batch_no = $3",
            [item.quantity, item.barcode.trim(), item.batch_no.trim()]
          );
          if (res && res.rowsAffected && res.rowsAffected > 0) {
            restored = true;
          }
        }
        if (!restored) {
          const res = await db.execute(
            "UPDATE products SET stock = stock + $1 WHERE barcode = $2",
            [item.quantity, item.barcode.trim()]
          );
          if (res && res.rowsAffected && res.rowsAffected > 0) {
            restored = true;
          }
        }
      } catch (err) {
        console.error(`Failed to revert stock by barcode ${item.barcode}:`, err);
      }
    }

    // Attempt 3: fallback by product_name if product_id and barcode did not match
    if (!restored && item.product_name && item.product_name.trim()) {
      try {
        await db.execute(
          "UPDATE products SET stock = stock + $1 WHERE LOWER(name) = LOWER($2)",
          [item.quantity, item.product_name.trim()]
        );
      } catch (err) {
        console.error(`Failed to revert stock by name ${item.product_name}:`, err);
      }
    }
  }

  // Notify active views (Inventory, Billing, Sales) that product stocks and sales have updated
  notifyDbUpdated("products");

  // 4. Revert marketing sales if marketing person assigned
  if (sale.marketing_person_id) {
    try {
      await db.execute(
        "UPDATE marketing SET sales = MAX(0, sales - $1) WHERE id = $2",
        [sale.grand_total, sale.marketing_person_id]
      );
    } catch (mktErr) {
      console.error("Failed to revert marketing sales on delete:", mktErr);
    }
  }

  // 5. Revert customer dues if applicable
  const phone = (sale.customer_phone || "").trim();
  const name = (sale.customer_name || "").trim();
  let customerId: number | null = null;

  if (phone || (name && name.toLowerCase() !== "walk-in customer")) {
    try {
      if (phone) {
        const rows = await db.select<{ id: number; dues: number }[]>(
          "SELECT id, dues FROM customers WHERE phone = $1 LIMIT 1",
          [phone]
        );
        if (rows.length > 0) {
          customerId = rows[0].id;
        }
      }
      if (!customerId && name && name.toLowerCase() !== "walk-in customer") {
        const rows = await db.select<{ id: number; dues: number }[]>(
          "SELECT id, dues FROM customers WHERE LOWER(name) = LOWER($1) LIMIT 1",
          [name]
        );
        if (rows.length > 0) {
          customerId = rows[0].id;
        }
      }

      if (customerId) {
        let saleDueAmount = 0;
        if (sale.due_amount !== undefined && sale.due_amount > 0) {
          saleDueAmount = sale.due_amount;
        } else if (sale.payment_mode) {
          const match = sale.payment_mode.match(/Due:\s*₹?\s*([\d.]+)/i);
          if (match && match[1]) {
            saleDueAmount = parseFloat(match[1]) || 0;
          } else if (
            sale.payment_mode.toLowerCase() === "due" ||
            sale.payment_mode.toLowerCase() === "credit"
          ) {
            saleDueAmount = sale.grand_total;
          }
        }

        if (saleDueAmount > 0) {
          await db.execute(
            "UPDATE customers SET dues = MAX(0, dues - $1) WHERE id = $2",
            [saleDueAmount, customerId]
          );
        }
      }
    } catch (custErr) {
      console.error("Failed to revert customer dues on sale delete:", custErr);
    }
  }

  // 6. Delete sale items and sale records from database (identified globally by invoice_no)
  await db.execute("DELETE FROM sale_items WHERE invoice_no = $1", [sale.invoice_no]);
  await db.execute("DELETE FROM sales WHERE invoice_no = $1", [sale.invoice_no]);

  // 7. Recalculate customer loyalty points after sale deletion
  if (customerId && (phone || name)) {
    try {
      const custRows = await db.select<{ loyalty_points: number }[]>(
        "SELECT loyalty_points FROM customers WHERE id = $1",
        [customerId]
      );
      const currentPts = custRows.length > 0 ? Number(custRows[0].loyalty_points) || 0 : 0;
      const salePoints = sale.points_earned !== undefined ? sale.points_earned : calculateLoyaltyPoints(sale.grand_total);

      const spentRows = await db.select<{ total_spent: number }[]>(
        `SELECT COALESCE(SUM(grand_total), 0) as total_spent 
         FROM sales 
         WHERE (customer_phone = $1 AND customer_phone IS NOT NULL AND customer_phone != '') 
            OR (LOWER(customer_name) = LOWER($2) AND customer_name IS NOT NULL AND customer_name != '')`,
        [phone, name]
      );
      const totalSpent =
        spentRows.length > 0 ? Number(spentRows[0].total_spent) || 0 : 0;
      const spentBasedPoints = calculateLoyaltyPoints(totalSpent);

      const newPoints =
        totalSpent > 0 ? spentBasedPoints : Math.max(0, currentPts - salePoints);
      await db.execute(
        "UPDATE customers SET loyalty_points = $1 WHERE id = $2",
        [newPoints, customerId]
      );
    } catch (ptsErr) {
      console.error("Failed to recalculate loyalty points on sale delete:", ptsErr);
    }
  }

  notifyDbUpdated("all");
}

