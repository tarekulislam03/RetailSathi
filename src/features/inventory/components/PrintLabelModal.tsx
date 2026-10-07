import React, { useState, useEffect } from "react";
import { Product } from "../types";
import {
  printBarcodeLabel,
  calibratePrinter,
  getLabelSettings,
  LabelSettings,
} from "../../../services/tsplService";
import { printBarcodeLabelEscPos } from "../../../services/escposService";
import { generateCode128Svg } from "../../../utils/code128";

interface PrintLabelModalProps {
  product: Product;
  onClose: () => void;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  product,
  onClose,
}) => {
  const [copies, setCopies] = useState(1);
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [printing, setPrinting] = useState(false);
  const [posPrinting, setPosPrinting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    getLabelSettings().then(setSettings);
  }, []);

  const handlePrint = async () => {
    if (!product.barcode || !product.barcode.trim()) {
      setStatusMsg({
        type: "error",
        text: "This product does not have a valid barcode assigned.",
      });
      return;
    }

    setPrinting(true);
    setStatusMsg(null);

    try {
      const res = await printBarcodeLabel(
        {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          mrp: product.mrp,
          batch_no: product.batch_no,
        },
        copies
      );

      setStatusMsg({
        type: "success",
        text: `✓ ${res || `Successfully printed ${copies} label(s)!`}`,
      });

      // Auto close on success after brief delay
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to print label.",
      });
    } finally {
      setPrinting(false);
    }
  };

  const handlePosPrint = async () => {
    if (!product.barcode || !product.barcode.trim()) {
      setStatusMsg({
        type: "error",
        text: "This product does not have a valid barcode assigned.",
      });
      return;
    }

    setPosPrinting(true);
    setStatusMsg({ type: "info", text: "Printing barcode label to POS thermal printer..." });

    try {
      for (let i = 0; i < copies; i++) {
        const res = await printBarcodeLabelEscPos({
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          mrp: product.mrp,
          batch_no: product.batch_no,
        });

        if (!res.success) {
          throw new Error(res.message);
        }
      }

      setStatusMsg({
        type: "success",
        text: `✓ Printed ${copies} label(s) to your POS thermal receipt printer!`,
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `POS Print Error: ${err?.message || err}`,
      });
    } finally {
      setPosPrinting(false);
    }
  };

  const handleRecalibrate = async () => {
    setCalibrating(true);
    setStatusMsg({ type: "info", text: "Sending calibration sequence (~T) to printer..." });
    try {
      const res = await calibratePrinter();
      setStatusMsg({
        type: "success",
        text: `✓ ${res || "Printer gap sensor calibrated."}`,
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

  const barcodeSvg = product.barcode
    ? generateCode128Svg(product.barcode, {
        height: 32,
        moduleWidth: 1.2,
        showText: true,
      })
    : "";

  return (
    <div className="modal-backdrop">
      <div className="modal-content card" style={{ maxWidth: "440px" }}>
        <div className="modal-header">
          <h2>🏷️ Print Barcode Label</h2>
          <button className="close-btn" onClick={onClose} disabled={printing}>
            ✕
          </button>
        </div>

        <div style={{ padding: "16px", backgroundColor: "#ffffff" }}>
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

          {/* Label Preview Card (2-Column) */}
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
              <span>2-Column Label Layout</span>
              <span>Only MRP (Centered)</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {[1, 2].map((colNum) => (
                <div
                  key={colNum}
                  style={{
                    background: "#ffffff",
                    border: "2px dashed #94a3b8",
                    borderRadius: "6px",
                    padding: "10px 6px",
                    textAlign: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: "3px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={product.name}
                  >
                    {product.name}
                  </div>

                  {barcodeSvg ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                      style={{
                        display: "inline-block",
                        margin: "2px 0",
                        maxWidth: "100%",
                        overflow: "hidden",
                      }}
                    />
                  ) : (
                    <div style={{ color: "#ef4444", fontSize: "0.75rem", padding: "6px" }}>
                      ⚠️ No barcode
                    </div>
                  )}

                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginTop: "3px",
                      paddingTop: "3px",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    MRP: ₹{((product.mrp && product.mrp > 0) ? product.mrp : product.price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                Number of Copies
              </label>
              <input
                type="number"
                min={1}
                max={500}
                className="input-field"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div style={{ flex: 1, fontSize: "0.78rem", color: "#64748b", alignSelf: "flex-end", paddingBottom: "6px" }}>
              <div>Printer: <strong>{settings?.printerName || "Default TSPL"}</strong></div>
              <div>Size: {settings?.widthMm || 50}mm × {settings?.heightMm || 30}mm</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn secondary-btn"
                onClick={handlePosPrint}
                disabled={posPrinting || printing || !product.barcode}
                style={{ fontSize: "0.82rem", padding: "6px 10px", background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}
                title="Test print this barcode sticker layout directly on your POS thermal receipt printer"
              >
                {posPrinting ? "⏳ Printing..." : "🧾 Test on POS Thermal Printer"}
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                onClick={handleRecalibrate}
                disabled={calibrating || printing || posPrinting}
                style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                title="Re-align gap sensor on stock replacement"
              >
                {calibrating ? "⏳ Aligning..." : "🔄 Recalibrate (~T)"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn secondary-btn"
                onClick={onClose}
                disabled={printing || posPrinting}
                style={{ padding: "8px 14px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={handlePrint}
                disabled={printing || posPrinting || !product.barcode}
                style={{ padding: "8px 18px", fontWeight: 700 }}
              >
                {printing ? "Printing..." : `🖨️ TSPL Print (${copies})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
