import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Product } from "../../inventory/types";
import { BatchSelectionModal } from "./BatchSelectionModal";

interface BarcodeSearchProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onError: (msg: string) => void;
  todayBillsCount?: number;
}

export const FOCUS_SEARCH_EVENT = "retail_sathi_focus_search";

export function focusProductSearch() {
  window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
  }, 20);
}

export const BarcodeSearch: React.FC<BarcodeSearchProps> = ({
  products,
  onAddToCart,
  onError,
  todayBillsCount,
}) => {
  const [quickSearch, setQuickSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [matchingBatches, setMatchingBatches] = useState<Product[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 15);
  };

  useEffect(() => {
    focusSearch();

    const handleFocusSearchEvent = () => {
      focusSearch();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchEvent);

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if user clicked an interactive input, navigation link, sidebar, modal dialog, or checkout panel
      const isInteractive =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "A" ||
        target.isContentEditable ||
        target.closest("a") !== null ||
        target.closest(".sidebar") !== null ||
        target.closest(".modal-overlay") !== null ||
        target.closest(".modal-backdrop") !== null ||
        target.closest(".modal-content") !== null ||
        target.closest(".checkout-card") !== null ||
        target.closest(".pos-right") !== null;

      // If user clicked inside an interactive element, link, sidebar, modal, or checkout, do NOT steal focus
      if (isInteractive) {
        return;
      }

      // If user clicked anywhere else on the billing page background, cart table, or buttons, restore focus to search bar
      focusSearch();
    };

    const handleKeyDownGlobal = (e: globalThis.KeyboardEvent) => {
      // F2 or Escape key shortcut to refocus search bar anytime
      if (e.key === "F2" || (e.key === "Escape" && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        focusSearch();
      } else if (
        e.key === "Enter" &&
        document.activeElement &&
        document.activeElement.tagName === "INPUT" &&
        document.activeElement !== searchInputRef.current
      ) {
        const active = document.activeElement as HTMLElement;
        // Don't intercept Enter inside modal dialogs
        if (
          active.closest(".modal-overlay") ||
          active.closest(".modal-backdrop") ||
          active.closest(".modal-content")
        ) {
          return;
        }
        // Pressing Enter in non-search inputs completes editing and returns focus to search bar
        e.preventDefault();
        active.blur();
        focusSearch();
      }
    };

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDownGlobal);

    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusSearchEvent);
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleKeyDownGlobal);
    };
  }, []);

  const searchMatches = quickSearch.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
            p.barcode.toLowerCase().includes(quickSearch.toLowerCase()) ||
            (p.batch_no && p.batch_no.toLowerCase().includes(quickSearch.toLowerCase()))
        )
        .slice(0, 8)
    : [];

  const lastScanTimeRef = useRef(0);
  const lastScanTermRef = useRef("");

  function selectProduct(product: Product) {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 250 && lastScanTermRef.current === String(product.id)) {
      return;
    }
    lastScanTimeRef.current = now;
    lastScanTermRef.current = String(product.id);

    onAddToCart(product);
    setQuickSearch("");
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
    setShowDropdown(false);
    focusSearch();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const rawInput = (e.currentTarget.value || quickSearch || "").trim();
      if (!rawInput) return;

      e.preventDefault();
      e.stopPropagation();
      setShowDropdown(false);

      const term = rawInput.toLowerCase();
      const now = Date.now();

      // Ignore rapid duplicate scan / Enter keybounce (e.g. within 250ms for same term)
      if (term === lastScanTermRef.current && now - lastScanTimeRef.current < 250) {
        return;
      }
      lastScanTimeRef.current = now;
      lastScanTermRef.current = term;

      // 1. Check exact barcode match first
      const exactBarcodeMatches = products.filter(
        (p) =>
          p.barcode &&
          (p.barcode.trim().toLowerCase() === term ||
            p.barcode.trim().replace(/^0+/, "").toLowerCase() === term.replace(/^0+/, ""))
      );

      // If multiple batches exist for the exact barcode scanned, show dedicated batch selection modal!
      if (exactBarcodeMatches.length > 1) {
        setMatchingBatches(exactBarcodeMatches);
        setIsBatchModalOpen(true);
        setShowDropdown(false);
        setQuickSearch("");
        if (searchInputRef.current) {
          searchInputRef.current.value = "";
        }
        return;
      }

      if (exactBarcodeMatches.length === 1) {
        selectProduct(exactBarcodeMatches[0]);
        return;
      }

      // 2. Check exact batch_no match
      const exactBatchMatches = products.filter(
        (p) => p.batch_no && p.batch_no.trim().toLowerCase() === term
      );
      if (exactBatchMatches.length === 1) {
        selectProduct(exactBatchMatches[0]);
        return;
      }

      // 3. Check exact product name match
      const exactNameMatches = products.filter(
        (p) => p.name.trim().toLowerCase() === term
      );
      if (exactNameMatches.length > 1) {
        setMatchingBatches(exactNameMatches);
        setIsBatchModalOpen(true);
        setShowDropdown(false);
        setQuickSearch("");
        if (searchInputRef.current) {
          searchInputRef.current.value = "";
        }
        return;
      }
      if (exactNameMatches.length === 1) {
        selectProduct(exactNameMatches[0]);
        return;
      }

      // 4. Fallback: partial match across barcode, name, or batch
      const partialMatches = products.filter(
        (p) =>
          (p.barcode && p.barcode.toLowerCase().includes(term)) ||
          p.name.toLowerCase().includes(term) ||
          (p.batch_no && p.batch_no.toLowerCase().includes(term))
      );

      if (partialMatches.length > 1) {
        const uniqueBarcodes = new Set(
          partialMatches.map((p) => p.barcode?.trim().toLowerCase()).filter(Boolean)
        );
        const uniqueNames = new Set(
          partialMatches.map((p) => p.name.trim().toLowerCase())
        );
        // If all partial matches represent the same product or barcode with multiple batches, prompt batch selection
        if (uniqueBarcodes.size === 1 || uniqueNames.size === 1) {
          setMatchingBatches(partialMatches);
          setIsBatchModalOpen(true);
          setShowDropdown(false);
          setQuickSearch("");
          if (searchInputRef.current) {
            searchInputRef.current.value = "";
          }
          return;
        }
        setShowDropdown(true);
        return;
      }

      if (partialMatches.length === 1) {
        selectProduct(partialMatches[0]);
        return;
      }

      onError(`No product found for barcode / batch / name: "${rawInput}"`);
      focusSearch();
    }
  }

  function handleBatchSelected(selectedBatch: Product) {
    setIsBatchModalOpen(false);
    setMatchingBatches([]);
    selectProduct(selectedBatch);
  }

  function handleBatchModalClose() {
    setIsBatchModalOpen(false);
    setMatchingBatches([]);
    focusSearch();
  }

  return (
    <>
      <div className="card pos-search-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <label htmlFor="quickSearch" className="font-semibold" style={{ margin: 0 }}>
            Scan Barcode or Select Product:
          </label>
          {todayBillsCount !== undefined && (
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#103c6b",
                background: "linear-gradient(to bottom, #edf5fe 0%, #d2e4fc 100%)",
                border: "1px solid #7092be",
                padding: "2px 8px",
                borderRadius: "3px",
                boxShadow: "inset 0 1px 0 #ffffff",
              }}
            >
              Today's Bills: <strong>{todayBillsCount}</strong>
            </div>
          )}
        </div>
        <div className="search-dropdown-wrapper">
          <input
            ref={searchInputRef}
            id="quickSearch"
            type="text"
            className="search-input barcode-search"
            placeholder="Scan Barcode, batch no, or type product name to search..."
            value={quickSearch}
            onChange={(e) => {
              const val = e.target.value;
              setQuickSearch(val);
              if (!isBatchModalOpen) {
                setShowDropdown(Boolean(val.trim()));
              }
            }}
            onFocus={() => {
              if (!isBatchModalOpen && quickSearch.trim()) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          {showDropdown && !isBatchModalOpen && searchMatches.length > 0 && (
            <div className="search-dropdown">
              {searchMatches.map((p) => (
                <div
                  key={p.id}
                  className={`dropdown-item ${p.stock <= 0 ? "out-of-stock" : ""}`}
                  onMouseDown={() => selectProduct(p)}
                >
                  <div className="item-info">
                    <span className="dropdown-title">{p.name}</span>
                    <span className="dropdown-sub">
                      Barcode: {p.barcode || "N/A"} | Batch: {p.batch_no || "N/A"} | Category: {p.category}
                    </span>
                  </div>
                  <div className="item-meta" style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                      {p.mrp && p.mrp > p.price ? (
                        <span style={{ fontSize: "0.75rem", color: "#64748b", textDecoration: "line-through" }}>
                          MRP: ₹{p.mrp.toFixed(2)}
                        </span>
                      ) : null}
                      <span className="dropdown-price">₹{p.price.toFixed(2)}</span>
                    </div>
                    <span
                      className={`dropdown-stock ${
                        p.stock <= p.reorder_threshold ? "low" : ""
                      }`}
                    >
                      Stock: {p.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BatchSelectionModal
        isOpen={isBatchModalOpen}
        batches={matchingBatches}
        searchTerm={quickSearch}
        onSelectBatch={handleBatchSelected}
        onClose={handleBatchModalClose}
      />
    </>
  );
};
