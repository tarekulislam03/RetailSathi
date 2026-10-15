import { getDb } from "../../../services/database";
import { Sale, SaleItem } from "../../billing/types";
import { parseSaleDate } from "../../../utils/dateUtils";
import { getRealTime } from "../../../services/realTimeService";
export { fetchSaleDetails, updateSale, deleteSale } from "../../billing/services/billingService";


export interface SalesAnalytics {
  todaySales: number;
  monthlySales: number;
  todayGst: number;
  monthlyGst: number;
  totalGst: number;
  monthlyProfit: number;
  totalProfit: number;
  todayOrdersCount: number;
  totalRevenue: number;
}

/**
 * Calculates net profit for a sale matching Manage Sales & Profit report logic:
 * (Selling Price - Cost/MRP) * Qty - Discount.
 * If line items are missing, falls back to 70% cost (30% net margin).
 */
export function calculateSaleProfit(sale: Sale): number {
  let saleCost = 0;
  if (sale.items && sale.items.length > 0) {
    for (const item of sale.items) {
      const costPrice = (item as any).cost_price;
      const itemMrp = (item as any).mrp;
      const unitCost =
        costPrice && costPrice > 0
          ? costPrice
          : itemMrp && itemMrp > 0 && itemMrp < item.price
          ? itemMrp
          : item.price * 0.8;
      saleCost += unitCost * item.quantity;
    }
  } else {
    saleCost = sale.grand_total * 0.7; // default fallback if line items missing
  }
  return Math.max(0, sale.total_amount - saleCost - sale.discount);
}

/**
 * Returns YYYY-MM key for grouping sales by month matching Manage Sales & Profit report.
 */
export function getSaleMonthKey(sale: Sale, fallbackDate: Date = new Date()): string {
  const dateObj = sale.created_at ? new Date(sale.created_at) : null;
  if (dateObj && !isNaN(dateObj.getTime())) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  }
  const parsed = parseSaleDate(sale.created_at, sale.invoice_no);
  if (parsed && !isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns YYYY-MM-DD date key and formatted date label for grouping sales by day.
 */
export function getSaleDateKey(sale: Sale, fallbackDate: Date = new Date()): { dateKey: string; dateLabel: string } {
  let d: Date | null = null;
  const parsed = parseSaleDate(sale.created_at, sale.invoice_no);
  if (parsed && !isNaN(parsed.getTime())) {
    d = parsed;
  } else if (sale.created_at) {
    const raw = new Date(sale.created_at);
    if (!isNaN(raw.getTime())) d = raw;
  }
  if (!d) d = fallbackDate;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateKey = `${year}-${month}-${day}`;
  const dateLabel = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return { dateKey, dateLabel };
}

export async function fetchSalesWithItems(): Promise<{
  sales: Sale[];
  analytics: SalesAnalytics;
}> {
  const db = await getDb();
  const sales = await db.select<Sale[]>("SELECT * FROM sales ORDER BY id DESC");

  // Fetch all sale items to calculate exact profits
  const allItems = await db.select<any[]>(`
    SELECT si.*, p.cost_price, p.mrp
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
  `);

  // Map items to sales by sale_id AND invoice_no for maximum resilience
  const itemsMap: Record<number, SaleItem[]> = {};
  const itemsByInvoiceMap: Record<string, SaleItem[]> = {};
  for (const item of allItems) {
    const saleItem: SaleItem = {
      id: item.id,
      sale_id: item.sale_id,
      invoice_no: item.invoice_no,
      product_id: item.product_id,
      product_name: item.product_name,
      barcode: item.barcode || "",
      price: item.price,
      quantity: item.quantity,
      total_price: item.total_price,
      ...item,
    };
    if (item.sale_id) {
      if (!itemsMap[item.sale_id]) itemsMap[item.sale_id] = [];
      const list = itemsMap[item.sale_id];
      const isDup = list.some(
        (ex) =>
          ex.product_id === saleItem.product_id &&
          ex.quantity === saleItem.quantity &&
          ex.price === saleItem.price
      );
      if (!isDup) list.push(saleItem);
    }
    if (item.invoice_no) {
      if (!itemsByInvoiceMap[item.invoice_no]) itemsByInvoiceMap[item.invoice_no] = [];
      const list = itemsByInvoiceMap[item.invoice_no];
      const isDup = list.some(
        (ex) =>
          ex.product_id === saleItem.product_id &&
          ex.quantity === saleItem.quantity &&
          ex.price === saleItem.price
      );
      if (!isDup) list.push(saleItem);
    }
  }

  const now = getRealTime();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const currentMonthKey = `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}`;

  let todaySales = 0;
  let monthlySales = 0;
  let todayGst = 0;
  let monthlyGst = 0;
  let totalGst = 0;
  let monthlyProfit = 0;
  let totalProfit = 0;
  let totalRevenue = 0;
  let todayOrdersCount = 0;

  for (const sale of sales) {
    sale.items = (sale.invoice_no && itemsByInvoiceMap[sale.invoice_no]) || itemsMap[sale.id] || [];
    totalRevenue += sale.grand_total;
    const saleTax = sale.tax_amount || 0;
    totalGst += saleTax;

    // Date parsing
    const saleDate = parseSaleDate(sale.created_at, sale.invoice_no);
    const isToday =
      saleDate &&
      !isNaN(saleDate.getTime()) &&
      saleDate.getDate() === todayDay &&
      saleDate.getMonth() === todayMonth &&
      saleDate.getFullYear() === todayYear;

    // Fallback string matching for en-IN formatted created_at
    const dateString = sale.created_at || "";
    const todayStr = now.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const matchesToday = isToday || dateString.includes(todayStr);

    // Month matching synchronized with Manage Sales & Profit report
    const monthKey = getSaleMonthKey(sale, now);
    const matchesMonth = monthKey === currentMonthKey;

    if (matchesToday) {
      todaySales += sale.grand_total;
      todayGst += saleTax;
      todayOrdersCount += 1;
    }

    // Profit Calculation synchronized with Manage Sales & Profit report
    const saleProfit = calculateSaleProfit(sale);
    totalProfit += saleProfit;

    if (matchesMonth) {
      monthlySales += sale.grand_total;
      monthlyGst += saleTax;
      monthlyProfit += saleProfit;
    }
  }

  return {
    sales,
    analytics: {
      todaySales,
      monthlySales,
      todayGst,
      monthlyGst,
      totalGst,
      monthlyProfit,
      totalProfit,
      todayOrdersCount,
      totalRevenue,
    },
  };
}
