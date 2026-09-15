import { getDb } from "../../../services/database";
import { Sale, SaleItem } from "../../billing/types";
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

  // Map items to sales
  const itemsMap: Record<number, SaleItem[]> = {};
  for (const item of allItems) {
    if (!itemsMap[item.sale_id]) {
      itemsMap[item.sale_id] = [];
    }
    itemsMap[item.sale_id].push({
      id: item.id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      product_name: item.product_name,
      barcode: item.barcode || "",
      price: item.price,
      quantity: item.quantity,
      total_price: item.total_price,
      ...item,
    });
  }

  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

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
    sale.items = itemsMap[sale.id] || [];
    totalRevenue += sale.grand_total;
    const saleTax = sale.tax_amount || 0;
    totalGst += saleTax;

    // Date parsing
    const saleDate = sale.created_at ? new Date(sale.created_at) : null;
    const isToday =
      saleDate &&
      !isNaN(saleDate.getTime()) &&
      saleDate.getDate() === todayDay &&
      saleDate.getMonth() === todayMonth &&
      saleDate.getFullYear() === todayYear;

    const isThisMonth =
      saleDate &&
      !isNaN(saleDate.getTime()) &&
      saleDate.getMonth() === todayMonth &&
      saleDate.getFullYear() === todayYear;

    // Fallback string matching for en-IN formatted created_at
    const dateString = sale.created_at || "";
    const todayStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const monthStr = now.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });

    const matchesToday = isToday || dateString.includes(todayStr);
    const matchesMonth = isThisMonth || dateString.includes(monthStr);

    if (matchesToday) {
      todaySales += sale.grand_total;
      todayGst += saleTax;
      todayOrdersCount += 1;
    }

    // Profit Calculation: (Selling Price - Cost/MRP) * Qty - Discount
    let saleCost = 0;
    for (const item of sale.items) {
      const costPrice = (item as any).cost_price;
      const itemMrp = (item as any).mrp;
      const unitCost = costPrice && costPrice > 0 ? costPrice : (itemMrp && itemMrp > 0 && itemMrp < item.price ? itemMrp : item.price * 0.8);
      saleCost += unitCost * item.quantity;
    }
    const saleProfit = Math.max(0, sale.total_amount - saleCost - sale.discount);
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
