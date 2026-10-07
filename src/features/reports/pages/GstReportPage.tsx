import React, { useEffect, useState } from "react";
import {
  fetchGstReportData,
  exportGstReportToExcel,
  exportGstReportToPdf,
} from "../services/gstReportService";
import { GstReportData } from "../types";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const GstReportPage: React.FC = () => {
  const [reportData, setReportData] = useState<GstReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"summary" | "inward" | "outward" | "all">("summary");
  const [exporting, setExporting] = useState<string | null>(null);

  async function loadReport(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await fetchGstReportData({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setReportData(data);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load GST report:", err);
        setError(err?.message || "Failed to generate GST report data.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadReport(true), 4000);

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  // Date Range Quick Preset Handlers
  const handleSetPreset = (preset: "today" | "this_month" | "last_month" | "this_fy" | "all") => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "this_month") {
      const firstDay = `${yyyy}-${mm}-01`;
      const lastDayDate = new Date(yyyy, now.getMonth() + 1, 0);
      const lastDay = `${yyyy}-${mm}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "last_month") {
      const lastMonthDate = new Date(yyyy, now.getMonth() - 1, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = String(lastMonthDate.getMonth() + 1).padStart(2, "0");
      const lmFirstDay = `${lmYear}-${lmMonth}-01`;
      const lmLastDayDate = new Date(lmYear, lastMonthDate.getMonth() + 1, 0);
      const lmLastDay = `${lmYear}-${lmMonth}-${String(lmLastDayDate.getDate()).padStart(2, "0")}`;
      setStartDate(lmFirstDay);
      setEndDate(lmLastDay);
    } else if (preset === "this_fy") {
      // Indian Financial Year: April 1 to March 31
      const fyStartYear = now.getMonth() >= 3 ? yyyy : yyyy - 1;
      const fyEndYear = fyStartYear + 1;
      setStartDate(`${fyStartYear}-04-01`);
      setEndDate(`${fyEndYear}-03-31`);
    }
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);
  const [pickedYear, setPickedYear] = useState<string>(String(currentYear));

  // Month is "selected" only when the date range is exactly one full calendar month
  const monthMatch = /^(\d{4})-(\d{2})-01$/.exec(startDate);
  let selectedMonth = "";
  let selectedYear = pickedYear;
  if (monthMatch && endDate) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    const lastDay = new Date(y, m, 0).getDate();
    if (endDate === `${monthMatch[1]}-${monthMatch[2]}-${String(lastDay).padStart(2, "0")}`) {
      selectedMonth = monthMatch[2];
      selectedYear = monthMatch[1];
    }
  }

  const handleSelectMonth = (month: string, year: string) => {
    setPickedYear(year);
    if (!month) {
      setStartDate("");
      setEndDate("");
      return;
    }
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    setStartDate(`${year}-${month}-01`);
    setEndDate(`${year}-${month}-${String(lastDay).padStart(2, "0")}`);
  };

  const monthFileLabel = selectedMonth
    ? `${MONTH_NAMES[Number(selectedMonth) - 1]}_${selectedYear}`
    : "";

  const handleExportExcel = async () => {
    if (!reportData) return;
    try {
      setExporting("excel");
      const res = await exportGstReportToExcel(
        reportData,
        monthFileLabel ? `GST_Report_${monthFileLabel}.xlsx` : undefined
      );
      if (res.filePath) {
        alert(`Excel report exported successfully!\n\nSaved to: ${res.filePath}`);
      } else {
        alert("Excel report generated and downloaded successfully!");
      }
    } catch (err: any) {
      console.error("Export Excel error:", err);
      alert("Failed to export Excel report: " + (err?.message || err));
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!reportData) return;
    try {
      setExporting("pdf");
      const res = await exportGstReportToPdf(
        reportData,
        monthFileLabel ? `GST_Report_${monthFileLabel}.pdf` : undefined
      );
      if (res.filePath) {
        alert(`PDF report exported successfully!\n\nSaved to: ${res.filePath}`);
      } else {
        alert("PDF report generated and downloaded successfully!");
      }
    } catch (err: any) {
      console.error("Export PDF error:", err);
      alert("Failed to export PDF report: " + (err?.message || err));
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter items based on search term
  const query = searchTerm.toLowerCase().trim();
  const filteredInward = reportData?.inwardItems.filter((i) => {
    if (!query) return true;
    return (
      i.product_name.toLowerCase().includes(query) ||
      i.barcode.toLowerCase().includes(query) ||
      i.invoice_no.toLowerCase().includes(query) ||
      i.supplier_name.toLowerCase().includes(query) ||
      i.hsn_code.toLowerCase().includes(query)
    );
  }) || [];

  const filteredOutward = reportData?.outwardItems.filter((i) => {
    if (!query) return true;
    return (
      i.product_name.toLowerCase().includes(query) ||
      i.barcode.toLowerCase().includes(query) ||
      i.invoice_no.toLowerCase().includes(query) ||
      i.customer_name.toLowerCase().includes(query) ||
      i.hsn_code.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div
      className="gst-report-container"
      style={{
        padding: "16px 20px",
        height: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Scrollbar & Print Specific Styles */}
      <style>{`
        .gst-report-container::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .gst-report-container::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .gst-report-container::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }
        .gst-report-container::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
        .gst-report-container .table-responsive::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .gst-report-container .table-responsive::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .gst-report-container .table-responsive::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8pt !important;
          }
          .sidebar, .nav-item, .no-print, .list-actions, button, .date-presets {
            display: none !important;
          }
          .card, .gst-report-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 7.5pt !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 2px 4px !important;
            color: #000000 !important;
          }
          th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div
        className="card no-print"
        style={{
          padding: "16px 20px",
          marginBottom: "16px",
          border: "1px solid #000000",
          borderRadius: "4px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "#000000",
                margin: "0 0 4px 0",
                letterSpacing: "0.5px",
              }}
            >
              GST COMPLIANCE & STOCK MOVEMENT REGISTER
            </h1>
            <div style={{ fontSize: "0.82rem", color: "#333333" }}>
              Official Black & White Audit Report — Complete Stock IN (Purchases) & Stock OUT (Sales) Ledger
            </div>
            {reportData && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#555555",
                  marginTop: "6px",
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <span>Store: <strong>{reportData.store.name}</strong></span>
                <span>GSTIN: <strong>{reportData.store.gstin || "N/A"}</strong></span>
                <span>Report Date: <strong>{reportData.generatedAt}</strong></span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              onClick={handleExportExcel}
              disabled={loading || !reportData || exporting === "excel"}
              style={{
                background: "#000000",
                color: "#ffffff",
                border: "1px solid #000000",
                fontWeight: 700,
                fontSize: "0.82rem",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              {exporting === "excel" ? "Generating Excel..." : "📊 Export Excel (.xlsx)"}
            </button>

            <button
              type="button"
              className="btn"
              onClick={handleExportPdf}
              disabled={loading || !reportData || exporting === "pdf"}
              style={{
                background: "#ffffff",
                color: "#000000",
                border: "1.5px solid #000000",
                fontWeight: 700,
                fontSize: "0.82rem",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              {exporting === "pdf" ? "Rendering PDF..." : "📄 Download PDF (B&W)"}
            </button>

            <button
              type="button"
              className="btn"
              onClick={handlePrint}
              disabled={loading || !reportData}
              style={{
                background: "#f4f4f4",
                color: "#000000",
                border: "1px solid #666666",
                fontWeight: 600,
                fontSize: "0.82rem",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              🖨️ Print Report
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid #cccccc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Month Selector (by month name) */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#000000" }}>Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => handleSelectMonth(e.target.value, selectedYear)}
              style={{ height: "30px", fontSize: "0.8rem", padding: "2px 6px", border: "1px solid #000000", borderRadius: "2px" }}
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleSelectMonth(selectedMonth, e.target.value)}
              style={{ height: "30px", fontSize: "0.8rem", padding: "2px 6px", border: "1px solid #000000", borderRadius: "2px" }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Presets */}
          <div className="date-presets" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_fy", label: "Current FY" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSetPreset(p.id as any)}
                style={{
                  fontSize: "0.76rem",
                  padding: "4px 8px",
                  borderRadius: "3px",
                  border: "1px solid #777777",
                  background: "#ffffff",
                  color: "#000000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#000000" }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  height: "30px",
                  fontSize: "0.8rem",
                  padding: "2px 6px",
                  border: "1px solid #000000",
                  borderRadius: "2px",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#000000" }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  height: "30px",
                  fontSize: "0.8rem",
                  padding: "2px 6px",
                  border: "1px solid #000000",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search product, barcode, party, inv #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: "30px",
                width: "220px",
                fontSize: "0.8rem",
                padding: "2px 8px",
                border: "1px solid #000000",
                borderRadius: "2px",
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            border: "1px solid #000000",
            borderRadius: "3px",
            background: "#fff0f0",
            color: "#990000",
            marginBottom: "14px",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      {loading && !reportData ? (
        <div style={{ padding: "40px", textAlign: "center", fontSize: "0.95rem" }}>
          Generating GST report & calculating stock registers...
        </div>
      ) : reportData ? (
        <>
          {/* Audit Summary KPI Tiles (Professional B&W) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            {/* Tile 1: Net GST Liability */}
            <div
              style={{
                border: "2px solid #000000",
                borderRadius: "3px",
                padding: "12px 14px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#555555", textTransform: "uppercase" }}>
                {reportData.summary.netGstPayable >= 0 ? "Net GST Tax Payable" : "Input Tax Credit (ITC) Balance"}
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#000000", margin: "4px 0" }}>
                ₹{Math.abs(reportData.summary.netGstPayable).toFixed(2)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#666666" }}>
                CGST: ₹{Math.abs(reportData.summary.netCgstPayable).toFixed(2)} | SGST: ₹{Math.abs(reportData.summary.netSgstPayable).toFixed(2)}
              </div>
            </div>

            {/* Tile 2: Output GST (Sales) */}
            <div
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "12px 14px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#555555", textTransform: "uppercase" }}>
                Output Tax Liability (Stock OUT)
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#000000", margin: "4px 0" }}>
                ₹{reportData.summary.totalOutwardGst.toFixed(2)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#666666" }}>
                Taxable: ₹{reportData.summary.totalOutwardTaxable.toFixed(2)} | Qty: {reportData.summary.totalOutwardQty}
              </div>
            </div>

            {/* Tile 3: Input Tax Credit (Purchases) */}
            <div
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "12px 14px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#555555", textTransform: "uppercase" }}>
                Input Tax Credit (Stock IN)
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#000000", margin: "4px 0" }}>
                ₹{reportData.summary.totalInwardGst.toFixed(2)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#666666" }}>
                Taxable: ₹{reportData.summary.totalInwardTaxable.toFixed(2)} | Qty: {reportData.summary.totalInwardQty}
              </div>
            </div>

            {/* Tile 4: Stock Movement Delta */}
            <div
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "12px 14px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#555555", textTransform: "uppercase" }}>
                Stock Movements Qty Delta
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#000000", margin: "4px 0" }}>
                {reportData.summary.totalInwardQty - reportData.summary.totalOutwardQty > 0 ? "+" : ""}
                {reportData.summary.totalInwardQty - reportData.summary.totalOutwardQty} units
              </div>
              <div style={{ fontSize: "0.72rem", color: "#666666" }}>
                IN: {reportData.summary.totalInwardQty} units | OUT: {reportData.summary.totalOutwardQty} units
              </div>
            </div>
          </div>

          {/* Section Tabs (Screen only) */}
          <div
            className="no-print"
            style={{
              display: "flex",
              borderBottom: "2px solid #000000",
              marginBottom: "14px",
              gap: "4px",
            }}
          >
            {[
              { id: "summary", label: "Overview & Tax Reconciliation" },
              { id: "inward", label: `Stock IN - Purchases (${filteredInward.length})` },
              { id: "outward", label: `Stock OUT - Sales (${filteredOutward.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "8px 16px",
                  fontSize: "0.82rem",
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  border: "1px solid #000000",
                  borderBottom: activeTab === tab.id ? "2px solid #ffffff" : "1px solid #000000",
                  marginBottom: activeTab === tab.id ? "-2px" : "0",
                  background: activeTab === tab.id ? "#ffffff" : "#eeeeee",
                  color: "#000000",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: SUMMARY TABLE */}
          {(activeTab === "summary" || typeof window !== "undefined") && (
            <div
              className={`card ${activeTab !== "summary" ? "print-only" : ""}`}
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "14px",
                marginBottom: "16px",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#000000",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000000",
                  paddingBottom: "4px",
                }}
              >
                1. TAX LIABILITY & STOCK AUDIT RECONCILIATION SUMMARY
              </div>

              <div className="table-responsive">
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.78rem",
                    color: "#000000",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f2f2f2" }}>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "left" }}>
                        SUPPLY / MOVEMENT CATEGORY
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "center" }}>
                        TOTAL QTY
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        TAXABLE VALUE (₹)
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        CGST (₹)
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        SGST (₹)
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        TOTAL GST (₹)
                      </th>
                      <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        GROSS VALUE (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", fontWeight: 700 }}>
                        STOCK IN (Inward Purchases - ITC Eligible)
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "center" }}>
                        {reportData.summary.totalInwardQty}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalInwardTaxable.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalInwardCgst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalInwardSgst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                        ₹{reportData.summary.totalInwardGst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                        ₹{reportData.summary.totalInwardAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", fontWeight: 700 }}>
                        STOCK OUT (Outward Sales - Output Tax Liability)
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "center" }}>
                        {reportData.summary.totalOutwardQty}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalOutwardTaxable.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalOutwardCgst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.totalOutwardSgst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                        ₹{reportData.summary.totalOutwardGst.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                        ₹{reportData.summary.totalOutwardAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ background: "#f8f8f8", fontWeight: 800 }}>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px" }}>
                        {reportData.summary.netGstPayable >= 0
                          ? "NET GST PAYABLE (Output GST - Input Tax Credit)"
                          : "NET INPUT TAX CREDIT (ITC) BALANCE CARRY FORWARD"}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "center" }}>
                        -
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "right" }}>
                        ₹{(reportData.summary.totalOutwardTaxable - reportData.summary.totalInwardTaxable).toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.netCgstPayable.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.netSgstPayable.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "right" }}>
                        ₹{reportData.summary.netGstPayable.toFixed(2)}
                      </td>
                      <td style={{ border: "1px solid #000000", padding: "8px 8px", textAlign: "right" }}>
                        ₹{(reportData.summary.totalOutwardAmount - reportData.summary.totalInwardAmount).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INWARD PURCHASES REGISTER (STOCK IN) */}
          {(activeTab === "inward" || activeTab === "all" || typeof window !== "undefined") && (
            <div
              className={`card ${activeTab !== "inward" && activeTab !== "all" ? "print-only" : ""}`}
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "14px",
                marginBottom: "16px",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #000000",
                  paddingBottom: "4px",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}>
                  2. INWARD SUPPLIES REGISTER — STOCK IN (Purchases: {filteredInward.length} items)
                </span>
                <span style={{ fontSize: "0.76rem", color: "#555555" }}>
                  Total Inward Tax: ₹{reportData.summary.totalInwardGst.toFixed(2)}
                </span>
              </div>

              <div className="table-responsive" style={{ maxHeight: "420px", overflowY: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.74rem",
                    color: "#000000",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f2f2f2" }}>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>#</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>DATE</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>INV NO</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>SUPPLIER</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>GSTIN</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>PRODUCT DESCRIPTION</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>HSN</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>QTY</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>RATE (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>TAXABLE (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>GST%</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>CGST (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>SGST (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>TOTAL (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInward.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ border: "1px solid #000000", padding: "14px", textAlign: "center" }}>
                          No inward stock purchases found in the selected date range.
                        </td>
                      </tr>
                    ) : (
                      filteredInward.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #dddddd" }}>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.date}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px" }}>{item.invoice_no}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px" }}>{item.supplier_name}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.supplier_gstin}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.hsn_code || "-"}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.quantity}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.rate.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.taxable_value.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.gst_rate}%</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.cgst.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.sgst.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right", fontWeight: 700 }}>
                            {item.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredInward.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
                        <td colSpan={7} style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          TOTAL INWARD:
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>
                          {reportData.summary.totalInwardQty}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px" }}></td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalInwardTaxable.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px" }}></td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalInwardCgst.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalInwardSgst.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalInwardAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: OUTWARD SALES REGISTER (STOCK OUT) */}
          {(activeTab === "outward" || activeTab === "all" || typeof window !== "undefined") && (
            <div
              className={`card ${activeTab !== "outward" && activeTab !== "all" ? "print-only" : ""}`}
              style={{
                border: "1px solid #000000",
                borderRadius: "3px",
                padding: "14px",
                marginBottom: "16px",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #000000",
                  paddingBottom: "4px",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}>
                  3. OUTWARD SUPPLIES REGISTER — STOCK OUT (Sales: {filteredOutward.length} items)
                </span>
                <span style={{ fontSize: "0.76rem", color: "#555555" }}>
                  Total Output Tax: ₹{reportData.summary.totalOutwardGst.toFixed(2)}
                </span>
              </div>

              <div className="table-responsive" style={{ maxHeight: "420px", overflowY: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.74rem",
                    color: "#000000",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f2f2f2" }}>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>#</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>DATE</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>BILL NO</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>CUSTOMER</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "left" }}>PRODUCT DESCRIPTION</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>HSN</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>QTY</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>RATE (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>TAXABLE (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>GST%</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>CGST (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>SGST (₹)</th>
                      <th style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>TOTAL (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutward.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ border: "1px solid #000000", padding: "14px", textAlign: "center" }}>
                          No outward stock sales found in the selected date range.
                        </td>
                      </tr>
                    ) : (
                      filteredOutward.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #dddddd" }}>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.date}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px" }}>{item.invoice_no}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px" }}>{item.customer_name}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.hsn_code || "-"}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.quantity}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.rate.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.taxable_value.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "center" }}>{item.gst_rate}%</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.cgst.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right" }}>{item.sgst.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000000", padding: "3px 5px", textAlign: "right", fontWeight: 700 }}>
                            {item.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredOutward.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
                        <td colSpan={6} style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          TOTAL OUTWARD:
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>
                          {reportData.summary.totalOutwardQty}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px" }}></td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalOutwardTaxable.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px" }}></td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalOutwardCgst.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalOutwardSgst.toFixed(2)}
                        </td>
                        <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "right" }}>
                          {reportData.summary.totalOutwardAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
