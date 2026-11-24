import React from "react";
import { GstTallyReportBundle, VoucherFilterContext } from "../types/gstTallyTypes";

interface Gstr3bViewProps {
  bundle: GstTallyReportBundle;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}

export const Gstr3bView: React.FC<Gstr3bViewProps> = ({ bundle, onOpenVouchers }) => {
  const { gstr3b } = bundle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* 3.1 */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
          3.1 Details of Outward Supplies and Inward Supplies liable to Reverse Charge
        </div>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left", width: "70px" }}>Table</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Nature of Supplies</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              {gstr3b.table31.map((r) => (
                <tr
                  key={r.code}
                  className={r.voucherIds.length > 0 ? "gst-clickable-row" : undefined}
                  onClick={() =>
                    r.voucherIds.length > 0 &&
                    onOpenVouchers({ title: `GSTR-3B ${r.code}`, voucherIds: r.voucherIds }, r.code)
                  }
                >
                  <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.code}</td>
                  <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.particulars}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.igst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.sgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cess.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3.2 */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
          3.2 Of the supplies shown in 3.1(a), Inter-State supplies made to Unregistered Persons
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Place of Supply (State/UT)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total Taxable Value (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Amount of Integrated Tax (₹)</th>
            </tr>
          </thead>
          <tbody>
            {gstr3b.table32.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ border: "1px solid #000000", padding: "10px", textAlign: "center" }}>
                  No inter-state unregistered supplies in this period.
                </td>
              </tr>
            ) : (
              gstr3b.table32.map((r) => (
                <tr
                  key={r.stateCode}
                  className="gst-clickable-row"
                  onClick={() =>
                    onOpenVouchers({ title: `3.2 Inter-State Unregistered — ${r.stateName}`, voucherIds: r.voucherIds }, r.stateName)
                  }
                >
                  <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 600 }}>
                    {r.stateCode} - {r.stateName}
                  </td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.igst.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4 */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
          4. Eligible ITC
        </div>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "#f2f2f2" }}>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left", width: "70px" }}>Table</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Details</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
                <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
              </tr>
            </thead>
            <tbody>
              {gstr3b.table4.map((r) => (
                <tr
                  key={r.code}
                  className={r.voucherIds.length > 0 ? "gst-clickable-row" : undefined}
                  style={{ fontWeight: r.code === "4(C)" ? 800 : 400, background: r.code === "4(C)" ? "#f8fafc" : undefined }}
                  onClick={() =>
                    r.voucherIds.length > 0 &&
                    onOpenVouchers({ title: `GSTR-3B ${r.code}`, voucherIds: r.voucherIds }, r.code)
                  }
                >
                  <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.code}</td>
                  <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.particulars}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.igst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.sgst.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cess.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5 */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
          5. Values of Exempt, Nil-rated and Non-GST Inward Supplies
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left", width: "70px" }}>Table</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Nature of Supplies</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Inter-State Supplies (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Intra-State Supplies (₹)</th>
            </tr>
          </thead>
          <tbody>
            {gstr3b.table5.map((r) => (
              <tr
                key={r.code}
                className={r.voucherIds.length > 0 ? "gst-clickable-row" : undefined}
                onClick={() =>
                  r.voucherIds.length > 0 &&
                  onOpenVouchers({ title: `GSTR-3B ${r.code}`, voucherIds: r.voucherIds }, r.code)
                }
              >
                <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.code}</td>
                <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.particulars}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.interState.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.intraState.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6.1 */}
      <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
          6.1 Payment of Tax
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Description</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Tax Payable (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>ITC Used (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cash Paid (₹)</th>
            </tr>
          </thead>
          <tbody>
            {gstr3b.table61.map((r) => (
              <tr key={r.taxHead}>
                <td style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.taxHead}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.taxPayable.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.itcUsed.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.cashPaid.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
              <td style={{ border: "1px solid #000000", padding: "5px 8px" }}>TOTAL</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>
                {gstr3b.table61.reduce((a, r) => a + r.taxPayable, 0).toFixed(2)}
              </td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>
                {gstr3b.table61.reduce((a, r) => a + r.itcUsed, 0).toFixed(2)}
              </td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>
                {gstr3b.table61.reduce((a, r) => a + r.cashPaid, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
