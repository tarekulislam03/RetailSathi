import React, { useState, useEffect } from "react";
import { Sale } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const items = sale.items || [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card receipt-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Retail Sathi - Tax Invoice</h2>
            <p className="hint-text">Invoice #{sale.invoice_no}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <div className="receipt-body">
          <div className="receipt-info-grid">
            <div>
              <p>
                <strong>Customer:</strong> {sale.customer_name}
              </p>
              <p>
                <strong>Phone:</strong> {sale.customer_phone || "N/A"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p>
                <strong>Date:</strong> {sale.created_at}
              </p>
              <p>
                <strong>Payment Mode:</strong> {sale.payment_mode}
              </p>
            </div>
          </div>

          <table className="product-table receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.product_name}</td>
                  <td>₹{item.price.toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>₹{item.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalItems > 5 && (
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          )}

          {(() => {
            const totalMrp = sale.total_amount || (sale.grand_total + sale.discount);
            const taxableAmount = Math.max(0, sale.grand_total - sale.tax_amount);

            return (
              <div className="receipt-totals">
                <div className="summary-row">
                  <span>Subtotal (Total MRP):</span>
                  <span>₹{totalMrp.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Discount (MRP - Selling Price):</span>
                  <span>- ₹{sale.discount.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Taxable Amount:</span>
                  <span>₹{taxableAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>GST Amount (Inclusive):</span>
                  <span>₹{sale.tax_amount.toFixed(2)}</span>
                </div>
                <div className="summary-row grand-total-line">
                  <span>Grand Total:</span>
                  <span>₹{sale.grand_total.toFixed(2)}</span>
                </div>

                {sale.paid_amount !== undefined && (
                  <div className="summary-row" style={{ fontWeight: 600, color: "#103c6b", marginTop: "4px" }}>
                    <span>Total Paid Amount:</span>
                    <span>₹{sale.paid_amount.toFixed(2)}</span>
                  </div>
                )}
                {sale.cash_paid !== undefined && sale.cash_paid > 0 && (
                  <div className="summary-row" style={{ fontSize: "0.82rem", color: "#475569" }}>
                    <span>- Cash Paid:</span>
                    <span>₹{sale.cash_paid.toFixed(2)}</span>
                  </div>
                )}
                {sale.upi_paid !== undefined && sale.upi_paid > 0 && (
                  <div className="summary-row" style={{ fontSize: "0.82rem", color: "#475569" }}>
                    <span>- UPI Paid:</span>
                    <span>₹{sale.upi_paid.toFixed(2)}</span>
                  </div>
                )}
                {sale.due_amount !== undefined && sale.due_amount > 0 && (
                  <div className="summary-row" style={{ color: "#b91c1c", fontWeight: 700 }}>
                    <span>Remaining Balance (Due):</span>
                    <span>₹{sale.due_amount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="form-actions" style={{ padding: "12px 16px" }}>
          <button className="btn primary-btn" onClick={() => window.print()}>
            PRINT RECEIPT
          </button>
          <button className="btn secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
