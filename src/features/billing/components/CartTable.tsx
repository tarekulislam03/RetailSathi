import React, { useState, useEffect } from "react";
import { CartItem } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (productId: number, newQty: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
}

export const CartTable: React.FC<CartTableProps> = ({
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [cart.length]);

  const totalItems = cart.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCart = cart.slice(startIndex, startIndex + pageSize);

  return (
    <div className="card list-card pos-cart-card">
      <div className="list-header">
        <h2>Current Order Items ({cart.length})</h2>
        {cart.length > 0 && (
          <button className="btn secondary-btn" onClick={onClearCart}>
            Clear Cart
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="empty-state">
          Cart is empty. Scan barcode or select a product above to start billing!
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Barcode</th>
                  <th>Price</th>
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
                    <td>₹{item.product.price.toFixed(2)}</td>
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
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
          />
        </>
      )}
    </div>
  );
};
