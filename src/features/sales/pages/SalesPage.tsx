import React, { useEffect, useState } from "react";
import { Sale } from "../../billing/types";
import { fetchSaleDetails } from "../../billing/services/billingService";
import {
  fetchSalesWithItems,
  SalesAnalytics,
} from "../services/salesService";
import { SalesKpiGrid } from "../components/SalesKpiGrid";
import { SalesTable } from "../components/SalesTable";
import { ReceiptModal } from "../../billing/components/ReceiptModal";
import { ManageGstModal } from "../components/ManageGstModal";
import { ManageSalesProfitModal } from "../components/ManageSalesProfitModal";
import { EditSaleModal } from "../components/EditSaleModal";
import { DeleteSaleModal } from "../components/DeleteSaleModal";

export const SalesPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    todaySales: 0,
    monthlySales: 0,
    todayGst: 0,
    monthlyGst: 0,
    totalGst: 0,
    monthlyProfit: 0,
    totalProfit: 0,
    todayOrdersCount: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Edit and Delete modal states
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Report Modal States
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [isSalesProfitModalOpen, setIsSalesProfitModalOpen] = useState(false);

  async function loadSalesData() {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSalesWithItems();
      setSales(result.sales);
      setAnalytics(result.analytics);
    } catch (err: any) {
      setError(err?.message || "Failed to load sales analytics & history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalesData();
  }, []);

  async function handleViewInvoice(saleId: number) {
    try {
      const details = await fetchSaleDetails(saleId);
      if (details) {
        setSelectedSale(details);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch invoice receipt.");
    }
  }

  async function handleEditSale(sale: Sale) {
    try {
      if (!sale.items || sale.items.length === 0) {
        const details = await fetchSaleDetails(sale.id);
        if (details) {
          setEditingSale(details);
          return;
        }
      }
      setEditingSale(sale);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch sale details for edit.");
    }
  }

  function handleDeleteSale(sale: Sale) {
    setDeletingSale(sale);
  }

  function toYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function handlePresetToday() {
    const today = toYMD(new Date());
    setStartDate(today);
    setEndDate(today);
  }

  function handlePresetYesterday() {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = toYMD(yest);
    setStartDate(yestStr);
    setEndDate(yestStr);
  }

  function handlePresetThisMonth() {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    setStartDate(firstDay);
    setEndDate(toYMD(now));
  }

  function handleClearFilters() {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  }

  // Filter Sales Logic
  const filteredSales = sales.filter((s) => {
    // Search Query Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchInvoice = s.invoice_no.toLowerCase().includes(q);
      const matchCustomer = (s.customer_name || "").toLowerCase().includes(q);
      const matchPhone = (s.customer_phone || "").toLowerCase().includes(q);
      const matchMode = (s.payment_mode || "").toLowerCase().includes(q);
      if (!matchInvoice && !matchCustomer && !matchPhone && !matchMode) {
        return false;
      }
    }

    // Date Range Filter
    const dateStr = s.created_at || "";
    if (startDate) {
      const startMs = new Date(startDate + "T00:00:00").getTime();
      const saleMs = new Date(dateStr).getTime() || Date.parse(dateStr);
      if (saleMs && saleMs < startMs) return false;
    }

    if (endDate) {
      const endMs = new Date(endDate + "T23:59:59.999").getTime();
      const saleMs = new Date(dateStr).getTime() || Date.parse(dateStr);
      if (saleMs && saleMs > endMs) return false;
    }

    return true;
  });

  const filteredTotalRevenue = filteredSales.reduce(
    (sum, s) => sum + s.grand_total,
    0
  );

  const filteredTotalGst = filteredSales.reduce(
    (sum, s) => sum + (s.tax_amount || 0),
    0
  );

  const isFiltered = Boolean(searchTerm || startDate || endDate);

  return (
    <>
      {/* Sales Analytics KPI Grid */}
      <SalesKpiGrid analytics={analytics} />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      {/* Sales Transactions Directory */}
      <section className="card list-card">
        <div className="list-header" style={{ flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2>Sales History ({filteredSales.length})</h2>
            {isFiltered && (
              <div style={{ fontSize: "0.78rem", color: "#104175", fontWeight: 600, marginTop: "2px" }}>
                Filtered Revenue: ₹{filteredTotalRevenue.toFixed(2)} | GST Collected: ₹{filteredTotalGst.toFixed(2)}
              </div>
            )}
          </div>

          <div className="list-actions" style={{ gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search invoice no, customer, phone, mode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: "220px" }}
            />

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                onClick={handlePresetToday}
                title="Filter for Today's Sales"
              >
                Today
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                onClick={handlePresetYesterday}
                title="Filter for Yesterday's Sales"
              >
                Yesterday
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                onClick={handlePresetThisMonth}
                title="Filter for Current Month's Sales"
              >
                This Month
              </button>
            </div>

            {/* Date Pickers */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label htmlFor="salesFromDate" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1a385c" }}>
                From:
              </label>
              <input
                id="salesFromDate"
                type="date"
                className="search-input"
                style={{ width: "130px", height: "30px", padding: "2px 6px" }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label htmlFor="salesToDate" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1a385c" }}>
                To:
              </label>
              <input
                id="salesToDate"
                type="date"
                className="search-input"
                style={{ width: "130px", height: "30px", padding: "2px 6px" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {isFiltered && (
              <button
                type="button"
                className="btn secondary-btn"
                onClick={handleClearFilters}
                style={{ padding: "3px 8px", fontSize: "0.78rem" }}
              >
                Clear Filters
              </button>
            )}

            {/* Management Buttons */}
            <button
              type="button"
              className="btn primary-btn"
              onClick={() => setIsGstModalOpen(true)}
            >
              Manage GST
            </button>
            <button
              type="button"
              className="btn primary-btn"
              onClick={() => setIsSalesProfitModalOpen(true)}
            >
              Manage Sales & Profit
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading sales analytics & transactions...</div>
        ) : filteredSales.length === 0 ? (
          <div className="empty-state">
            {isFiltered
              ? "No sales found for the selected search or date range filter."
              : "No sales completed yet. Go to POS / Billing to create your first invoice!"}
          </div>
        ) : (
          <SalesTable
            sales={filteredSales}
            onViewInvoice={handleViewInvoice}
            onEditSale={handleEditSale}
            onDeleteSale={handleDeleteSale}
          />
        )}
      </section>

      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {editingSale && (
        <EditSaleModal
          isOpen={Boolean(editingSale)}
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaleUpdated={loadSalesData}
        />
      )}

      {deletingSale && (
        <DeleteSaleModal
          isOpen={Boolean(deletingSale)}
          sale={deletingSale}
          onClose={() => setDeletingSale(null)}
          onSaleDeleted={loadSalesData}
        />
      )}

      <ManageGstModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        sales={sales}
      />

      <ManageSalesProfitModal
        isOpen={isSalesProfitModalOpen}
        onClose={() => setIsSalesProfitModalOpen(false)}
        sales={sales}
      />
    </>
  );
};

