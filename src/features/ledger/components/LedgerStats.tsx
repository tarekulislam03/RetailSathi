import React from "react";
import { LedgerStatsData } from "../types";

interface LedgerStatsProps {
  stats: LedgerStatsData;
}

export const LedgerStats: React.FC<LedgerStatsProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">TOTAL STOCK MOVEMENTS</span>
        <span className="stat-value">{stats.totalMovements}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">TOTAL STOCK IN (PURCHASES)</span>
        <span className="stat-value" style={{ color: "#055e37" }}>
          +{stats.totalStockInQty} units
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">TOTAL STOCK OUT (SALES)</span>
        <span className="stat-value" style={{ color: "#b91c1c" }}>
          -{stats.totalStockOutQty} units
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">NET STOCK CHANGE</span>
        <span
          className="stat-value"
          style={{
            color: stats.netStockChange >= 0 ? "#104175" : "#b91c1c",
          }}
        >
          {stats.netStockChange >= 0
            ? `+${stats.netStockChange}`
            : stats.netStockChange}{" "}
          units
        </span>
      </div>
    </div>
  );
};
