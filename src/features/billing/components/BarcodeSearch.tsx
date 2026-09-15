import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Product } from "../../inventory/types";

interface BarcodeSearchProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onError: (msg: string) => void;
  todayBillsCount?: number;
}

export const BarcodeSearch: React.FC<BarcodeSearchProps> = ({
  products,
  onAddToCart,
  onError,
  todayBillsCount,
}) => {
  const [quickSearch, setQuickSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = () => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 15);
  };

  useEffect(() => {
    focusSearch();

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if user clicked an interactive input, navigation link, sidebar, button, or modal dialog
      const isInteractive =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.isContentEditable ||
        target.closest("a") !== null ||
        target.closest("button") !== null ||
        target.closest(".sidebar") !== null ||
        target.closest(".modal-overlay") !== null;

      // If user clicked inside an interactive element, link, sidebar, or modal, do NOT steal focus
      if (isInteractive) {
        return;
      }

      // If user clicked anywhere else on the billing page background, restore focus to search bar
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
        // Pressing Enter in non-search inputs completes editing and returns focus to search bar
        (document.activeElement as HTMLElement).blur();
        focusSearch();
      }
    };

    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDownGlobal);

    return () => {
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

  function selectProduct(product: Product) {
    onAddToCart(product);
    setQuickSearch("");
    setShowDropdown(false);
    focusSearch();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && quickSearch.trim()) {
      const term = quickSearch.trim().toLowerCase();
      const matched =
        products.find(
          (p) => p.barcode.toLowerCase() === term || p.name.toLowerCase() === term || (p.batch_no && p.batch_no.toLowerCase() === term)
        ) ||
        products.find(
          (p) =>
            p.barcode.toLowerCase().includes(term) ||
            p.name.toLowerCase().includes(term) ||
            (p.batch_no && p.batch_no.toLowerCase().includes(term))
        );

      if (matched) {
        onAddToCart(matched);
        setQuickSearch("");
        setShowDropdown(false);
      } else {
        onError(`No product found for barcode / batch / name: "${quickSearch}"`);
      }
      focusSearch();
    }
  }

  return (
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
            setQuickSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        {showDropdown && searchMatches.length > 0 && (
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
                <div className="item-meta">
                  <span className="dropdown-price">₹{p.price.toFixed(2)}</span>
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
  );
};
