import React, { useState, useEffect } from "react";
import { User, CreateUserInput, UpdateUserInput, UserRole } from "../types";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate: (data: CreateUserInput) => Promise<{ success: boolean; error?: string }>;
  onSubmitUpdate: (id: number, data: UpdateUserInput) => Promise<{ success: boolean; error?: string }>;
  userToEdit: User | null;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  userToEdit,
}) => {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("cashier");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setFullName(userToEdit.full_name || "");
      setUsername(userToEdit.username || "");
      setPassword("");
      setRole(userToEdit.role || "cashier");
      setPhone(userToEdit.phone || "");
      setIsActive(userToEdit.is_active === 1 || userToEdit.is_active === true);
    } else {
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("cashier");
      setPhone("");
      setIsActive(true);
    }
    setErrorMsg("");
    setShowPassword(false);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      if (userToEdit) {
        // Edit mode
        const updateData: UpdateUserInput = {
          full_name: fullName.trim(),
          role,
          phone: phone.trim() || undefined,
          is_active: isActive,
        };
        if (password.trim()) {
          updateData.password = password.trim();
        }

        const res = await onSubmitUpdate(userToEdit.id, updateData);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update user.");
        }
      } else {
        // Create mode
        if (!username.trim()) {
          setErrorMsg("Username is required.");
          setIsSubmitting(false);
          return;
        }
        if (!password.trim()) {
          setErrorMsg("Password is required.");
          setIsSubmitting(false);
          return;
        }
        if (!fullName.trim()) {
          setErrorMsg("Full name is required.");
          setIsSubmitting(false);
          return;
        }

        const createData: CreateUserInput = {
          username: username.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          role,
          phone: phone.trim() || undefined,
          is_active: isActive,
        };

        const res = await onSubmitCreate(createData);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to create user.");
        }
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: "460px", width: "90%" }}>
        {/* Title Bar Header */}
        <div className="modal-header">
          <h2>{userToEdit ? "Edit User Account" : "Create New User / Cashier"}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "16px 20px" }}>
            {errorMsg && (
              <div className="error-banner" style={{ marginBottom: "12px" }}>
                <span>{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg("")}>X</button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="userFullName">Full Name *</label>
              <input
                id="userFullName"
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="userUsername">Username *</label>
              <input
                id="userUsername"
                type="text"
                placeholder="e.g. cashier1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={!!userToEdit}
                style={userToEdit ? { background: "#eef2f6", color: "#64748b" } : {}}
              />
              {userToEdit && (
                <small style={{ color: "#64748b", fontSize: "0.74rem" }}>
                  Username cannot be changed after creation.
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="userPassword">
                {userToEdit ? "New Password (optional)" : "Password *"}
              </label>
              <div className="login-input-wrapper password-input-wrapper">
                <input
                  id="userPassword"
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  placeholder={userToEdit ? "Leave blank to keep unchanged" : "Enter account password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!userToEdit}
                />
                <button
                  type="button"
                  className="login-eye-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="userRole">Role</label>
                <select
                  id="userRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="cashier">Cashier (POS only)</option>
                  <option value="admin">Admin (Full Access)</option>
                  <option value="manager">Manager (Store Ops)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="userPhone">Phone Number</label>
                <input
                  id="userPhone"
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "6px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "#103c6b" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Active Account (Allowed to log in)</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn primary-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : userToEdit ? "Update User" : "Save User"}
            </button>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
