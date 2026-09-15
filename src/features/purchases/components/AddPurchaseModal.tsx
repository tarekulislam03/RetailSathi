import React, { useState, useEffect } from "react";
import { Product } from "../../inventory/types";
import { fetchProducts } from "../../inventory/services/inventoryService";
import { Supplier } from "../types/supplier";
import { fetchSuppliers } from "../services/supplierService";
import { PurchaseItemDraft, CreatePurchaseInput } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  onSavePurchase: (input: CreatePurchaseInput) => Promise<number>;
}

export const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
  onSavePurchase,
}) => {
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [savedSuppliers, setSavedSuppliers] = useState<Supplier[]>([]);

  // Header form fields
  const [supplierName, setSupplierName] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [gstNo, setGstNo] = useState("");
  const [contactNo, setContactNo] = useState("");

  // Search existing product state
  const [searchProdTerm, setSearchProdTerm] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Product detail input fields
  const [selectedProdId, setSelectedProdId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [category, setCategory] = useState("General");
  const [gstRate, setGstRate] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Items draft array
  const [draftItems, setDraftItems] = useState<PurchaseItemDraft[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft items pagination state
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(5);

  useEffect(() => {
    setItemsPage(1);
  }, [draftItems.length]);


  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchProducts(), fetchSuppliers()])
        .then(([prods, suppliers]) => {
          setExistingProducts(prods);
          setSavedSuppliers(suppliers);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const matchedSuppliers = supplierName.trim()
    ? savedSuppliers
        .filter(
          (s) =>
            s.name.toLowerCase().includes(supplierName.toLowerCase()) ||
            (s.company_name && s.company_name.toLowerCase().includes(supplierName.toLowerCase())) ||
            (s.gst_no && s.gst_no.toLowerCase().includes(supplierName.toLowerCase()))
        )
        .slice(0, 6)
    : [];

  function handleSelectSavedSupplier(s: Supplier) {
    setSupplierName(s.name);
    if (s.gst_no) setGstNo(s.gst_no);
    if (s.contact_no) setContactNo(s.contact_no);
    setShowSupplierDropdown(false);
  }

  const matchedExistingProducts = searchProdTerm.trim()
    ? existingProducts
        .filter(
          (p) =>
            p.name.toLowerCase().includes(searchProdTerm.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchProdTerm.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(searchProdTerm.toLowerCase())) ||
            (p.batch_no && p.batch_no.toLowerCase().includes(searchProdTerm.toLowerCase())) ||
            (p.hsn_code && p.hsn_code.toLowerCase().includes(searchProdTerm.toLowerCase()))
        )
        .slice(0, 8)
    : [];

  function handleSelectProductFromSearch(prod: Product) {
    setSelectedProdId(prod.id);
    setProductName(prod.name);
    setBarcode(prod.barcode || "");
    setBatchNo(prod.batch_no || "");
    setHsnCode(prod.hsn_code || "");
    setCategory(prod.category || "General");
    setGstRate(prod.gst_rate ? prod.gst_rate.toString() : "0");
    setMrp(prod.mrp ? prod.mrp.toString() : "");
    setSellingPrice(prod.price ? prod.price.toString() : "0");
    const cost = (prod as any).cost_price ?? (prod.price ? prod.price * 0.8 : 0);
    setPurchasePrice(cost ? Number(cost).toFixed(2) : "");
    setSearchProdTerm(prod.name);
    setShowSearchDropdown(false);
  }

  function handleAddItem() {
    setErrorMsg("");
    if (!productName.trim()) {
      setErrorMsg("Please enter or select a product name.");
      return;
    }

    const pPrice = parseFloat(purchasePrice);
    const sPrice = parseFloat(sellingPrice);
    const mrpVal = parseFloat(mrp) || 0;
    const gstVal = parseFloat(gstRate) || 0;
    const qty = parseInt(quantity, 10);

    if (isNaN(pPrice) || pPrice < 0) {
      setErrorMsg("Please enter a valid Purchase Price (Cost).");
      return;
    }

    if (isNaN(sPrice) || sPrice < 0) {
      setErrorMsg("Please enter a valid Selling Price.");
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Please enter a valid Quantity greater than 0.");
      return;
    }

    const newItem: PurchaseItemDraft = {
      product_id: selectedProdId,
      product_name: productName.trim(),
      barcode: barcode.trim(),
      batch_no: batchNo.trim(),
      hsn_code: hsnCode.trim(),
      category: category.trim() || "General",
      purchase_price: pPrice,
      mrp: mrpVal,
      selling_price: sPrice,
      gst_rate: gstVal,
      quantity: qty,
      subtotal: pPrice * qty,
    };

    setDraftItems([...draftItems, newItem]);

    // Reset item entry form
    setSelectedProdId(null);
    setSearchProdTerm("");
    setProductName("");
    setBarcode("");
    setBatchNo("");
    setHsnCode("");
    setCategory("General");
    setGstRate("0");
    setPurchasePrice("");
    setMrp("");
    setSellingPrice("");
    setQuantity("1");
    setShowSearchDropdown(false);
  }

  function handleRemoveItem(index: number) {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  }

  const grandTotal = draftItems.reduce((acc, item) => acc + item.subtotal, 0);

  async function handleSavePurchase() {
    setErrorMsg("");
    if (!supplierName.trim()) {
      setErrorMsg("Please enter Supplier Name.");
      return;
    }
    if (!invoiceNo.trim()) {
      setErrorMsg("Please enter Invoice No.");
      return;
    }
    if (!purchaseDate.trim()) {
      setErrorMsg("Please enter Purchase Date.");
      return;
    }
    if (draftItems.length === 0) {
      setErrorMsg("Please add at least one product item to the purchase list.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSavePurchase({
        supplier_name: supplierName,
        invoice_no: invoiceNo,
        purchase_date: purchaseDate,
        gst_no: gstNo,
        contact_no: contactNo,
        items: draftItems,
      });

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save purchase entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{
          maxWidth: "960px",
          width: "96%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Record New Stock Purchase</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <div
          style={{
            padding: "14px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {errorMsg && (
            <div className="error-banner">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")}>X</button>
            </div>
          )}

          {/* 1. Supplier Header */}
          <div
            style={{
              background: "#edf4fc",
              border: "1px solid #7092be",
              padding: "10px 12px",
            }}
          >
            <h3
              style={{
                fontSize: "0.92rem",
                color: "#103c6b",
                marginBottom: "8px",
                fontWeight: 700,
              }}
            >
              1. Supplier & Invoice Information
            </h3>
            <div className="form-row">
              <div className="form-group" style={{ position: "relative" }}>
                <label>Supplier Name * (Type to search saved suppliers)</label>
                <div className="search-dropdown-wrapper">
                  <input
                    type="text"
                    placeholder="Search or enter supplier name..."
                    value={supplierName}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                    autoFocus
                  />

                  {showSupplierDropdown && matchedSuppliers.length > 0 && (
                    <div className="search-dropdown" style={{ zIndex: 1150, maxHeight: "200px" }}>
                      {matchedSuppliers.map((s) => (
                        <div
                          key={s.id}
                          className="dropdown-item"
                          onMouseDown={() => handleSelectSavedSupplier(s)}
                        >
                          <div className="item-info">
                            <span className="dropdown-title">{s.name}</span>
                            <span className="dropdown-sub">
                              {s.company_name ? `Firm: ${s.company_name} | ` : ""}GST: {s.gst_no || "N/A"}
                            </span>
                          </div>
                          <div className="item-meta">
                            <span className="dropdown-sub">{s.contact_no || ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Invoice No *</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-001"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: "6px" }}>
              <div className="form-group">
                <label>Purchase Date *</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>GST No</label>
                <input
                  type="text"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  value={gstNo}
                  onChange={(e) => setGstNo(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Contact No</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. Product Add Section */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #7092be",
              padding: "10px 12px",
            }}
          >
            <h3
              style={{
                fontSize: "0.92rem",
                color: "#103c6b",
                marginBottom: "8px",
                fontWeight: 700,
              }}
            >
              2. Add Product Items to Purchase List
            </h3>

            {/* Live Search Bar for Existing Inventory Products */}
            <div className="form-group" style={{ marginBottom: "10px", position: "relative" }}>
              <label htmlFor="inventorySearchInput">
                Search Product from Existing Inventory (or enter new details below)
              </label>
              <div className="search-dropdown-wrapper">
                <input
                  id="inventorySearchInput"
                  type="text"
                  className="search-input"
                  placeholder="Type product name, barcode, batch no, HSN or category to search..."
                  value={searchProdTerm}
                  onChange={(e) => {
                    setSearchProdTerm(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  style={{ width: "100%", height: "34px", fontSize: "0.92rem" }}
                />

                {showSearchDropdown && matchedExistingProducts.length > 0 && (
                  <div className="search-dropdown" style={{ zIndex: 1100, maxHeight: "220px" }}>
                    {matchedExistingProducts.map((p) => (
                      <div
                        key={p.id}
                        className="dropdown-item"
                        onMouseDown={() => handleSelectProductFromSearch(p)}
                      >
                        <div className="item-info">
                          <span className="dropdown-title">{p.name}</span>
                          <span className="dropdown-sub">
                            Barcode: {p.barcode || "N/A"} | Batch: {p.batch_no || "N/A"} | HSN: {p.hsn_code || "N/A"}
                          </span>
                        </div>
                        <div className="item-meta">
                          <span className="dropdown-price">₹{p.price.toFixed(2)}</span>
                          <span className="dropdown-stock">Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Barcode</label>
                <input
                  type="text"
                  placeholder="Scan or type barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Batch No.</label>
                <input
                  type="text"
                  placeholder="e.g. B2026-09"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>HSN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 1006.30"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="General"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>

            <div
              className="form-row"
              style={{ marginTop: "6px", alignItems: "flex-end" }}
            >
              <div className="form-group">
                <label>GST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Purchase Price (Cost ₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cost per unit"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>MRP (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="MRP"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Selling Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Selling MRP"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <button
                  className="btn primary-btn"
                  type="button"
                  onClick={handleAddItem}
                  style={{ width: "100%", height: "32px" }}
                >
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          {/* 3. Items Table Draft */}
          <div
            style={{
              border: "1px solid #7092be",
              background: "#fafbfc",
              padding: "8px 10px",
            }}
          >
            <h3
              style={{
                fontSize: "0.92rem",
                color: "#103c6b",
                marginBottom: "6px",
                fontWeight: 700,
              }}
            >
              3. Added Items List ({draftItems.length})
            </h3>

            {draftItems.length === 0 ? (
              <div className="empty-state" style={{ padding: "12px" }}>
                No items added yet. Search or enter product details above and click "+ Add Item".
              </div>
            ) : (
              (() => {
                const totalItems = draftItems.length;
                const totalPages = Math.ceil(totalItems / itemsPageSize) || 1;
                const safePage = Math.min(itemsPage, totalPages);
                const startIndex = (safePage - 1) * itemsPageSize;
                const paginatedDraftItems = draftItems.slice(startIndex, startIndex + itemsPageSize);

                return (
                  <>
                    <div className="table-responsive" style={{ maxHeight: "180px" }}>
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
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDraftItems.map((item, idx) => {
                            const actualIndex = startIndex + idx;
                            return (
                              <tr key={actualIndex}>
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
                                <td>
                                  <button
                                    className="btn-icon delete-btn"
                                    type="button"
                                    onClick={() => handleRemoveItem(actualIndex)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      pageSize={itemsPageSize}
                      totalItems={totalItems}
                      onPageChange={setItemsPage}
                      onPageSizeChange={setItemsPageSize}
                      pageSizeOptions={[5, 10, 20]}
                    />
                  </>
                );
              })()
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "8px",
                paddingTop: "6px",
                borderTop: "1px solid #7092be",
                fontWeight: "bold",
                fontSize: "0.95rem",
              }}
            >
              <span>Total Items: {draftItems.length}</span>
              <span style={{ color: "#1c5eb6" }}>
                Grand Total Expenditure: ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div
          className="form-actions"
          style={{
            padding: "10px 14px",
            background: "#e8eff7",
            borderTop: "1px solid #7092be",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn secondary-btn" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn primary-btn"
            onClick={handleSavePurchase}
            disabled={isSubmitting || draftItems.length === 0}
          >
            {isSubmitting ? "Saving & Syncing..." : "Save Purchase & Update Inventory"}
          </button>
        </div>
      </div>
    </div>
  );
};
