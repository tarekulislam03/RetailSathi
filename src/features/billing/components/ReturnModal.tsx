import React, { useState, useEffect, useRef } from "react";
import { Sale } from "../types";
import { Product } from "../../inventory/types";
import { fetchSaleByInvoice, updateSale, fetchSales } from "../services/billingService";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onReturnComplete: (updatedSale: Sale) => void;
}

interface ReturnCartItem {
  product_id: number;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
  mrp: number;
  gst_rate: number;
  originalQty?: number;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  products,
  onReturnComplete,
}) => {
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded Sale State
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Items in return / exchange
  const [items, setItems] = useState<ReturnCartItem[]>([]);

  // Replacement / Exchange search
  const [productQuery, setProductQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the invoice search bar
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTimeout(() => {
        if (!activeSale) {
          searchInputRef.current?.focus();
        }
      }, 50);

      fetchSales()
        .then((all) => setRecentSales(all.slice(0, 6)))
        .catch(() => {});
    }
  }, [isOpen, activeSale]);

  if (!isOpen) return null;

  async function handleSearchInvoice(targetInv?: string) {
    const inv = (targetInv || invoiceQuery).trim();
    if (!inv) {
      setError("Please enter or scan an Invoice / Bill Number.");
      searchInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sale = await fetchSaleByInvoice(inv);
      if (!sale) {
        setError(`No invoice found with number "${inv}". Please verify and try again.`);
        setLoading(false);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      setActiveSale(sale);
      setCustomerName(sale.customer_name || "Walk-in Customer");
      setCustomerPhone(sale.customer_phone || "");
      setPaymentMode(sale.payment_mode || "Cash");

      // Populate items
      const loadedItems: ReturnCartItem[] = (sale.items || []).map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        barcode: it.barcode || "",
        price: it.price,
        quantity: it.quantity,
        mrp: it.mrp || it.price,
        gst_rate: (it as any).gst_rate || 0,
        originalQty: it.quantity,
      }));

      setItems(loadedItems);
      setInvoiceQuery("");
    } catch (err: any) {
      setError(err?.message || "Failed to search for invoice.");
    } finally {
      setLoading(false);
    }
  }

  function handleResetSearch() {
    setActiveSale(null);
    setItems([]);
    setError(null);
    setInvoiceQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }

  // Item quantity adjustments
  function handleUpdateQty(idx: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const newQty = Math.max(0, cur.quantity + delta);

      if (newQty === 0) {
        return next.filter((_, i) => i !== idx);
      }

      if (delta > 0 && cur.product_id) {
        const prod = products.find((p) => p.id === cur.product_id);
        const original = cur.originalQty || 0;
        const additionalNeeded = newQty - original;
        if (prod && additionalNeeded > 0 && prod.stock < additionalNeeded) {
          setError(`Insufficient stock for "${cur.product_name}". Only ${prod.stock} available.`);
          return prev;
        }
      }

      next[idx] = { ...cur, quantity: newQty };
      return next;
    });
  }

  function handleManualQtyChange(idx: number, raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val <= 0) return;

    setItems((prev) => {
      const next = [...prev];
      const cur = next[idx];
      if (cur.product_id) {
        const prod = products.find((p) => p.id === cur.product_id);
        const original = cur.originalQty || 0;
        const additionalNeeded = val - original;
        if (prod && additionalNeeded > 0 && prod.stock < additionalNeeded) {
          setError(`Insufficient stock for "${cur.product_name}". Only ${prod.stock} available.`);
          return prev;
        }
      }
      next[idx] = { ...cur, quantity: val };
      return next;
    });
  }

  function handleRemoveItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Add Replacement / Exchange item
  function handleAddExchangeProduct(prod: Product) {
    if (prod.stock <= 0) {
      setError(`"${prod.name}" is out of stock!`);
      return;
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.product_id === prod.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1,
        };
        return next;
      }

      return [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          barcode: prod.barcode || "",
          price: prod.price,
          quantity: 1,
          mrp: prod.mrp || prod.price,
          gst_rate: prod.gst_rate || 0,
          originalQty: 0,
        },
      ];
    });

    setProductQuery("");
    setShowProductDropdown(false);
    setError(null);
  }

  // Matching exchange products
  const productMatches = productQuery.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
            p.barcode.toLowerCase().includes(productQuery.toLowerCase())
        )
        .slice(0, 6)
    : [];

  // Calculations
  const originalGrandTotal = activeSale ? Number(activeSale.grand_total) || 0 : 0;

  let newSellingTotal = 0;
  let newMrpTotal = 0;
  let newTaxAmount = 0;

  for (const it of items) {
    const itemTotal = it.price * it.quantity;
    newSellingTotal += itemTotal;
    newMrpTotal += (it.mrp || it.price) * it.quantity;
    if (it.gst_rate > 0) {
      const taxable = itemTotal / (1 + it.gst_rate / 100);
      newTaxAmount += itemTotal - taxable;
    }
  }

  const newGrandTotal = Math.max(0, newSellingTotal);
  const diff = newGrandTotal - originalGrandTotal;
  const isRefund = diff < -0.01;
  const isPayable = diff > 0.01;
  const refundAmount = Math.abs(diff);

  async function handleProcessReturn() {
    if (!activeSale) return;

    if (items.length === 0) {
      setError("Cannot process a return with 0 items. If the customer returned all items for a full refund, you can delete the sale from Sales History or adjust quantities.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let finalPaymentMode = paymentMode;
      if (isRefund) {
        finalPaymentMode = `${paymentMode} (Refunded ₹${refundAmount.toFixed(2)})`;
      } else if (isPayable) {
        finalPaymentMode = `${paymentMode} (Extra Paid ₹${diff.toFixed(2)})`;
      }

      const updated = await updateSale(activeSale.id, {
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim(),
        total_mrp: newMrpTotal,
        discount: Math.max(0, newMrpTotal - newSellingTotal),
        tax_amount: newTaxAmount,
        payment_mode: finalPaymentMode,
        items: items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          barcode: it.barcode,
          price: it.price,
          quantity: it.quantity,
          mrp: it.mrp,
          gst_rate: it.gst_rate,
        })),
      });

      onReturnComplete(updated);
      onClose();
    } catch (err: any) {
      console.error("Return update error:", err);
      setError(err?.message || "Failed to process return.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content card"
        style={{ maxWidth: "860px", width: "95%", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Windows 7 Aero Header */}
        <div className="modal-header">
          <div>
            <h2>Sales Return & Exchange</h2>
            <div className="hint-text">
              Scan or enter invoice number to process product returns, adjust quantities, or issue replacements
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button" disabled={submitting}>
            X
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner" style={{ margin: "10px 14px 0" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} type="button">X</button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: "14px", overflowY: "auto", flex: 1 }}>
          {/* STEP 1: Invoice Search Bar (Windows 7 Aero Panel) */}
          {!activeSale ? (
            <div>
              <div
                style={{
                  background: "#e8eff7",
                  padding: "16px 20px",
                  borderRadius: "4px",
                  border: "1px solid #7092be",
                  boxShadow: "inset 0 1px 0 #ffffff",
                  marginBottom: "14px",
                }}
              >
                <label
                  htmlFor="invoiceSearchInput"
                  style={{
                    display: "block",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#103c6b",
                    marginBottom: "8px",
                  }}
                >
                  Scan or Enter Invoice / Bill Number:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    ref={searchInputRef}
                    id="invoiceSearchInput"
                    type="text"
                    className="search-input"
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchInvoice();
                      }
                    }}
                    placeholder="Scan bill barcode or type e.g. INV-20261015-..."
                    style={{
                      flex: 1,
                      height: "34px",
                      fontSize: "0.92rem",
                      fontWeight: 700,
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn primary-btn"
                    onClick={() => handleSearchInvoice()}
                    disabled={loading}
                    style={{
                      padding: "0 18px",
                      height: "34px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {loading ? "Searching..." : "Find Invoice"}
                  </button>
                </div>
              </div>

              {/* Quick Select from Recent Bills */}
              {recentSales.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#103c6b", marginBottom: "8px" }}>
                    Recent Bills (Quick Select):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "8px" }}>
                    {recentSales.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSearchInvoice(s.invoice_no)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #7092be",
                          borderRadius: "3px",
                          padding: "8px 10px",
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef4fb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: "#0b305b", fontSize: "0.85rem" }}>
                            {s.invoice_no}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#3b5370" }}>
                            {s.customer_name || "Walk-in"} • {formatTo12Hour(s.created_at)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: "#08572e", fontSize: "0.92rem" }}>
                          ₹{Number(s.grand_total || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Loaded Invoice Details & Return / Exchange Editor */
            <div>
              {/* Top Banner with Invoice Info (Windows 7 Aero Box) */}
              <div
                style={{
                  background: "#e8eff7",
                  border: "1px solid #7092be",
                  borderRadius: "3px",
                  padding: "8px 12px",
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "inset 0 1px 0 #ffffff",
                }}
              >
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.70rem", color: "#3b5370", fontWeight: 700, textTransform: "uppercase" }}>
                      Invoice No
                    </span>
                    <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#0b305b" }}>
                      {activeSale.invoice_no}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.70rem", color: "#3b5370", fontWeight: 700, textTransform: "uppercase" }}>
                      Bill Date & Time
                    </span>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e3a5f" }}>
                      {formatTo12Hour(activeSale.created_at)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.70rem", color: "#3b5370", fontWeight: 700, textTransform: "uppercase" }}>
                      Original Total
                    </span>
                    <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#08572e" }}>
                      ₹{originalGrandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="btn secondary-btn"
                  style={{ fontSize: "0.78rem", padding: "4px 10px", fontWeight: 700 }}
                >
                  Change Invoice
                </button>
              </div>

              {/* Customer Details Form */}
              <div className="form-row" style={{ marginBottom: "10px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Customer Name</label>
                  <input
                    type="text"
                    className="search-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Customer Phone</label>
                  <input
                    type="text"
                    className="search-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Customer Phone"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Refund / Payment Mode</label>
                  <select
                    className="search-input"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{ fontWeight: 700 }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Due / Credit">Due / Credit</option>
                  </select>
                </div>
              </div>

              {/* Add Replacement / Exchange Item Bar */}
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#103c6b", whiteSpace: "nowrap" }}>
                    + Exchange Item:
                  </span>
                  <input
                    ref={productInputRef}
                    type="text"
                    className="search-input"
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Scan barcode or type product name to add exchange items..."
                    style={{ flex: 1, height: "28px", fontSize: "0.82rem" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && productMatches.length > 0) {
                        e.preventDefault();
                        handleAddExchangeProduct(productMatches[0]);
                      }
                    }}
                  />
                </div>

                {showProductDropdown && productMatches.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "115px",
                      right: 0,
                      background: "#ffffff",
                      border: "1px solid #7092be",
                      borderRadius: "3px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      zIndex: 20,
                      maxHeight: "180px",
                      overflowY: "auto",
                    }}
                  >
                    {productMatches.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddExchangeProduct(p)}
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #e1e9f2",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.82rem",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef4fb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                      >
                        <div>
                          <strong style={{ color: "#0b305b" }}>{p.name}</strong>
                          <span style={{ color: "#55708f", marginLeft: "6px" }}>({p.barcode || "N/A"})</span>
                        </div>
                        <div>
                          <strong style={{ color: "#08572e", marginRight: "10px" }}>₹{p.price.toFixed(2)}</strong>
                          <span style={{ color: p.stock > 0 ? "#1e5e2e" : "#b02a2a" }}>Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table (Aero Product Table) */}
              <div className="table-responsive" style={{ maxHeight: "240px", marginBottom: "12px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Product & Barcode</th>
                      <th style={{ width: "90px", textAlign: "right" }}>Rate</th>
                      <th style={{ width: "120px", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "95px", textAlign: "right" }}>Total</th>
                      <th style={{ width: "35px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const itemTotal = it.price * it.quantity;
                      const isNewlyAdded = !it.originalQty;
                      const isQtyReduced = (it.originalQty || 0) > it.quantity;

                      return (
                        <tr
                          key={idx}
                          style={{
                            background: isNewlyAdded ? "#edf9f0" : isQtyReduced ? "#fffbeb" : "#ffffff",
                          }}
                        >
                          <td>
                            <span className="font-semibold" style={{ color: "#0b305b" }}>
                              {it.product_name}
                            </span>
                            <div style={{ fontSize: "0.72rem", color: "#55708f" }}>
                              {it.barcode ? `Barcode: ${it.barcode}` : "No barcode"}
                              {it.originalQty !== undefined && (
                                <span style={{ marginLeft: "6px", color: "#2062aa", fontWeight: 600 }}>
                                  (Orig: {it.originalQty})
                                </span>
                              )}
                              {isNewlyAdded && (
                                <span style={{ marginLeft: "6px", color: "#08572e", fontWeight: 700 }}>
                                  [Exchange]
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            ₹{it.price.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleUpdateQty(idx, -1)}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                style={{
                                  width: "42px",
                                  textAlign: "center",
                                  padding: "2px 4px",
                                  height: "26px",
                                  fontSize: "0.82rem",
                                  fontWeight: 800,
                                }}
                                value={it.quantity}
                                onChange={(e) => handleManualQtyChange(idx, e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleUpdateQty(idx, 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="price-tag" style={{ textAlign: "right" }}>
                            ₹{itemTotal.toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="btn-icon delete-btn"
                              onClick={() => handleRemoveItem(idx)}
                              title="Remove item"
                            >
                              X
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Balance / Refund Calculation Bar (Windows 7 Aero Box) */}
              <div
                style={{
                  background: isRefund
                    ? "linear-gradient(to bottom, #edf9f0 0%, #d8f3de 100%)"
                    : isPayable
                    ? "linear-gradient(to bottom, #edf4fc 0%, #dbe8f7 100%)"
                    : "linear-gradient(to bottom, #f2f6fa 0%, #e1e9f2 100%)",
                  border: `1px solid ${isRefund ? "#83c993" : isPayable ? "#7092be" : "#b8cde4"}`,
                  borderRadius: "3px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "inset 0 1px 0 #ffffff",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#3b5370" }}>
                    Original Bill: <strong>₹{originalGrandTotal.toFixed(2)}</strong> &nbsp;|&nbsp; Revised Bill: <strong>₹{newGrandTotal.toFixed(2)}</strong>
                  </div>
                  {isRefund ? (
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#08572e", marginTop: "2px", textShadow: "0 1px 0 #ffffff" }}>
                      💵 Refund to Customer: ₹{refundAmount.toFixed(2)}
                    </div>
                  ) : isPayable ? (
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#103c6b", marginTop: "2px", textShadow: "0 1px 0 #ffffff" }}>
                      💰 Extra Collect from Customer: ₹{diff.toFixed(2)}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#3b5370", marginTop: "2px" }}>
                      ⚖️ Even Exchange: ₹0.00 Difference
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn secondary-btn"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary-btn"
                    onClick={handleProcessReturn}
                    disabled={submitting || items.length === 0}
                    style={{ fontWeight: 700 }}
                  >
                    {submitting ? "Processing..." : isRefund ? "✓ Process Refund & Save" : "✓ Complete Return & Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
