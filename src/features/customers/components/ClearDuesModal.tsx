import React, { useState, useEffect } from "react";
import { Customer } from "../types";

interface ClearDuesModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerId: number, amountToClear: number) => Promise<void>;
}

export const ClearDuesModal: React.FC<ClearDuesModalProps> = ({
  customer,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [amountInput, setAmountInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setAmountInput(String(customer.dues));
      setError(null);
    } else {
      setAmountInput("");
    }
  }, [customer]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !customer) return null;

  const totalDues = customer.dues || 0;
  const enteredAmount = Math.max(0, parseFloat(amountInput) || 0);
  const remainingDues = Math.max(0, totalDues - enteredAmount);
  const isFullClearance = enteredAmount >= totalDues;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enteredAmount <= 0) {
      setError("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (enteredAmount > totalDues) {
      setError(`Entered amount (₹${enteredAmount.toFixed(2)}) cannot exceed total dues of ₹${totalDues.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(customer!.id, enteredAmount);
      onClose();
    } catch (err: any) {
      console.error("Clear dues error:", err);
      setError(err?.message || "Failed to settle customer dues.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSetFullAmount() {
    setAmountInput(String(totalDues));
    setError(null);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "450px" }}
      >
        <div className="modal-header">
          <div>
            <h2>Clear Customer Dues</h2>
            <div className="hint-text">
              Settling outstanding balance for <strong>{customer.name}</strong> ({customer.phone || "No phone"})
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

        <form onSubmit={handleSubmit} style={{ padding: "16px" }}>
          {/* Summary Box */}
          <div
            style={{
              background: "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)",
              border: "1px solid #ffe58f",
              borderRadius: "3px",
              padding: "10px 12px",
              marginBottom: "14px",
              fontSize: "0.86rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#873800" }}>Total Outstanding Dues:</span>
              <strong style={{ color: "#b91c1c", fontSize: "0.95rem" }}>
                ₹{totalDues.toFixed(2)}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
              <span>Settlement Mode:</span>
              <strong style={{ color: isFullClearance ? "#137333" : "#1e40af" }}>
                {isFullClearance ? "Full Clearance" : "Partial Payment"}
              </strong>
            </div>
          </div>

          <div className="form-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <label htmlFor="clearAmount" style={{ marginBottom: 0 }}>
                Amount to Clear (₹) *
              </label>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "2px 6px", fontSize: "0.76rem" }}
                onClick={handleSetFullAmount}
              >
                Clear Full Amount (₹{totalDues.toFixed(2)})
              </button>
            </div>
            <input
              id="clearAmount"
              type="number"
              min="0.01"
              max={totalDues}
              step="0.01"
              placeholder={`Enter amount up to ${totalDues.toFixed(2)}`}
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setError(null);
              }}
              autoFocus
              required
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#103c6b",
              }}
            />
          </div>

          {/* Remaining Dues Preview */}
          <div
            style={{
              background: "#f0f5fb",
              border: "1px solid #7092be",
              borderRadius: "3px",
              padding: "8px 12px",
              marginBottom: "16px",
              fontSize: "0.84rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Remaining Dues After Payment:</span>
            <strong
              style={{
                fontSize: "0.92rem",
                color: remainingDues > 0 ? "#b91c1c" : "#137333",
              }}
            >
              ₹{remainingDues.toFixed(2)}
            </strong>
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
              style={{
                background: isFullClearance
                  ? "linear-gradient(to bottom, #2e7d32 0%, #1b5e20 100%)"
                  : "linear-gradient(to bottom, #3988e3 0%, #1555a6 100%)",
                borderColor: isFullClearance ? "#1b5e20" : "#103c6b",
              }}
            >
              {isSubmitting
                ? "Processing..."
                : isFullClearance
                ? "CLEAR FULL DUES"
                : `CLEAR ₹${enteredAmount.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
