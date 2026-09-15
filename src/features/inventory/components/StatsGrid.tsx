import React from "react";
import { Product } from "../types";

interface StatsGridProps {
  products: Product[];
  onLowStockClick?: () => void;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ products, onLowStockClick }) => {
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.reorder_threshold).length;
  const totalValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);

  return (
    <section className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Total Items</span>
        <span className="stat-value">{totalProducts}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Total Units in Stock</span>
        <span className="stat-value">{totalStock}</span>
      </div>
      <div
        className="stat-card"
        style={{
          background: lowStockCount > 0
            ? "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)"
            : undefined,
          cursor: onLowStockClick ? "pointer" : "default",
        }}
        onClick={onLowStockClick}
        title={onLowStockClick ? "Click to view Low Stock & Out of Stock section" : undefined}
      >
        <span
          className="stat-label"
          style={{
            color: lowStockCount > 0 ? "#873800" : undefined,
            fontWeight: lowStockCount > 0 ? 700 : 600,
          }}
        >
          Low Stock Alert Items
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className="stat-value"
            style={{ color: lowStockCount > 0 ? "#b91c1c" : undefined }}
          >
            {lowStockCount}
          </span>
          {lowStockCount > 0 && (
            <span
              style={{
                background: "#b91c1c",
                color: "#ffffff",
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              ALERT
            </span>
          )}
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-label">Total Inventory Value</span>
        <span className="stat-value">₹ {totalValue.toLocaleString()}</span>
      </div>
    </section>
  );
};
