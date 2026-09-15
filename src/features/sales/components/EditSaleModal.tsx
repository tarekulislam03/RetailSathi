import React, { useState, useEffect } from "react";
import { Sale, UpdateSaleInput } from "../../billing/types";
import { fetchSaleDetails, updateSale } from "../../billing/services/billingService";
import { fetchProducts } from "../../inventory/services/inventoryService";
import { Product } from "../../inventory/types";
import { fetchMarketingPersons } from "../../marketing/services/marketingService";
import { MarketingPerson } from "../../marketing/types";

interface EditSaleModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSaleUpdated: () => void;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  sale,
  onClose,
  onSaleUpdated,
}) => {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discount, setDiscount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [marketingPersonId, setMarketingPersonId] = useState<number | null>(null);

  // Split payment fields
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [upiPaid, setUpiPaid] = useState<number>(0);
  const [dueAmount, setDueAmount] = useState<number>(0);

  // Items in edit cart
  const [items, setItems] = useState<
    {
      product_id: number;
      product_name: string;
      barcode: string;
      price: number;
      quantity: number;
      mrp?: number;
      gst_rate?: number;
    }[]
  >([]);

  // Inventory products for adding new items
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [marketingPersons, setMarketingPersons] = useState<MarketingPerson[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;

    async function loadFullSale() {
      try {
        setError(null);
        let fullSale = sale!;
        if (!fullSale.items || fullSale.items.length === 0) {
          const details = await fetchSaleDetails(sale!.id);
          if (details) fullSale = details;
        }

        setCustomerName(fullSale.customer_name || "");
        setCustomerPhone(fullSale.customer_phone || "");
        setTaxAmount(fullSale.tax_amount || 0);
        setMarketingPersonId(fullSale.marketing_person_id || null);

        // Extract payment mode
        const mode = fullSale.payment_mode || "Cash";
        if (mode.toLowerCase().includes("split")) {
          setPaymentMode("Split Payment");
        } else if (mode.toLowerCase().includes("due") || mode.toLowerCase().includes("credit")) {
          setPaymentMode("Due / Credit");
        } else if (mode.toLowerCase().includes("upi")) {
          setPaymentMode("UPI");
        } else if (mode.toLowerCase().includes("card")) {
          setPaymentMode("Card");
        } else {
          setPaymentMode("Cash");
        }

        setCashPaid(fullSale.cash_paid || 0);
        setUpiPaid(fullSale.upi_paid || 0);
        setDueAmount(fullSale.due_amount || 0);

        // Populate items & calculate MRP vs Selling discount
        if (fullSale.items && fullSale.items.length > 0) {
          let itemSellingTotal = 0;
          let itemMrpTotal = 0;

          const mappedItems = fullSale.items.map((it) => {
            const price = it.price;
            const quantity = it.quantity;
            const mrp = (it as any).mrp ?? price;
            itemSellingTotal += price * quantity;
            itemMrpTotal += (mrp > 0 ? mrp : price) * quantity;
            return {
              product_id: it.product_id,
              product_name: it.product_name,
              barcode: it.barcode || "",
              price,
              quantity,
              mrp,
              gst_rate: (it as any).gst_rate ?? 0,
            };
          });

          setItems(mappedItems);

          const autoMrpDiscount = Math.max(0, itemMrpTotal - itemSellingTotal);
          const initialExtraDiscount = Math.max(
            0,
            (fullSale.discount || 0) - autoMrpDiscount
          );
          setDiscount(initialExtraDiscount);
        } else {
          setItems([]);
          setDiscount(0);
        }
      } catch (err: any) {
        console.error("Failed to load full sale details:", err);
      }
    }

    loadFullSale();

    // Fetch product catalog & marketing personnel
    fetchProducts()
      .then(setAvailableProducts)
      .catch((err) => console.error("Failed to fetch products:", err));

    fetchMarketingPersons()
      .then(setMarketingPersons)
      .catch((err) => console.error("Failed to fetch marketing persons:", err));
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  // Calculate Subtotal (Selling Price Total) and Calculated GST
  let subtotal = 0;
  let calculatedGst = 0;

  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    const rate = item.gst_rate || 0;
    if (rate > 0) {
      const taxable = itemTotal / (1 + rate / 100);
      calculatedGst += itemTotal - taxable;
    }
  }

  const grandTotal = Math.max(0, subtotal - discount);

  function handleQuantityChange(index: number, newQty: number) {
    if (newQty < 1) return;
    const next = [...items];
    next[index].quantity = newQty;
    setItems(next);
  }

  function handlePriceChange(index: number, newPrice: number) {
    if (newPrice < 0) return;
    const next = [...items];
    next[index].price = newPrice;
    setItems(next);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) {
      setError("Sale must contain at least one item.");
      return;
    }
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    setError(null);
  }

  function handleAddProduct() {
    if (!selectedProductId) return;
    const pId = Number(selectedProductId);
    const prod = availableProducts.find((p) => p.id === pId);
    if (!prod) return;

    // Check if already in cart
    const existingIdx = items.findIndex((it) => it.product_id === pId);
    if (existingIdx >= 0) {
      handleQuantityChange(existingIdx, items[existingIdx].quantity + 1);
    } else {
      setItems([
        ...items,
        {
          product_id: prod.id,
          product_name: prod.name,
          barcode: prod.barcode || "",
          price: prod.price,
          quantity: 1,
          mrp: prod.mrp || prod.price,
          gst_rate: prod.gst_rate || 0,
        },
      ]);
    }
    setSelectedProductId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setError("Please add at least one product to the sale.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const effectiveTax = taxAmount > 0 ? taxAmount : calculatedGst;

      const updateInput: UpdateSaleInput = {
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || "",
        discount,
        tax_amount: effectiveTax,
        payment_mode: paymentMode,
        marketing_person_id: marketingPersonId,
        items,
      };

      if (paymentMode === "Split Payment") {
        updateInput.cash_paid = cashPaid;
        updateInput.upi_paid = upiPaid;
        updateInput.due_amount = dueAmount;
      } else if (paymentMode === "Due / Credit") {
        updateInput.due_amount = grandTotal;
      }

      await updateSale(sale!.id, updateInput);
      onSaleUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update sale record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{ maxWidth: "780px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Edit Invoice #{sale.invoice_no}</h2>
            <div className="hint-text">
              Date: {sale.created_at || "N/A"} | Modify customer, items, prices, and payment details
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: "10px 14px 0" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} type="button">X</button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "14px" }}>
          {/* Customer Details & Payment Mode */}
          <div className="form-row" style={{ marginBottom: "10px" }}>
            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Customer Phone</label>
              <input
                type="text"
                placeholder="Phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: "10px" }}>
            <div className="form-group">
              <label>Payment Mode</label>
              <select
                className="search-input"
                style={{ width: "100%" }}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Due / Credit">Due / Credit</option>
                <option value="Split Payment">Split Payment</option>
              </select>
            </div>

            <div className="form-group">
              <label>Marketing Personnel (Optional)</label>
              <select
                className="search-input"
                style={{ width: "100%" }}
                value={marketingPersonId ?? ""}
                onChange={(e) =>
                  setMarketingPersonId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">None / Direct Sale</option>
                {marketingPersons.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.area || "General"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Split Payment Breakdown */}
          {paymentMode === "Split Payment" && (
            <div
              className="form-row"
              style={{
                marginBottom: "12px",
                background: "#e8eff7",
                padding: "8px 10px",
                borderRadius: "3px",
                border: "1px solid #b8cde4",
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cash Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashPaid}
                  onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>UPI Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={upiPaid}
                  onChange={(e) => setUpiPaid(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Due Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dueAmount}
                  onChange={(e) => setDueAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* Items Section */}
          <div
            style={{
              marginBottom: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#103c6b" }}>
              Sale Product Items ({items.length})
            </span>

            {/* Add Product Dropdown */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <select
                className="search-input"
                style={{ width: "220px", height: "30px", fontSize: "0.8rem" }}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">+ Add Product from Inventory...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.stock}, ₹{p.price})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                onClick={handleAddProduct}
                disabled={!selectedProductId}
              >
                Add
              </button>
            </div>
          </div>

          <div
            className="table-responsive"
            style={{ maxHeight: "220px", marginBottom: "12px" }}
          >
            <table className="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th style={{ width: "90px" }}>Unit Price</th>
                  <th style={{ width: "110px" }}>Qty</th>
                  <th>Total</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-semibold">{item.product_name}</td>
                    <td>{item.barcode || "-"}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={{
                          width: "75px",
                          padding: "2px 4px",
                          height: "26px",
                          fontSize: "0.82rem",
                        }}
                        value={item.price}
                        onChange={(e) =>
                          handlePriceChange(idx, parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleQuantityChange(idx, item.quantity - 1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          style={{
                            width: "42px",
                            textAlign: "center",
                            padding: "2px 4px",
                            height: "26px",
                            fontSize: "0.82rem",
                          }}
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              idx,
                              parseInt(e.target.value, 10) || 1
                            )
                          }
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="price-tag">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td>
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Discount & Tax adjusters */}
          <div className="form-row" style={{ marginBottom: "12px" }}>
            <div className="form-group">
              <label>Additional Discount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label>GST / Tax Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxAmount}
                onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Summary Box */}
          <div
            style={{
              background: "#f4f8fc",
              border: "1px dashed #7092be",
              padding: "10px",
              borderRadius: "3px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.88rem",
            }}
          >
            <div>
              <span>Selling Subtotal: <strong>₹{subtotal.toFixed(2)}</strong></span>
              <span style={{ marginLeft: "14px" }}>
                GST (Inclusive): <strong>₹{(taxAmount > 0 ? taxAmount : calculatedGst).toFixed(2)}</strong>
              </span>
              <span style={{ marginLeft: "14px" }}>
                Extra Discount: <strong>₹{discount.toFixed(2)}</strong>
              </span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#055e37" }}>
              Grand Total: ₹{grandTotal.toFixed(2)}
            </div>
          </div>

          {/* Form Action Buttons */}
          <div
            className="form-actions"
            style={{ marginTop: "14px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary-btn"
              disabled={saving}
            >
              {saving ? "Saving Changes..." : "Update Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
