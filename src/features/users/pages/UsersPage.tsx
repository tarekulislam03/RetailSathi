import React, { useState, useEffect, useMemo } from "react";
import { User, UserStats } from "../types";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  calculateUserStats,
} from "../services/userService";
import { UserModal } from "../components/UserModal";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  async function loadUsers(silent = false) {
    if (!silent) setLoading(true);
    try {
      const list = await fetchUsers(searchQuery);
      setUsers(list);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load users:", err);
        setError(err?.message || "Failed to load users from database.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadUsers(true), 3000);

  useEffect(() => {
    loadUsers();
  }, [searchQuery]);

  function showToast(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }

  const stats: UserStats = useMemo(() => calculateUserStats(users), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      const isActive = u.is_active === 1 || u.is_active === true;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  async function handleCreateUser(data: any) {
    const res = await createUser(data);
    if (res.success) {
      showToast(`User "${data.full_name}" created successfully!`);
      loadUsers();
    }
    return res;
  }

  async function handleUpdateUser(id: number, data: any) {
    const res = await updateUser(id, data);
    if (res.success) {
      showToast("User updated successfully!");
      loadUsers();
    }
    return res;
  }

  async function handleDeleteUser(user: User) {
    if (!window.confirm(`Are you sure you want to delete user "${user.full_name}" (${user.username})?`)) {
      return;
    }
    try {
      const res = await deleteUser(user.id);
      if (res.success) {
        showToast(`User "${user.full_name}" deleted.`);
        loadUsers();
      } else {
        setError(res.error || "Failed to delete user.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete user.");
    }
  }

  return (
    <>
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className="error-banner"
          style={{
            background: "linear-gradient(to bottom, #e3f2fd 0%, #bbdefb 100%)",
            color: "#0d47a1",
            borderColor: "#1976d2",
          }}
        >
          <span>{notification}</span>
          <button onClick={() => setNotification(null)}>X</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{stats.totalUsers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Cashiers</span>
          <span className="stat-value" style={{ color: "#16a34a" }}>
            {stats.activeCashiers}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Store Admins</span>
          <span className="stat-value" style={{ color: "#1d4ed8" }}>
            {stats.totalAdmins}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Inactive Accounts</span>
          <span className="stat-value" style={{ color: stats.inactiveUsers > 0 ? "#dc2626" : undefined }}>
            {stats.inactiveUsers}
          </span>
        </div>
      </section>

      {/* Main List Card */}
      <section className="card list-card">
        <div className="list-header">
          <h2>User & Cashier Directory ({filteredUsers.length})</h2>

          <div className="list-actions">
            <input
              id="userSearch"
              type="text"
              className="search-input"
              placeholder="Search by name, username, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: "200px" }}
            />

            <select
              className="search-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: "auto", cursor: "pointer" }}
            >
              <option value="all">All Roles</option>
              <option value="cashier">Cashiers</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
            </select>

            <select
              className="search-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", cursor: "pointer" }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              type="button"
              className="btn primary-btn add-product-btn"
              onClick={() => {
                setUserToEdit(null);
                setIsModalOpen(true);
              }}
            >
              + ADD USER
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-responsive">
          <table className="product-table">
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>ID</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ width: "120px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="loading">
                    Loading users database...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {searchQuery
                      ? "No matching user accounts found."
                      : "No user accounts recorded in database yet."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.is_active === 1 || u.is_active === true;
                  return (
                    <tr key={u.id}>
                      <td style={{ textAlign: "center" }}>
                        <span className="barcode-tag">#{u.id}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: "#103c6b" }}>
                        {u.full_name}
                      </td>
                      <td>
                        <span className="barcode-tag">{u.username}</span>
                      </td>
                      <td>
                        <span className={`sidebar-role-badge role-${u.role}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>{u.phone || "—"}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: isActive ? "#15803d" : "#b91c1c",
                            background: isActive ? "#dcfce7" : "#fee2e2",
                            border: `1px solid ${isActive ? "#86efac" : "#fca5a5"}`,
                            padding: "1px 6px",
                            borderRadius: "2px",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: isActive ? "#16a34a" : "#dc2626",
                            }}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <button
                            type="button"
                            className="action-btn edit-btn"
                            onClick={() => {
                              setUserToEdit(u);
                              setIsModalOpen(true);
                            }}
                            title="Edit User"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <UserModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setUserToEdit(null);
          }}
          onSubmitCreate={handleCreateUser}
          onSubmitUpdate={handleUpdateUser}
          userToEdit={userToEdit}
        />
      )}
    </>
  );
};
