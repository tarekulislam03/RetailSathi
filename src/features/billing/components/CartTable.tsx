import React, { useState, useEffect, useRef } from "react";
import { CartItem } from "../types";
import { Pagination } from "../../../components/common/Pagination";
import { focusProductSearch } from "./BarcodeSearch";

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (productId: number, newQty: number) => void;
  onUpdatePrice?: (productId: number, newPrice: number) => void;
  onUpdateMrp?: (productId: number, newMrp: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOpenAddProduct?: () => void;
  onOpenReturnModal?: () => void;
  onHoldBill?: () => void;
  onOpenHeldBills?: () => void;
  heldBillsCount?: number;
}

interface CartTableRowProps {
  item: CartItem;
  onUpdateQty: (productId: number, newQty: number) => void;
  onUpdatePrice?: (productId: number, newPrice: number) => void;
  onUpdateMrp?: (productId: number, newMrp: number) => void;
  onRemoveItem: (productId: number) => void;
  isLastItem?: boolean;
}

const CartTableRow: React.FC<CartTableRowProps> = ({
  item,
  onUpdateQty,
  onUpdatePrice,
  onUpdateMrp,
  onRemoveItem,
  isLastItem = false,
}) => {
  const mrpInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [mrpVal, setMrpVal] = useState<string>(() =>
    item.product.mrp != null ? String(item.product.mrp) : ""
  );
  const [priceVal, setPriceVal] = useState<string>(() =>
    item.product.price != null ? String(item.product.price) : ""
  );
  const [qtyVal, setQtyVal] = useState<string>(() => String(item.quantity));

  useEffect(() => {
    if (document.activeElement !== mrpInputRef.current) {
      setMrpVal(item.product.mrp != null ? String(item.product.mrp) : "");
    }
  }, [item.product.mrp]);

  useEffect(() => {
    if (document.activeElement !== priceInputRef.current) {
      setPriceVal(item.product.price != null ? String(item.product.price) : "");
    }
  }, [item.product.price]);

  useEffect(() => {
    if (document.activeElement !== qtyInputRef.current) {
      setQtyVal(String(item.quantity));
    }
  }, [item.quantity]);

  const handleMrpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMrpVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onUpdateMrp?.(item.product.id, num);
    }
  };

  const handleMrpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const num = parseFloat(mrpVal);
      if (!isNaN(num) && num >= 0) {
        onUpdateMrp?.(item.product.id, num);
      } else {
        setMrpVal(item.product.mrp != null ? String(item.product.mrp) : "");
      }
      mrpInputRef.current?.blur();
      focusProductSearch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMrpVal(item.product.mrp != null ? String(item.product.mrp) : "");
      mrpInputRef.current?.blur();
      focusProductSearch();
    }
  };

  const handleMrpBlur = () => {
    const num = parseFloat(mrpVal);
    if (isNaN(num) || num < 0) {
      setMrpVal(item.product.mrp != null ? String(item.product.mrp) : "");
    } else {
      onUpdateMrp?.(item.product.id, num);
    }
    setTimeout(() => {
      const active = document.activeElement;
      const isOtherInput =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");
      const isProtected =
        active &&
        (active.closest(".sidebar") ||
          active.closest(".modal-content") ||
          active.closest(".modal-backdrop") ||
          active.closest(".checkout-card") ||
          active.closest(".pos-right"));
      if (!isOtherInput || !isProtected) {
        focusProductSearch();
      }
    }, 20);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPriceVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onUpdatePrice?.(item.product.id, num);
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const num = parseFloat(priceVal);
      if (!isNaN(num) && num >= 0) {
        onUpdatePrice?.(item.product.id, num);
      } else {
        setPriceVal(item.product.price != null ? String(item.product.price) : "");
      }
      priceInputRef.current?.blur();
      focusProductSearch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPriceVal(item.product.price != null ? String(item.product.price) : "");
      priceInputRef.current?.blur();
      focusProductSearch();
    }
  };

  const handlePriceBlur = () => {
    const num = parseFloat(priceVal);
    if (isNaN(num) || num < 0) {
      setPriceVal(item.product.price != null ? String(item.product.price) : "");
    } else {
      onUpdatePrice?.(item.product.id, num);
    }
    setTimeout(() => {
      const active = document.activeElement;
      const isOtherInput =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");
      const isProtected =
        active &&
        (active.closest(".sidebar") ||
          active.closest(".modal-content") ||
          active.closest(".modal-backdrop") ||
          active.closest(".checkout-card") ||
          active.closest(".pos-right"));
      if (!isOtherInput || !isProtected) {
        focusProductSearch();
      }
    }, 20);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQtyVal(val);
    const num = parseInt(val, 10);
    // While typing, only update parent if it is a valid positive integer.
    // Do NOT call onUpdateQty(id, 0) on empty string or 0 to prevent accidentally deleting product while typing.
    if (!isNaN(num) && num > 0) {
      onUpdateQty(item.product.id, num);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const num = parseInt(qtyVal, 10);
      if (!isNaN(num) && num > 0) {
        onUpdateQty(item.product.id, num);
      } else {
        setQtyVal(String(item.quantity));
      }
      qtyInputRef.current?.blur();
      focusProductSearch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQtyVal(String(item.quantity));
      qtyInputRef.current?.blur();
      focusProductSearch();
    }
  };

  const handleQtyBlur = () => {
    const num = parseInt(qtyVal, 10);
    if (isNaN(num) || num <= 0) {
      setQtyVal(String(item.quantity));
    } else {
      onUpdateQty(item.product.id, num);
    }
    setTimeout(() => {
      const active = document.activeElement;
      const isOtherInput =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");
      const isProtected =
        active &&
        (active.closest(".sidebar") ||
          active.closest(".modal-content") ||
          active.closest(".modal-backdrop") ||
          active.closest(".checkout-card") ||
          active.closest(".pos-right"));
      if (!isOtherInput || !isProtected) {
        focusProductSearch();
      }
    }, 20);
  };

  return (
    <tr className={isLastItem ? "last-cart-item" : ""}>
      <td className="font-semibold">
        {item.product.name}
        {item.product.batch_no ? (
          <span
            style={{
              display: "block",
              fontSize: "0.72rem",
              color: "#475569",
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "1px 5px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "3px",
              }}
            >
              Batch: {item.product.batch_no}
            </span>
          </span>
        ) : null}
      </td>
      <td>
        <code className="barcode-tag">{item.product.barcode || "-"}</code>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>₹</span>
          <input
            ref={mrpInputRef}
            type="number"
            step="any"
            min="0"
            value={mrpVal}
            onChange={handleMrpChange}
            onKeyDown={handleMrpKeyDown}
            onBlur={handleMrpBlur}
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
            ref={priceInputRef}
            type="number"
            step="any"
            min="0"
            value={priceVal}
            onChange={handlePriceChange}
            onKeyDown={handlePriceKeyDown}
            onBlur={handlePriceBlur}
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
            type="button"
            className="qty-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onUpdateQty(item.product.id, item.quantity - 1);
              focusProductSearch();
            }}
            title="Decrease quantity"
          >
            -
          </button>
          <input
            ref={qtyInputRef}
            type="number"
            className="qty-input"
            value={qtyVal}
            onChange={handleQtyChange}
            onKeyDown={handleQtyKeyDown}
            onBlur={handleQtyBlur}
            min="1"
            max={item.product.stock}
            title="Adjust quantity"
          />
          <button
            type="button"
            className="qty-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onUpdateQty(item.product.id, item.quantity + 1);
              focusProductSearch();
            }}
            title="Increase quantity"
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
          type="button"
          className="btn-icon delete-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onRemoveItem(item.product.id);
            focusProductSearch();
          }}
          title="Remove item"
        >
          Remove
        </button>
      </td>
    </tr>
  );
};

