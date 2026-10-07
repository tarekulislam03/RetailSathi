import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sale } from "../../billing/types";
import { Pagination } from "../../../components/common/Pagination";

interface ManageGstModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
}

export interface MonthlyGstRow {
  monthKey: string;
  monthLabel: string;
  invoiceCount: number;
  grossSales: number;
  taxableSales: number;
  totalGst: number;
  cgst: number;
  sgst: number;
}

export const ManageGstModal: React.FC<ManageGstModalProps> = ({
  isOpen,
  onClose,
  sales,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  // Group sales by month
  const monthlyMap: Record<string, MonthlyGstRow> = {};

  for (const s of sales) {
    let year = 0;
    let monthIdx = 0;

    const dateObj = s.created_at ? new Date(s.created_at) : null;
    if (dateObj && !isNaN(dateObj.getTime())) {
      year = dateObj.getFullYear();
      monthIdx = dateObj.getMonth();
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthIdx = now.getMonth();
    }

    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    const dateForLabel = new Date(year, monthIdx, 1);
    const monthLabel = dateForLabel.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        monthKey,
        monthLabel,
        invoiceCount: 0,
        grossSales: 0,
        taxableSales: 0,
        totalGst: 0,
        cgst: 0,
        sgst: 0,
      };
    }

    const gstVal = s.tax_amount || 0;
    const taxableVal = Math.max(0, s.grand_total - gstVal);

    monthlyMap[monthKey].invoiceCount += 1;
    monthlyMap[monthKey].grossSales += s.grand_total;
    monthlyMap[monthKey].taxableSales += taxableVal;
    monthlyMap[monthKey].totalGst += gstVal;
    monthlyMap[monthKey].cgst += gstVal / 2;
    monthlyMap[monthKey].sgst += gstVal / 2;
  }

  // Sort monthly rows descending by monthKey
  const allMonthlyRows = Object.values(monthlyMap).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey)
  );

  const filteredRows = searchTerm.trim()
    ? allMonthlyRows.filter((r) =>
        r.monthLabel.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        r.monthKey.includes(searchTerm.trim())
      )
    : allMonthlyRows;

  // Summary Metrics
  const totalAllTimeGst = allMonthlyRows.reduce((acc, r) => acc + r.totalGst, 0);
  const totalAllTimeTaxable = allMonthlyRows.reduce(
    (acc, r) => acc + r.taxableSales,
    0
  );

  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  const currentMonthGst = monthlyMap[currentMonthKey]?.totalGst || 0;

  // Pagination calculation
  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{ maxWidth: "860px", width: "95%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Manage GST & Monthly Tax Reports</h2>
            <div className="hint-text">
              Month-wise breakdown of taxable sales, GST collection, and tax liabilities
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div style={{ padding: "14px" }}>
          {/* Top Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #e8f4ea 100%)",
                border: "1px solid #a8dab5",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#137333" }}>
                CURRENT MONTH GST
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0d5c3a" }}>
                ₹{currentMonthGst.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #edf4fc 100%)",
                border: "1px solid #7092be",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1a385c" }}>
                TOTAL HISTORICAL GST
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#103c6b" }}>
                ₹{totalAllTimeGst.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #f4f8fc 100%)",
                border: "1px solid #b8cde4",
                padding: "10px 14px",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#3b5370" }}>
                TOTAL TAXABLE SALES
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#29486b" }}>
                ₹{totalAllTimeTaxable.toFixed(2)}
              </div>
            </div>
          </div>

          {/* List Action Bar */}
          <div
            className="list-header"
            style={{ marginBottom: "10px", flexWrap: "wrap" }}
          >
            <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#103c6b" }}>
              Monthly GST Ledger Records ({filteredRows.length} months)
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search month or year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "220px" }}
            />
          </div>

          {/* Table */}
          {filteredRows.length === 0 ? (
            <div className="empty-state" style={{ padding: "28px" }}>
              No monthly GST records found.
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: "320px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>MONTH & YEAR</th>
                      <th>INVOICES</th>
                      <th>GROSS SALES (₹)</th>
                      <th>TAXABLE VALUE (₹)</th>
                      <th>CGST [50%] (₹)</th>
                      <th>SGST [50%] (₹)</th>
                      <th>TOTAL GST COLLECTED (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => (
                      <tr key={r.monthKey}>
                        <td className="font-semibold">{r.monthLabel}</td>
                        <td>{r.invoiceCount} invoices</td>
                        <td>₹{r.grossSales.toFixed(2)}</td>
                        <td>₹{r.taxableSales.toFixed(2)}</td>
                        <td style={{ color: "#3b5370" }}>₹{r.cgst.toFixed(2)}</td>
                        <td style={{ color: "#3b5370" }}>₹{r.sgst.toFixed(2)}</td>
                        <td className="price-tag" style={{ color: "#103c6b" }}>
                          ₹{r.totalGst.toFixed(2)}
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

          <div
            className="form-actions"
            style={{ marginTop: "14px", justifyContent: "space-between", alignItems: "center" }}
          >
            <button
              type="button"
              className="btn primary-btn"
              onClick={() => {
                onClose();
                navigate("/gst-report");
              }}
              style={{ fontWeight: 700 }}
            >
              📊 Full GST & Stock In/Out Report (Excel & PDF)
            </button>

            <button className="btn secondary-btn" onClick={onClose}>
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
