import React, { useState, useEffect } from "react";
import { CartItem } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (productId: number, newQty: number) => void;
  onUpdatePrice?: (productId: number, newPrice: number) => void;
  onUpdateMrp?: (productId: number, newMrp: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOpenAddProduct?: () => void;
}

export const CartTable: React.FC<CartTableProps> = ({
  cart,
  onUpdateQty,
  onUpdatePrice,
  onUpdateMrp,
  onRemoveItem,
  onClearCart,
  onOpenAddProduct,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const totalItems = cart.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCart = cart.slice(startIndex, startIndex + pageSize);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="card list-card pos-cart-card">
      <div className="list-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Current Order Items ({cart.length})</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onOpenAddProduct && (
            <button
              type="button"
              className="btn primary-btn"
              onClick={onOpenAddProduct}
              style={{
                padding: "5px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "linear-gradient(to bottom, #2563eb 0%, #1d4ed8 100%)",
                borderColor: "#1e40af",
              }}
              title="Add a product not found in inventory and add it directly to cart"
            >
              + New Product
            </button>
          )}
          {cart.length > 0 && (
            <button className="btn secondary-btn" onClick={onClearCart}>
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="empty-state">
          <p style={{ margin: 0 }}>Cart is empty. Scan barcode or select a product above to start billing!</p>
          {onOpenAddProduct && (
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onOpenAddProduct}
              style={{
                marginTop: "10px",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#1d4ed8",
                borderColor: "#93c5fd",
                background: "#eff6ff",
              }}
            >
              + Add Unregistered Product to Cart
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Barcode</th>
                  <th style={{ width: "95px" }}>MRP</th>
                  <th style={{ width: "95px" }}>Selling Price</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCart.map((item) => (
                  <tr key={item.product.id}>
                    <td className="font-semibold">{item.product.name}</td>
                    <td>
                      <code className="barcode-tag">
                        {item.product.barcode || "-"}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>₹</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.product.mrp ?? ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdateMrp?.(item.product.id, isNaN(val) ? 0 : val);
                          }}
                          className="cart-price-input"
                          style={{
                            width: "72px",
                            padding: "2px 4px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            textAlign: "right",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            background: "#ffffff",
                          }}
                          title="Edit MRP (affects database upon sale)"
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>₹</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.product.price ?? ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdatePrice?.(item.product.id, isNaN(val) ? 0 : val);
                          }}
                          className="cart-price-input"
                          style={{
                            width: "72px",
                            padding: "2px 4px",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "#166534",
                            textAlign: "right",
                            border: "1px solid #86efac",
                            borderRadius: "4px",
                            background: "#f0fdf4",
                          }}
                          title="Edit Selling Price (affects database upon sale)"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="qty-controls">
                        <button
                          className="qty-btn"
                          onClick={() =>
                            onUpdateQty(item.product.id, item.quantity - 1)
                          }
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="qty-input"
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateQty(
                              item.product.id,
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          min="1"
                          max={item.product.stock}
                        />
                        <button
                          className="qty-btn"
                          onClick={() =>
                            onUpdateQty(item.product.id, item.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="price-tag">
                      ₹{(item.product.price * item.quantity).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className="btn-icon delete-btn"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        Remove
                      </button>
                    </td>
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
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[50, 100, 200, 500]}
          />
        </>
      )}
    </div>
  );
};
