import React, { useState, useEffect } from "react";
import { CartItem } from "../types";
import { Customer } from "../../customers/types";
import { MarketingPerson } from "../../marketing/types";

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
  onCheckout: (paymentDetails?: {
    paymentMode: string;
    paidAmount: number;
    dueAmount: number;
    cashPaid: number;
    upiPaid: number;
  }) => void;
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
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  // Sync single paid input when grandTotal changes if user hasn't explicitly edited it
  useEffect(() => {
    if (singlePaidInput === "" || Number(singlePaidInput) === 0) {
      setSinglePaidInput(grandTotal > 0 ? String(grandTotal) : "");
    }
  }, [grandTotal]);

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

  const filteredCustomers = customers.filter((c) => {
    const query = customerName.toLowerCase().trim();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query)
    );
  });

  const selectedCustomer = customers.find(
    (c) =>
      (customerPhone && c.phone.trim() === customerPhone.trim()) ||
      (customerName && c.name.toLowerCase().trim() === customerName.toLowerCase().trim())
  );

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

  const isCheckoutBlocked = cart.length === 0 || (dueAmount > 0 && !isCustomerProvided);

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

      {/* Searchable Customer Dropdown */}
      <div className="form-group" style={{ position: "relative" }}>
        <label htmlFor="cName">Customer Name</label>
        <input
          id="cName"
          type="text"
          placeholder="Search name or phone..."
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
          autoComplete="off"
        />

        {isDropdownOpen && (
          <div className="search-dropdown" style={{ maxHeight: "220px" }}>
            {filteredCustomers.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="dropdown-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCustomerName(c.name);
                  setCustomerPhone(c.phone);
                  setIsDropdownOpen(false);
                }}
              >
                <div className="item-info">
                  <span className="dropdown-title">{c.name}</span>
                  <span className="dropdown-sub">{c.phone || "No phone"}</span>
                </div>
                <div className="item-meta">
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "#0066cc",
                      fontWeight: 600,
                    }}
                  >
                    {c.loyalty_points} pts
                  </span>
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
                  onClick={() => setIsDropdownOpen(false)}
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

      <div className="form-group">
        <label htmlFor="cPhone">Customer Phone</label>
        <input
          id="cPhone"
          type="text"
          placeholder="Enter mobile no"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
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
              Selected: {selectedCustomer.name} ({selectedCustomer.phone})
            </div>
            <div style={{ color: "#4d5c6d" }}>
              Points:{" "}
              <strong style={{ color: "#0066cc" }}>
                {selectedCustomer.loyalty_points} pts
              </strong>
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
        onClick={() => {
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
      >
        COMPLETE SALE & PRINT INVOICE
      </button>
    </div>
  );
};
