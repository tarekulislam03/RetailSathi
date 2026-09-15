import React, { useState, useEffect } from "react";
import { Product } from "../types";
import { getBatchStatusMap } from "../utils/batchUtils";
import { Pagination } from "../../../components/common/Pagination";

interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  allProducts?: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
}

export const LowStockModal: React.FC<LowStockModalProps> = ({
  isOpen,
  onClose,
  products,
  allProducts,
  onEdit,
  onDelete,
}) => {
  const [filterType, setFilterType] = useState<"all" | "out" | "low">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter low stock products (stock <= reorder_threshold)
  const lowStockItems = products.filter((p) => p.stock <= p.reorder_threshold);

  const filteredItems = lowStockItems.filter((item) => {
    if (filterType === "out" && item.stock !== 0) return false;
    if (filterType === "low" && item.stock === 0) return false;

    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.barcode.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.batch_no.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchTerm, lowStockItems.length]);

  if (!isOpen) return null;

  const statusMap = getBatchStatusMap(
    allProducts && allProducts.length > 0 ? allProducts : products
  );

  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const outOfStockCount = lowStockItems.filter((p) => p.stock === 0).length;
  const lowStockOnlyCount = lowStockItems.filter((p) => p.stock > 0).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "920px", width: "95%", padding: 0 }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            background: "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)",
            borderBottom: "1px solid #ffe58f",
            padding: "12px 16px",
          }}
        >
          <div>
            <h2 style={{ color: "#873800", display: "flex", alignItems: "center", gap: "8px" }}>
              Manage Low Stock & Out of Stock Items
              <span
                style={{
                  background: "#b91c1c",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  fontWeight: 700,
                }}
              >
                {lowStockItems.length} {lowStockItems.length === 1 ? "Item" : "Items"} Total
              </span>
            </h2>
            <p className="hint-text" style={{ color: "#613400", margin: 0 }}>
              Review and restock inventory products that are at or below their reorder threshold limit.
            </p>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "16px" }}>
          {lowStockItems.length === 0 ? (
            <div
              style={{
                background: "linear-gradient(to bottom, #e6f4ea 0%, #c8e6c9 100%)",
                border: "1px solid #81c784",
                borderRadius: "3px",
                padding: "16px",
                textAlign: "center",
                color: "#1b5e20",
                fontSize: "0.92rem",
                fontWeight: 600,
              }}
            >
              ✅ All product stock levels are healthy! No items are currently below their reorder threshold.
            </div>
          ) : (
            <>
              {/* Controls Bar: Search & Quick Filters */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className={`btn ${filterType === "all" ? "primary-btn" : "secondary-btn"}`}
                    style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                    onClick={() => setFilterType("all")}
                  >
                    All Alerts ({lowStockItems.length})
                  </button>
                  {outOfStockCount > 0 && (
                    <button
                      type="button"
                      className={`btn ${filterType === "out" ? "primary-btn" : "secondary-btn"}`}
                      style={{
                        padding: "3px 10px",
                        fontSize: "0.78rem",
                        borderColor: "#b91c1c",
                        color: filterType === "out" ? "#ffffff" : "#b91c1c",
                      }}
                      onClick={() => setFilterType("out")}
                    >
                      Out of Stock ({outOfStockCount})
                    </button>
                  )}
                  {lowStockOnlyCount > 0 && (
                    <button
                      type="button"
                      className={`btn ${filterType === "low" ? "primary-btn" : "secondary-btn"}`}
                      style={{
                        padding: "3px 10px",
                        fontSize: "0.78rem",
                        borderColor: "#d97706",
                        color: filterType === "low" ? "#ffffff" : "#d97706",
                      }}
                      onClick={() => setFilterType("low")}
                    >
                      Low Stock ({lowStockOnlyCount})
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  className="search-input"
                  placeholder="Search name, barcode, batch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: "240px", height: "30px", fontSize: "0.82rem" }}
                />
              </div>

              {paginatedItems.length === 0 ? (
                <div className="empty-state" style={{ padding: "20px" }}>
                  No matching low stock items found for current filter.
                </div>
              ) : (
                <>
                  <div className="table-responsive" style={{ maxHeight: "360px", overflowY: "auto" }}>
                    <table className="product-table">
                      <thead>
                        <tr style={{ background: "#fffbe6" }}>
                          <th>Barcode</th>
                          <th>Product Name</th>
                          <th>Batch No</th>
                          <th>Batch Status</th>
                          <th>Current Stock</th>
                          <th>Reorder Threshold</th>
                          <th>Selling Rate</th>
                          <th>Category</th>
                          <th style={{ textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item) => {
                          const batchStatus = statusMap.get(item.id) || "New Stock";
                          const isZeroStock = item.stock === 0;

                          return (
                            <tr
                              key={item.id}
                              style={{
                                backgroundColor: isZeroStock ? "#fff5f5" : "#fffdf0",
                              }}
                            >
                              <td>
                                <code className="barcode-tag">{item.barcode || "-"}</code>
                              </td>
                              <td className="font-semibold" style={{ color: "#1e293b" }}>
                                {item.name}
                              </td>
                              <td>{item.batch_no || "-"}</td>
                              <td>
                                <span
                                  className={`stock-status-badge ${
                                    batchStatus === "New Stock" ? "new-stock" : "old-stock"
                                  }`}
                                >
                                  {batchStatus}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "3px",
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    color: isZeroStock ? "#991b1b" : "#854d0e",
                                    backgroundColor: isZeroStock ? "#fee2e2" : "#fef9c3",
                                    border: isZeroStock ? "1px solid #fca5a5" : "1px solid #fef08a",
                                  }}
                                >
                                  {isZeroStock ? "0 (Out of Stock)" : `${item.stock} units`}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, color: "#475569" }}>
                                {item.reorder_threshold} units
                              </td>
                              <td className="price-tag">₹ {item.price.toFixed(2)}</td>
                              <td>{item.category || "-"}</td>
                              <td style={{ textAlign: "center" }}>
                                <div className="action-buttons" style={{ justifyContent: "center" }}>
                                  <button
                                    className="btn-icon edit-btn"
                                    onClick={() => {
                                      onClose();
                                      onEdit(item);
                                    }}
                                    title="Edit product to update stock / threshold"
                                  >
                                    Restock / Edit
                                  </button>
                                  <button
                                    className="btn-icon delete-btn"
                                    onClick={() => onDelete(item.id)}
                                    title="Delete product"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalItems > 6 && (
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      totalItems={totalItems}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={setPageSize}
                      pageSizeOptions={[6, 12, 24]}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="form-actions" style={{ justifyContent: "flex-end", padding: "10px 16px" }}>
          <button type="button" className="btn secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
