import React, { useEffect, useState } from "react";
import { MarketingPerson, MarketingSaleRecord } from "../types";
import { fetchMarketingPersonSales } from "../services/marketingService";
import { MonthYearPicker } from "./MonthYearPicker";
import { Pagination } from "../../../components/common/Pagination";

interface MarketingDetailsModalProps {
  person: MarketingPerson | null;
  isOpen: boolean;
  onClose: () => void;
  initialMonth?: string;
}

export const MarketingDetailsModal: React.FC<MarketingDetailsModalProps> = ({
  person,
  isOpen,
  onClose,
  initialMonth,
}) => {
  const [salesRecords, setSalesRecords] = useState<MarketingSaleRecord[]>([]);
  const [fetchedPerson, setFetchedPerson] = useState<MarketingPerson | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonth) return initialMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    if (isOpen && initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [isOpen, initialMonth]);

  useEffect(() => {
    if (isOpen && person) {
      loadSalesHistory(person.id, selectedMonth);
    } else {
      setFetchedPerson(null);
      setSalesRecords([]);
    }
  }, [isOpen, person?.id, selectedMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [salesRecords]);

  async function loadSalesHistory(personId: number, monthStr: string) {
    try {
      setLoading(true);
      const res = await fetchMarketingPersonSales(personId, monthStr);
      if (res.person) {
        setFetchedPerson(res.person);
      }
      setSalesRecords(res.sales);
    } catch (err) {
      console.error("Failed to load marketing sales history:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !person) return null;

  const personData = fetchedPerson || person;

  const monthSalesCompleted = salesRecords.reduce(
    (acc, s) => acc + s.grand_total,
    0
  );
  const monthCommissionEarned = (monthSalesCompleted * personData.commission) / 100;

  const lifetimeSales = personData.lifetime_sales ?? personData.sales ?? 0;
  const lifetimeCommission =
    personData.lifetime_commission ?? (lifetimeSales * personData.commission) / 100;

  const totalItems = salesRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedSales = salesRecords.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "720px", width: "95%" }}
      >
        <div className="modal-header">
          <div>
            <h2>Personnel Details: {personData.name}</h2>
            <div className="hint-text">
              {personData.phone ? `Phone: ${personData.phone}` : "No phone"}{" "}
              {personData.area ? `| Area: ${personData.area}` : ""} | Commission Rate: {personData.commission}%
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {/* Lifetime & Monthly Metrics Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            margin: "12px 0",
          }}
        >
          <div
            style={{
              background: "linear-gradient(to bottom, #ffffff 0%, #f0f4f9 100%)",
              border: "1px solid #7092be",
              padding: "10px 14px",
              borderRadius: "3px",
            }}
          >
            <div
              style={{
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#1a385c",
                marginBottom: "4px",
              }}
            >
              LIFETIME METRICS
            </div>
            <div style={{ fontSize: "0.85rem", color: "#333", marginBottom: "2px" }}>
              Completed Sales:{" "}
              <strong style={{ color: "#0d5c3a" }}>
                ₹{lifetimeSales.toFixed(2)}
              </strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#333" }}>
              Earned Commission ({personData.commission}%):{" "}
              <strong style={{ color: "#103c6b" }}>
                ₹{lifetimeCommission.toFixed(2)}
              </strong>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(to bottom, #ffffff 0%, #e8f4ea 100%)",
              border: "1px solid #a8dab5",
              padding: "10px 14px",
              borderRadius: "3px",
            }}
          >
            <div
              style={{
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#137333",
                marginBottom: "4px",
              }}
            >
              SELECTED MONTH METRICS ({selectedMonth})
            </div>
            <div style={{ fontSize: "0.85rem", color: "#333", marginBottom: "2px" }}>
              Completed Sales:{" "}
              <strong style={{ color: "#0d5c3a" }}>
                ₹{monthSalesCompleted.toFixed(2)}
              </strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#333" }}>
              Earned Commission ({personData.commission}%):{" "}
              <strong style={{ color: "#103c6b" }}>
                ₹{monthCommissionEarned.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Filter bar for Month */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "12px 0 8px",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", color: "#103c6b", margin: 0 }}>
            Sales History Breakdown ({salesRecords.length})
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label
              style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a385c" }}
            >
              Select Month:
            </label>
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              idPrefix="modal-mkt"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: "20px" }}>
            Loading sales history...
          </div>
        ) : salesRecords.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 10px" }}>
            No sales recorded for this personnel in the selected month ({selectedMonth}).
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ maxHeight: "260px" }}>
              <table className="product-table">
                <thead>
                  <tr>
                    <th>INVOICE NO</th>
                    <th>DATE & TIME</th>
                    <th>CUSTOMER</th>
                    <th>PAYMENT</th>
                    <th>SALE AMOUNT</th>
                    <th>COMMISSION ({personData.commission}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700, color: "#103c6b" }}>
                        {s.invoice_no}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "#3b5370" }}>
                        {s.created_at || "—"}
                      </td>
                      <td>
                        <div>{s.customer_name}</div>
                        {s.customer_phone && (
                          <div style={{ fontSize: "0.75rem", color: "#666" }}>
                            {s.customer_phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="barcode-tag">{s.payment_mode}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#0d5c3a" }}>
                          ₹{s.grand_total.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#103c6b" }}>
                          ₹{s.commission_earned.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </>
        )}

        <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: "14px" }}>
          <button type="button" className="btn secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
