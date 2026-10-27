import React, { useState, useEffect, useRef } from "react";
import { CartItem } from "../types";
import {
  getAvailablePrinters,
  PrinterDevice,
  StoreReceiptInfo,
} from "../../../services/escposService";
import { loadReceiptStoreInfo } from "../../../services/receiptStoreInfo";
import { Pagination } from "../../../components/common/Pagination";
import {
  getDevicePrinterSettings,
  saveDevicePrinterSettings,
} from "../../../services/deviceSettingsService";
import { getDb } from "../../../services/database";

export interface CheckoutPaymentDetails {
  paymentMode: string;
  paidAmount: number;
  dueAmount: number;
  cashPaid: number;
  upiPaid: number;
}

interface CheckoutInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  marketingPersonName?: string;
  paymentDetails: CheckoutPaymentDetails;
  onConfirmCheckout: (
    action: "save" | "print",
    printerOptions?: {
      printerName?: string;
      paperWidth?: 58 | 80;
      storeInfo?: StoreReceiptInfo | null;
    }
  ) => Promise<void>;
  isProcessing?: boolean;
}

export const CheckoutInvoiceModal: React.FC<CheckoutInvoiceModalProps> = ({
  isOpen,
  onClose,
  cart,
  customerName,
  customerPhone,
  marketingPersonName,
  paymentDetails,
  onConfirmCheckout,
  isProcessing = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [storeInfo, setStoreInfo] = useState<StoreReceiptInfo | null>(null);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem("selected_pos_printer") || ""
      : "";
  });
  const [paperWidth, setPaperWidth] = useState<58 | 80>(() => {
    return typeof localStorage !== "undefined" &&
      localStorage.getItem("pos_paper_width") === "58"
      ? 58
      : 80;
  });

  const [activeAction, setActiveAction] = useState<"save" | "print" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([loadReceiptStoreInfo(), getAvailablePrinters(), getDevicePrinterSettings()]).then(
      ([store, list, deviceSettings]) => {
        if (!isMounted) return;
        setStoreInfo(store);
        setPrinters(list);

        const currentPaperWidth = deviceSettings.pos_paper_width || 80;
        setPaperWidth(currentPaperWidth);

        let initialName = deviceSettings.pos_printer || selectedPrinter || "";
        const exists = list.some((p) => p.name.toLowerCase() === initialName.toLowerCase());
        if (!exists && list.length > 0) {
          const sysDef = list.find((p) => p.is_default);
          initialName = sysDef ? sysDef.name : list[0]?.name || "";
        }
        setSelectedPrinter(initialName);
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  // Close on Escape key if not currently saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !activeAction && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAction, isProcessing, onClose]);

  if (!isOpen) return null;

  const totalItems = cart.length;
  const totalQty = cart.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);

  // Financial calculations
  const totalMRP = cart.reduce(
    (acc, item) =>
      acc + (item.product.mrp || item.product.price) * item.quantity,
    0
  );

  const totalDiscount = cart.reduce((acc, item) => {
    const mrp = item.product.mrp || item.product.price;
    const discountPerUnit = Math.max(0, mrp - item.product.price);
    return acc + discountPerUnit * item.quantity;
  }, 0);

  let totalTaxableAmount = 0;
  let totalGstAmount = 0;
  for (const item of cart) {
    const itemSellingTotal = item.product.price * item.quantity;
    const gstRate = item.product.gst_rate || 0;
    if (gstRate > 0) {
      const itemTaxable = itemSellingTotal / (1 + gstRate / 100);
      const itemGst = itemSellingTotal - itemTaxable;
      totalTaxableAmount += itemTaxable;
      totalGstAmount += itemGst;
    } else {
      totalTaxableAmount += itemSellingTotal;
    }
  }

  const grandTotal = totalMRP - totalDiscount;
  const paidAmount = paymentDetails.paidAmount;
  const dueAmount = paymentDetails.dueAmount;
  const cashPaid = paymentDetails.cashPaid;
  const upiPaid = paymentDetails.upiPaid;
  const changeReturn = Math.max(0, paidAmount - grandTotal);

  const isNamedCustomer = Boolean(
    customerPhone.trim() ||
      (customerName.trim() && customerName.trim().toLowerCase() !== "walk-in customer")
  );
  const earnedLoyaltyPoints = Math.floor(grandTotal / 100);
  const [existingLoyaltyPoints, setExistingLoyaltyPoints] = useState<number>(0);
  const [existingCustomerId, setExistingCustomerId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !isNamedCustomer) return;
    const phone = customerPhone.trim();
    const name = customerName.trim();
    getDb().then(async (db) => {
      try {
        const rows = await db.select<{ id: number; loyalty_points: number }[]>(
          "SELECT id, loyalty_points FROM customers WHERE (phone = $1 AND phone != '') OR (LOWER(name) = LOWER($2) AND name != '') LIMIT 1",
          [phone, name]
        );
        if (rows.length > 0) {
          setExistingCustomerId(rows[0].id);
          setExistingLoyaltyPoints(Number(rows[0].loyalty_points) || 0);
        } else {
          setExistingCustomerId(null);
          setExistingLoyaltyPoints(0);
        }
      } catch {
        setExistingCustomerId(null);
        setExistingLoyaltyPoints(0);
      }
    });
  }, [isOpen, customerPhone, customerName, isNamedCustomer]);

  const projectedLoyaltyPoints = existingLoyaltyPoints + earnedLoyaltyPoints;

  // Pagination
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCart = cart.slice(startIndex, startIndex + pageSize);

  const handlePrinterChange = (printerName: string) => {
    setSelectedPrinter(printerName);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("selected_pos_printer", printerName);
    }
    saveDevicePrinterSettings({ pos_printer: printerName }).catch((err) => {
      console.warn("Failed to persist pos_printer to local device settings:", err);
    });
  };

  const handleExecute = async (action: "save" | "print") => {
    if (isSubmittingRef.current || isProcessing) return;
    isSubmittingRef.current = true;
    setActiveAction(action);
    setErrorMessage(null);

    try {
      await onConfirmCheckout(action, {
        printerName: selectedPrinter || undefined,
        paperWidth: paperWidth,
        storeInfo: storeInfo || undefined,
      });
    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      setErrorMessage(err?.message || `Failed to ${action === "print" ? "save and print" : "save"} sale.`);
    } finally {
      isSubmittingRef.current = false;
      setActiveAction(null);
    }
  };

  const isBusy = Boolean(activeAction) || isProcessing;

  return (
    <div className="modal-backdrop" style={{ cursor: "default" }}>
      <div
        className="modal-content card receipt-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "580px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2>Invoice Details</h2>
            <div
              className="hint-text"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "2px",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Review invoice summary before completing transaction
              </span>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            disabled={isBusy}
            title="Close (Keep cart items and data intact)"
          >
            ✕
          </button>
        </div>

        {/* Error / Alert Feedback */}
        {errorMessage && (
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
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              style={{
                background: "none",
                border: "none",
                color: "#b91c1c",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          className="receipt-body"
          style={{ padding: "16px", overflowY: "auto", flex: 1 }}
        >
          {/* Quick Printer Selector Bar */}
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
                <span style={{ fontWeight: 600, color: "#334155" }}>
                  🖨️ Printer:
                </span>
                <select
                  value={selectedPrinter}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  disabled={isBusy}
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
              <span
                style={{
                  color: "#64748b",
                  display: "block",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Customer
              </span>
              <strong style={{ color: "#0f172a" }}>
                {customerName.trim() || "Walk-in Customer"}
              </strong>
              {existingCustomerId ? (
                <span
                  style={{
                    display: "block",
                    color: "#0284c7",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                  }}
                >
                  Customer ID: #{existingCustomerId}
                </span>
              ) : isNamedCustomer ? (
                <span
                  style={{
                    display: "block",
                    color: "#16a34a",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                  }}
                >
                  (New Customer)
                </span>
              ) : null}
              {customerPhone && (
                <span
                  style={{
                    display: "block",
                    color: "#64748b",
                    fontSize: "0.76rem",
                  }}
                >
                  {customerPhone}
                </span>
              )}
            </div>

            <div>
              <span
                style={{
                  color: "#64748b",
                  display: "block",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
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
                {paymentDetails.paymentMode || "Cash"}
              </span>
              {marketingPersonName && (
                <span
                  style={{
                    display: "block",
                    color: "#64748b",
                    fontSize: "0.74rem",
                    marginTop: "2px",
                  }}
                >
                  Mkt: {marketingPersonName}
                </span>
              )}
            </div>

            <div>
              <span
                style={{
                  color: "#64748b",
                  display: "block",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Items / Qty
              </span>
              <strong style={{ color: "#0f172a" }}>
                {totalItems} items ({totalQty} pcs)
              </strong>
            </div>

            <div>
              <span
                style={{
                  color: "#64748b",
                  display: "block",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Status
              </span>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "2px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: dueAmount > 0 ? "#fee2e2" : "#dcfce7",
                  color: dueAmount > 0 ? "#b91c1c" : "#15803d",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                }}
              >
                {dueAmount > 0 ? `Due: ₹${dueAmount.toFixed(2)}` : "Paid in Full"}
              </span>
            </div>

            {isNamedCustomer && (
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "block",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Loyalty Points
                </span>
                <strong style={{ color: "#0066cc" }}>
                  {projectedLoyaltyPoints} pts
                </strong>
                {earnedLoyaltyPoints > 0 && (
                  <span
                    style={{
                      display: "block",
                      color: "#16a34a",
                      fontSize: "0.76rem",
                    }}
                  >
                    (+{earnedLoyaltyPoints} earned)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Items Summary Table */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            <table
              className="product-table"
              style={{ width: "100%", margin: 0, fontSize: "0.84rem" }}
            >
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>
                    Item Name
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 10px",
                      width: "50px",
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 10px",
                      width: "80px",
                    }}
                  >
                    MRP
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 10px",
                      width: "80px",
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 10px",
                      width: "90px",
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCart.map((item, idx) => {
                  const itemMrp = item.product.mrp || item.product.price;
                  const itemTotal = item.product.price * item.quantity;
                  return (
                    <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                        {item.product.name}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          color: "#64748b",
                        }}
                      >
                        ₹{itemMrp.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          color: "#475569",
                        }}
                      >
                        ₹{item.product.price.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        ₹{itemTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalItems > pageSize && (
            <div style={{ marginBottom: "12px" }}>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[50, 100, 200]}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                color: "#475569",
              }}
            >
              <span>Subtotal (Total MRP):</span>
              <span>₹{totalMRP.toFixed(2)}</span>
            </div>

            {totalDiscount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                <span>Discount / Savings:</span>
                <span>- ₹{totalDiscount.toFixed(2)}</span>
              </div>
            )}

            {totalGstAmount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                  color: "#64748b",
                }}
              >
                <span>GST (Inclusive):</span>
                <span>₹{totalGstAmount.toFixed(2)}</span>
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
              <span style={{ color: "#2563eb" }}>₹{grandTotal.toFixed(2)}</span>
            </div>

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
              <span>₹{paidAmount.toFixed(2)}</span>
            </div>

            {cashPaid > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "2px",
                  color: "#64748b",
                  fontSize: "0.8rem",
                }}
              >
                <span>• Cash:</span>
                <span>₹{cashPaid.toFixed(2)}</span>
              </div>
            )}

            {upiPaid > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "2px",
                  color: "#64748b",
                  fontSize: "0.8rem",
                }}
              >
                <span>• UPI:</span>
                <span>₹{upiPaid.toFixed(2)}</span>
              </div>
            )}

            {dueAmount > 0 && (
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
                <span>₹{dueAmount.toFixed(2)}</span>
              </div>
            )}

            {changeReturn > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "4px",
                  color: "#137333",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                <span>Change Return:</span>
                <span>₹{changeReturn.toFixed(2)}</span>
              </div>
            )}

            {isNamedCustomer && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  paddingTop: "8px",
                  borderTop: "1px dashed #cbd5e1",
                  fontSize: "0.85rem",
                  color: "#0369a1",
                  fontWeight: 600,
                }}
              >
                <span>Total Loyalty Points:</span>
                <span style={{ fontWeight: 700 }}>
                  {projectedLoyaltyPoints} pts
                  {earnedLoyaltyPoints > 0 && (
                    <span style={{ color: "#16a34a", marginLeft: "4px" }}>
                      (+{earnedLoyaltyPoints} this bill)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons: Close, Save Only, Print Bill */}
        <div
          className="form-actions"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            className="btn secondary-btn"
            onClick={onClose}
            disabled={isBusy}
            title="Cancel checkout and return to cart"
          >
            ✕ Cancel
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={() => handleExecute("save")}
              disabled={isBusy}
              style={{
                fontWeight: 700,
                minWidth: "120px",
                borderColor: "#2563eb",
                color: "#1d4ed8",
              }}
            >
              {activeAction === "save" ? "💾 Saving..." : "Save Only"}
            </button>

            <button
              type="button"
              className="btn primary-btn"
              onClick={() => handleExecute("print")}
              disabled={isBusy}
              style={{ fontWeight: 700, minWidth: "130px" }}
            >
              {activeAction === "print" ? "🖨️ Printing..." : "Print Bill"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
