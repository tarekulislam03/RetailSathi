import React, { useState, useEffect } from "react";
import { Product } from "../types";
import {
  printReorderListEscPos,
  getAvailablePrinters,
  PrinterDevice,
  ReorderItem,
  getActiveStoreInfo,
  StoreReceiptInfo,
} from "../../../services/escposService";
import { getDevicePrinterSettings } from "../../../services/deviceSettingsService";

export interface ReorderListModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  allProducts?: Product[];
  onEdit?: (product: Product) => void;
  onDelete?: (id: number) => void;
}

export const ReorderListModal: React.FC<ReorderListModalProps> = ({
  isOpen,
  onClose,
  products,
  onEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "out" | "low">("all");
  // Map of productId -> reorder quantity (number) for selected products
  const [selectedMap, setSelectedMap] = useState<Record<number, number>>({});
  // Explicit selection order: first selected product ID is first in array
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);

  // Printer Configuration State
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [storeInfo, setStoreInfo] = useState<StoreReceiptInfo | null>(null);

  // Printing state
  const [printing, setPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Identify all low stock products (stock <= reorder_threshold)
  const lowStockItems = products.filter((p) => p.stock <= p.reorder_threshold);

  // Suggested reorder quantity for a product
  const getSuggestedQty = (p: Product) => {
    const diff = p.reorder_threshold - p.stock;
    return diff > 0 ? diff : Math.max(1, p.reorder_threshold || 1);
  };

  // Initialize selectedMap with all low stock items and their default suggested quantities when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<number, number> = {};
      const initialOrder: number[] = [];
      for (const p of lowStockItems) {
        initialMap[p.id] = getSuggestedQty(p);
        initialOrder.push(p.id);
      }
      setSelectedMap(initialMap);
      setSelectedOrder(initialOrder);
      setStatusMsg(null);
      setSearchTerm("");
      setFilterType("all");

      // Load store and printer settings
      Promise.all([
        getActiveStoreInfo(),
        getAvailablePrinters().catch(() => []),
        getDevicePrinterSettings(),
      ])
        .then(([store, printerList, deviceSettings]) => {
          setStoreInfo(store);
          setPrinters(printerList);

          const defaultWidth =
            deviceSettings.pos_paper_width ||
            (store.paper_width as 58 | 80) ||
            80;
          setPaperWidth(defaultWidth);

          let initialPrinter =
            deviceSettings.pos_printer || store.default_printer || "";
          if (initialPrinter && printerList.length > 0) {
            const exists = printerList.some(
              (p) => p.name.toLowerCase() === initialPrinter.toLowerCase()
            );
            if (!exists) {
              const sysDef = printerList.find((p) => p.is_default);
              initialPrinter = sysDef ? sysDef.name : printerList[0]?.name || "";
            }
          } else if (!initialPrinter && printerList.length > 0) {
            const sysDef = printerList.find((p) => p.is_default);
            initialPrinter = sysDef ? sysDef.name : printerList[0]?.name || "";
          }
          setSelectedPrinter(initialPrinter);
        })
        .catch((err) => {
          console.warn("[ReorderModal] Error loading printer settings:", err);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !printing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, printing]);

  if (!isOpen) return null;

  // Filter items according to search and status tab
  const filteredItems = lowStockItems.filter((item) => {
    if (filterType === "out" && item.stock !== 0) return false;
    if (filterType === "low" && item.stock === 0) return false;

    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      (item.barcode && item.barcode.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.batch_no && item.batch_no.toLowerCase().includes(query))
    );
  });

  const outOfStockCount = lowStockItems.filter((p) => p.stock === 0).length;
  const lowStockOnlyCount = lowStockItems.filter((p) => p.stock > 0).length;

  const toggleSelect = (id: number, product: Product) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        next[id] = getSuggestedQty(product);
      }
      return next;
    });
    setSelectedOrder((prev) => {
      if (prev.includes(id)) {
        return prev.filter((itemId) => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const updateQuantity = (id: number, qty: number) => {
    const val = isNaN(qty) ? 1 : Math.max(1, qty);
    setSelectedMap((prev) => ({
      ...prev,
      [id]: val,
    }));
    setSelectedOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const selectAllFiltered = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const item of filteredItems) {
        if (next[item.id] === undefined) {
          next[item.id] = getSuggestedQty(item);
        }
      }
      return next;
    });
    setSelectedOrder((prev) => {
      const next = [...prev];
      for (const item of filteredItems) {
        if (!next.includes(item.id)) {
          next.push(item.id);
        }
      }
      return next;
    });
  };

  const deselectAllFiltered = () => {
    const deselectIds = new Set(filteredItems.map((i) => i.id));
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const id of deselectIds) {
        delete next[id];
      }
      return next;
    });
    setSelectedOrder((prev) => prev.filter((id) => !deselectIds.has(id)));
  };

  const selectedCount = Object.keys(selectedMap).length;
  const totalReorderUnits = Object.values(selectedMap).reduce((acc, q) => acc + q, 0);

  // Preserve order: first selected is first in selectedPayload
  const orderedIds: number[] = [];
  for (const id of selectedOrder) {
    if (selectedMap[id] !== undefined && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }
  for (const idStr of Object.keys(selectedMap)) {
    const id = Number(idStr);
    if (!orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  const selectedPayload: ReorderItem[] = orderedIds
    .map((id) => {
      const prod = products.find((p) => p.id === id);
      if (!prod) return null;
      return {
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        category: prod.category,
        stock: prod.stock,
        reorder_threshold: prod.reorder_threshold,
        reorder_quantity: selectedMap[id] || 1,
        price: prod.price,
        mrp: prod.mrp,
      };
    })
    .filter(Boolean) as ReorderItem[];

  const handlePrintReorders = async () => {
    if (selectedPayload.length === 0) {
      setStatusMsg({
        type: "error",
        text: "Please select at least one item to reorder.",
      });
      return;
    }

    setPrinting(true);
    setStatusMsg({
      type: "info",
      text: `Formatting reorder list for ${paperWidth}mm connected printer...`,
    });

    try {
      const res = await printReorderListEscPos(selectedPayload, {
        printerName: selectedPrinter || undefined,
        paperWidth,
        storeName: storeInfo?.name,
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          text: `✓ ${res.message || "Reorder list printed successfully!"}`,
        });
      } else {
        setStatusMsg({
          type: "error",
          text: res.message || "Failed to print reorder list.",
        });
      }
    } catch (err: any) {
      console.error("[Reorder-Print] Execution error:", err);
      setStatusMsg({
        type: "error",
        text: err?.message || "An unexpected error occurred while printing.",
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%", padding: 0 }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            background: "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)",
            borderBottom: "1px solid #ffe58f",
            padding: "14px 20px",
          }}
        >
          <div>
            <h2
              style={{
                color: "#873800",
                margin: 0,
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📋 Low Stock Reorder List
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
                {lowStockItems.length} {lowStockItems.length === 1 ? "Item" : "Items"}
              </span>
            </h2>
            <p className="hint-text" style={{ color: "#613400", margin: "4px 0 0 0", fontSize: "0.82rem" }}>
              Select products to reorder, adjust quantities, and print a formatted sheet adjusted for your connected POS printer.
            </p>
          </div>
          <button className="close-btn" onClick={onClose} disabled={printing} type="button">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "16px 20px" }}>
          {lowStockItems.length === 0 ? (
            <div
              style={{
                background: "linear-gradient(to bottom, #e6f4ea 0%, #c8e6c9 100%)",
                border: "1px solid #81c784",
                borderRadius: "6px",
                padding: "24px 16px",
                textAlign: "center",
                color: "#1b5e20",
                fontSize: "0.95rem",
                fontWeight: 600,
              }}
            >
              ✅ All product stock levels are healthy! No items are currently below their reorder threshold limit.
            </div>
          ) : (
            <>
              {/* Search, Filter Tabs & Select All / Clear toolbar */}
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
                {/* Filter Tabs */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    type="button"
                    className={`btn ${filterType === "all" ? "primary-btn" : "secondary-btn"}`}
                    style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                    onClick={() => setFilterType("all")}
                  >
                    All ({lowStockItems.length})
                  </button>
                  {outOfStockCount > 0 && (
                    <button
                      type="button"
                      className={`btn ${filterType === "out" ? "primary-btn" : "secondary-btn"}`}
                      style={{
                        padding: "4px 10px",
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
                        padding: "4px 10px",
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

                {/* Search & Selection Actions */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1 1 auto", justifyContent: "flex-end" }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search name, barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: "210px", height: "30px", fontSize: "0.82rem" }}
                  />
                  <button
                    type="button"
                    className="btn secondary-btn"
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    onClick={selectAllFiltered}
                    title="Select all items visible in current view"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn secondary-btn"
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                    onClick={deselectAllFiltered}
                    title="Deselect all visible items"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div
                style={{
                  maxHeight: "330px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  background: "#ffffff",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        borderBottom: "1px solid #cbd5e1",
                      }}
                    >
                      <th style={{ width: "36px", padding: "8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredItems.length > 0 &&
                            filteredItems.every((item) => selectedMap[item.id] !== undefined)
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAllFiltered();
                            } else {
                              deselectAllFiltered();
                            }
                          }}
                          title="Select / Deselect all visible"
                        />
                      </th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Product</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Barcode</th>
                      <th style={{ padding: "8px", textAlign: "center", width: "95px" }}>Stock</th>
                      <th style={{ padding: "8px", textAlign: "center", width: "85px" }}>Min Limit</th>
                      <th style={{ padding: "8px", textAlign: "center", width: "115px" }}>
                        Reorder Qty
                      </th>
                      {onEdit && (
                        <th style={{ padding: "8px", textAlign: "center", width: "60px" }}>Edit</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={onEdit ? 7 : 6}
                          style={{ padding: "24px", textAlign: "center", color: "#64748b" }}
                        >
                          No matching low stock products found.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const isSelected = selectedMap[item.id] !== undefined;
                        const isZero = item.stock === 0;
                        const qtyValue = selectedMap[item.id] ?? getSuggestedQty(item);

                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              background: isSelected
                                ? isZero
                                  ? "#fff5f5"
                                  : "#fffdf0"
                                : "#ffffff",
                              opacity: isSelected ? 1 : 0.75,
                            }}
                          >
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(item.id, item)}
                              />
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.name}</div>
                              {item.category && (
                                <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                                  {item.category}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "8px", color: "#475569" }}>
                              <code>{item.barcode || "-"}</code>
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: 700,
                                  fontSize: "0.76rem",
                                  color: isZero ? "#991b1b" : "#854d0e",
                                  backgroundColor: isZero ? "#fee2e2" : "#fef9c3",
                                  border: isZero ? "1px solid #fca5a5" : "1px solid #fef08a",
                                }}
                              >
                                {isZero ? "0 (Out)" : `${item.stock}`}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "8px",
                                textAlign: "center",
                                fontWeight: 600,
                                color: "#475569",
                              }}
                            >
                              {item.reorder_threshold}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <input
                                type="number"
                                min={1}
                                max={99999}
                                className="input-field"
                                style={{
                                  width: "72px",
                                  padding: "3px 6px",
                                  fontSize: "0.84rem",
                                  textAlign: "center",
                                  fontWeight: 700,
                                  border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                  background: isSelected ? "#ffffff" : "#f1f5f9",
                                }}
                                value={qtyValue}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  updateQuantity(item.id, val);
                                }}
                                title="Quantity to order from supplier"
                              />
                            </td>
                            {onEdit && (
                              <td style={{ padding: "8px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  className="btn-icon edit-btn"
                                  style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                                  onClick={() => {
                                    onClose();
                                    onEdit(item);
                                  }}
                                  title="Edit product threshold / stock"
                                >
                                  Edit
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Connected Printer & Paper Settings Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginTop: "12px",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                }}
              >
                {/* Printer Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "4px" }}>
                    🖨️ Connected Printer:
                  </span>
                  {printers.length > 0 ? (
                    <select
                      className="search-input"
                      style={{ height: "30px", fontSize: "0.8rem", minWidth: "180px", maxWidth: "260px" }}
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                    >
                      {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.is_default ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: "#64748b", fontStyle: "italic" }}>
                      {selectedPrinter || "Default System Printer"}
                    </span>
                  )}
                </div>

                {/* Paper Width Adjustment Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Roll Width:</span>
                  <div style={{ display: "flex", borderRadius: "4px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
                    <button
                      type="button"
                      style={{
                        padding: "3px 10px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        background: paperWidth === 80 ? "#2563eb" : "#ffffff",
                        color: paperWidth === 80 ? "#ffffff" : "#475569",
                      }}
                      onClick={() => setPaperWidth(80)}
                    >
                      80mm (Standard)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "3px 10px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        borderLeft: "1px solid #cbd5e1",
                        background: paperWidth === 58 ? "#2563eb" : "#ffffff",
                        color: paperWidth === 58 ? "#ffffff" : "#475569",
                      }}
                      onClick={() => setPaperWidth(58)}
                    >
                      58mm (Compact)
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Message Notification */}
              {statusMsg && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    borderRadius: "5px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    background:
                      statusMsg.type === "success"
                        ? "#ecfdf5"
                        : statusMsg.type === "error"
                        ? "#fef2f2"
                        : "#eff6ff",
                    color:
                      statusMsg.type === "success"
                        ? "#065f46"
                        : statusMsg.type === "error"
                        ? "#991b1b"
                        : "#1e40af",
                    border: `1px solid ${
                      statusMsg.type === "success"
                        ? "#a7f3d0"
                        : statusMsg.type === "error"
                        ? "#fecaca"
                        : "#bfdbfe"
                    }`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{statusMsg.text}</span>
                  <button
                    type="button"
                    onClick={() => setStatusMsg(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      color: "inherit",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="form-actions"
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#475569" }}>
            {lowStockItems.length > 0 && (
              <>
                Selected: <strong>{selectedCount}</strong> products (
                <strong>{totalReorderUnits}</strong> total units)
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={printing}
            >
              Close
            </button>
            {lowStockItems.length > 0 && (
              <button
                type="button"
                className="btn primary-btn"
                style={{
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background:
                    selectedCount > 0
                      ? "linear-gradient(to bottom, #16a34a 0%, #15803d 100%)"
                      : undefined,
                  borderColor: selectedCount > 0 ? "#15803d" : undefined,
                }}
                disabled={selectedCount === 0 || printing}
                onClick={handlePrintReorders}
              >
                {printing ? "⏳ Printing..." : `🖨️ Print Reorders (${selectedCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Hidden thermal print view for browser window.print() fallback */}
        <div
          className="thermal-receipt-paper reorder-print-paper"
          style={{ display: "none" }}
        >
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "14pt" }}>
            {storeInfo?.name || "RETAIL SATHI"}
          </div>
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}>
            *** INVENTORY REORDER LIST ***
          </div>
          <div style={{ fontSize: "9pt", margin: "4px 0" }}>
            Date: {new Date().toLocaleString("en-IN")}
          </div>
          <hr style={{ borderTop: "1px dashed #000000" }} />
          <div style={{ fontSize: "11pt", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
            <span># Item Description</span>
            <span>Order Qty</span>
          </div>
          <hr style={{ borderTop: "1px solid #000000" }} />
          {selectedPayload.map((item, idx) => (
            <div
              key={item.id}
              style={{
                margin: "8px 0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderBottom: "1px dotted #888888",
                paddingBottom: "4px",
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: "11pt", flex: 1, paddingRight: "10px" }}>
                {idx + 1}. {item.name}
              </span>
              <span style={{ fontWeight: "bold", fontSize: "13pt", whiteSpace: "nowrap" }}>
                {item.reorder_quantity}
              </span>
            </div>
          ))}
          <hr style={{ borderTop: "2px solid #000000" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11pt", margin: "4px 0" }}>
            <span>TOTAL ITEMS:</span>
            <span>{selectedPayload.length}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12pt", margin: "4px 0" }}>
            <span>TOTAL REORDER UNITS:</span>
            <span>{totalReorderUnits}</span>
          </div>
          <hr style={{ borderTop: "1px dashed #000000" }} />
          <div style={{ margin: "16px 0 6px 0", fontSize: "9pt" }}>
            Supplier: ___________________________<br />
            Authorized: _________________________
          </div>
          <div style={{ textAlign: "center", fontSize: "8pt", marginTop: "10px" }}>
            Retail Sathi POS • Inventory Reorders
          </div>
        </div>
      </div>
    </div>
  );
};
