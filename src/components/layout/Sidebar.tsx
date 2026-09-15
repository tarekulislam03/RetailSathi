import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../features/auth/context/AuthContext";

export const Sidebar: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();

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

        {/* Admin only feature links */}
        {isAdmin && (
          <>
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

            <NavLink
              to="/users"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Users / Cashiers</span>
            </NavLink>
          </>
        )}
      </div>

      {/* Account Info & Logout Button at Bottom */}
      {user && (
        <div className="sidebar-user-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="sidebar-user-text">
              <div
                className="sidebar-user-name"
                title={user.full_name || user.username}
              >
                {user.full_name || user.username}
              </div>
              <span className={`sidebar-role-badge role-${user.role}`}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={logout}
            title="Log Out of Session"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
};
