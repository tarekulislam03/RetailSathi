import React, { useState, useEffect } from "react";
import { Customer } from "../types";
import { Sale, SaleItem } from "../../billing/types";
import {
  fetchCustomerSales,
  fetchSaleItems,
} from "../services/customerService";
import { Pagination } from "../../../components/common/Pagination";
import { EditSaleModal } from "../../sales/components/EditSaleModal";
import { DeleteSaleModal } from "../../sales/components/DeleteSaleModal";

interface CustomerPurchasesModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerPurchasesModal: React.FC<CustomerPurchasesModalProps> = ({
  customer,
  isOpen,
  onClose,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit & Delete modal states
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);

  // Date Filter State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sub-modal / Selected Sale Items State
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [activeItems, setActiveItems] = useState<SaleItem[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // Pagination states
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(5);

  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(5);

  async function loadPurchases() {
    if (!customer) return;
    try {
      setLoading(true);
      setError(null);
      setActiveSale(null);
      setActiveItems([]);
      const list = await fetchCustomerSales(customer.phone, customer.name);
      setSales(list);
    } catch (err: any) {
      console.error("Failed to load customer purchases:", err);
      setError(err?.message || "Failed to load purchases from database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen && customer) {
      loadPurchases();
    }
  }, [isOpen, customer]);

  useEffect(() => {
    setSalesPage(1);
  }, [sales, startDate, endDate]);

  useEffect(() => {
    setItemsPage(1);
  }, [activeItems]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activeSale) {
          setActiveSale(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, activeSale]);

  if (!isOpen || !customer) return null;

  async function handleViewItems(sale: Sale) {
    try {
      setActiveSale(sale);
      setLoadingItems(true);
      const items = await fetchSaleItems(sale.id);
      setActiveItems(items);
    } catch (err: any) {
      console.error("Failed to fetch sale items:", err);
    } finally {
      setLoadingItems(false);
    }
  }

  // Filter sales by date range selector
  const filteredSales = sales.filter((s) => {
    if (!startDate && !endDate) return true;
    const saleDateStr = s.created_at || "";

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      const saleMs = new Date(saleDateStr).getTime() || Date.parse(saleDateStr);
      if (saleMs && saleMs < startMs) return false;
    }

    if (endDate) {
      const endMs = new Date(endDate + "T23:59:59").getTime();
      const saleMs = new Date(saleDateStr).getTime() || Date.parse(saleDateStr);
      if (saleMs && saleMs > endMs) return false;
    }

    return true;
  });

  // Calculate paginated sales
  const salesTotalItems = filteredSales.length;
  const salesTotalPages = Math.ceil(salesTotalItems / salesPageSize) || 1;
  const safeSalesPage = Math.min(salesPage, salesTotalPages);
  const salesStartIndex = (safeSalesPage - 1) * salesPageSize;
  const paginatedSales = filteredSales.slice(salesStartIndex, salesStartIndex + salesPageSize);

  // Calculate paginated active items
  const itemsTotalItems = activeItems.length;
  const itemsTotalPages = Math.ceil(itemsTotalItems / itemsPageSize) || 1;
  const safeItemsPage = Math.min(itemsPage, itemsTotalPages);
  const itemsStartIndex = (safeItemsPage - 1) * itemsPageSize;
  const paginatedItems = activeItems.slice(itemsStartIndex, itemsStartIndex + itemsPageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%" }}
      >
        {/* Title Header */}
        <div className="modal-header">
          <div>
            <h2>
              Purchase History: {customer.name}{" "}
              {customer.phone ? `(${customer.phone})` : ""}
            </h2>
            <div className="hint-text">
              View all sales transactions, total spent, and line items for this customer.
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div style={{ padding: "14px" }}>
          {error && (
            <div className="error-banner" style={{ marginBottom: "12px" }}>
              <span>{error}</span>
              <button onClick={() => setError(null)}>X</button>
            </div>
          )}

          {/* Date Selector Filter Bar */}
          <div
            style={{
              background: "#f0f4f9",
              border: "1px solid #7092be",
              padding: "10px 14px",
              borderRadius: "3px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#103c6b" }}>
              Filter by Date Range:
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="fromDate" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                From:
              </label>
              <input
                id="fromDate"
                type="date"
                className="search-input"
                style={{ width: "140px", height: "30px", padding: "2px 6px" }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="toDate" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                To:
              </label>
              <input
                id="toDate"
                type="date"
                className="search-input"
                style={{ width: "140px", height: "30px", padding: "2px 6px" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                className="btn secondary-btn"
                style={{ height: "30px", padding: "0 10px", fontSize: "0.8rem" }}
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Active Items Sub-Panel / Detail View */}
          {activeSale && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #1a5695",
                borderRadius: "3px",
                marginBottom: "14px",
                padding: "12px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #b8cde4",
                  paddingBottom: "6px",
                  marginBottom: "10px",
                }}
              >
                <div style={{ fontWeight: 700, color: "#103c6b", fontSize: "0.92rem" }}>
                  Invoice #{activeSale.invoice_no} Line Items ({activeSale.created_at})
                </div>
                <button
                  type="button"
                  className="btn secondary-btn"
                  style={{ padding: "2px 8px", fontSize: "0.78rem" }}
                  onClick={() => setActiveSale(null)}
                >
                  Close Items View
                </button>
              </div>

              {loadingItems ? (
                <div className="loading" style={{ padding: "16px" }}>
                  Loading purchase line items...
                </div>
              ) : activeItems.length === 0 ? (
                <div className="empty-state" style={{ padding: "16px" }}>
                  No item details found for this invoice.
                </div>
              ) : (
                <>
                  <div className="table-responsive" style={{ maxHeight: "180px" }}>
                    <table className="product-table">
                      <thead>
                        <tr>
                          <th>PRODUCT NAME</th>
                          <th>BARCODE</th>
                          <th>UNIT PRICE (₹)</th>
                          <th>QUANTITY</th>
                          <th>SUBTOTAL (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{item.product_name}</td>
                            <td>
                              {item.barcode ? (
                                <span className="barcode-tag">{item.barcode}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>₹{item.price.toFixed(2)}</td>
                            <td>{item.quantity}</td>
                            <td className="price-tag">₹{item.total_price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={safeItemsPage}
                    totalPages={itemsTotalPages}
                    pageSize={itemsPageSize}
                    totalItems={itemsTotalItems}
                    onPageChange={setItemsPage}
                    onPageSizeChange={setItemsPageSize}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </>
              )}
            </div>
          )}

          {/* Master Purchases List Table */}
          {loading ? (
            <div className="loading">Loading customer purchases...</div>
          ) : filteredSales.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              {startDate || endDate
                ? "No purchases found within selected date range."
                : "No purchase transactions recorded for this customer yet."}
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: "320px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>INVOICE NO</th>
                      <th>DATE & TIME</th>
                      <th>AMOUNT (₹)</th>
                      <th>PAYMENT MODE</th>
                      <th style={{ textAlign: "center", width: "130px" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSales.map((s) => (
                      <tr
                        key={s.id}
                        style={
                          activeSale?.id === s.id
                            ? { backgroundColor: "#e3f2fd" }
                            : undefined
                        }
                      >
                        <td className="font-semibold">{s.invoice_no}</td>
                        <td style={{ fontSize: "0.82rem", color: "#3b5370" }}>
                          {s.created_at}
                        </td>
                        <td className="price-tag">₹{s.grand_total.toFixed(2)}</td>
                        <td>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "2px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              background:
                                s.payment_mode === "Due" ? "#fef2f2" : "#f0f4f9",
                              color:
                                s.payment_mode === "Due" ? "#b91c1c" : "#1a5695",
                              border:
                                s.payment_mode === "Due"
                                  ? "1px solid #fca5a5"
                                  : "1px solid #b3d1ff",
                            }}
                          >
                            {s.payment_mode === "Due"
                              ? "Due / Credit"
                              : s.payment_mode}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="action-buttons" style={{ justifyContent: "center" }}>
                            <button
                              type="button"
                              className="btn-icon edit-btn"
                              onClick={() => handleViewItems(s)}
                              title="View Line Items"
                            >
                              View Items
                            </button>
                            <button
                              type="button"
                              className="btn-icon edit-btn"
                              onClick={() => setEditingSale(s)}
                              title="Edit Sale Record"
                              style={{
                                background: "linear-gradient(to bottom, #ffffff 0%, #dbeafd 100%)",
                                borderColor: "#3b82f6",
                                color: "#1d4ed8",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-icon delete-btn"
                              onClick={() => setDeletingSale(s)}
                              title="Delete Sale Record"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={safeSalesPage}
                totalPages={salesTotalPages}
                pageSize={salesPageSize}
                totalItems={salesTotalItems}
                onPageChange={setSalesPage}
                onPageSizeChange={setSalesPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </>
          )}

          {/* Footer Bar */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "10px",
              borderTop: "1px solid #7092be",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#103c6b" }}>
              Total Filtered Purchases: {filteredSales.length} invoice(s) | Total
              Amount: ₹
              {filteredSales
                .reduce((acc, s) => acc + s.grand_total, 0)
                .toFixed(2)}
            </div>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
            >
              Close Window
            </button>
          </div>
        </div>

        {editingSale && (
          <EditSaleModal
            isOpen={Boolean(editingSale)}
            sale={editingSale}
            onClose={() => setEditingSale(null)}
            onSaleUpdated={loadPurchases}
          />
        )}

        {deletingSale && (
          <DeleteSaleModal
            isOpen={Boolean(deletingSale)}
            sale={deletingSale}
            onClose={() => setDeletingSale(null)}
            onSaleDeleted={loadPurchases}
          />
        )}
      </div>
    </div>
  );
};
