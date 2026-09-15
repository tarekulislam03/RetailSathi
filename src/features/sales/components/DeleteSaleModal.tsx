import React, { useState, useEffect } from "react";
import { Sale } from "../../billing/types";
import { fetchSaleDetails, deleteSale } from "../../billing/services/billingService";

interface DeleteSaleModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSaleDeleted: () => void;
}

export const DeleteSaleModal: React.FC<DeleteSaleModalProps> = ({
  isOpen,
  sale,
  onClose,
  onSaleDeleted,
}) => {
  const [targetSale, setTargetSale] = useState<Sale | null>(sale);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setTargetSale(sale);

    async function loadSale() {
      if (!sale!.items || sale!.items.length === 0) {
        try {
          const details = await fetchSaleDetails(sale!.id);
          if (details) setTargetSale(details);
        } catch (e) {
          console.error("Failed to load sale details for delete modal:", e);
        }
      }
    }
    loadSale();
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;
  const currentSale = targetSale || sale;

  async function handleDelete() {
    try {
      setDeleting(true);
      setError(null);
      await deleteSale(sale!.id);
      onSaleDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete sale transaction.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{ maxWidth: "520px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ color: "#8c1010" }}>Confirm Delete Sale</h2>
            <div className="hint-text">
              Invoice #{currentSale.invoice_no} ({currentSale.created_at || "N/A"})
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: "10px 14px 0" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)}>X</button>
          </div>
        )}

        <div style={{ padding: "16px" }}>
          <p style={{ fontSize: "0.9rem", color: "#1e3a5f", marginBottom: "12px" }}>
            Are you sure you want to permanently delete this sale transaction?
          </p>

          {/* Sale Information Card */}
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fca5a5",
              padding: "10px 14px",
              borderRadius: "3px",
              marginBottom: "14px",
              fontSize: "0.85rem",
              lineHeight: 1.6,
            }}
          >
            <div><strong>Invoice No:</strong> {currentSale.invoice_no}</div>
            <div><strong>Customer:</strong> {currentSale.customer_name || "Walk-in"} ({currentSale.customer_phone || "No phone"})</div>
            <div><strong>Payment Mode:</strong> {currentSale.payment_mode}</div>
            <div><strong>Grand Total:</strong> <span className="price-tag">₹{currentSale.grand_total.toFixed(2)}</span></div>
            {currentSale.items && currentSale.items.length > 0 && (
              <div>
                <strong>Items ({currentSale.items.length}):</strong>{" "}
                {currentSale.items.map((it) => `${it.product_name} (x${it.quantity})`).join(", ")}
              </div>
            )}
          </div>

          <div
            style={{
              background: "#f0f5fb",
              border: "1px solid #7092be",
              padding: "10px",
              borderRadius: "3px",
              fontSize: "0.8rem",
              color: "#1a385c",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>Automated System Actions on Delete:</div>
            <ul style={{ paddingLeft: "18px", margin: 0 }}>
              <li>Return item quantities back to product inventory stock.</li>
              <li>Decrease daily and monthly sales summaries & total revenue.</li>
              <li>Decrease GST tax amounts from tax ledgers & GST reports.</li>
              <li>Adjust customer outstanding dues and loyalty points if applicable.</li>
            </ul>
          </div>

          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn delete-btn"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "linear-gradient(to bottom, #f76868 0%, #d92b2b 100%)",
                color: "#ffffff",
                borderColor: "#a81919",
                fontWeight: 700,
              }}
            >
              {deleting ? "Deleting..." : "Confirm & Delete Sale"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
