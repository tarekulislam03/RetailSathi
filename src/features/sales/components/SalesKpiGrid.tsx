import React from "react";
import { SalesAnalytics } from "../services/salesService";

interface SalesKpiGridProps {
  analytics: SalesAnalytics;
  filteredStats?: {
    isFiltered: boolean;
    cashReceived: number;
    upiReceived: number;
  };
}

export const SalesKpiGrid: React.FC<SalesKpiGridProps> = ({ analytics, filteredStats }) => {
  const isFiltered = Boolean(filteredStats?.isFiltered);
  const displayCash = isFiltered
    ? (filteredStats?.cashReceived ?? 0)
    : (analytics.monthlyCash ?? 0);
  const displayUpi = isFiltered
    ? (filteredStats?.upiReceived ?? 0)
    : (analytics.monthlyUpi ?? 0);

  return (
    <section className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Today's Sales</span>
        <span className="stat-value">
          ₹{analytics.todaySales.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Monthly Sales</span>
        <span className="stat-value">
          ₹{analytics.monthlySales.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">
          {isFiltered ? "Cash Received (Filtered)" : "Cash Received"}
        </span>
        <span className="stat-value" style={{ color: "#065f46" }}>
          ₹{displayCash.toFixed(2)}
        </span>
        {!isFiltered && (
          <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
            Today: ₹{(analytics.todayCash ?? 0).toFixed(2)}
          </span>
        )}
      </div>

      <div className="stat-card">
        <span className="stat-label">
          {isFiltered ? "UPI Received (Filtered)" : "UPI Received"}
        </span>
        <span className="stat-value" style={{ color: "#1d4ed8" }}>
          ₹{displayUpi.toFixed(2)}
        </span>
        {!isFiltered && (
          <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
            Today: ₹{(analytics.todayUpi ?? 0).toFixed(2)}
          </span>
        )}
      </div>

      <div className="stat-card">
        <span className="stat-label">Monthly GST Collected</span>
        <span className="stat-value" style={{ color: "#103c6b" }}>
          ₹{analytics.monthlyGst.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Monthly Profit</span>
        <span className="stat-value" style={{ color: "#055e37" }}>
          ₹{analytics.monthlyProfit.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Today's Orders</span>
        <span className="stat-value">{analytics.todayOrdersCount}</span>
      </div>
    </section>
  );
};
