import React, { useState, useEffect, useRef, useMemo } from "react";
import { AiBillImport, AiBillImportItem } from "../types";
import { Product } from "../../inventory/types";
import { fetchProducts } from "../../inventory/services/inventoryService";
import {
  updateAiBillImportItems,
  verifyAndImportAiBill,
} from "../services/aiBillImportService";

interface AiBillReviewModalProps {
  billImport: AiBillImport | null;
  onClose: () => void;
  onImported: (purchaseId: number) => void;
}

function suggestBatchNo(invoiceNo: string, idx: number, existingProducts: Product[], barcode: string): string {
  const cleanInv = invoiceNo.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "NEW";
  let candidate = `B-${cleanInv}-${idx + 1}`;
  let counter = 1;
  while (
    existingProducts.some(
      (p) =>
        p.barcode.trim().toLowerCase() === barcode.trim().toLowerCase() &&
        (p.batch_no || "").trim().toLowerCase() === candidate.toLowerCase()
    )
  ) {
    counter += 1;
    candidate = `B-${cleanInv}-${idx + 1}-${counter}`;
  }
  return candidate;
}

export const AiBillReviewModal: React.FC<AiBillReviewModalProps> = ({
  billImport,
  onClose,
  onImported,
}) => {
  const [items, setItems] = useState<AiBillImportItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Barcode scan state
  const [scanInput, setScanInput] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "not_found" | "info" | "error";
    message: string;
  } | null>(null);

  // Not-found -> search by name & save new barcode state
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [nameSearchQuery, setNameSearchQuery] = useState("");
  const [selectedMatchProduct, setSelectedMatchProduct] = useState<Product | null>(null);
  const [newBarcodeInput, setNewBarcodeInput] = useState("");
  const [newBatchInput, setNewBatchInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const nameSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!billImport) return;
    setItems(billImport.items.map((it) => ({ ...it })));
    const firstPending = billImport.items.findIndex(
      (it) => !it.verification_status || it.verification_status === "pending"
    );
    setActiveIndex(firstPending >= 0 ? firstPending : 0);
    setScanInput("");
    setScanFeedback(null);
    setNotFoundBarcode(null);
    setSelectedMatchProduct(null);
    setNameSearchQuery("");
    setError(null);

    fetchProducts()
      .then((list) => setProducts(list))
      .catch((err) => console.error("Failed to load inventory products:", err));

    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 80);
  }, [billImport]);

  const activeItem = items[activeIndex] || null;

  const verifiedCount = useMemo(
    () =>
      items.filter(
        (it) => it.verification_status && it.verification_status !== "pending"
      ).length,
    [items]
  );

  // Unique product suggestions when searching by name (group by name+barcode)
  const nameSearchResults = useMemo(() => {
    const q = nameSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const matches: Product[] = [];
    for (const p of products) {
      if (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      ) {
        const key = `${p.name.toLowerCase()}|${p.barcode.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push(p);
        }
      }
      if (matches.length >= 25) break;
    }
    return matches;
  }, [nameSearchQuery, products]);

  if (!billImport) return null;

  const advanceToNextPending = (updatedItems: AiBillImportItem[], currentIdx: number) => {
    const nextAfter = updatedItems.findIndex(
      (it, idx) =>
        idx > currentIdx &&
        (!it.verification_status || it.verification_status === "pending")
    );
    if (nextAfter >= 0) {
      setActiveIndex(nextAfter);
      return;
    }
    const anyPending = updatedItems.findIndex(
      (it) => !it.verification_status || it.verification_status === "pending"
    );
    if (anyPending >= 0) {
      setActiveIndex(anyPending);
    }
  };

  const handleBarcodeCheck = (rawCode?: string) => {
    const code = (rawCode ?? scanInput).trim();
    if (!code) return;

    setError(null);
    const matchingProducts = products.filter(
      (p) => p.barcode.trim().toLowerCase() === code.toLowerCase()
    );

    if (matchingProducts.length > 0) {
      // Barcode FOUND -> company did NOT change barcode -> import as new batch
      const matched = matchingProducts[0];
      const targetIdx = activeIndex;
      const current = items[targetIdx];
      if (!current) return;

      const resolvedBatch =
        (current.batch_no || "").trim() ||
        suggestBatchNo(billImport.invoice_no, targetIdx, products, matched.barcode);

      const updated = items.map((it, idx) =>
        idx === targetIdx
          ? {
              ...it,
              barcode: matched.barcode,
              product_id: matched.id,
              product_name: matched.name,
              matched_product_id: matched.id,
              matched_product_name: matched.name,
              category: matched.category || it.category || "General",
              hsn_code: it.hsn_code || matched.hsn_code || "",
              gst_rate: it.gst_rate || matched.gst_rate || 0,
              batch_no: resolvedBatch,
              verification_status: "matched_existing" as const,
            }
          : it
      );

      setItems(updated);
      setNotFoundBarcode(null);
      setSelectedMatchProduct(null);
      setScanInput("");
      setScanFeedback({
        type: "success",
        message: `✓ Barcode "${matched.barcode}" found (${matched.name}). Company barcode unchanged — marked to import as New Batch (${resolvedBatch}).`,
      });
      advanceToNextPending(updated, targetIdx);
      setTimeout(() => scanInputRef.current?.focus(), 40);
    } else {
      // Barcode NOT FOUND -> company changed barcode (or new product) -> ask user to search by name
      setNotFoundBarcode(code);
      setNewBarcodeInput(code);
      setSelectedMatchProduct(null);
      const suggestedQuery = activeItem?.product_name
        ? activeItem.product_name.split(/\s+/).slice(0, 2).join(" ")
        : "";
      setNameSearchQuery(suggestedQuery);
      setNewBatchInput(
        (activeItem?.batch_no || "").trim() ||
          suggestBatchNo(billImport.invoice_no, activeIndex, products, code)
      );
      setScanInput("");
      setScanFeedback({
        type: "not_found",
        message: `Barcode "${code}" not found in inventory — company may have changed the barcode. Search the product by name below to save this barcode as a new batch.`,
      });
      setTimeout(() => nameSearchInputRef.current?.focus(), 60);
    }
  };

  const handleSelectMatchedProduct = (prod: Product) => {
    setSelectedMatchProduct(prod);
    const code = notFoundBarcode || newBarcodeInput || scanInput;
    setNewBarcodeInput(code.trim());
    setNewBatchInput(
      (activeItem?.batch_no || "").trim() ||
        suggestBatchNo(billImport.invoice_no, activeIndex, products, code.trim())
    );
  };

  const handleSaveNewBarcodeAndBatch = () => {
    const cleanBarcode = newBarcodeInput.trim();
    if (!cleanBarcode) {
      setError("Please scan or enter the new barcode.");
      return;
    }
    if (!selectedMatchProduct) {
      setError("Please search and select the existing product first.");
      return;
    }
    const cleanBatch =
      newBatchInput.trim() ||
      suggestBatchNo(billImport.invoice_no, activeIndex, products, cleanBarcode);

    const updated = items.map((it, idx) =>
      idx === activeIndex
        ? {
            ...it,
            barcode: cleanBarcode,
            product_id: selectedMatchProduct.id,
            product_name: selectedMatchProduct.name,
            matched_product_id: selectedMatchProduct.id,
            matched_product_name: selectedMatchProduct.name,
            old_barcode: selectedMatchProduct.barcode,
            category: selectedMatchProduct.category || it.category || "General",
            hsn_code: it.hsn_code || selectedMatchProduct.hsn_code || "",
            gst_rate: it.gst_rate || selectedMatchProduct.gst_rate || 0,
            batch_no: cleanBatch,
            verification_status: "new_barcode_batch" as const,
          }
        : it
    );

    setItems(updated);
    setNotFoundBarcode(null);
    setSelectedMatchProduct(null);
    setNameSearchQuery("");
    setNewBarcodeInput("");
    setNewBatchInput("");
    setError(null);
    setScanFeedback({
      type: "success",
      message: `✓ Saved new barcode "${cleanBarcode}" for "${selectedMatchProduct.name}" as New Batch (${cleanBatch}).`,
    });
    advanceToNextPending(updated, activeIndex);
    setTimeout(() => scanInputRef.current?.focus(), 40);
  };

  const handleMarkAsBrandNewProduct = () => {
    const cleanBarcode = (newBarcodeInput || notFoundBarcode || "").trim();
    if (!cleanBarcode) {
      setError("Please scan or enter a barcode for the new product.");
      return;
    }
    const cleanBatch =
      newBatchInput.trim() ||
      suggestBatchNo(billImport.invoice_no, activeIndex, products, cleanBarcode);

    const updated = items.map((it, idx) =>
      idx === activeIndex
        ? {
            ...it,
            barcode: cleanBarcode,
            batch_no: cleanBatch,
            verification_status: "new_product" as const,
          }
        : it
    );

    setItems(updated);
    setNotFoundBarcode(null);
    setSelectedMatchProduct(null);
    setNameSearchQuery("");
    setNewBarcodeInput("");
    setNewBatchInput("");
    setError(null);
    setScanFeedback({
      type: "info",
      message: `✓ Marked "${activeItem?.product_name}" with barcode "${cleanBarcode}" as a Brand New Product (Batch: ${cleanBatch}).`,
    });
    advanceToNextPending(updated, activeIndex);
    setTimeout(() => scanInputRef.current?.focus(), 40);
  };

  const updateItemField = (
    idx: number,
    field: keyof AiBillImportItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [field]: value };
        if (field === "quantity" || field === "purchase_price") {
          next.subtotal =
            (Number(next.purchase_price) || 0) * (Number(next.quantity) || 0);
        }
        return next;
      })
    );
  };

  const handleSaveProgress = async () => {
    setIsSaving(true);
    try {
      await updateAiBillImportItems(billImport.id, items);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save review progress.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmImport = async () => {
    setError(null);
    for (const it of items) {
      if (!it.product_name.trim()) {
        setError("Every item must have a product name.");
        return;
      }
      if ((Number(it.quantity) || 0) <= 0) {
        setError(`Quantity for "${it.product_name}" must be greater than 0.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const purchaseId = await verifyAndImportAiBill(billImport.id, {
        supplier_name: billImport.supplier_name,
        invoice_no: billImport.invoice_no,
        purchase_date: billImport.purchase_date,
        gst_no: billImport.gst_no,
        contact_no: billImport.contact_no,
        items,
      });
      onImported(purchaseId);
    } catch (err: any) {
      setError(err?.message || "Failed to import verified purchase.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount = items.reduce(
    (sum, it) =>
      sum +
      (Number(it.subtotal) ||
        (Number(it.purchase_price) || 0) * (Number(it.quantity) || 0)),
    0
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{
          maxWidth: "1140px",
          width: "96%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Review AI Bill Import — Invoice #{billImport.invoice_no}</h2>
            <div style={{ fontSize: "0.84rem", color: "#475569", marginTop: "2px" }}>
              Supplier: <strong>{billImport.supplier_name}</strong> | Date:{" "}
              <strong>{billImport.purchase_date}</strong> | Verified:{" "}
              <strong style={{ color: verifiedCount === items.length ? "#15803d" : "#0369a1" }}>
                {verifiedCount} / {items.length} items
              </strong>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isSaving}>
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div className="error-banner" style={{ marginBottom: "10px" }}>
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>X</button>
            </div>
          )}

          {/* Barcode Scanner & Active Item Verification Box */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "12px 14px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Verifying Item #{activeIndex + 1} of {items.length}
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                  {activeItem ? activeItem.product_name : "No item selected"}
                  {activeItem && (
                    <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#475569", marginLeft: "10px" }}>
                      Qty: {activeItem.quantity} | MRP: ₹{Number(activeItem.mrp || 0).toFixed(2)} | Rate: ₹
                      {Number(activeItem.purchase_price || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1 1 340px", maxWidth: "460px" }}>
                <input
                  ref={scanInputRef}
                  type="text"
                  className="search-input"
                  style={{ flex: 1, fontWeight: 600 }}
                  placeholder="Scan barcode of purchased item & press Enter..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeCheck();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn primary-btn"
                  onClick={() => handleBarcodeCheck()}
                >
                  Check Barcode
                </button>
              </div>
            </div>

            {scanFeedback && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  marginBottom: notFoundBarcode ? "10px" : "0",
                  background:
                    scanFeedback.type === "success"
                      ? "#dcfce7"
                      : scanFeedback.type === "not_found"
                        ? "#fef3c7"
                        : "#e0f2fe",
                  color:
                    scanFeedback.type === "success"
                      ? "#166534"
                      : scanFeedback.type === "not_found"
                        ? "#92400e"
                        : "#075985",
                  border:
                    scanFeedback.type === "success"
                      ? "1px solid #86efac"
                      : scanFeedback.type === "not_found"
                        ? "1px solid #fcd34d"
                        : "1px solid #7dd3fc",
                }}
              >
                {scanFeedback.message}
              </div>
            )}

            {/* Barcode Not Found -> Search by Name & Save New Barcode + New Batch */}
            {notFoundBarcode && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #f59e0b",
                  borderRadius: "6px",
                  padding: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ color: "#92400e", fontSize: "0.9rem" }}>
                    Search Existing Product by Name (to update barcode & import as new batch)
                  </strong>
                  <button
                    type="button"
                    className="btn secondary-btn"
                    style={{ padding: "3px 10px", fontSize: "0.8rem" }}
                    onClick={handleMarkAsBrandNewProduct}
                  >
                    + Save as Brand New Product
                  </button>
                </div>

                <input
                  ref={nameSearchInputRef}
                  type="text"
                  className="search-input"
                  style={{ width: "100%", marginBottom: "8px" }}
                  placeholder="Type product name to search inventory..."
                  value={nameSearchQuery}
                  onChange={(e) => setNameSearchQuery(e.target.value)}
                />

                {nameSearchResults.length > 0 ? (
                  <div
                    style={{
                      maxHeight: "160px",
                      overflowY: "auto",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      marginBottom: "10px",
                    }}
                  >
                    <table className="product-table" style={{ margin: 0, fontSize: "0.82rem" }}>
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Current Barcode</th>
                          <th>Batch</th>
                          <th>MRP</th>
                          <th>Stock</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nameSearchResults.map((p) => {
                          const isSelected = selectedMatchProduct?.id === p.id;
                          return (
                            <tr
                              key={p.id}
                              style={{
                                background: isSelected ? "#eff6ff" : undefined,
                                cursor: "pointer",
                              }}
                              onClick={() => handleSelectMatchedProduct(p)}
                            >
                              <td style={{ fontWeight: 600 }}>{p.name}</td>
                              <td style={{ fontFamily: "monospace" }}>{p.barcode || "-"}</td>
                              <td>{p.batch_no || "-"}</td>
                              <td>₹{Number(p.mrp || p.price).toFixed(2)}</td>
                              <td>{p.stock}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn secondary-btn"
                                  style={{ padding: "2px 8px", fontSize: "0.78rem" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMatchedProduct(p);
                                  }}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "8px" }}>
                    {nameSearchQuery.trim()
                      ? "No matching products found in inventory. You can refine the search or save as a Brand New Product."
                      : "Type a product name above to search."}
                  </div>
                )}

                {selectedMatchProduct && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      alignItems: "flex-end",
                      padding: "10px",
                      background: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: "4px",
                    }}
                  >
                    <div style={{ flex: "1 1 200px" }}>
                      <div style={{ fontSize: "0.75rem", color: "#1e40af", fontWeight: 700 }}>
                        Selected Product
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                        {selectedMatchProduct.name}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "#475569" }}>
                        Old Barcode: {selectedMatchProduct.barcode || "None"}
                      </div>
                    </div>

                    <div style={{ flex: "1 1 180px" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "3px" }}>
                        Scan / Confirm New Barcode
                      </label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ width: "100%", fontFamily: "monospace" }}
                        value={newBarcodeInput}
                        onChange={(e) => setNewBarcodeInput(e.target.value)}
                      />
                    </div>

                    <div style={{ flex: "0 1 150px" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "3px" }}>
                        New Batch No
                      </label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ width: "100%" }}
                        value={newBatchInput}
                        onChange={(e) => setNewBatchInput(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn primary-btn"
                      onClick={handleSaveNewBarcodeAndBatch}
                    >
                      Save Barcode & New Batch
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="table-responsive" style={{ maxHeight: "340px", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
            <table className="product-table" style={{ margin: 0, fontSize: "0.83rem" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product Name</th>
                  <th>Barcode</th>
                  <th>Batch No</th>
                  <th style={{ width: "70px" }}>Qty</th>
                  <th style={{ width: "85px" }}>Rate (₹)</th>
                  <th style={{ width: "85px" }}>MRP (₹)</th>
                  <th style={{ width: "85px" }}>Sell (₹)</th>
                  <th>Verification Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  const status = item.verification_status || "pending";
                  return (
                    <tr
                      key={idx}
                      onClick={() => {
                        setActiveIndex(idx);
                        setNotFoundBarcode(null);
                        setSelectedMatchProduct(null);
                        setTimeout(() => scanInputRef.current?.focus(), 30);
                      }}
                      style={{
                        cursor: "pointer",
                        background: isActive ? "#eff6ff" : undefined,
                        outline: isActive ? "2px solid #3b82f6" : undefined,
                      }}
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => updateItemField(idx, "product_name", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "100%", minWidth: "170px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.barcode}
                          onChange={(e) => updateItemField(idx, "barcode", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Scan..."
                          style={{ width: "120px", fontFamily: "monospace", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.batch_no}
                          onChange={(e) => updateItemField(idx, "batch_no", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Auto batch"
                          style={{ width: "105px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItemField(idx, "quantity", Number(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "60px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.purchase_price}
                          onChange={(e) => updateItemField(idx, "purchase_price", Number(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "75px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => updateItemField(idx, "mrp", Number(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "75px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.selling_price}
                          onChange={(e) => updateItemField(idx, "selling_price", Number(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "75px", padding: "3px 6px" }}
                        />
                      </td>
                      <td>
                        {status === "matched_existing" && (
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#166534",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ Matched (New Batch)
                          </span>
                        )}
                        {status === "new_barcode_batch" && (
                          <span
                            style={{
                              background: "#dbeafe",
                              color: "#1e40af",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ New Barcode + Batch
                          </span>
                        )}
                        {status === "new_product" && (
                          <span
                            style={{
                              background: "#f3e8ff",
                              color: "#6b21a8",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ New Product
                          </span>
                        )}
                        {status === "pending" && (
                          <span
                            style={{
                              background: "#f1f5f9",
                              color: "#475569",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Pending Scan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          className="form-actions"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
            Bill Total: ₹{totalAmount.toFixed(2)}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={handleSaveProgress}
              disabled={isSaving}
            >
              Save Progress
            </button>
            <button
              type="button"
              className="btn primary-btn"
              onClick={handleConfirmImport}
              disabled={isSaving}
              style={{ fontWeight: 700 }}
            >
              {isSaving ? "Importing..." : "Confirm & Import Purchase"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
