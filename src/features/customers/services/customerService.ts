import { getDb } from "../../../services/database";
import { Customer, CustomerInput, CustomerStatsData } from "../types";
import { Sale, SaleItem } from "../../billing/types";

/**
 * Calculates customer loyalty points based on total purchase amount.
 * Formula: 1 point for every ₹10 spent (e.g. ₹250 spent = 25 points).
 * Minimum 1 point for any valid purchase > ₹0.
 */
export function calculateLoyaltyPoints(totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  const pts = Math.floor(totalSpent / 10);
  return Math.max(1, pts);
}

export async function fetchCustomers(): Promise<Customer[]> {
  const db = await getDb();

  // Fetch base customer rows with joined product name from purchase_item_id
  const rows = await db.select<any[]>(`
    SELECT 
      c.id, 
      c.name, 
      c.phone, 
      c.address, 
      c.purchase_item_id, 
      c.loyalty_points, 
      c.dues, 
      c.created_at,
      p.name AS purchase_item_name
    FROM customers c
    LEFT JOIN products p ON c.purchase_item_id = p.id
    ORDER BY c.id DESC
  `);

  // Fetch sales summary grouped by customer phone / name to compute total purchases & loyalty points dynamically
  const salesSummary = await db.select<any[]>(`
    SELECT 
      customer_phone,
      customer_name,
      COUNT(*) as purchases_count,
      COALESCE(SUM(grand_total), 0) as total_spent
    FROM sales
    GROUP BY customer_phone, customer_name
  `);

  const phoneSalesMap = new Map<string, { count: number; spent: number }>();
  const nameSalesMap = new Map<string, { count: number; spent: number }>();

  for (const s of salesSummary) {
    const summary = {
      count: Number(s.purchases_count) || 0,
      spent: Number(s.total_spent) || 0,
    };
    if (s.customer_phone && s.customer_phone.trim()) {
      const pKey = s.customer_phone.trim();
      const prev = phoneSalesMap.get(pKey) || { count: 0, spent: 0 };
      phoneSalesMap.set(pKey, {
        count: prev.count + summary.count,
        spent: prev.spent + summary.spent,
      });
    }
    if (
      s.customer_name &&
      s.customer_name.trim() &&
      s.customer_name.trim().toLowerCase() !== "walk-in customer"
    ) {
      const nKey = s.customer_name.trim().toLowerCase();
      const prev = nameSalesMap.get(nKey) || { count: 0, spent: 0 };
      nameSalesMap.set(nKey, {
        count: prev.count + summary.count,
        spent: prev.spent + summary.spent,
      });
    }
  }

  return rows.map((r) => {
    const phone = (r.phone || "").trim();
    const nameKey = (r.name || "").trim().toLowerCase();

    // Match sales summary by phone first, then by name
    const summary = phoneSalesMap.get(phone) || nameSalesMap.get(nameKey) || {
      count: 0,
      spent: 0,
    };

    // Calculate loyalty points from total purchase amount, fallback to stored row points
    const computedLoyaltyPoints = calculateLoyaltyPoints(summary.spent);
    const finalLoyaltyPoints = Math.max(
      computedLoyaltyPoints,
      Number(r.loyalty_points) || 0
    );

    return {
      id: r.id,
      name: r.name || "",
      phone: r.phone || "",
      address: r.address || "",
      purchase_item_id: r.purchase_item_id ?? null,
      purchase_item_name: r.purchase_item_name || undefined,
      total_purchases_count: summary.count,
      total_spent: summary.spent,
      loyalty_points: finalLoyaltyPoints,
      dues: Number(r.dues) || 0,
      created_at: r.created_at,
    };
  });
}

export async function fetchCustomerById(id: number): Promise<Customer | null> {
  const customers = await fetchCustomers();
  return customers.find((c) => c.id === id) || null;
}

export async function createCustomer(input: CustomerInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO customers (name, phone, address, purchase_item_id, loyalty_points, dues)
     VALUES ($1, $2, $3, NULL, 0, 0)`,
    [
      input.name.trim(),
      input.phone.trim(),
      (input.address || "").trim(),
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateCustomer(
  id: number,
  input: CustomerInput
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE customers
     SET name = $1, phone = $2, address = $3
     WHERE id = $4`,
    [
      input.name.trim(),
      input.phone.trim(),
      (input.address || "").trim(),
      id,
    ]
  );
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM customers WHERE id = $1", [id]);
}

/**
 * Settles outstanding dues for a customer by deducting amountToClear or setting dues = 0.
 */
export async function settleCustomerDues(
  id: number,
  amountToClear?: number
): Promise<void> {
  const db = await getDb();
  if (amountToClear === undefined || amountToClear <= 0) {
    await db.execute("UPDATE customers SET dues = 0 WHERE id = $1", [id]);
  } else {
    const rows = await db.select<{ dues: number }[]>(
      "SELECT dues FROM customers WHERE id = $1",
      [id]
    );
    if (rows.length > 0) {
      const currentDues = Number(rows[0].dues) || 0;
      const newDues = Math.max(0, currentDues - amountToClear);
      await db.execute("UPDATE customers SET dues = $1 WHERE id = $2", [
        newDues,
        id,
      ]);
    }
  }
}

