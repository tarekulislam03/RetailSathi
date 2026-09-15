import React, { useState, useEffect } from "react";
import { Sale } from "../../billing/types";
import { Pagination } from "../../../components/common/Pagination";

interface ManageSalesProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
}

export interface MonthlySalesProfitRow {
  monthKey: string;
  monthLabel: string;
  orderCount: number;
  grossRevenue: number;
  totalCost: number;
  totalDiscount: number;
  netProfit: number;
  profitMargin: number;
}

export const ManageSalesProfitModal: React.FC<ManageSalesProfitModalProps> = ({
  isOpen,
  onClose,
  sales,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  // Group sales by month
  const monthlyMap: Record<string, MonthlySalesProfitRow> = {};

  for (const s of sales) {
    let year = 0;
    let monthIdx = 0;

    const dateObj = s.created_at ? new Date(s.created_at) : null;
    if (dateObj && !isNaN(dateObj.getTime())) {
      year = dateObj.getFullYear();
      monthIdx = dateObj.getMonth();
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthIdx = now.getMonth();
    }

    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    const dateForLabel = new Date(year, monthIdx, 1);
    const monthLabel = dateForLabel.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        monthKey,
        monthLabel,
        orderCount: 0,
        grossRevenue: 0,
        totalCost: 0,
        totalDiscount: 0,
        netProfit: 0,
        profitMargin: 0,
      };
    }

    // Profit Calculation: (Selling Price - Cost/MRP) * Qty - Discount
    let saleCost = 0;
    if (s.items && s.items.length > 0) {
      for (const item of s.items) {
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
      saleCost = s.grand_total * 0.7; // default fallback if line items missing
    }

    const saleProfit = Math.max(0, s.total_amount - saleCost - s.discount);

    monthlyMap[monthKey].orderCount += 1;
    monthlyMap[monthKey].grossRevenue += s.grand_total;
    monthlyMap[monthKey].totalCost += saleCost;
    monthlyMap[monthKey].totalDiscount += s.discount;
    monthlyMap[monthKey].netProfit += saleProfit;
  }

  // Calculate profit margin for each month row
  const allMonthlyRows = Object.values(monthlyMap).map((r) => ({
    ...r,
    profitMargin: r.grossRevenue > 0 ? (r.netProfit / r.grossRevenue) * 100 : 0,
  })).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const filteredRows = searchTerm.trim()
    ? allMonthlyRows.filter((r) =>
        r.monthLabel.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        r.monthKey.includes(searchTerm.trim())
      )
    : allMonthlyRows;

  // Summary Metrics
  const totalAllTimeRevenue = allMonthlyRows.reduce(
    (acc, r) => acc + r.grossRevenue,
    0
  );
  const totalAllTimeProfit = allMonthlyRows.reduce(
    (acc, r) => acc + r.netProfit,
    0
  );
  const overallMargin =
    totalAllTimeRevenue > 0
      ? (totalAllTimeProfit / totalAllTimeRevenue) * 100
      : 0;

  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  const currentMonthProfit = monthlyMap[currentMonthKey]?.netProfit || 0;

  // Pagination calculation
  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{ maxWidth: "900px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Manage Sales & Monthly Profit Reports</h2>
            <div className="hint-text">
              Month-wise breakdown of gross revenue, cost of goods, discounts, net profit, and profit margin
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div style={{ padding: "14px" }}>
          {/* Top Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #e8f4ea 100%)",
                border: "1px solid #a8dab5",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#137333" }}>
                CURRENT MONTH PROFIT
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0d5c3a" }}>
                ₹{currentMonthProfit.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #edf4fc 100%)",
                border: "1px solid #7092be",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1a385c" }}>
                TOTAL HISTORICAL REVENUE
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#103c6b" }}>
                ₹{totalAllTimeRevenue.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #f0fdf4 100%)",
                border: "1px solid #86efac",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#15803d" }}>
                TOTAL NET PROFIT
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#166534" }}>
                ₹{totalAllTimeProfit.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #fefce8 100%)",
                border: "1px solid #fde047",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#a16207" }}>
                OVERALL PROFIT MARGIN
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#854d0e" }}>
                {overallMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* List Action Bar */}
          <div
            className="list-header"
            style={{ marginBottom: "10px", flexWrap: "wrap" }}
          >
            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#103c6b" }}>
              Monthly Sales & Profitability Ledger ({filteredRows.length} months)
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search month or year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "220px" }}
            />
          </div>

          {/* Table */}
          {filteredRows.length === 0 ? (
            <div className="empty-state" style={{ padding: "28px" }}>
              No monthly sales & profit records found.
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: "320px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>MONTH & YEAR</th>
                      <th>ORDERS</th>
                      <th>GROSS REVENUE (₹)</th>
                      <th>COST OF GOODS (₹)</th>
                      <th>DISCOUNTS (₹)</th>
                      <th>NET PROFIT (₹)</th>
                      <th>PROFIT MARGIN (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => (
                      <tr key={r.monthKey}>
                        <td className="font-semibold">{r.monthLabel}</td>
                        <td>{r.orderCount} orders</td>
                        <td>₹{r.grossRevenue.toFixed(2)}</td>
                        <td style={{ color: "#4b5563" }}>₹{r.totalCost.toFixed(2)}</td>
                        <td style={{ color: "#b91c1c" }}>₹{r.totalDiscount.toFixed(2)}</td>
                        <td className="price-tag" style={{ color: "#0d5c3a" }}>
                          ₹{r.netProfit.toFixed(2)}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "2px",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              backgroundColor: r.profitMargin >= 15 ? "#e6f4ea" : "#fef2f2",
                              color: r.profitMargin >= 15 ? "#137333" : "#b91c1c",
                              border: r.profitMargin >= 15 ? "1px solid #a8dab5" : "1px solid #fca5a5",
                              display: "inline-block",
                            }}
                          >
                            {r.profitMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20]}
              />
            </>
          )}

          <div
            className="form-actions"
            style={{ marginTop: "14px", justifyContent: "flex-end" }}
          >
            <button className="btn secondary-btn" onClick={onClose}>
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
