import React, { useState, useEffect } from "react";
import { HeldBill } from "../types";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface HeldBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldBills: HeldBill[];
  onResume: (bill: HeldBill) => void;
  onDiscard: (id: string) => void;
  onClearAll: () => void;
}

export const HeldBillsModal: React.FC<HeldBillsModalProps> = ({
  isOpen,
  onClose,
  heldBills,
  onResume,
  onDiscard,
  onClearAll,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setExpandedBillId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredBills = heldBills.filter((b) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const cust = (b.customer_name || "").toLowerCase();
    const phone = (b.customer_phone || "").toLowerCase();
    const itemMatch = b.cart.some((it) =>
      it.product.name.toLowerCase().includes(q)
    );
    return cust.includes(q) || phone.includes(q) || itemMatch;
  });

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content card aero-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "680px",
          width: "95%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Windows 7 Aero Style Modal Header */}
        <div
          className="modal-header"
          style={{
            background: "linear-gradient(to bottom, #edf5fe 0%, #d2e4fc 100%)",
            borderBottom: "1px solid #7092be",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.25rem" }}>📋</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  color: "#103c6b",
                  fontWeight: 700,
                  textShadow: "0 1px 0 #ffffff",
                }}
              >
                Held Bills / Parked Orders ({heldBills.length})
              </h2>
              <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                Resume any parked transaction or switch customers seamlessly
              </span>
            </div>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: "linear-gradient(to bottom, #f27272 0%, #d93838 100%)",
              border: "1px solid #941b1b",
              color: "#ffffff",
              borderRadius: "4px",
              width: "28px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "inset 0 1px 0 #ff9999",
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter & Actions Bar */}
        <div
          style={{
            padding: "10px 16px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer name, phone, or product in bill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: "0.84rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
            }}
            autoFocus
          />
          {heldBills.length > 1 && (
            <button
              type="button"
              className="btn secondary-btn"
              onClick={() => {
                if (window.confirm("Are you sure you want to discard all held bills?")) {
                  onClearAll();
                }
              }}
              style={{
                fontSize: "0.76rem",
                padding: "6px 10px",
                color: "#b91c1c",
                borderColor: "#fca5a5",
                background: "#fef2f2",
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Held Bills List Body */}
        <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1, background: "#f1f5f9" }}>
          {filteredBills.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "#ffffff",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⏸️</div>
              <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "#334155" }}>
                {searchTerm ? "No held bills match your search." : "No bills currently on hold."}
              </p>
              <span style={{ fontSize: "0.8rem" }}>
                To hold a customer's bill, click <strong>"⏸️ Hold Bill"</strong> on the billing page anytime.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredBills.map((bill) => {
                const isExpanded = expandedBillId === bill.id;
                return (
                  <div
                    key={bill.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        background: "linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                            {bill.customer_name || "Walk-in Customer"}
                          </strong>
                          {bill.customer_phone && (
                            <span
                              style={{
                                fontSize: "0.78rem",
                                color: "#475569",
                                background: "#e2e8f0",
                                padding: "1px 6px",
                                borderRadius: "3px",
                              }}
                            >
                              📞 {bill.customer_phone}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "0.74rem",
                              color: "#64748b",
                              background: "#f1f5f9",
                              padding: "1px 6px",
                              borderRadius: "3px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            🕒 {formatTo12Hour(bill.heldAt)}
                          </span>
                        </div>

                        <div style={{ fontSize: "0.82rem", color: "#64748b", display: "flex", gap: "12px" }}>
                          <span>
                            Items: <strong>{bill.total_items}</strong> ({bill.total_qty} pcs)
                          </span>
                          <span>•</span>
                          <span>
                            Payment Mode: <strong>{bill.payment_mode || "Cash"}</strong>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ display: "block", fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                            Total Bill
                          </span>
                          <strong style={{ fontSize: "1.15rem", color: "#166534" }}>
                            ₹{bill.grand_total.toFixed(2)}
                          </strong>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn primary-btn"
                            onClick={() => onResume(bill)}
                            style={{
                              padding: "6px 14px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              background: "linear-gradient(to bottom, #16a34a 0%, #15803d 100%)",
                              borderColor: "#166534",
                              boxShadow: "inset 0 1px 0 #4ade80",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Load this order back into active cart"
                          >
                            ▶️ Resume
                          </button>

                          <button
                            type="button"
                            className="btn secondary-btn"
                            onClick={() => {
                              if (window.confirm(`Discard held bill for "${bill.customer_name || 'Walk-in Customer'}"?`)) {
                                onDiscard(bill.id);
                              }
                            }}
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.82rem",
                              color: "#b91c1c",
                              borderColor: "#fca5a5",
                            }}
                            title="Discard / Delete this held bill"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Items Preview Header */}
                    <div
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{
                        padding: "5px 14px",
                        background: "#f1f5f9",
                        borderTop: "1px solid #e2e8f0",
                        fontSize: "0.76rem",
                        color: "#2563eb",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{isExpanded ? "▲ Hide Items Preview" : `▼ View ${bill.cart.length} Items in this Bill`}</span>
                      <span style={{ color: "#64748b" }}>Click to expand/collapse</span>
                    </div>

                    {/* Expandable Items Preview Table */}
                    {isExpanded && (
                      <div style={{ padding: "8px 14px", background: "#ffffff", borderTop: "1px solid #f1f5f9" }}>
                        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                              <th style={{ padding: "4px 0" }}>Item</th>
                              <th style={{ padding: "4px 8px", textAlign: "center" }}>Qty</th>
                              <th style={{ padding: "4px 8px", textAlign: "right" }}>Rate</th>
                              <th style={{ padding: "4px 0", textAlign: "right" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bill.cart.map((it, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "4px 0", fontWeight: 500 }}>{it.product.name}</td>
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>{it.quantity}</td>
                                <td style={{ padding: "4px 8px", textAlign: "right", color: "#64748b" }}>
                                  ₹{it.product.price.toFixed(2)}
                                </td>
                                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>
                                  ₹{(it.product.price * it.quantity).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "10px 16px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Held bills are saved persistently and stay safe even when navigating pages.
          </span>
          <button type="button" className="btn secondary-btn" onClick={onClose} style={{ padding: "6px 16px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
