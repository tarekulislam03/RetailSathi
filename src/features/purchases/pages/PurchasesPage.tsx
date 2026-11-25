import React, { useState, useEffect } from "react";
import { Purchase, AiBillImport } from "../types";
import {
  getAllPurchases,
  createPurchase,
} from "../services/purchaseService";
import {
  getPendingAiBillImports,
  dismissAiBillImport,
} from "../services/aiBillImportService";
import { PurchaseListTable } from "../components/PurchaseListTable";
import { AddPurchaseModal } from "../components/AddPurchaseModal";
import { PurchaseDetailsModal } from "../components/PurchaseDetailsModal";
import { ManageSuppliersModal } from "../components/ManageSuppliersModal";
import { AiBillReviewModal } from "../components/AiBillReviewModal";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pendingImports, setPendingImports] = useState<AiBillImport[]>([]);
  const [reviewingImport, setReviewingImport] = useState<AiBillImport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageSuppliersOpen, setIsManageSuppliersOpen] = useState(false);
  const [selectedDetailsId, setSelectedDetailsId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [list, importsList] = await Promise.all([
        getAllPurchases(),
        getPendingAiBillImports(),
      ]);
      setPurchases(list);
      setPendingImports(importsList);
    } catch (err) {
      if (!silent) {
        console.error("Failed to load purchase records:", err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useDbRefresh(() => loadData(true), 3000);

  useEffect(() => {
    loadData();
  }, []);

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }

  const filteredPurchases = searchQuery.trim()
    ? purchases.filter(
        (p) =>
          p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.gst_no && p.gst_no.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : purchases;

  return (
    <>
      {notification && (
        <div
          className="error-banner"
          style={{ background: "#1c5eb6", color: "#ffffff", borderColor: "#154d8c" }}
        >
          <span>{notification}</span>
          <button onClick={() => setNotification(null)}>X</button>
        </div>
      )}

      {pendingImports.length > 0 && (
        <section
          className="card list-card"
          style={{
            marginBottom: "14px",
            padding: "10px 14px",
            borderLeft: "4px solid #2563eb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#0f172a" }}>
              AI Bill Imports ({pendingImports.length} Pending Review)
            </h3>
          </div>

          <div className="table-responsive" style={{ marginTop: "8px" }}>
            <table className="product-table" style={{ margin: 0, fontSize: "0.84rem" }}>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingImports.map((imp) => (
                  <tr key={imp.id}>
                    <td className="font-semibold">{imp.invoice_no}</td>
                    <td>{imp.supplier_name}</td>
                    <td>{imp.purchase_date}</td>
                    <td>{imp.items.length} items</td>
                    <td className="price-tag">₹{imp.total_amount.toFixed(2)}</td>
                    <td style={{ color: "#475569" }}>{imp.source_note || "AI Bill Scan"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn primary-btn"
                          style={{ padding: "3px 10px", fontSize: "0.8rem" }}
                          onClick={() => setReviewingImport(imp)}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          className="btn secondary-btn"
                          style={{ padding: "3px 8px", fontSize: "0.8rem" }}
                          onClick={async () => {
                            await dismissAiBillImport(imp.id);
                            loadData(true);
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Stock Purchase Directory ({purchases.length})</h2>
          <div className="list-actions">
            <input
              type="text"
              className="search-input"
              placeholder="Search supplier, invoice no, GST..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="btn secondary-btn"
              onClick={() => setIsManageSuppliersOpen(true)}
            >
              Manage Suppliers
            </button>
            <button
              className="btn primary-btn"
              onClick={() => setIsAddModalOpen(true)}
            >
              + RECORD NEW PURCHASE
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading purchase records...</div>
        ) : (
          <PurchaseListTable
            purchases={filteredPurchases}
            searchTerm={searchQuery}
            onViewDetails={(id) => setSelectedDetailsId(id)}
          />
        )}
      </section>

      <AddPurchaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSavePurchase={createPurchase}
        onSaveSuccess={() => {
          showNotification("Purchase recorded successfully & inventory stock updated!");
          loadData();
        }}
      />

      <PurchaseDetailsModal
        purchaseId={selectedDetailsId}
        onClose={() => setSelectedDetailsId(null)}
      />

      <AiBillReviewModal
        billImport={reviewingImport}
        onClose={() => setReviewingImport(null)}
        onImported={(purchaseId) => {
          setReviewingImport(null);
          showNotification(`AI bill verified & imported as Purchase #${purchaseId}!`);
          loadData();
        }}
      />

      <ManageSuppliersModal
        isOpen={isManageSuppliersOpen}
        onClose={() => setIsManageSuppliersOpen(false)}
      />
    </>
  );
};
