import React from "react";
import { formatInr, GstCaPackData } from "../services/gstCaPackService";
import { GstRateSlabRow, GstVoucher } from "../types/gstTallyTypes";

interface GstCaPackViewProps {
  pack: GstCaPackData;
  amountThreshold: number;
  onThresholdChange: (val: number) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  exporting: string | null;
}

const PageCard: React.FC<{
  pageNum: number;
  title: string;
  pack: GstCaPackData;
  children: React.ReactNode;
}> = ({ pageNum, title, pack, children }) => (
  <div
    style={{
      background: "#ffffff",
      border: "1.5px solid #000000",
      borderRadius: "4px",
      padding: "14px 16px",
      marginBottom: "16px",
    }}
  >
    {/* Repeating Page Header */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1.5px solid #000000",
        paddingBottom: "6px",
        marginBottom: "10px",
        fontSize: "0.75rem",
      }}
    >
      <div>
        <strong>{pack.store.name.toUpperCase()}</strong> &nbsp;|&nbsp; GSTIN: <strong>{pack.store.gstin || "Not Set"}</strong>
      </div>
      <div>
        Period: <strong>{pack.periodLabel}</strong>
      </div>
    </div>

    <div style={{ fontSize: "0.86rem", fontWeight: 800, marginBottom: "8px" }}>{title}</div>
    {children}

    {/* Repeating Page Footer */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderTop: "1px solid #cbd5e1",
        paddingTop: "6px",
        marginTop: "10px",
        fontSize: "0.72rem",
        color: "#475569",
      }}
    >
      <span>Generated: {pack.generatedAt} | RetailSathi ERP</span>
      <span>Page {pageNum} of 13</span>
    </div>
  </div>
);

const RateTable: React.FC<{ title: string; rows: GstRateSlabRow[] }> = ({ title, rows }) => (
  <div style={{ marginBottom: "10px" }}>
    <div style={{ fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>{title}</div>
    <div className="table-responsive">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr style={{ background: "#f2f2f2" }}>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Rate (%)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Taxable (₹)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>CGST (₹)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>SGST (₹)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>IGST (₹)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cess (₹)</th>
            <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gstRate}>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{r.gstRate}%</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.taxableValue)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.cgst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.sgst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.igst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.cess)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(r.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>TOTAL</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.taxableValue, 0))}</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.cgst, 0))}</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.sgst, 0))}</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.igst, 0))}</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.cess, 0))}</td>
            <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, r) => a + r.totalAmount, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);

const VoucherTable: React.FC<{ rows: GstVoucher[]; partyLabel: string; emptyText: string }> = ({
  rows,
  partyLabel,
  emptyText,
}) => (
  <div className="table-responsive">
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
      <thead>
        <tr style={{ background: "#f2f2f2" }}>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Date</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>{partyLabel}</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>{partyLabel} GSTIN</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Invoice No</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Taxable (₹)</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>CGST (₹)</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>SGST (₹)</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>IGST (₹)</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cess (₹)</th>
          <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={10} style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{emptyText}</td>
          </tr>
        ) : (
          rows.map((v) => (
            <tr key={v.id}>
              <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{v.date}</td>
              <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{v.partyName}</td>
              <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{v.partyGstin || "-"}</td>
              <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{v.voucherNo}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(v.taxableValue)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(v.cgst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(v.sgst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(v.igst)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(v.cess)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(v.totalAmount)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
          <td colSpan={4} style={{ border: "1px solid #000", padding: "4px 6px" }}>TOTAL ({rows.length} vouchers)</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.taxableValue, 0))}</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.cgst, 0))}</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.sgst, 0))}</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.igst, 0))}</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.cess, 0))}</td>
          <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(rows.reduce((a, v) => a + v.totalAmount, 0))}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

