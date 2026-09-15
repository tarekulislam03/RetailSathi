import React, { useState, useEffect } from "react";
import { Customer, CustomerInput } from "../types";

interface CustomerModalProps {
  editingCustomer: Customer | null;
  onSave: (payload: CustomerInput) => Promise<void>;
  onClose: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  editingCustomer,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name);
      setPhone(editingCustomer.phone);
      setAddress(editingCustomer.address);
    } else {
      setName("");
      setPhone("");
      setAddress("");
    }
  }, [editingCustomer]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Customer phone number is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
    } catch (err: any) {
      console.error("Save customer error:", err);
      setError(err?.message || "Failed to save customer record.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <div className="modal-header">
          <div>
            <h2>{editingCustomer ? "Edit Customer Record" : "Add New Customer"}</h2>
            <div className="hint-text">
              {editingCustomer
                ? `Updating details for customer #${editingCustomer.id}`
                : "Enter customer profile details"}
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {error && (
          <div
            className="error-banner"
            style={{ margin: "10px 16px 0", borderRadius: "2px" }}
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              X
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="custName">Customer Name *</label>
            <input
              id="custName"
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="custPhone">Phone Number *</label>
            <input
              id="custPhone"
              type="text"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="custAddress">Address</label>
            <textarea
              id="custAddress"
              placeholder="e.g. Shop 12, Main Market, Delhi"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "6px 9px",
                border: "1px solid #7f9db9",
                borderRadius: "2px",
                fontSize: "0.88rem",
                fontFamily: "inherit",
                boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.1)",
                boxSizing: "border-box",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : editingCustomer
                ? "UPDATE CUSTOMER"
                : "SAVE CUSTOMER"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
