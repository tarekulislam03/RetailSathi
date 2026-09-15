import React from "react";
import { MarketingStatsData } from "../types";

interface MarketingStatsProps {
  stats: MarketingStatsData;
}

export const MarketingStats: React.FC<MarketingStatsProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">TOTAL PERSONNEL</div>
        <div className="stat-value">{stats.totalPersonnel}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">TOTAL SALES COMPLETED</div>
        <div className="stat-value">₹{stats.totalSalesCompleted.toFixed(2)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">TOTAL COMMISSION</div>
        <div className="stat-value">₹{stats.totalCommission.toFixed(2)}</div>
      </div>
    </div>
  );
};
