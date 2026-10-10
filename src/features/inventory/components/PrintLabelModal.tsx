import React, { useState, useEffect } from "react";
import { Product } from "../types";
import {
  printBarcodeLabels,
  calibratePrinter,
  getLabelSettings,
  LabelSettings,
  validateLabelSettings,
  isValidEan13,
} from "../../../services/tsplService";
import { generateCode128Svg } from "../../../utils/code128";
import { getActiveOrFirstStore } from "../../stores/services/storeService";

interface PrintLabelModalProps {
  product?: Product;
  selectedProducts?: { product: Product; quantity: number }[];
  onClose: () => void;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  product,
  selectedProducts,
  onClose,
}) => {
  // Items list to print
  const [items, setItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [storeName, setStoreName] = useState<string>("RETAIL SATHI");
  const [printing, setPrinting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (selectedProducts && selectedProducts.length > 0) {
      setItems(selectedProducts);
    } else if (product) {
      setItems([{ product, quantity: 1 }]);
    }

    getLabelSettings().then(setSettings);
    getActiveOrFirstStore().then((store) => {
      if (store?.name) setStoreName(store.name);
    }).catch(() => {});
  }, [product, selectedProducts]);

  const previewItem = items[0]?.product || product;
  const totalLabels = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  const handleQuantityChange = (idx: number, qty: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], quantity: Math.max(1, qty) };
    setItems(next);
  };

  const handlePrint = async () => {
    if (!settings?.printerName) {
      setStatusMsg({
        type: "error",
        text: "Please select and configure your Label Printer in Settings first.",
      });
      return;
    }

    const invalidItem = items.find((i) => !i.product.barcode || !i.product.barcode.trim());
    if (invalidItem) {
      setStatusMsg({
        type: "error",
        text: `Product "${invalidItem.product.name}" does not have a valid barcode.`,
      });
      return;
    }

    setPrinting(true);
    setStatusMsg({ type: "info", text: "Sending raw TSPL job to Windows spooler..." });

    try {
      const payload = items.map((i) => ({
        item: {
          id: i.product.id,
          name: i.product.name,
          barcode: i.product.barcode,
          price: i.product.price,
          mrp: i.product.mrp,
          storeName,
        },
        quantity: i.quantity,
      }));

      const res = await printBarcodeLabels(payload, settings);
      setStatusMsg({
        type: "success",
        text: `✓ ${res || `Printed ${totalLabels} barcode label(s) successfully!`}`,
      });

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to print labels.",
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleRecalibrate = async () => {
    setCalibrating(true);
    setStatusMsg({ type: "info", text: "Sending AUTODETECT media calibration to printer..." });
    try {
      const res = await calibratePrinter(settings?.printerName);
      setStatusMsg({
        type: "success",
        text: `✓ ${res || "Printer media sensor calibrated."}`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `Calibration error: ${err?.message || err}`,
      });
    } finally {
      setCalibrating(false);
    }
  };

  const barcodeRaw = previewItem?.barcode || "";
  const isEan = isValidEan13(barcodeRaw);
  const barcodeSvg = barcodeRaw
    ? generateCode128Svg(barcodeRaw, {
        height: 38,
        moduleWidth: 1.6,
        showText: false,
        align: "left",
      })
    : "";

  const mrpValue = previewItem
    ? (previewItem.mrp && previewItem.mrp > 0 ? previewItem.mrp : previewItem.price)
    : 0;

  const validation = settings ? validateLabelSettings(settings) : { valid: true };

  return (
    <div className="modal-backdrop">
      <div className="modal-content card" style={{ maxWidth: "560px", padding: 0 }}>
        <div className="modal-header" style={{ padding: "16px 20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
            🏷️ Print Barcode Labels (DCode DC421 Pro)
          </h2>
          <button className="close-btn" onClick={onClose} disabled={printing}>
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 20px" }}>
          {statusMsg && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                marginBottom: "14px",
                fontSize: "0.85rem",
                fontWeight: 600,
                background:
                  statusMsg.type === "success"
                    ? "#ecfdf5"
                    : statusMsg.type === "error"
                    ? "#fef2f2"
                    : "#eff6ff",
                color:
                  statusMsg.type === "success"
                    ? "#047857"
                    : statusMsg.type === "error"
                    ? "#b91c1c"
                    : "#1d4ed8",
                border: `1px solid ${
                  statusMsg.type === "success"
                    ? "#a7f3d0"
                    : statusMsg.type === "error"
                    ? "#fecaca"
                    : "#bfdbfe"
                }`,
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {!settings?.printerName && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "6px",
                padding: "10px 14px",
                marginBottom: "14px",
                fontSize: "0.83rem",
                color: "#92400e",
              }}
            >
              ⚠️ <strong>No Label Printer configured:</strong> Go to <strong>Settings → Label Printer</strong> to select your DCode DC421 Pro printer.
            </div>
          )}

          {/* Live Preview (2-Column) */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#64748b",
                marginBottom: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>On-Screen Label Preview ({settings?.columns || 2} Columns × {settings?.labelWidthMm || 50}mm)</span>
              <span>{isEan ? "EAN-13" : "Code 128"}</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(2, settings?.columns || 2)}, 1fr)`,
                gap: "10px",
                background: "#f8fafc",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              {[1, 2].map((colNum) => (
                <div
                  key={colNum}
                  style={{
                    background: "#ffffff",
                    border: "2px solid #334155",
                    borderRadius: "4px",
                    padding: `${(settings?.paddingMm || 2) * 2}px`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                    boxSizing: "border-box",
                    minHeight: "135px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 900,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%",
                        letterSpacing: "0.4px",
                        textAlign: "left",
                        marginBottom: "10px",
                      }}
                    >
                      {storeName}
                    </div>

                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%",
                        lineHeight: "1.2",
                        textAlign: "left",
                        marginBottom: "3px",
                      }}
                      title={previewItem?.name}
                    >
                      {previewItem?.name || "Product Name"}
                    </div>

                    {barcodeSvg ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                        style={{
                          display: "flex",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          width: "100%",
                          margin: "1px 0 2px 0",
                        }}
                      />
                    ) : (
                      <div style={{ color: "#ef4444", fontSize: "0.75rem", padding: "4px 0" }}>
                        ⚠️ No barcode
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 900,
                        color: "#000000",
                        width: "100%",
                        letterSpacing: "0.3px",
                        textAlign: "left",
                        marginTop: "1px",
                      }}
                    >
                      MRP Rs.{mrpValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items & Quantities Table */}
          <div style={{ marginBottom: "16px", maxHeight: "160px", overflowY: "auto" }}>
            <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
              Selected Products ({items.length}) — Total Labels: <strong>{totalLabels}</strong>
            </label>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>Product</th>
                  <th style={{ padding: "6px 8px" }}>Barcode</th>
                  <th style={{ padding: "6px 8px", width: "100px" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.product.id || idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{it.product.name}</td>
                    <td style={{ padding: "6px 8px", color: "#64748b" }}><code>{it.product.barcode || "-"}</code></td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        className="input-field"
                        style={{ width: "70px", padding: "4px 6px", fontSize: "0.82rem" }}
                        value={it.quantity}
                        onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Printer Info Summary */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.78rem",
              color: "#64748b",
              padding: "8px 12px",
              background: "#f8fafc",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            <div>
              Printer: <strong>{settings?.printerName || "Not Configured"}</strong>
            </div>
            <div>
              Roll: <strong>{settings?.columns || 2} Cols × {settings?.labelWidthMm || 50}×{settings?.labelHeightMm || 25}mm</strong>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={handleRecalibrate}
              disabled={calibrating || printing}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
              title="Send TSPL AUTODETECT media calibration"
            >
              {calibrating ? "⏳ Calibrating..." : "🔄 Calibrate Media"}
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn secondary-btn"
                onClick={onClose}
                disabled={printing}
                style={{ padding: "8px 14px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={handlePrint}
                disabled={printing || !validation.valid || items.length === 0}
                style={{ padding: "8px 18px", fontWeight: 700 }}
              >
                {printing ? "Printing..." : `🖨️ Print Labels (${totalLabels})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
