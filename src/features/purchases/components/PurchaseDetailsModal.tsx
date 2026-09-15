import React, { useEffect, useState } from "react";
import { Purchase, PurchaseItem } from "../types";
import { getPurchaseWithItems } from "../services/purchaseService";
import { Pagination } from "../../../components/common/Pagination";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface PurchaseDetailsModalProps {
  purchaseId: number | null;
  onClose: () => void;
}

export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
  purchaseId,
  onClose,
}) => {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    if (purchaseId) {
      setLoading(true);
      setCurrentPage(1);
      getPurchaseWithItems(purchaseId)
        .then(({ purchase, items }) => {
          setPurchase(purchase);
          setItems(items);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [purchaseId]);

  if (!purchaseId) return null;

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{ maxWidth: "800px", width: "94%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Purchase Details (Invoice #{purchase?.invoice_no || purchaseId})</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <div style={{ padding: "14px" }}>
          {loading ? (
            <div className="empty-state">Loading purchase details...</div>
          ) : !purchase ? (
            <div className="empty-state">Purchase record not found.</div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 16px",
                  padding: "10px 14px",
                  background: "#edf4fc",
                  border: "1px solid #7092be",
                  marginBottom: "14px",
                  fontSize: "0.88rem",
                }}
              >
                <div>
                  <strong>Supplier Name:</strong> {purchase.supplier_name}
                </div>
                <div>
                  <strong>Invoice No:</strong> {purchase.invoice_no}
                </div>
                <div>
                  <strong>Date:</strong> {formatTo12Hour(purchase.created_at || purchase.purchase_date)}
                </div>
                <div>
                  <strong>Contact No:</strong> {purchase.contact_no || "N/A"}
                </div>
                <div>
                  <strong>GST No:</strong> {purchase.gst_no || "N/A"}
                </div>
                <div>
                  <strong>Total Amount:</strong> ₹{purchase.total_amount.toFixed(2)}
                </div>
              </div>

              <h3
                style={{
                  fontSize: "0.95rem",
                  color: "#103c6b",
                  marginBottom: "8px",
                  fontWeight: 700,
                }}
              >
                Items in Purchase ({items.length})
              </h3>
              <div className="table-responsive" style={{ maxHeight: "280px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Barcode</th>
                      <th>Batch No</th>
                      <th>HSN</th>
                      <th>Category</th>
                      <th>Cost Price</th>
                      <th>MRP</th>
                      <th>Sell Price</th>
                      <th>GST %</th>
                      <th>Qty</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.product_name}</td>
                        <td>
                          <code className="barcode-tag">{item.barcode || "-"}</code>
                        </td>
                        <td>{item.batch_no || "-"}</td>
                        <td>{item.hsn_code || "-"}</td>
                        <td>{item.category}</td>
                        <td>₹{item.purchase_price.toFixed(2)}</td>
                        <td>₹{(item.mrp || 0).toFixed(2)}</td>
                        <td>₹{item.selling_price.toFixed(2)}</td>
                        <td>{item.gst_rate || 0}%</td>
                        <td>{item.quantity}</td>
                        <td className="price-tag">₹{item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20]}
              />
            </>
          )}

          <div
            className="form-actions"
            style={{ marginTop: "14px", justifyContent: "flex-end" }}
          >
            <button className="btn secondary-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
