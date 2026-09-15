import React, { useEffect, useState } from "react";
import { StockMovement } from "../types";
import { fetchStockMovements } from "../services/ledgerService";
import { LedgerTable } from "../components/LedgerTable";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const LedgerPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const list = await fetchStockMovements();
      setMovements(list);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load stock ledger movements:", err);
        setError(err?.message || "Failed to load stock movements from database.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadData(true), 3000);

  useEffect(() => {
    loadData();
  }, []);

  const filteredMovements = movements.filter((m) => {
    // Type Filter
    if (typeFilter !== "ALL" && m.type !== typeFilter) {
      return false;
    }

    // Search Query Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchProduct = m.product_name.toLowerCase().includes(q);
      const matchBarcode = m.barcode.toLowerCase().includes(q);
      const matchBatch = m.batch_no.toLowerCase().includes(q);
      const matchRef = m.reference_no.toLowerCase().includes(q);
      const matchParty = m.party_name.toLowerCase().includes(q);
      if (
        !matchProduct &&
        !matchBarcode &&
        !matchBatch &&
        !matchRef &&
        !matchParty
      ) {
        return false;
      }
    }

    // Date Range Filter
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      const movementMs =
        new Date(m.timestamp).getTime() || Date.parse(m.timestamp);
      if (movementMs && movementMs < startMs) return false;
    }

    if (endDate) {
      const endMs = new Date(endDate + "T23:59:59").getTime();
      const movementMs =
        new Date(m.timestamp).getTime() || Date.parse(m.timestamp);
      if (movementMs && movementMs > endMs) return false;
    }

    return true;
  });

  return (
    <>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Stock Movement Ledger ({filteredMovements.length})</h2>

          <div className="list-actions" style={{ gap: "10px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search product, barcode, batch, ref, party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: "240px" }}
            />

            <select
              className="search-input"
              style={{ width: "160px", height: "32px" }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="ALL">All Movement Types</option>
              <option value="IN">STOCK IN (Purchases)</option>
              <option value="OUT">STOCK OUT (Sales)</option>
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label
                htmlFor="fromDate"
                style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1a385c" }}
              >
                From:
              </label>
              <input
                id="fromDate"
                type="date"
                className="search-input"
                style={{ width: "130px", height: "32px" }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label
                htmlFor="toDate"
                style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1a385c" }}
              >
                To:
              </label>
              <input
                id="toDate"
                type="date"
                className="search-input"
                style={{ width: "130px", height: "32px" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {(searchTerm || typeFilter !== "ALL" || startDate || endDate) && (
              <button
                type="button"
                className="btn secondary-btn"
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading stock movement ledger...</div>
        ) : filteredMovements.length === 0 ? (
          <div className="empty-state">
            {searchTerm || typeFilter !== "ALL" || startDate || endDate
              ? "No matching stock movement logs found."
              : "No stock movements recorded yet."}
          </div>
        ) : (
          <LedgerTable movements={filteredMovements} />
        )}
      </section>
    </>
  );
};