/**
 * Fetches all sales history for a specific customer by phone and name.
 */
export async function fetchCustomerSales(
  customerPhone: string,
  customerName: string
): Promise<Sale[]> {
  const db = await getDb();
  const phone = (customerPhone || "").trim();
  const name = (customerName || "").trim();

  if (!phone && !name) return [];

  const rows = await db.select<Sale[]>(
    `SELECT * FROM sales 
     WHERE (customer_phone = $1 AND customer_phone IS NOT NULL AND customer_phone != '') 
        OR (LOWER(customer_name) = LOWER($2) AND customer_name IS NOT NULL AND customer_name != '')
     ORDER BY id DESC`,
    [phone, name]
  );
  return rows;
}

/**
 * Fetches itemized line items for a specific sale ID.
 */
export async function fetchSaleItems(saleId: number): Promise<SaleItem[]> {
  const db = await getDb();
  const items = await db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id ASC",
    [saleId]
  );
  return items;
}

/**
 * Links POS sales to customers during checkout:
 * 1. Checks if customer exists by phone/name. If not, auto-registers customer.
 * 2. If paymentMode is "Due" or "Credit", adds grandTotal to customer's dues.
 * 3. Updates purchase_item_id to the last purchased product ID.
 * 4. Recalculates loyalty points based on total purchase amount.
 */
export async function recordCustomerSale(
  customerPhone: string,
  customerName: string,
  grandTotal: number,
  paymentMode: string,
  firstProductId?: number,
  dueAmount?: number
): Promise<void> {
  const phone = (customerPhone || "").trim();
  const name = (customerName || "").trim();
  if (!phone && (!name || name.toLowerCase() === "walk-in customer")) {
    return; // Walk-in customer without phone, skip profile link
  }

  const db = await getDb();

  // Find existing customer by phone or name
  let customerId: number | null = null;
  let currentDues = 0;

  if (phone) {
    const rows = await db.select<{ id: number; dues: number }[]>(
      "SELECT id, dues FROM customers WHERE phone = $1 LIMIT 1",
      [phone]
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
      currentDues = Number(rows[0].dues) || 0;
    }
  }

  if (!customerId && name && name.toLowerCase() !== "walk-in customer") {
    const rows = await db.select<{ id: number; dues: number }[]>(
      "SELECT id, dues FROM customers WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
      currentDues = Number(rows[0].dues) || 0;
    }
  }

  // Calculate added dues
  let addedDues = 0;
  if (dueAmount !== undefined) {
    addedDues = Math.max(0, dueAmount);
  } else {
    const isCreditSale =
      paymentMode.toLowerCase() === "due" || paymentMode.toLowerCase() === "credit";
    addedDues = isCreditSale ? grandTotal : 0;
  }

  // Calculate overall total spent by this customer across all sales
  const spentRows = await db.select<{ total_spent: number }[]>(
    `SELECT COALESCE(SUM(grand_total), 0) as total_spent 
     FROM sales 
     WHERE (customer_phone = $1 AND customer_phone IS NOT NULL AND customer_phone != '') 
        OR (LOWER(customer_name) = LOWER($2) AND customer_name IS NOT NULL AND customer_name != '')`,
    [phone, name]
  );

  let totalSpent = spentRows.length > 0 ? Number(spentRows[0].total_spent) || 0 : 0;
  if (totalSpent === 0 && grandTotal > 0) {
    totalSpent = grandTotal;
  }
  const updatedPoints = calculateLoyaltyPoints(totalSpent);

  // If customer doesn't exist, create automatically with calculated initial points and dues
  if (!customerId) {
    const newName = name || `Customer (${phone})`;
    const initialDues = addedDues;
    const insertRes = await db.execute(
      `INSERT INTO customers (name, phone, address, purchase_item_id, loyalty_points, dues)
       VALUES ($1, $2, '', $3, $4, $5)`,
      [newName, phone, firstProductId ?? null, updatedPoints, initialDues]
    );
    customerId = insertRes.lastInsertId ?? null;
  } else {
    // Existing customer: update dues, purchase_item_id, and loyalty_points
    const newDues = currentDues + addedDues;
    if (firstProductId) {
      await db.execute(
        `UPDATE customers SET purchase_item_id = $1, dues = $2, loyalty_points = $3 WHERE id = $4`,
        [firstProductId, newDues, updatedPoints, customerId]
      );
    } else {
      await db.execute(
        `UPDATE customers SET dues = $1, loyalty_points = $2 WHERE id = $3`,
        [newDues, updatedPoints, customerId]
      );
    }
  }
}

export async function getCustomerStats(): Promise<CustomerStatsData> {
  const customers = await fetchCustomers();
  const totalCustomers = customers.length;
  const totalLoyaltyPoints = customers.reduce(
    (sum, c) => sum + c.loyalty_points,
    0
  );
  const totalDues = customers.reduce((sum, c) => sum + c.dues, 0);
  const customersWithDues = customers.filter((c) => c.dues > 0).length;

  return {
    totalCustomers,
    totalLoyaltyPoints,
    totalDues,
    customersWithDues,
  };
}
