import React, { useState } from "react";
import { Product } from "../types";
import { PrintLabelModal } from "./PrintLabelModal";

interface BulkPrintLabelsModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

export const BulkPrintLabelsModal: React.FC<BulkPrintLabelsModalProps> = ({
  products,
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMap, setSelectedMap] = useState<Record<number, number>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);

  if (!isOpen) return null;

  const validProducts = products.filter((p) => p.barcode && p.barcode.trim());
  const filtered = validProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelect = (id: number) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  };

  const updateQuantity = (id: number, qty: number) => {
    setSelectedMap((prev) => ({
      ...prev,
      [id]: Math.max(1, qty),
    }));
  };

  const selectAll = () => {
    const next: Record<number, number> = {};
    for (const p of filtered) {
      next[p.id] = selectedMap[p.id] || 1;
    }
    setSelectedMap(next);
  };

  const deselectAll = () => {
    setSelectedMap({});
  };

  const selectedCount = Object.keys(selectedMap).length;
  const totalLabels = Object.values(selectedMap).reduce((acc, q) => acc + q, 0);

  const handleProceedToPrint = () => {
    if (selectedCount === 0) return;
    setShowPrintModal(true);
  };

  const selectedPayload = Object.entries(selectedMap)
    .map(([idStr, quantity]) => {
      const prod = products.find((p) => p.id === Number(idStr));
      return prod ? { product: prod, quantity } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number }[];

  return (
    <>
      <div className="modal-backdrop">
        <div className="modal-content card" style={{ maxWidth: "680px", padding: 0 }}>
          <div className="modal-header" style={{ padding: "16px 20px" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
              🖨️ Select Products to Print Labels
            </h2>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>

          <div style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "center" }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search products by name or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn secondary-btn"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                onClick={selectAll}
              >
                Select All
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                onClick={deselectAll}
              >
                Clear
              </button>
            </div>

            <div
              style={{
                maxHeight: "340px",
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ width: "40px", padding: "8px", textAlign: "center" }}></th>
                    <th style={{ padding: "8px", textAlign: "left" }}>Product</th>
                    <th style={{ padding: "8px", textAlign: "left" }}>Barcode</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>MRP</th>
                    <th style={{ padding: "8px", textAlign: "center", width: "90px" }}>Copies</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                        No products found with scannable barcodes.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const isSelected = Boolean(selectedMap[p.id]);
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: isSelected ? "#f0fdf4" : "#ffffff",
                          }}
                        >
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(p.id)}
                            />
                          </td>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: "8px", color: "#64748b" }}>
                            <code>{p.barcode}</code>
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>
                            ₹{((p.mrp && p.mrp > 0) ? p.mrp : p.price).toFixed(2)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              className="input-field"
                              style={{ width: "65px", padding: "3px 6px", fontSize: "0.82rem", textAlign: "center" }}
                              value={selectedMap[p.id] || 1}
                              disabled={!isSelected}
                              onChange={(e) => updateQuantity(p.id, parseInt(e.target.value) || 1)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                Selected: <strong>{selectedCount}</strong> products (<strong>{totalLabels}</strong> total labels)
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn secondary-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary-btn"
                  disabled={selectedCount === 0}
                  onClick={handleProceedToPrint}
                >
                  Configure & Print →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPrintModal && (
        <PrintLabelModal
          selectedProducts={selectedPayload}
          onClose={() => {
            setShowPrintModal(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
