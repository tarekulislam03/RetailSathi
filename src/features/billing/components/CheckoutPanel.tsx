import React, { useState, useEffect } from "react";
import { CartItem } from "../types";
import { Customer } from "../../customers/types";
import { MarketingPerson } from "../../marketing/types";
import { CheckoutPaymentDetails } from "./CheckoutInvoiceModal";

interface CheckoutPanelProps {
  cart: CartItem[];
  customers: Customer[];
  marketingPersons: MarketingPerson[];
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  marketingPersonId: number | null;
  setMarketingPersonId: (val: number | null) => void;
  paymentMode: string;
  setPaymentMode: (val: string) => void;
  onCheckout: (paymentDetails: CheckoutPaymentDetails) => void;
  isProcessing?: boolean;
}

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({
  cart,
  customers,
  marketingPersons,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  marketingPersonId,
  setMarketingPersonId,
  paymentMode,
  setPaymentMode,
  onCheckout,
  isProcessing = false,
}) => {
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);

  // Split Payment Inputs
  const [cashPaidInput, setCashPaidInput] = useState<string>("");
  const [upiPaidInput, setUpiPaidInput] = useState<string>("");
  // Single Payment Input
  const [singlePaidInput, setSinglePaidInput] = useState<string>("");

  // 1. Subtotal (Total MRP)
  const totalMRP = cart.reduce(
    (acc, item) =>
      acc + (item.product.mrp || item.product.price) * item.quantity,
    0
  );

  // 2. Discount (MRP - Selling Price)
  const totalDiscount = cart.reduce((acc, item) => {
    const mrp = item.product.mrp || item.product.price;
    const discountPerUnit = Math.max(0, mrp - item.product.price);
    return acc + discountPerUnit * item.quantity;
  }, 0);

  // 3. Grand Total
  const grandTotal = totalMRP - totalDiscount;

  // Always keep single paid input set to the full grand total when grand total updates
  useEffect(() => {
    setSinglePaidInput(grandTotal > 0 ? String(grandTotal) : "");
  }, [grandTotal]);

  // Clear split payment inputs when cart is cleared
  useEffect(() => {
    if (cart.length === 0) {
      setCashPaidInput("");
      setUpiPaidInput("");
    }
  }, [cart.length]);

  // 4. Taxable Amount & GST Amount (Inclusive GST)
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

  const filterCustomersByName = (list: Customer[], input: string) => {
    const raw = input.trim();
    if (!raw) return list;
    const query = raw.toLowerCase();
    const cleanQuery = query.replace(/^#/, "").trim();
    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric) {
      // User typed numeric query (e.g. "78" or "#78"):
      // Must match exact customer ID, or phone starting with full digits (when 6+ digits entered)
      return list
        .filter((c) => {
          const isExactId = String(c.id) === cleanQuery;
          const isExactPhone = c.phone.trim() === cleanQuery;
          const isPhonePrefix = cleanQuery.length >= 6 && c.phone.trim().startsWith(cleanQuery);
          const isNameExact = c.name.toLowerCase() === query;
          return isExactId || isExactPhone || isPhonePrefix || isNameExact;
        })
        .sort((a, b) => {
          const aExactId = String(a.id) === cleanQuery ? 1 : 0;
          const bExactId = String(b.id) === cleanQuery ? 1 : 0;
          return bExactId - aExactId;
        });
    }

    // Non-numeric query: search customer name or exact #id
    return list.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(query);
      const exactIdMatch = `#${c.id}` === query || String(c.id) === cleanQuery;
      return nameMatch || exactIdMatch;
    });
  };

  const filterCustomersByPhone = (list: Customer[], input: string) => {
    const raw = input.trim();
    if (!raw) return list;
    const query = raw.toLowerCase();
    const cleanQuery = query.replace(/^#/, "").trim();
    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric) {
      // User typed numeric query in phone field (e.g. "78" or "9876543210"):
      // Matches exact customer ID or phone number that STARTS with the digits
      return list
        .filter((c) => {
          const isExactId = String(c.id) === cleanQuery;
          const isExactPhone = c.phone.trim() === cleanQuery;
          const isPhonePrefix = c.phone.trim().startsWith(cleanQuery);
          return isExactId || isExactPhone || isPhonePrefix;
        })
        .sort((a, b) => {
          const aExactId = String(a.id) === cleanQuery ? 1 : 0;
          const bExactId = String(b.id) === cleanQuery ? 1 : 0;
          const aExactPhone = a.phone.trim() === cleanQuery ? 1 : 0;
          const bExactPhone = b.phone.trim() === cleanQuery ? 1 : 0;
          return (bExactId + bExactPhone) - (aExactId + aExactPhone);
        });
    }

    // Non-numeric query: search customer name or exact #id
    return list.filter((c) => {
      return (
        `#${c.id}` === query ||
        String(c.id) === cleanQuery ||
        c.name.toLowerCase().includes(query)
      );
    });
  };

  const filteredCustomersByName = filterCustomersByName(customers, customerName);
  const filteredCustomersByPhone = filterCustomersByPhone(customers, customerPhone);

  const selectedCustomer = customers.find((c) => {
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const cleanName = nameTrim.replace(/^#/, "");
    const cleanPhone = phoneTrim.replace(/^#/, "");

    if (phoneTrim && c.phone.trim() === phoneTrim) return true;
    if (nameTrim && c.name.toLowerCase().trim() === nameTrim.toLowerCase()) return true;
    if (nameTrim && (cleanName === String(c.id) || nameTrim === `#${c.id}`)) return true;
    if (phoneTrim && (cleanPhone === String(c.id) || phoneTrim === `#${c.id}`)) return true;
    return false;
  });

  const isSplitMode = paymentMode === "Split (Cash + UPI)" || paymentMode === "Split";

  // Calculate Paid Amounts & Dues
  let totalPaid = 0;
  let cashPaidVal = 0;
  let upiPaidVal = 0;

  if (isSplitMode) {
    cashPaidVal = Math.max(0, parseFloat(cashPaidInput) || 0);
    upiPaidVal = Math.max(0, parseFloat(upiPaidInput) || 0);
    totalPaid = cashPaidVal + upiPaidVal;
  } else {
    totalPaid =
      singlePaidInput !== ""
        ? Math.max(0, parseFloat(singlePaidInput) || 0)
        : grandTotal;
    if (paymentMode === "Cash") cashPaidVal = totalPaid;
    if (paymentMode === "UPI") upiPaidVal = totalPaid;
  }

  const dueAmount = Math.max(0, grandTotal - totalPaid);
  const changeReturn = Math.max(0, totalPaid - grandTotal);

  const isCustomerProvided = Boolean(
    (customerName.trim() && customerName.trim().toLowerCase() !== "walk-in customer") ||
    customerPhone.trim()
  );

  const isCheckoutBlocked =
    isProcessing ||
    cart.length === 0 ||
    (dueAmount > 0 && !isCustomerProvided);

  function handleAutoFillUpi() {
    const remaining = Math.max(0, grandTotal - cashPaidVal);
    setUpiPaidInput(remaining > 0 ? String(remaining) : "0");
  }

  function handleAutoFillCash() {
    const remaining = Math.max(0, grandTotal - upiPaidVal);
    setCashPaidInput(remaining > 0 ? String(remaining) : "0");
  }

  function handlePayFull() {
    setSinglePaidInput(String(grandTotal));
    setCashPaidInput(String(grandTotal));
    setUpiPaidInput("0");
  }

  return (
    <div className="card checkout-card">
      <h2>Payment & Checkout</h2>

      {/* Searchable Customer Name Dropdown */}
      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="cName">Customer Name</label>
        <input
          id="cName"
          type="text"
          placeholder="Search name, phone, or customer ID (#)..."
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value.toUpperCase());
            setIsNameDropdownOpen(true);
          }}
          style={{ textTransform: "uppercase" }}
          onFocus={() => setIsNameDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsNameDropdownOpen(false), 200)}
          autoComplete="off"
        />

        {isNameDropdownOpen && (
          <div className="search-dropdown" style={{ maxHeight: "220px" }}>
            {filteredCustomersByName.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="dropdown-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCustomerName(c.name);
                  setCustomerPhone(c.phone);
                  setIsNameDropdownOpen(false);
                }}
              >
                <div className="item-info">
                  <span className="dropdown-title">
                    <span
                      style={{
                        display: "inline-block",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        marginRight: "6px",
                      }}
                    >
                      #{c.id}
                    </span>
                    {c.name}
                  </span>
                  <span className="dropdown-sub">{c.phone || "No phone"}</span>
                </div>
                <div className="item-meta">
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "#16a34a",
                      fontWeight: 600,
                    }}
                  >
                    {c.active_points ?? (c.loyalty_points % 10)} active pts
                  </span>
                  {(c.lucky_draw_count ?? Math.floor(c.loyalty_points / 10)) > 0 && (
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "#d97706",
                        fontWeight: 700,
                      }}
                    >
                      🎟️ {c.lucky_draw_count ?? Math.floor(c.loyalty_points / 10)} draw
                    </span>
                  )}
                  {c.dues > 0 && (
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      Due: ₹{c.dues.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {customerName.trim() &&
              customerName.trim().toLowerCase() !== "walk-in customer" &&
              !selectedCustomer && (
                <div
                  className="dropdown-item"
                  style={{
                    backgroundColor: "#e6f4ea",
                    color: "#137333",
                    fontWeight: 600,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsNameDropdownOpen(false)}
                >
                  <div className="item-info">
                    <span className="dropdown-title" style={{ color: "#137333" }}>
                      + Add New Customer: "{customerName.trim()}"
                    </span>
                    <span className="dropdown-sub" style={{ color: "#1e8e3e" }}>
                      Will be saved to Customer Directory upon completing sale
                    </span>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Searchable Customer Phone Dropdown */}
      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="cPhone">Customer Phone</label>
        <input
          id="cPhone"
          type="text"
          placeholder="Search or enter mobile no..."
          value={customerPhone}
          onChange={(e) => {
            setCustomerPhone(e.target.value);
            setIsPhoneDropdownOpen(true);
          }}
          onFocus={() => setIsPhoneDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsPhoneDropdownOpen(false), 200)}
          autoComplete="off"
        />

        {isPhoneDropdownOpen && (
          <div className="search-dropdown" style={{ maxHeight: "220px" }}>
            {filteredCustomersByPhone.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="dropdown-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCustomerName(c.name);
                  setCustomerPhone(c.phone);
                  setIsPhoneDropdownOpen(false);
                }}
              >
                <div className="item-info">
                  <span className="dropdown-title">
                    <span
                      style={{
                        display: "inline-block",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        marginRight: "6px",
                      }}
                    >
                      #{c.id}
                    </span>
                    {c.phone || "No phone"}
                  </span>
                  <span className="dropdown-sub">{c.name}</span>
                </div>
                <div className="item-meta">
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "#16a34a",
                      fontWeight: 600,
                    }}
                  >
                    {c.active_points ?? (c.loyalty_points % 10)} active pts
                  </span>
                  {(c.lucky_draw_count ?? Math.floor(c.loyalty_points / 10)) > 0 && (
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "#d97706",
                        fontWeight: 700,
                      }}
                    >
                      🎟️ {c.lucky_draw_count ?? Math.floor(c.loyalty_points / 10)} draw
                    </span>
                  )}
                  {c.dues > 0 && (
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      Due: ₹{c.dues.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {customerPhone.trim() && !selectedCustomer && (
              <div
                className="dropdown-item"
                style={{
                  backgroundColor: "#e6f4ea",
                  color: "#137333",
                  fontWeight: 600,
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsPhoneDropdownOpen(false)}
              >
                <div className="item-info">
                  <span className="dropdown-title" style={{ color: "#137333" }}>
                    + Use Phone: "{customerPhone.trim()}"
                  </span>
                  <span className="dropdown-sub" style={{ color: "#1e8e3e" }}>
                    Will be linked to customer bill
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="mktPersonSelect">Marketing / Delivery Personnel</label>
        <select
          id="mktPersonSelect"
          className="search-input"
          style={{ width: "100%", height: "34px" }}
          value={marketingPersonId ?? ""}
          onChange={(e) =>
            setMarketingPersonId(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">-- None --</option>
          {marketingPersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.area ? `(${p.area})` : ""}
            </option>
          ))}
        </select>
      </div>

      {!selectedCustomer &&
        customerName.trim() &&
        customerName.trim().toLowerCase() !== "walk-in customer" && (
          <div
            style={{
              background: "linear-gradient(to bottom, #e6f4ea 0%, #c8e6c9 100%)",
              border: "1px solid #81c784",
              padding: "6px 10px",
              borderRadius: "3px",
              fontSize: "0.8rem",
              marginBottom: "8px",
              color: "#1b5e20",
              fontWeight: 600,
            }}
          >
            New Customer: "{customerName.trim()}" will be saved to Customer Directory.
          </div>
        )}

      {selectedCustomer && (
        <div
          style={{
            background: "linear-gradient(to bottom, #f0f7ff 0%, #e1effd 100%)",
            border: "1px solid #7092be",
            padding: "6px 10px",
            borderRadius: "3px",
            fontSize: "0.8rem",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#103c6b" }}>
              Selected: #{selectedCustomer.id} - {selectedCustomer.name} ({selectedCustomer.phone})
            </div>
            <div style={{ color: "#4d5c6d" }}>
              Active:{" "}
              <strong style={{ color: "#16a34a" }}>
                {selectedCustomer.active_points ?? (selectedCustomer.loyalty_points % 10)} pts
              </strong>
              {" | "}
              Lifetime:{" "}
              <strong style={{ color: "#0066cc" }}>
                {selectedCustomer.loyalty_points} pts
              </strong>
              {(selectedCustomer.lucky_draw_count ?? Math.floor(selectedCustomer.loyalty_points / 10)) > 0 && (
                <span style={{ marginLeft: "8px", color: "#d97706", fontWeight: 700 }}>
                  | 🎟️ {selectedCustomer.lucky_draw_count ?? Math.floor(selectedCustomer.loyalty_points / 10)} Draw(s)
                </span>
              )}
              {selectedCustomer.dues > 0 && (
                <span
                  style={{
                    marginLeft: "8px",
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  | Existing Dues: ₹{selectedCustomer.dues.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.9rem",
            }}
            onClick={() => {
              setCustomerName("");
              setCustomerPhone("");
            }}
            title="Clear customer selection"
          >
            X
          </button>
        </div>
      )}

      {/* Bill Totals Summary */}
      <div className="bill-summary-box">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span style={{ fontWeight: 700 }}>₹{totalMRP.toFixed(2)}</span>
        </div>

        <div className="summary-row" style={{ color: "#0d5c3a" }}>
          <span>Discount:</span>
          <span style={{ fontWeight: 700 }}>- ₹{totalDiscount.toFixed(2)}</span>
        </div>

        <div className="summary-row" style={{ color: "#4d5c6d", fontSize: "0.84rem" }}>
          <span>Taxable Amount:</span>
          <span>₹{totalTaxableAmount.toFixed(2)}</span>
        </div>

        <div className="summary-row" style={{ color: "#4d5c6d", fontSize: "0.84rem" }}>
          <span>GST Amount:</span>
          <span>₹{totalGstAmount.toFixed(2)}</span>
        </div>

        <div className="grand-total-box" style={{ marginTop: "10px" }}>
          <span>GRAND TOTAL</span>
          <span className="grand-total-val">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="form-group">
        <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1a385c" }}>
          Select Payment Method
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "6px",
            marginTop: "4px",
          }}
        >
          {[
            { id: "Cash", label: "Cash" },
            { id: "UPI", label: "UPI" },
            { id: "Card", label: "Card" },
            { id: "Split (Cash + UPI)", label: "Split (Cash + UPI)" },
          ].map((mode) => {
            const isSelected =
              paymentMode === mode.id ||
              (paymentMode === "Split" && mode.id === "Split (Cash + UPI)");
            return (
              <button
                key={mode.id}
                type="button"
                style={{
                  padding: "8px 4px",
                  fontSize: "0.82rem",
                  fontWeight: isSelected ? 700 : 600,
                  textAlign: "center",
                  borderRadius: "3px",
                  background: isSelected
                    ? "linear-gradient(to bottom, #3988e3 0%, #1555a6 100%)"
                    : "linear-gradient(to bottom, #ffffff 0%, #ebf2f9 100%)",
                  color: isSelected ? "#ffffff" : "#104175",
                  border: isSelected ? "1px solid #103c6b" : "1px solid #7092be",
                  boxShadow: isSelected
                    ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.15)"
                    : "inset 0 1px 0 #ffffff",
                  cursor: "pointer",
                }}
                onClick={() => setPaymentMode(mode.id)}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Paid Amounts & Split Payment Management Section */}
      <div
        style={{
          background: "#f0f5fb",
          border: "1px solid #7092be",
          borderRadius: "3px",
          padding: "10px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#103c6b",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Paid Amounts & Split Entry</span>
          {isSplitMode ? (
            <span style={{ fontSize: "0.76rem", color: "#2563eb", fontWeight: 700 }}>
              Split Payment Mode
            </span>
          ) : (
            <button
              type="button"
              className="btn secondary-btn"
              style={{ padding: "1px 6px", fontSize: "0.74rem" }}
              onClick={handlePayFull}
            >
              Pay Full (₹{grandTotal.toFixed(2)})
            </button>
          )}
        </div>

        {isSplitMode ? (
          <div>
            <div className="form-row" style={{ gap: "8px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: "0.78rem" }}>Cash Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cashPaidInput}
                  onChange={(e) => setCashPaidInput(e.target.value)}
                  style={{ height: "30px", padding: "2px 6px" }}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: "0.78rem" }}>UPI Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={upiPaidInput}
                  onChange={(e) => setUpiPaidInput(e.target.value)}
                  style={{ height: "30px", padding: "2px 6px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ flex: 1, padding: "2px 4px", fontSize: "0.74rem" }}
                onClick={handleAutoFillUpi}
              >
                Auto-fill UPI Balance
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ flex: 1, padding: "2px 4px", fontSize: "0.74rem" }}
                onClick={handleAutoFillCash}
              >
                Auto-fill Cash Balance
              </button>
            </div>
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: "0.78rem" }}>Amount Paid by Customer (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={grandTotal.toFixed(2)}
              value={singlePaidInput}
              onChange={(e) => setSinglePaidInput(e.target.value)}
              style={{ height: "30px", padding: "2px 6px" }}
            />
          </div>
        )}

        {/* Live Calculation Summary */}
        <div
          style={{
            marginTop: "10px",
            paddingTop: "8px",
            borderTop: "1px dashed #b8cde4",
            fontSize: "0.83rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
              fontWeight: 600,
            }}
          >
            <span>Total Amount Paid:</span>
            <span style={{ color: "#103c6b", fontWeight: 700 }}>
              ₹{totalPaid.toFixed(2)}
            </span>
          </div>

          {dueAmount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#b91c1c",
                fontWeight: 700,
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
                color: "#137333",
                fontWeight: 700,
              }}
            >
              <span>Change Return:</span>
              <span>₹{changeReturn.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Due Customer Info / Warning Alert Box */}
      {dueAmount > 0 && (
        isCustomerProvided ? (
          <div
            style={{
              background: "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)",
              border: "1px solid #ffe58f",
              padding: "8px 10px",
              borderRadius: "3px",
              fontSize: "0.8rem",
              marginBottom: "10px",
              color: "#873800",
              fontWeight: 600,
            }}
          >
            ℹ️ Outstanding balance of <strong>₹{dueAmount.toFixed(2)}</strong> will be recorded as customer dues for "<strong>{customerName.trim() || selectedCustomer?.name}</strong>".
          </div>
        ) : (
          <div
            style={{
              background: "linear-gradient(to bottom, #fff1f0 0%, #ffa39e 100%)",
              border: "1px solid #ff4d4f",
              padding: "8px 10px",
              borderRadius: "3px",
              fontSize: "0.8rem",
              marginBottom: "10px",
              color: "#a8071a",
              fontWeight: 700,
            }}
          >
            ⚠️ Customer details required! Please enter customer name or phone above to record the outstanding due balance of ₹{dueAmount.toFixed(2)}.
          </div>
        )
      )}

      <button
        className="btn primary-btn checkout-btn"
        onClick={(e) => {
          e.preventDefault();
          if (isCheckoutBlocked) return;
          let finalPaymentMode = paymentMode;
          if (paymentMode === "Split (Cash + UPI)") {
            finalPaymentMode = "Split (Cash + UPI)";
          }
          onCheckout({
            paymentMode: finalPaymentMode,
            paidAmount: totalPaid,
            dueAmount: dueAmount,
            cashPaid: isSplitMode ? cashPaidVal : (paymentMode === "Cash" ? totalPaid : 0),
            upiPaid: isSplitMode ? upiPaidVal : (paymentMode === "UPI" ? totalPaid : 0),
          });
        }}
        disabled={isCheckoutBlocked}
        style={
          isCheckoutBlocked
            ? { opacity: 0.65, cursor: "not-allowed", pointerEvents: "none" }
            : undefined
        }
      >
        {isProcessing ? "Processing..." : "Checkout"}
      </button>
    </div>
  );
};
