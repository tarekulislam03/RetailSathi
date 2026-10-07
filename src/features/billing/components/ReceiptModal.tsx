import React, { useState, useEffect, useRef } from "react";
import { Sale } from "../types";
import {
  printReceiptEscPos,
  getAvailablePrinters,
  PrinterDevice,
  StoreReceiptInfo,
} from "../../../services/escposService";
import { loadReceiptStoreInfo } from "../../../services/receiptStoreInfo";
import { Pagination } from "../../../components/common/Pagination";

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
  autoPrint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  autoPrint = false,
}) => {
  const items = sale.items || [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [storeInfo, setStoreInfo] = useState<StoreReceiptInfo | null>(null);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem("selected_pos_printer") || ""
      : "";
  });
  const [paperWidth, setPaperWidth] = useState<58 | 80>(() => {
    return typeof localStorage !== "undefined" && localStorage.getItem("pos_paper_width") === "58"
      ? 58
      : 80;
  });

  const [printStatus, setPrintStatus] = useState<{
    type: "idle" | "printing" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  const hasAutoPrintedRef = useRef(false);
  const isPrintingRef = useRef(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  const executePrint = async (
    targetStore?: StoreReceiptInfo | null,
    targetPrinter?: string,
    targetPaperWidth?: 58 | 80
  ) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setPrintStatus({ type: "printing", message: "Sending to ESC/POS printer..." });

    try {
      const freshStore = targetStore !== undefined ? targetStore : await loadReceiptStoreInfo();
      const activeStore = freshStore || storeInfo;
      const activePrinter = targetPrinter !== undefined ? targetPrinter : selectedPrinter;
      const activeWidth = targetPaperWidth !== undefined ? targetPaperWidth : paperWidth;

      const res = await printReceiptEscPos(sale, {
        printerName: activePrinter || undefined,
        paperWidth: activeWidth,
        storeInfo: activeStore || undefined,
      });

      if (res.success) {
        setPrintStatus({
          type: "success",
          message: res.message || "✓ Receipt printed successfully!",
        });
        setTimeout(() => {
          setPrintStatus((prev) => (prev.type === "success" ? { type: "idle" } : prev));
        }, 3000);
      } else {
        setPrintStatus({
          type: "error",
          message: res.message || "Failed to print receipt.",
        });
      }
    } catch (err: any) {
      setPrintStatus({
        type: "error",
        message: err?.message || "Failed to trigger print.",
      });
    } finally {
      isPrintingRef.current = false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([loadReceiptStoreInfo(), getAvailablePrinters()]).then(
      ([store, list]) => {
        if (!isMounted) return;
        setStoreInfo(store);
        setPrinters(list);

        const currentPaperWidth = (store.paper_width as 58 | 80) || paperWidth;
        if (store.paper_width) {
          setPaperWidth(currentPaperWidth);
        }

        const defaultName =
          selectedPrinter ||
          store.default_printer ||
          list.find((p) => p.is_default)?.name ||
          list[0]?.name ||
          "";
        if (defaultName && !selectedPrinter) {
          setSelectedPrinter(defaultName);
        }

        if (autoPrint && !hasAutoPrintedRef.current) {
          hasAutoPrintedRef.current = true;
          executePrint(store, defaultName, currentPaperWidth);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePrinterChange = (printerName: string) => {
    setSelectedPrinter(printerName);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("selected_pos_printer", printerName);
    }
  };

  const handlePrint = () => {
    executePrint();
  };

  // Financial calculations
  const totalMrp = sale.total_amount || (sale.grand_total + (sale.discount || 0));
  const totalSavings = sale.discount || Math.max(0, totalMrp - sale.grand_total);
  const totalQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card receipt-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-header">
          <div>
            <h2>Invoice Summary</h2>
            <p className="hint-text">
              Invoice #{sale.invoice_no} • {sale.created_at || "Just now"}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Print Status Feedback */}
        {printStatus.type !== "idle" && (
          <div
            style={{
              padding: "8px 14px",
              margin: "8px 16px 0 16px",
              borderRadius: "6px",
              fontSize: "0.84rem",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background:
                printStatus.type === "printing"
                  ? "#eff6ff"
                  : printStatus.type === "success"
                  ? "#ecfdf5"
                  : "#fef2f2",
              color:
                printStatus.type === "printing"
                  ? "#1d4ed8"
                  : printStatus.type === "success"
                  ? "#047857"
                  : "#b91c1c",
              border: `1px solid ${
                printStatus.type === "printing"
                  ? "#bfdbfe"
                  : printStatus.type === "success"
                  ? "#a7f3d0"
                  : "#fecaca"
              }`,
            }}
          >
            <span>{printStatus.message}</span>
            {printStatus.type === "error" && (
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: "#b91c1c",
                  color: "#fff",
                  border: "none",
                  padding: "2px 8px",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="receipt-body" style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {/* Top Quick Controls: Printer selector */}
          {printers.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#f1f5f9",
                borderRadius: "6px",
                marginBottom: "14px",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: 600, color: "#334155" }}>🖨️ Printer:</span>
                <select
                  value={selectedPrinter}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.82rem",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                  }}
                >
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.is_default ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <span style={{ color: "#64748b", fontSize: "0.78rem" }}>
                Thermal Roll: {paperWidth}mm
              </span>
            </div>
          )}

          {/* Quick Invoice Overview Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: "10px",
              padding: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "14px",
              fontSize: "0.84rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
                Customer
              </span>
              <strong style={{ color: "#0f172a" }}>{sale.customer_name || "Walk-in Customer"}</strong>
              {sale.customer_phone && (
                <span style={{ display: "block", color: "#64748b", fontSize: "0.76rem" }}>
                  {sale.customer_phone}
                </span>
              )}
            </div>

            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
                Payment Mode
              </span>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "2px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                }}
              >
                {sale.payment_mode || "Cash"}
              </span>
            </div>

            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
                Items / Qty
              </span>
              <strong style={{ color: "#0f172a" }}>
                {totalItems} items ({totalQty} pcs)
              </strong>
            </div>

            <div>
              <span style={{ color: "#64748b", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
                Status
              </span>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "2px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: (sale.due_amount || 0) > 0 ? "#fee2e2" : "#dcfce7",
                  color: (sale.due_amount || 0) > 0 ? "#b91c1c" : "#15803d",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                }}
              >
                {(sale.due_amount || 0) > 0 ? `Due: ₹${sale.due_amount?.toFixed(2)}` : "Paid in Full"}
              </span>
            </div>
          </div>

          {/* Items Summary Table */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
            <table className="product-table" style={{ width: "100%", margin: 0, fontSize: "0.84rem" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Item</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", width: "80px" }}>Rate</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", width: "50px" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", width: "90px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{item.product_name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>₹{item.price.toFixed(2)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>₹{item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalItems > 5 && (
            <div style={{ marginBottom: "12px" }}>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20]}
              />
            </div>
          )}

          {/* Financial Breakdown */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "12px 14px",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#475569" }}>
              <span>Subtotal (Total MRP):</span>
              <span>₹{totalMrp.toFixed(2)}</span>
            </div>

            {totalSavings > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#059669", fontWeight: 600 }}>
                <span>Discount / Savings:</span>
                <span>- ₹{totalSavings.toFixed(2)}</span>
              </div>
            )}

            {(sale.tax_amount || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "#64748b" }}>
                <span>GST (Inclusive):</span>
                <span>₹{(sale.tax_amount || 0).toFixed(2)}</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "8px",
                marginTop: "6px",
                borderTop: "1px solid #cbd5e1",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <span>Grand Total:</span>
              <span style={{ color: "#2563eb" }}>₹{sale.grand_total.toFixed(2)}</span>
            </div>

            {sale.paid_amount !== undefined && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "6px",
                  fontSize: "0.82rem",
                  color: "#1e3a5f",
                  fontWeight: 600,
                }}
              >
                <span>Total Paid:</span>
                <span>₹{sale.paid_amount.toFixed(2)}</span>
              </div>
            )}

            {sale.cash_paid !== undefined && sale.cash_paid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#64748b", fontSize: "0.8rem" }}>
                <span>• Cash:</span>
                <span>₹{sale.cash_paid.toFixed(2)}</span>
              </div>
            )}

            {sale.upi_paid !== undefined && sale.upi_paid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#64748b", fontSize: "0.8rem" }}>
                <span>• UPI:</span>
                <span>₹{sale.upi_paid.toFixed(2)}</span>
              </div>
            )}

            {sale.due_amount !== undefined && sale.due_amount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "4px",
                  color: "#b91c1c",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                <span>Remaining Balance (Due):</span>
                <span>₹{sale.due_amount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Close, Print Bill */}
        <div
          className="form-actions"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            className="btn secondary-btn"
            onClick={onClose}
            disabled={printStatus.type === "printing"}
          >
            Close
          </button>
          <button
            type="button"
            className="btn primary-btn"
            onClick={handlePrint}
            disabled={printStatus.type === "printing"}
            style={{ fontWeight: 700 }}
          >
            {printStatus.type === "printing" ? "⏳ Printing..." : "🖨️ Print Bill"}
          </button>
        </div>
      </div>
    </div>
  );
};
