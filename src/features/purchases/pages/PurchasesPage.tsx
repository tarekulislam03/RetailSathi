import React, { useState, useEffect } from "react";
import { Purchase } from "../types";
import {
  getAllPurchases,
  createPurchase,
} from "../services/purchaseService";
import { PurchaseListTable } from "../components/PurchaseListTable";
import { AddPurchaseModal } from "../components/AddPurchaseModal";
import { PurchaseDetailsModal } from "../components/PurchaseDetailsModal";
import { ManageSuppliersModal } from "../components/ManageSuppliersModal";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageSuppliersOpen, setIsManageSuppliersOpen] = useState(false);
  const [selectedDetailsId, setSelectedDetailsId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await getAllPurchases();
      setPurchases(list);
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

      <ManageSuppliersModal
        isOpen={isManageSuppliersOpen}
        onClose={() => setIsManageSuppliersOpen(false)}
      />
    </>
  );
};