export const CartTable: React.FC<CartTableProps> = ({
  cart,
  onUpdateQty,
  onUpdatePrice,
  onUpdateMrp,
  onRemoveItem,
  onClearCart,
  onOpenAddProduct,
  onOpenReturnModal,
  onHoldBill,
  onOpenHeldBills,
  heldBillsCount = 0,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const prevCartLengthRef = useRef(cart.length);

  const totalItems = cart.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  // Auto-scroll cart item list when items grow beyond the visible window
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      const newTotalPages = Math.ceil(cart.length / pageSize) || 1;
      if (currentPage !== newTotalPages) {
        setCurrentPage(newTotalPages);
      }

      const scrollToBottom = () => {
        const el = tableContainerRef.current;
        if (el) {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: "smooth",
          });
        }
      };

      requestAnimationFrame(scrollToBottom);
      const timer = setTimeout(() => {
        const el = tableContainerRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }, 60);

      prevCartLengthRef.current = cart.length;
      return () => clearTimeout(timer);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart.length, currentPage, pageSize]);

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCart = cart.slice(startIndex, startIndex + pageSize);
  const lastCartItemId = cart.length > 0 ? cart[cart.length - 1].product.id : null;

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="card list-card pos-cart-card">
      <div className="list-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Current Order Items ({cart.length})</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onOpenReturnModal && (
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onOpenReturnModal}
              style={{
                padding: "5px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "#f1f5f9",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
              }}
              title="Open Sales Return & Exchange (F4)"
            >
              🔄 Return (F4)
            </button>
          )}
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
          {onHoldBill && (
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onHoldBill}
              disabled={cart.length === 0}
              style={{
                padding: "5px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: cart.length > 0 ? "linear-gradient(to bottom, #fff7ed 0%, #ffedd5 100%)" : "#f1f5f9",
                color: cart.length > 0 ? "#c2410c" : "#94a3b8",
                border: cart.length > 0 ? "1px solid #fdba74" : "1px solid #cbd5e1",
                cursor: cart.length > 0 ? "pointer" : "not-allowed",
              }}
              title="Park / Hold current cart to bill another customer (F6)"
            >
              ⏸️ Hold Bill (F6)
            </button>
          )}

          {onOpenHeldBills && (
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onOpenHeldBills}
              style={{
                padding: "5px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: heldBillsCount > 0 ? "linear-gradient(to bottom, #eff6ff 0%, #dbeafe 100%)" : "#f1f5f9",
                color: heldBillsCount > 0 ? "#1d4ed8" : "#475569",
                border: heldBillsCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
              }}
              title="View and resume parked bills (F7)"
            >
              📋 Held Bills
              {heldBillsCount > 0 && (
                <span
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "10px",
                    padding: "0 6px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    lineHeight: "18px",
                  }}
                >
                  {heldBillsCount}
                </span>
              )}
            </button>
          )}

          {cart.length > 0 && (
            <button
              type="button"
              className="btn secondary-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onClearCart();
                focusProductSearch();
              }}
            >
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
          <div ref={tableContainerRef} className="table-responsive">
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
                  <CartTableRow
                    key={item.product.id}
                    item={item}
                    onUpdateQty={onUpdateQty}
                    onUpdatePrice={onUpdatePrice}
                    onUpdateMrp={onUpdateMrp}
                    onRemoveItem={onRemoveItem}
                    isLastItem={item.product.id === lastCartItemId}
                  />
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
