import React from "react";
import { SalesAnalytics } from "../services/salesService";

interface SalesKpiGridProps {
  analytics: SalesAnalytics;
}

export const SalesKpiGrid: React.FC<SalesKpiGridProps> = ({ analytics }) => {
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
        <span className="stat-label">Monthly GST Collected</span>
        <span className="stat-value" style={{ color: "#103c6b" }}>
          ₹{analytics.monthlyGst.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Est. Monthly Profit</span>
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
