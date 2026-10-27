import { getDb } from "../../../services/database";
import { Customer, CustomerInput, CustomerStatsData } from "../types";
import { Sale, SaleItem } from "../../billing/types";

/**
 * Calculates customer loyalty points based on total purchase amount.
 * Formula: 1 point for every ₹100 spent (e.g. ₹250 spent = 2 points).
 */
export function calculateLoyaltyPoints(totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  return Math.floor(totalSpent / 100);
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
      COALESCE(c.lucky_draw_used, 0) AS lucky_draw_used,
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

  const staleUpdates: { id: number; points: number }[] = [];

  const result = rows.map((r) => {
    const phone = (r.phone || "").trim();
    const nameKey = (r.name || "").trim().toLowerCase();

    // Match sales summary by phone first, then by name
    const summary = phoneSalesMap.get(phone) || nameSalesMap.get(nameKey) || {
      count: 0,
      spent: 0,
    };

    // Calculate loyalty points from total purchase amount, preserving existing stored points
    const storedLoyaltyPoints = Number(r.loyalty_points) || 0;
    const spentBasedPoints =
      summary.count > 0 ? calculateLoyaltyPoints(summary.spent) : 0;
    const finalLoyaltyPoints = Math.max(storedLoyaltyPoints, spentBasedPoints);
    if (finalLoyaltyPoints !== storedLoyaltyPoints) {
      staleUpdates.push({ id: r.id, points: finalLoyaltyPoints });
    }

    const luckyDrawUsed = Math.max(0, Number(r.lucky_draw_used) || 0);
    const totalDrawsEarned = Math.floor(finalLoyaltyPoints / 10);
    const eligibleLuckyDraws = Math.max(0, totalDrawsEarned - luckyDrawUsed);

    return {
      id: r.id,
      name: (r.name || "").toUpperCase(),
      phone: r.phone || "",
      address: r.address || "",
      purchase_item_id: r.purchase_item_id ?? null,
      purchase_item_name: r.purchase_item_name || undefined,
      total_purchases_count: summary.count,
      total_spent: summary.spent,
      loyalty_points: finalLoyaltyPoints,
      active_points: finalLoyaltyPoints % 10,
      lucky_draw_used: luckyDrawUsed,
      lucky_draw_count: eligibleLuckyDraws,
      dues: Number(r.dues) || 0,
      created_at: r.created_at,
    };
  });

  // Persist recalculated points and uppercase names so previously stored values match
  for (const u of staleUpdates) {
    try {
      await db.execute("UPDATE customers SET loyalty_points = $1 WHERE id = $2", [
        u.points,
        u.id,
      ]);
    } catch (err) {
      console.error("Failed to sync loyalty points:", err);
    }
  }

  try {
    await db.execute("UPDATE customers SET name = UPPER(name) WHERE name IS NOT NULL AND name != UPPER(name)");
  } catch (err) {
    // ignore
  }

  return result;
}

export async function fetchCustomerById(id: number): Promise<Customer | null> {
  const customers = await fetchCustomers();
  return customers.find((c) => c.id === id) || null;
}

