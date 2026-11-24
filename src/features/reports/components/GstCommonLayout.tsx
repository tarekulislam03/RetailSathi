import React from "react";
import {
  BreadcrumbItem,
  GstStoreHeader,
  PeriodMode,
  ReconciliationSummary,
} from "../types/gstTallyTypes";

interface GstCommonLayoutProps {
  store: GstStoreHeader;
  reportTitle: string;
  periodLabel: string;
  periodMode: PeriodMode;
  onPeriodModeChange: (mode: PeriodMode) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
  counters: string[];
  selectedCounter: string;
  onCounterChange: (counter: string) => void;
  breadcrumbs: BreadcrumbItem[];
  onNavigateBreadcrumb: (index: number) => void;
  onExportPdf: () => void;
  onPrint: () => void;
  exportingPdf: boolean;
  loading: boolean;
  reconciliation: ReconciliationSummary;
  children: React.ReactNode;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = [
  { id: "Q1", label: "Q1 (Apr - Jun)", startMonth: "04", endMonth: "06", endDay: "30", fyOffset: 0 },
  { id: "Q2", label: "Q2 (Jul - Sep)", startMonth: "07", endMonth: "09", endDay: "30", fyOffset: 0 },
  { id: "Q3", label: "Q3 (Oct - Dec)", startMonth: "10", endMonth: "12", endDay: "31", fyOffset: 0 },
  { id: "Q4", label: "Q4 (Jan - Mar)", startMonth: "01", endMonth: "03", endDay: "31", fyOffset: 1 },
];

export const GstCommonLayout: React.FC<GstCommonLayoutProps> = ({
  store,
  reportTitle,
  periodLabel,
  periodMode,
  onPeriodModeChange,
  startDate,
  endDate,
  onDateRangeChange,
  counters,
  selectedCounter,
  onCounterChange,
  breadcrumbs,
  onNavigateBreadcrumb,
  onExportPdf,
  onPrint,
  exportingPdf,
  loading,
  reconciliation,
  children,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Infer selected month / quarter from startDate
  const selectedYear = startDate ? startDate.slice(0, 4) : String(currentYear);
  const selectedMonth = startDate && periodMode === "month" ? startDate.slice(5, 7) : "";

  const handleMonthPick = (month: string, year: string) => {
    if (!month) {
      onDateRangeChange("", "");
      return;
    }
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    onDateRangeChange(`${year}-${month}-01`, `${year}-${month}-${String(lastDay).padStart(2, "0")}`);
  };

  const handleQuarterPick = (qId: string, fyStartYear: number) => {
    const q = QUARTERS.find((item) => item.id === qId);
    if (!q) return;
    const yr = fyStartYear + q.fyOffset;
    onDateRangeChange(`${yr}-${q.startMonth}-01`, `${yr}-${q.endMonth}-${q.endDay}`);
  };

  const hasDiff =
    Math.abs(reconciliation.diffTaxable) > 0.01 ||
    Math.abs(reconciliation.diffTax) > 0.01 ||
    Math.abs(reconciliation.diffTotal) > 0.01;

  return (
    <div
      className="gst-report-container"
      style={{
        padding: "14px 18px",
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
        background: "#f8fafc",
        color: "#000000",
      }}
    >
      <style>{`
        @media print {
          .no-print, .sidebar { display: none !important; }
          .gst-report-container { padding: 0 !important; background: #fff !important; }
          table { border-collapse: collapse !important; width: 100% !important; font-size: 8pt !important; }
          th, td { border: 1px solid #000 !important; padding: 3px 5px !important; }
        }
        .gst-clickable-row:hover {
          background-color: #eef6ff !important;
          cursor: pointer;
        }
        .gst-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      {/* Common Header */}
      <div
        style={{
          background: "#ffffff",
          border: "1.5px solid #000000",
          borderRadius: "4px",
          padding: "12px 16px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#444444" }}>
              {store.name.toUpperCase()} &nbsp;|&nbsp; GSTIN: <strong>{store.gstin || "Not Set"}</strong> &nbsp;|&nbsp; State:{" "}
              <strong>{store.stateCode ? `${store.stateCode} - ${store.stateName}` : store.stateName}</strong>
            </div>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "4px 0 2px 0", color: "#000000" }}>
              {reportTitle}
            </h1>
            <div style={{ fontSize: "0.76rem", color: "#555555" }}>
              Period: <strong>{periodLabel}</strong> &nbsp;|&nbsp; Counter:{" "}
              <strong>{selectedCounter === "ALL" ? "All Counters" : selectedCounter}</strong>
            </div>
          </div>

          <div className="no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={loading || exportingPdf}
              style={{
                background: "#000000",
                color: "#ffffff",
                border: "1px solid #000000",
                padding: "7px 14px",
                fontWeight: 700,
                fontSize: "0.8rem",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              {exportingPdf ? "Exporting PDF..." : "Export PDF"}
            </button>
            <button
              type="button"
              onClick={onPrint}
              disabled={loading}
              style={{
                background: "#ffffff",
                color: "#000000",
                border: "1.5px solid #000000",
                padding: "7px 12px",
                fontWeight: 700,
                fontSize: "0.8rem",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Print
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          className="no-print"
          style={{
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #dddddd",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            fontSize: "0.78rem",
          }}
        >
          {/* Period Mode */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontWeight: 700 }}>Period:</span>
            {(["month", "quarter", "custom"] as PeriodMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onPeriodModeChange(mode)}
                style={{
                  padding: "4px 9px",
                  border: "1px solid #000000",
                  borderRadius: "2px",
                  background: periodMode === mode ? "#000000" : "#ffffff",
                  color: periodMode === mode ? "#ffffff" : "#000000",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  textTransform: "capitalize",
                  cursor: "pointer",
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {periodMode === "month" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthPick(e.target.value, selectedYear)}
                style={{ height: "28px", border: "1px solid #000000", padding: "0 6px", fontSize: "0.78rem" }}
              >
                <option value="">All Months</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={String(idx + 1).padStart(2, "0")}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => handleMonthPick(selectedMonth || "01", e.target.value)}
                style={{ height: "28px", border: "1px solid #000000", padding: "0 6px", fontSize: "0.78rem" }}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodMode === "quarter" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {QUARTERS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleQuarterPick(q.id, currentYear)}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #666666",
                    borderRadius: "2px",
                    background: "#f8fafc",
                    color: "#000000",
                    fontWeight: 600,
                    fontSize: "0.73rem",
                    cursor: "pointer",
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {periodMode === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontWeight: 700 }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateRangeChange(e.target.value, endDate)}
                style={{ height: "28px", border: "1px solid #000000", padding: "0 6px", fontSize: "0.78rem" }}
              />
              <label style={{ fontWeight: 700 }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateRangeChange(startDate, e.target.value)}
                style={{ height: "28px", border: "1px solid #000000", padding: "0 6px", fontSize: "0.78rem" }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => onDateRangeChange("", "")}
            style={{
              padding: "4px 8px",
              border: "1px solid #888888",
              borderRadius: "2px",
              background: "#ffffff",
              color: "#333333",
              fontSize: "0.73rem",
              cursor: "pointer",
            }}
          >
            All Time
          </button>

          {/* Counter Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
            <label style={{ fontWeight: 700 }}>Counter:</label>
            <select
              value={selectedCounter}
              onChange={(e) => onCounterChange(e.target.value)}
              style={{ height: "28px", border: "1px solid #000000", padding: "0 8px", fontSize: "0.78rem" }}
            >
              <option value="ALL">All</option>
              {counters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "10px",
          fontSize: "0.78rem",
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          padding: "6px 12px",
          borderRadius: "3px",
        }}
      >
        {breadcrumbs.map((bc, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${bc.page}-${idx}`}>
              {idx > 0 && <span style={{ color: "#64748b" }}>&gt;</span>}
              {isLast ? (
                <span style={{ fontWeight: 800, color: "#000000" }}>{bc.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateBreadcrumb(idx)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#1d4ed8",
                    textDecoration: "underline",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                  }}
                >
                  {bc.label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Page Content */}
      <div style={{ marginBottom: "14px" }}>{children}</div>

      {/* Reconciliation Block (Common to ALL Pages at the bottom) */}
      <div
        style={{
          background: "#ffffff",
          border: hasDiff ? "2px solid #b91c1c" : "1.5px solid #000000",
          borderRadius: "4px",
          padding: "10px 14px",
        }}
      >
        <div
          style={{
            fontSize: "0.78rem",
            fontWeight: 800,
            textTransform: "uppercase",
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Reconciliation: Books Total vs Return Total</span>
          {hasDiff ? (
            <span style={{ color: "#b91c1c" }}>DIFFERENCE DETECTED</span>
          ) : (
            <span style={{ color: "#15803d" }}>RECONCILED (0.00 DIFF)</span>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "left" }}>Particulars</th>
              <th style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "right" }}>Total Tax (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "right" }}>Invoice Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 600 }}>As per Books</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.booksTaxable.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.booksTax.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.booksTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 600 }}>Included in Return</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.returnTaxable.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.returnTax.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.returnTotal.toFixed(2)}</td>
            </tr>
            <tr style={{ background: hasDiff ? "#fee2e2" : "#f8fafc", color: hasDiff ? "#991b1b" : "#000000", fontWeight: 800 }}>
              <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>Difference (Books - Return)</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.diffTaxable.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.diffTax.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{reconciliation.diffTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
