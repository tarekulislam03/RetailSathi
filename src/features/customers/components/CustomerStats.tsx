import React from "react";
import { CustomerStatsData } from "../types";

interface CustomerStatsProps {
  stats: CustomerStatsData;
}

export const CustomerStats: React.FC<CustomerStatsProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">TOTAL CUSTOMERS</span>
        <span className="stat-value">{stats.totalCustomers}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">TOTAL LOYALTY POINTS</span>
        <span className="stat-value" style={{ color: "#0066cc" }}>
          {stats.totalLoyaltyPoints.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
          })} pts
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">OUTSTANDING DUES</span>
        <span
          className="stat-value"
          style={{ color: stats.totalDues > 0 ? "#b91c1c" : "#055e37" }}
        >
          ₹{stats.totalDues.toFixed(2)}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">CUSTOMERS WITH DUES</span>
        <span
          className="stat-value"
          style={{ color: stats.customersWithDues > 0 ? "#d97706" : "#104175" }}
        >
          {stats.customersWithDues}
        </span>
      </div>
    </div>
  );
};