export async function createCustomer(input: CustomerInput): Promise<number> {
  const db = await getDb();
  const normalizedName = input.name.trim().toUpperCase();
  const initialPoints = Number(input.loyalty_points) || 0;
  const initialDues = Number(input.dues) || 0;
  const result = await db.execute(
    `INSERT INTO customers (name, phone, address, purchase_item_id, loyalty_points, dues)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      normalizedName,
      input.phone.trim(),
      (input.address || "").trim(),
      input.purchase_item_id ?? null,
      initialPoints,
      initialDues,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateCustomer(
  id: number,
  input: CustomerInput
): Promise<void> {
  const db = await getDb();
  const normalizedName = input.name.trim().toUpperCase();
  if (input.loyalty_points !== undefined) {
    await db.execute(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3, loyalty_points = $4
       WHERE id = $5`,
      [
        normalizedName,
        input.phone.trim(),
        (input.address || "").trim(),
        Number(input.loyalty_points) || 0,
        id,
      ]
    );
  } else {
    await db.execute(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3
       WHERE id = $4`,
      [
        normalizedName,
        input.phone.trim(),
        (input.address || "").trim(),
        id,
      ]
    );
  }
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM customers WHERE id = $1", [id]);
}

/**
 * Updates how many lucky draws the customer has used.
 */
export async function updateCustomerLuckyDrawUsed(
  id: number,
  usedCount: number
): Promise<void> {
  const db = await getDb();
  const safeCount = Math.max(0, Math.floor(usedCount));
  await db.execute(
    "UPDATE customers SET lucky_draw_used = $1 WHERE id = $2",
    [safeCount, id]
  );
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
 * 4. Updates loyalty points (existing points + points earned on this sale).
 * Returns the customer ID, updated loyalty points, and points earned on this sale.
 */
export async function recordCustomerSale(
  customerPhone: string,
  customerName: string,
  grandTotal: number,
  paymentMode: string,
  firstProductId?: number,
  dueAmount?: number
): Promise<{ customerId: number; updatedPoints: number; earnedPoints: number } | null> {
  const phone = (customerPhone || "").trim();
  const name = (customerName || "").trim();
  if (!phone && (!name || name.toLowerCase() === "walk-in customer")) {
    return null; // Walk-in customer without phone, skip profile link
  }

  const db = await getDb();

  // Find existing customer by phone or name
  let customerId: number | null = null;
  let currentDues = 0;
  let existingPoints = 0;

  if (phone) {
    const rows = await db.select<{ id: number; dues: number; loyalty_points: number }[]>(
      "SELECT id, dues, loyalty_points FROM customers WHERE phone = $1 LIMIT 1",
      [phone]
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
      currentDues = Number(rows[0].dues) || 0;
      existingPoints = Number(rows[0].loyalty_points) || 0;
    }
  }

  if (!customerId && name && name.toLowerCase() !== "walk-in customer") {
    const rows = await db.select<{ id: number; dues: number; loyalty_points: number }[]>(
      "SELECT id, dues, loyalty_points FROM customers WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name]
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
      currentDues = Number(rows[0].dues) || 0;
      existingPoints = Number(rows[0].loyalty_points) || 0;
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

  const earnedPoints = calculateLoyaltyPoints(grandTotal);
  let updatedPoints = 0;

  // If customer doesn't exist, create automatically with calculated initial points and dues
  if (!customerId) {
    updatedPoints = earnedPoints;
    const newName = (name ? name.toUpperCase() : `Customer (${phone})`).toUpperCase();
    const initialDues = addedDues;
    const insertRes = await db.execute(
      `INSERT INTO customers (name, phone, address, purchase_item_id, loyalty_points, dues)
       VALUES ($1, $2, '', $3, $4, $5)`,
      [newName, phone, firstProductId ?? null, updatedPoints, initialDues]
    );
    customerId = insertRes.lastInsertId ?? null;
  } else {
    // Existing customer: add earned points to existing points, also ensure >= spent-based formula
    const spentRows = await db.select<{ total_spent: number }[]>(
      `SELECT COALESCE(SUM(grand_total), 0) as total_spent 
       FROM sales 
       WHERE (customer_phone = $1 AND customer_phone IS NOT NULL AND customer_phone != '') 
          OR (LOWER(customer_name) = LOWER($2) AND customer_name IS NOT NULL AND customer_name != '')`,
      [phone, name]
    );
    const totalSpent = spentRows.length > 0 ? Number(spentRows[0].total_spent) || 0 : 0;
    const spentBasedPoints = calculateLoyaltyPoints(totalSpent);

    updatedPoints = Math.max(existingPoints + earnedPoints, spentBasedPoints);

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

  return { customerId: customerId ?? 0, updatedPoints, earnedPoints };
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
