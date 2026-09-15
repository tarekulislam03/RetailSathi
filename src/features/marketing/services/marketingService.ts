import { getDb } from "../../../services/database";
import {
  MarketingPerson,
  MarketingPersonInput,
  MarketingSaleRecord,
  MarketingStatsData,
} from "../types";

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function matchesMonth(dateStr: string, targetMonth: string): boolean {
  if (!dateStr || !targetMonth) return true;
  const cleanDateStr = dateStr.trim();
  if (!cleanDateStr) return true;

  // 1. Direct YYYY-MM prefix match (e.g. "2026-09-11 14:00:00")
  if (cleanDateStr.startsWith(targetMonth)) return true;

  // 2. Check for month abbreviation + year (e.g. "11 Sep 2026, 08:55 pm")
  const parts = targetMonth.split("-");
  if (parts.length === 2) {
    const targetYear = parts[0];
    const targetMmNum = parseInt(parts[1], 10);
    if (!isNaN(targetMmNum) && targetMmNum >= 1 && targetMmNum <= 12) {
      const targetMonthName = MONTH_NAMES[targetMmNum - 1];
      const lowerStr = cleanDateStr.toLowerCase();
      if (lowerStr.includes(targetMonthName) && lowerStr.includes(targetYear)) {
        return true;
      }
    }
  }

  // 3. Fallback to JS Date parsing
  const parsed = new Date(cleanDateStr);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear().toString();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}` === targetMonth;
  }

  return false;
}

export async function fetchMarketingPersons(
  selectedMonth?: string
): Promise<MarketingPerson[]> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM marketing ORDER BY id DESC");

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const targetMonth = selectedMonth || currentMonthStr;

  let allSales: any[] = [];
  try {
    allSales = await db.select<any[]>(
      "SELECT id, invoice_no, customer_name, customer_phone, grand_total, payment_mode, marketing_person_id, created_at FROM sales WHERE marketing_person_id IS NOT NULL"
    );
  } catch (err) {
    console.warn("Could not query sales with marketing_person_id:", err);
  }

  return rows.map((r) => {
    const personId = Number(r.id);
    const commRate = Number(r.commission) || 0;

    const personSales = allSales.filter(
      (s) => Number(s.marketing_person_id) === personId
    );

    let lifetimeSales = personSales.reduce(
      (acc, s) => acc + (Number(s.grand_total) || 0),
      0
    );
    if (lifetimeSales === 0 && Number(r.sales) > 0) {
      lifetimeSales = Number(r.sales);
    }

    const monthlySales = personSales.reduce((acc, s) => {
      if (matchesMonth(s.created_at || "", targetMonth)) {
        return acc + (Number(s.grand_total) || 0);
      }
      return acc;
    }, 0);

    const lifetimeCommission = (lifetimeSales * commRate) / 100;
    const monthlyCommission = (monthlySales * commRate) / 100;

    return {
      id: personId,
      name: r.name || "",
      phone: r.phone || "",
      area: r.area || "",
      sales: lifetimeSales,
      commission: commRate,
      lifetime_sales: lifetimeSales,
      lifetime_commission: lifetimeCommission,
      monthly_sales: monthlySales,
      monthly_commission: monthlyCommission,
      created_at: r.created_at,
    };
  });
}

export async function fetchMarketingPersonSales(
  personId: number,
  selectedMonth?: string
): Promise<{
  person: MarketingPerson | null;
  sales: MarketingSaleRecord[];
}> {
  const db = await getDb();
  const persons = await db.select<any[]>(
    "SELECT * FROM marketing WHERE id = $1",
    [personId]
  );
  if (!persons || persons.length === 0) {
    return { person: null, sales: [] };
  }

  const personRow = persons[0];
  const commRate = Number(personRow.commission) || 0;

  const salesRows = await db.select<any[]>(
    "SELECT * FROM sales WHERE marketing_person_id = $1 ORDER BY id DESC",
    [personId]
  );

  const mappedSales: MarketingSaleRecord[] = salesRows.map((s) => {
    const grandTotal = Number(s.grand_total) || 0;
    return {
      id: Number(s.id),
      invoice_no: s.invoice_no || "",
      customer_name: s.customer_name || "Walk-in Customer",
      customer_phone: s.customer_phone || "",
      grand_total: grandTotal,
      payment_mode: s.payment_mode || "Cash",
      created_at: s.created_at || "",
      commission_earned: (grandTotal * commRate) / 100,
    };
  });

  const filteredSales = selectedMonth
    ? mappedSales.filter((s) => matchesMonth(s.created_at, selectedMonth))
    : mappedSales;

  const fetchedList = await fetchMarketingPersons(selectedMonth);
  const person = fetchedList.find((p) => p.id === personId) || {
    id: Number(personRow.id),
    name: personRow.name || "",
    phone: personRow.phone || "",
    area: personRow.area || "",
    sales: Number(personRow.sales) || 0,
    commission: commRate,
  };

  return { person, sales: filteredSales };
}

export async function createMarketingPerson(
  person: MarketingPersonInput
): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  const res = await db.execute(
    `INSERT INTO marketing (name, phone, area, sales, commission, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      person.name.trim(),
      person.phone ? person.phone.trim() : "",
      person.area ? person.area.trim() : "",
      person.sales ?? 0,
      person.commission ?? 0,
      formattedDate,
    ]
  );
  return res.lastInsertId ?? 0;
}

export async function updateMarketingPerson(
  id: number,
  person: MarketingPersonInput
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE marketing
     SET name = $1, phone = $2, area = $3, sales = $4, commission = $5
     WHERE id = $6`,
    [
      person.name.trim(),
      person.phone ? person.phone.trim() : "",
      person.area ? person.area.trim() : "",
      person.sales ?? 0,
      person.commission ?? 0,
      id,
    ]
  );
}

export async function deleteMarketingPerson(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM marketing WHERE id = $1", [id]);
}

export async function getMarketingStats(
  selectedMonth?: string
): Promise<MarketingStatsData> {
  const persons = await fetchMarketingPersons(selectedMonth);
  let totalSalesCompleted = 0;
  let totalCommission = 0;

  for (const p of persons) {
    totalSalesCompleted += p.monthly_sales ?? p.sales ?? 0;
    totalCommission +=
      p.monthly_commission ?? ((p.sales || 0) * (p.commission || 0)) / 100;
  }

  return {
    totalPersonnel: persons.length,
    totalSalesCompleted,
    totalCommission,
  };
}
