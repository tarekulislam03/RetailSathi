import React from "react";
import {
  GstTallyReportBundle,
  GstVoucher,
  Gstr1SectionId,
  VoucherFilterContext,
} from "../types/gstTallyTypes";

interface Gstr1SummaryViewProps {
  bundle: GstTallyReportBundle;
  onOpenSection: (sectionId: Gstr1SectionId, label: string) => void;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}

export const Gstr1SummaryView: React.FC<Gstr1SummaryViewProps> = ({
  bundle,
  onOpenSection,
  onOpenVouchers,
}) => {
  const { gstr1 } = bundle;
  const supplySections = gstr1.sections.filter(
    (r) => r.sectionId !== "hsn" && r.sectionId !== "docs"
  );
  const totals = supplySections.reduce(
    (acc, r) => ({
      count: acc.count + r.voucherCount,
      taxable: acc.taxable + r.taxableValue,
      igst: acc.igst + r.igst,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      cess: acc.cess + r.cess,
      inv: acc.inv + r.invoiceAmount,
    }),
    { count: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, inv: 0 }
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Top Status Table */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
          GSTR-1 Voucher Statistics
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "left" }}>Particulars</th>
              <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "right", width: "160px" }}>
                Voucher Count
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              className="gst-clickable-row"
              onClick={() => onOpenVouchers({ title: "Total Outward Vouchers", direction: "outward" }, "Total Vouchers")}
            >
              <td style={{ border: "1px solid #000000", padding: "6px 10px", fontWeight: 700 }}>Total Vouchers</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 10px", fontWeight: 700 }}>
                {gstr1.totalVouchers}
              </td>
            </tr>
            <tr
              className="gst-clickable-row"
              onClick={() =>
                onOpenVouchers(
                  {
                    title: "Included in GSTR-1 Return",
                    voucherIds: bundle.outwardVouchers.filter((v) => v.includedInReturn).map((v) => v.id),
                  },
                  "Included in Return"
                )
              }
            >
              <td style={{ border: "1px solid #000000", padding: "6px 10px" }}>Included in Return</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 10px", fontWeight: 700 }}>
                {gstr1.includedInReturn}
              </td>
            </tr>
            <tr
              className="gst-clickable-row"
              onClick={() => onOpenSection("not_relevant", "Not Relevant for Return")}
            >
              <td style={{ border: "1px solid #000000", padding: "6px 10px" }}>Not Relevant for Return</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 10px", fontWeight: 700 }}>
                {gstr1.notRelevant}
              </td>
            </tr>
            <tr
              className="gst-clickable-row"
              style={{ background: gstr1.incompleteCount > 0 ? "#fef2f2" : undefined }}
              onClick={() => onOpenSection("incomplete", "Incomplete / Mismatch in Information")}
            >
              <td
                style={{
                  border: "1px solid #000000",
                  padding: "6px 10px",
                  fontWeight: 700,
                  color: gstr1.incompleteCount > 0 ? "#b91c1c" : "#000000",
                }}
              >
                Incomplete / Mismatch in Information (Click to inspect reasons)
              </td>
              <td
                className="gst-num"
                style={{
                  border: "1px solid #000000",
                  padding: "6px 10px",
                  fontWeight: 800,
                  color: gstr1.incompleteCount > 0 ? "#b91c1c" : "#000000",
                }}
              >
                {gstr1.incompleteCount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section Table */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
          GSTR-1 Return Sections (Click any row to drill down)
        </div>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "left" }}>Table No.</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "left" }}>Particulars</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>Voucher Count</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>Cess (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "6px 8px", textAlign: "right" }}>Invoice Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {gstr1.sections.map((sec) => (
                <tr
                  key={sec.sectionId}
                  className="gst-clickable-row"
                  onClick={() => onOpenSection(sec.sectionId, `${sec.tableNo}: ${sec.particulars}`)}
                >
                  <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{sec.tableNo}</td>
                  <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 600, color: "#1d4ed8" }}>
                    {sec.particulars}
                  </td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.voucherCount}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.igst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.cgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.sgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{sec.cess.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>
                    {sec.invoiceAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
                <td colSpan={2} style={{ border: "1px solid #000000", padding: "6px 8px" }}>TOTAL</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.count}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.taxable.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.igst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.cgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.sgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.cess.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "6px 8px" }}>{totals.inv.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

interface Gstr1SectionViewProps {
  bundle: GstTallyReportBundle;
  sectionId: Gstr1SectionId;
  onOpenVoucher: (voucher: GstVoucher) => void;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}

export const Gstr1SectionView: React.FC<Gstr1SectionViewProps> = ({
  bundle,
  sectionId,
  onOpenVoucher,
  onOpenVouchers,
}) => {
  const { gstr1 } = bundle;

  if (sectionId === "b2cs") {
    const rows = gstr1.b2csRows;
    return (
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
          Table 7: B2C (Small) — State-wise &amp; Rate-wise Summary
        </div>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>State</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Rate (%)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Vouchers</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ border: "1px solid #000000", padding: "12px", textAlign: "center" }}>
                    No B2C Small records found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.stateCode}-${r.gstRate}`}
                    className="gst-clickable-row"
                    onClick={() =>
                      onOpenVouchers(
                        {
                          title: `B2C Small — ${r.stateName} (${r.gstRate}%)`,
                          voucherIds: r.voucherIds,
                        },
                        `${r.stateName} (${r.gstRate}%)`
                      )
                    }
                  >
                    <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 600 }}>
                      {r.stateCode} - {r.stateName}
                    </td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.gstRate}%</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.voucherCount}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.igst.toFixed(2)}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.cgst.toFixed(2)}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.sgst.toFixed(2)}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.cess.toFixed(2)}</td>
                    <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700 }}>{r.totalAmount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sectionId === "hsn") {
    const rows = gstr1.hsnRows;
    return (
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
          Table 12: HSN-wise Summary of Outward Supplies
        </div>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>HSN</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Description</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "center" }}>UQC</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total Qty</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total Value (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.hsnCode}-${r.uqc}`}
                  className="gst-clickable-row"
                  onClick={() =>
                    onOpenVouchers(
                      { title: `Vouchers for HSN ${r.hsnCode}`, voucherIds: r.voucherIds },
                      `HSN ${r.hsnCode}`
                    )
                  }
                >
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700 }}>{r.hsnCode}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.description}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "center" }}>{r.uqc}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.totalQty}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700 }}>{r.totalValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.igst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.cgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.sgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{r.cess.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sectionId === "docs") {
    return (
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
          Table 13: Documents Issued
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Document Type</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Series From</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Series To</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cancelled</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Net Issued</th>
            </tr>
          </thead>
          <tbody>
            {gstr1.docsIssued.map((d) => (
              <tr key={d.documentType}>
                <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 600 }}>{d.documentType}</td>
                <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>{d.seriesFrom}</td>
                <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>{d.seriesTo}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{d.totalIssued}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{d.cancelled}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{d.netIssued}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Invoice-level section views (B2B, B2CL, Nil/Exempt, CDNR, Incomplete, Not Relevant)
  const list: GstVoucher[] =
    sectionId === "b2b"
      ? gstr1.b2bVouchers
      : sectionId === "b2cl"
      ? gstr1.b2clVouchers
      : sectionId === "nil_exempt"
      ? gstr1.nilExemptVouchers
      : sectionId === "cdnr"
      ? gstr1.cdnrVouchers
      : sectionId === "incomplete"
      ? gstr1.incompleteVouchers
      : gstr1.notRelevantVouchers;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
        {sectionId === "incomplete"
          ? "Incomplete / Mismatch in Information — Voucher Reasons"
          : `Voucher List (${list.length} records)`}
      </div>
      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Party Name</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>GSTIN</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Invoice No</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "center" }}>Date</th>
              {sectionId === "incomplete" && (
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Mismatch Reason(s)</th>
              )}
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={sectionId === "incomplete" ? 11 : 10} style={{ border: "1px solid #000000", padding: "12px", textAlign: "center" }}>
                  No vouchers in this section.
                </td>
              </tr>
            ) : (
              list.map((v) => (
                <tr key={v.id} className="gst-clickable-row" onClick={() => onOpenVoucher(v)}>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 600 }}>{v.partyName}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.partyGstin || "-"}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", color: "#1d4ed8", fontWeight: 700 }}>{v.voucherNo}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "center" }}>{v.date}</td>
                  {sectionId === "incomplete" && (
                    <td style={{ border: "1px solid #000000", padding: "4px 8px", color: "#b91c1c", fontWeight: 600 }}>
                      {v.mismatchReasons.join(", ")}
                    </td>
                  )}
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.igst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.cgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.sgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.cess.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700 }}>{v.totalAmount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
