import React from "react";
import { PurchaseStatsData } from "../types";

interface PurchaseStatsProps {
  stats: PurchaseStatsData;
}

export const PurchaseStats: React.FC<PurchaseStatsProps> = ({ stats }) => {
  return (
    <section className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Today's Purchases</span>
        <span className="stat-value">₹{stats.todaySpend.toFixed(2)}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Monthly Purchases</span>
        <span className="stat-value">₹{stats.monthlySpend.toFixed(2)}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Total Expenditure</span>
        <span className="stat-value">₹{stats.totalSpend.toFixed(2)}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Total Invoices</span>
        <span className="stat-value">{stats.totalPurchasesCount}</span>
      </div>
    </section>
  );
};
