import React, { useState, FormEvent, KeyboardEvent } from "react";
import { Product, ProductInput } from "../types";

interface ProductModalProps {
  editingProduct: Product | null;
  onSave: (payload: ProductInput) => Promise<void>;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  editingProduct,
  onSave,
  onClose,
}) => {
  const [barcode, setBarcode] = useState(editingProduct?.barcode || "");
  const [name, setName] = useState(editingProduct?.name || "");
  const [batchNo, setBatchNo] = useState(editingProduct?.batch_no || "");
  const [mrp, setMrp] = useState(editingProduct?.mrp ? editingProduct.mrp.toString() : "");
  const [price, setPrice] = useState(editingProduct?.price ? editingProduct.price.toString() : "");
  const [stock, setStock] = useState(editingProduct?.stock ? editingProduct.stock.toString() : "");
  const [hsnCode, setHsnCode] = useState(editingProduct?.hsn_code || "");
  const [reorderThreshold, setReorderThreshold] = useState(
    editingProduct ? editingProduct.reorder_threshold.toString() : "5"
  );
  const [gstRate, setGstRate] = useState(
    editingProduct ? editingProduct.gst_rate.toString() : "0"
  );
  const [category, setCategory] = useState(editingProduct?.category || "General");
  const [error, setError] = useState<string | null>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT") {
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input:not([disabled]), select:not([disabled]), button[type='submit']"
          )
        );
        const index = focusable.indexOf(target as any);
        if (index > -1 && index < focusable.length - 1) {
          e.preventDefault();
          focusable[index + 1].focus();
        }
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);
    const mrpNum = parseFloat(mrp) || 0;
    const reorderNum = parseInt(reorderThreshold, 10) || 0;
    const gstNum = parseFloat(gstRate) || 0;

    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid selling rate (Price).");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      setError("Please enter a valid stock count.");
      return;
    }

    try {
      await onSave({
        barcode: barcode.trim(),
        name: name.trim(),
        batch_no: batchNo.trim(),
        mrp: mrpNum,
        price: priceNum,
        stock: stockNum,
        hsn_code: hsnCode.trim(),
        reorder_threshold: reorderNum,
        gst_rate: gstNum,
        category: category.trim() || "General",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save product.");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{editingProduct ? "Edit Product" : "Add New Product"}</h2>
            <p className="hint-text">
              Press <strong>Enter</strong> to jump to next field
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: "12px 16px 0" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)}>X</button>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="barcode">Barcode</label>
              <input
                id="barcode"
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or enter barcode"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Product Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basmati Rice 5kg"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Groceries, Dairy"
              />
            </div>

            <div className="form-group">
              <label htmlFor="batchNo">Batch No.</label>
              <input
                id="batchNo"
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="e.g. B2026-09"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mrp">MRP (₹)</label>
              <input
                id="mrp"
                type="number"
                step="0.01"
                min="0"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Selling Rate (₹) *</label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="stock">Stock Qty *</label>
              <input
                id="stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="hsnCode">HSN Code</label>
              <input
                id="hsnCode"
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 1006.30"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reorderThreshold">Reorder Threshold</label>
              <input
                id="reorderThreshold"
                type="number"
                min="0"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                placeholder="5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gstRate">GST Rate (%)</label>
              <input
                id="gstRate"
                type="number"
                step="0.1"
                min="0"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary-btn">
              {editingProduct ? "Update Product" : "Save Product (Enter)"}
            </button>
            <button type="button" className="btn secondary-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