export const GstCaPackView: React.FC<GstCaPackViewProps> = ({
  pack,
  amountThreshold,
  onThresholdChange,
  onExportPdf,
  onExportExcel,
  onExportCsv,
  exporting,
}) => {
  const hasDiff =
    Math.abs(pack.reconciliation.diffTaxable) > 0.01 ||
    Math.abs(pack.reconciliation.diffTax) > 0.01 ||
    Math.abs(pack.reconciliation.diffTotal) > 0.01;

  return (
    <div>
      {/* CA Pack Action Bar */}
      <div
        className="no-print"
        style={{
          background: "#ffffff",
          border: "1px solid #000000",
          borderRadius: "4px",
          padding: "10px 14px",
          marginBottom: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>
          CA GST Audit Pack — 13-Page Ready-to-File Report (All non-cancelled vouchers included)
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={Boolean(exporting)}
            style={{ background: "#000", color: "#fff", border: "1px solid #000", padding: "6px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
          >
            {exporting === "pdf" ? "Generating 13-Page PDF..." : "Download 13-Page CA PDF"}
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            disabled={Boolean(exporting)}
            style={{ background: "#fff", color: "#000", border: "1.5px solid #000", padding: "6px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
          >
            {exporting === "xlsx" ? "Exporting..." : "Export Excel (.xlsx)"}
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={Boolean(exporting)}
            style={{ background: "#f1f5f9", color: "#000", border: "1px solid #000", padding: "6px 12px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
          >
            {exporting === "csv" ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* PAGE 1: COVER SHEET */}
      <PageCard pageNum={1} title="1. COVER SHEET & AUDIT RECONCILIATION" pack={pack}>
        {pack.syncInfo.hasUnsyncedWarning && (
          <div style={{ background: "#fef2f2", border: "1px solid #b91c1c", color: "#991b1b", padding: "8px 10px", marginBottom: "10px", fontWeight: 700, fontSize: "0.78rem" }}>
            WARNING: {pack.syncInfo.unsyncedCount} unsynced local record(s) pending sync! (Last sync: {pack.syncInfo.lastSyncTime})
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", marginBottom: "10px" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, width: "30%" }}>Store Name / GSTIN</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>{pack.store.name} | {pack.store.gstin || "Not Set"}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700 }}>Period / Generated</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>{pack.periodLabel} | {pack.generatedAt}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700 }}>Last Sync / Pending</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>{pack.syncInfo.lastSyncTime} ({pack.syncInfo.unsyncedCount} pending)</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "left" }}>Reconciliation</th>
              <th style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>Taxable (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>Tax (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Books Total</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.booksTaxable)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.booksTax)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.booksTotal)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Return Total</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.returnTaxable)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.returnTax)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.returnTotal)}</td>
            </tr>
            <tr style={{ background: hasDiff ? "#fee2e2" : "#f8fafc", color: hasDiff ? "#991b1b" : "#000", fontWeight: 800 }}>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Difference (Books - Return)</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.diffTaxable)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.diffTax)}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 8px" }}>{formatInr(pack.reconciliation.diffTotal)}</td>
            </tr>
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 2 */}
      <PageCard pageNum={2} title="2. SALES SUMMARY — RATE-WISE (B2B & B2C SPLIT)" pack={pack}>
        <RateTable title="2A. B2B Sales (Registered)" rows={pack.salesRateSplit.b2b} />
        <RateTable title="2B. B2C Sales (Unregistered)" rows={pack.salesRateSplit.b2c} />
        <RateTable title="2C. Combined Sales" rows={pack.salesRateSplit.combined} />
      </PageCard>

      {/* PAGE 3 */}
      <PageCard pageNum={3} title="3. B2B SALES REGISTER" pack={pack}>
        <VoucherTable rows={pack.b2bSales} partyLabel="Customer" emptyText="No B2B sales in selected period." />
      </PageCard>

      {/* PAGE 4 */}
      <PageCard pageNum={4} title="4. SALES RETURNS / CREDIT NOTES" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Date</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Note No</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Original Invoice</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Taxable (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Tax (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {pack.salesReturns.length === 0 ? (
              <tr><td colSpan={6} style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>No credit notes.</td></tr>
            ) : (
              pack.salesReturns.map((r) => (
                <tr key={r.noteNo}>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{r.date}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{r.noteNo}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{r.originalInvoice}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.taxableValue)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.taxAmount)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(r.totalAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 5 */}
      <PageCard pageNum={5} title="5. HSN SUMMARY" pack={pack}>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>HSN</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Description</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>UQC</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Qty</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Taxable (₹)</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              {pack.hsnSummary.map((r) => (
                <tr key={`${r.hsnCode}-${r.uqc}`}>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{r.hsnCode}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{r.description}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{r.uqc}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{r.totalQty}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.taxableValue)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.cgst)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.sgst)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.igst)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.cess)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* PAGE 6 */}
      <PageCard pageNum={6} title="6. DOCUMENTS ISSUED" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Counter</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Document Type</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Series From</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Series To</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cancelled</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Net Issued</th>
            </tr>
          </thead>
          <tbody>
            {pack.docsIssued.map((d) => (
              <tr key={`${d.counter}-${d.documentType}`}>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.counter}</td>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.documentType}</td>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.seriesFrom}</td>
                <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.seriesTo}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.total}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{d.cancelled}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{d.netIssued}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 7 */}
      <PageCard pageNum={7} title="7. PURCHASE REGISTER (FOR ITC)" pack={pack}>
        <VoucherTable rows={pack.purchaseRegister} partyLabel="Supplier" emptyText="No purchases in selected period." />
      </PageCard>

      {/* PAGE 8 */}
      <PageCard pageNum={8} title="8. PURCHASE RETURNS / DEBIT NOTES" pack={pack}>
        <VoucherTable rows={pack.purchaseReturns} partyLabel="Supplier" emptyText="No purchase returns / debit notes." />
      </PageCard>

      {/* PAGE 9 */}
      <PageCard pageNum={9} title="9. EXEMPT / NIL-RATED SALES TOTAL" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Category</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Vouchers</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 6px" }}>Nil Rated / 0% GST Sales</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{pack.exemptSales.voucherCount}</td>
              <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(pack.exemptSales.totalExemptSales)}</td>
            </tr>
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 10 */}
      <PageCard pageNum={10} title="10. ITC REVERSAL LIST & INELIGIBLE ITC" pack={pack}>
        <div style={{ fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>Ineligible ITC (Missing / Invalid Supplier GSTIN)</div>
        <VoucherTable rows={pack.ineligibleItc} partyLabel="Supplier" emptyText="No ineligible ITC purchases." />
      </PageCard>

      {/* PAGE 11 */}
      <PageCard pageNum={11} title="11. CANCELLED / DRAFT / DELETED BILLS LIST" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Bill No</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Date</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Amount (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Cancelled By</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {pack.cancelledBills.length === 0 ? (
              <tr><td colSpan={5} style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>No cancelled or draft bills.</td></tr>
            ) : (
              pack.cancelledBills.map((c) => (
                <tr key={c.billNo}>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.billNo}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.date}</td>
                  <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(c.amount)}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.cancelledBy}</td>
                  <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 12 */}
      <PageCard pageNum={12} title="12. COUNTER-WISE SALES SUMMARY (DAY-END RECONCILIATION)" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Counter</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Bills</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cash (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>UPI (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Card (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Credit/Due (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Total Sales (₹)</th>
            </tr>
          </thead>
          <tbody>
            {pack.counterSummary.map((c) => (
              <tr key={c.counter}>
                <td style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{c.counter}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.billCount}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(c.cash)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(c.upi)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(c.card)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(c.creditDue)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(c.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageCard>

      {/* PAGE 13 */}
      <PageCard pageNum={13} title="13. GSTR-3B WORKING SHEET" pack={pack}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>Tax Head</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Tax Payable (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>ITC Used (₹)</th>
              <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>Cash Paid (₹)</th>
            </tr>
          </thead>
          <tbody>
            {pack.gstr3b.table61.map((r) => (
              <tr key={r.taxHead}>
                <td style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{r.taxHead}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.taxPayable)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px" }}>{formatInr(r.itcUsed)}</td>
                <td className="gst-num" style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: 700 }}>{formatInr(r.cashPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageCard>
    </div>
  );
};
