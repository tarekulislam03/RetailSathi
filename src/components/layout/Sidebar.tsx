import React from "react";
import { NavLink } from "react-router-dom";

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-menu">
        <NavLink
          to="/billing"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">POS / Billing</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Inventory</span>
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Purchases</span>
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Sales History</span>
        </NavLink>

        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Customers</span>
        </NavLink>

        <NavLink
          to="/ledger"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Stock Ledger</span>
        </NavLink>

        <NavLink
          to="/marketing"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Marketing</span>
        </NavLink>
      </div>
    </aside>
  );
};
