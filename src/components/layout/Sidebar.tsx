import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../features/auth/context/AuthContext";
import { triggerUpdateCheck } from "../common/UpdateChecker";
import { APP_DISPLAY_VERSION } from "../../constants/version";

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
              <span className="nav-label">Inventory & Stock</span>
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
              to="/purchases"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Purchases & Inward</span>
            </NavLink>

            <NavLink
              to="/customers"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Customers & Loyalty</span>
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
              to="/gst-report"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">GST Reports</span>
            </NavLink>

            <NavLink
              to="/marketing"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Marketing & Delivery</span>
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Users / Cashiers</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-label">Store & POS Settings</span>
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              paddingTop: "6px",
              borderTop: "1px solid #c5d7ea",
              fontSize: "0.72rem",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#e3effc",
                border: "1px solid #b3cde8",
                padding: "2px 7px",
                borderRadius: "10px",
                fontWeight: 700,
                color: "#0f3e6d",
                fontSize: "0.70rem",
                letterSpacing: "0.01em",
              }}
              title={`Retail Sathi ${APP_DISPLAY_VERSION}`}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#16a34a",
                  display: "inline-block",
                  boxShadow: "0 0 4px #22c55e",
                }}
              />
              <span>Retail Sathi {APP_DISPLAY_VERSION}</span>
            </div>

            <button
              type="button"
              onClick={triggerUpdateCheck}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "linear-gradient(to bottom, #f7faff 0%, #e1eefc 100%)",
                border: "1px solid #7092be",
                color: "#0f3e6d",
                cursor: "pointer",
                padding: "2px 7px",
                borderRadius: "3px",
                fontSize: "0.70rem",
                fontWeight: 600,
                boxShadow: "inset 0 1px 0 #ffffff, 0 1px 2px rgba(0,0,0,0.06)",
                transition: "all 0.15s ease",
              }}
              title="Check for software updates"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #ffffff 0%, #ebf4fe 100%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(to bottom, #f7faff 0%, #e1eefc 100%)";
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Updates</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
