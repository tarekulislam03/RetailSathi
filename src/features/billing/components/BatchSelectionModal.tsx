import React, { useState, useEffect } from "react";
import { Product } from "../../inventory/types";
import { getBatchStatusMap } from "../../inventory/utils/batchUtils";

export interface BatchSelectionModalProps {
  isOpen: boolean;
  batches: Product[];
  searchTerm?: string;
  onSelectBatch: (product: Product) => void;
  onClose: () => void;
}

export const BatchSelectionModal: React.FC<BatchSelectionModalProps> = ({
  isOpen,
  batches,
  searchTerm,
  onSelectBatch,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const openedAtRef = React.useRef(0);

  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
      setSelectedIndex(0);
    }
  }, [isOpen, batches]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Ignore rapid scanner key bounces arriving immediately upon modal opening
      const elapsed = Date.now() - openedAtRef.current;

      // Number keys 1-9 for quick batch selection (active after 150ms)
      if (e.key >= "1" && e.key <= "9") {
        if (elapsed < 150) return;
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= batches.length) {
          e.preventDefault();
          e.stopPropagation();
          onSelectBatch(batches[num - 1]);
          return;
        }
      }

      // Arrow keys to navigate
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % batches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + batches.length) % batches.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // Ignore trailing newline / auto-enter keybounce from barcode scanner (within 450ms)
        if (elapsed < 450) {
          return;
        }
        if (batches[selectedIndex]) {
          onSelectBatch(batches[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, batches, selectedIndex, onSelectBatch, onClose]);

  if (!isOpen || batches.length === 0) return null;

  const statusMap = getBatchStatusMap(batches);
  const productName = batches[0]?.name || "Product";
  const barcode = batches[0]?.barcode || searchTerm || "";

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content card aero-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "680px",
          width: "92%",
          boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
        }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#1e3a8a" }}>
              Select Batch for Selling
            </h2>
            <p className="hint-text" style={{ margin: "2px 0 0" }}>
              Multiple batches found for this barcode. Select the batch to bill.
            </p>
          </div>
          <button className="close-btn" onClick={onClose} title="Close (Esc)">
            X
          </button>
        </div>

        {/* Product details banner */}
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Scanned Item:
            </span>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
              {productName}
            </div>
          </div>
          {barcode && (
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Barcode:</span>
              <div>
                <code
                  className="barcode-tag"
                  style={{
                    fontSize: "0.85rem",
                    padding: "3px 8px",
                    background: "#ffffff",
                    border: "1px solid #93c5fd",
                    borderRadius: "4px",
                    color: "#1d4ed8",
                    fontWeight: 700,
                  }}
                >
                  {barcode}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Batches Table */}
        <div style={{ padding: "14px 16px", maxHeight: "360px", overflowY: "auto" }}>
          <table
            className="product-table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ width: "40px", textAlign: "center", padding: "8px 6px" }}>#</th>
                <th style={{ textAlign: "left", padding: "8px 10px" }}>Batch No</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>Stock Status</th>
                <th style={{ textAlign: "right", padding: "8px 10px" }}>MRP</th>
                <th style={{ textAlign: "right", padding: "8px 10px" }}>Selling Rate</th>
                <th style={{ textAlign: "center", padding: "8px 10px" }}>Available Stock</th>
                <th style={{ textAlign: "center", padding: "8px 10px", width: "95px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch, idx) => {
                const isSelected = idx === selectedIndex;
                const status = statusMap.get(batch.id) || "New Stock";
                const isOutOfStock = batch.stock <= 0;
                const isLowStock = batch.stock <= (batch.reorder_threshold || 5);

                return (
                  <tr
                    key={batch.id}
                    onClick={() => {
                      setSelectedIndex(idx);
                      onSelectBatch(batch);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "#e0f2fe" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderLeft: isSelected ? "4px solid #0284c7" : "4px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ textAlign: "center", padding: "10px 6px", fontWeight: 700, color: "#64748b" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "22px",
                          height: "22px",
                          lineHeight: "22px",
                          borderRadius: "4px",
                          background: isSelected ? "#0284c7" : "#e2e8f0",
                          color: isSelected ? "#ffffff" : "#334155",
                          fontSize: "0.78rem",
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td style={{ padding: "10px", fontWeight: 600, color: "#1e293b" }}>
                      {batch.batch_no ? (
                        <span style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                          {batch.batch_no}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Default (No Batch)</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px" }}>
                      <span
                        className={`stock-status-badge ${
                          status === "New Stock" ? "new-stock" : "old-stock"
                        }`}
                        style={{ fontSize: "0.74rem", padding: "2px 8px" }}
                        title={status === "Old Stock" ? "Older batch - recommended to sell first (FIFO)" : "Newer batch"}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", padding: "10px", fontWeight: 600, color: "#475569" }}>
                      ₹{Number(batch.mrp || batch.price).toFixed(2)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "10px",
                        fontWeight: 700,
                        color: "#0f766e",
                        fontSize: "0.95rem",
                      }}
                    >
                      ₹{Number(batch.price).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px" }}>
                      {isOutOfStock ? (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        >
                          Out of Stock (0)
                        </span>
                      ) : isLowStock ? (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#92400e",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        >
                          {batch.stock} units
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        >
                          {batch.stock} units
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px" }}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          padding: "4px 10px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          background: isSelected ? "#0284c7" : "#f1f5f9",
                          color: isSelected ? "#ffffff" : "#1e293b",
                          border: isSelected ? "1px solid #0284c7" : "1px solid #cbd5e1",
                          borderRadius: "4px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBatch(batch);
                        }}
                      >
                        {isSelected ? "Select ↵" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            margin: "0 16px 14px",
            padding: "8px 12px",
            background: "#f8fafc",
            border: "1px dashed #cbd5e1",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.78rem",
            color: "#64748b",
          }}
        >
          <div>
            ⌨️ <strong>Press [1] - [{Math.min(9, batches.length)}]</strong> to instantly select |{" "}
            <strong>↑ / ↓</strong> to navigate | <strong>Enter ↵</strong> to confirm
          </div>
          <button
            type="button"
            className="btn secondary-btn"
            style={{ padding: "3px 10px", fontSize: "0.78rem" }}
            onClick={onClose}
          >
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
