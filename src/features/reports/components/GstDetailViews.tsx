import React from "react";
import {
  GstTallyReportBundle,
  GstVoucher,
  VoucherFilterContext,
} from "../types/gstTallyTypes";

/* PAGE 4: VOUCHER REGISTER */
export const VoucherRegisterView: React.FC<{
  vouchers: GstVoucher[];
  title?: string;
  onOpenVoucher: (v: GstVoucher) => void;
}> = ({ vouchers, title, onOpenVoucher }) => {
  const totTaxable = vouchers.reduce((a, v) => a + v.taxableValue, 0);
  const totTax = vouchers.reduce((a, v) => a + v.totalTax, 0);
  const totAmt = vouchers.reduce((a, v) => a + v.totalAmount, 0);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px", textTransform: "uppercase" }}>
        {title || "GST Voucher Register"} ({vouchers.length} vouchers)
      </div>
      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "center" }}>Date</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Particulars</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Voucher Type</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Voucher No.</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Counter</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "left" }}>Party GSTIN</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Tax (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ border: "1px solid #000000", padding: "12px", textAlign: "center" }}>
                  No vouchers found.
                </td>
              </tr>
            ) : (
              vouchers.map((v) => (
                <tr key={v.id} className="gst-clickable-row" onClick={() => onOpenVoucher(v)}>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", textAlign: "center" }}>{v.date}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 600 }}>{v.partyName}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.voucherType}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px", color: "#1d4ed8", fontWeight: 700 }}>{v.voucherNo}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.counter}</td>
                  <td style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.partyGstin || "-"}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.taxableValue.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px" }}>{v.totalTax.toFixed(2)}</td>
                  <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700 }}>{v.totalAmount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
          {vouchers.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
                <td colSpan={6} style={{ border: "1px solid #000000", padding: "5px 8px" }}>TOTAL</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{totTaxable.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{totTax.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{totAmt.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

/* PAGE 5: INVOICE VIEW */
export const InvoiceDetailView: React.FC<{ voucher: GstVoucher }> = ({ voucher }) => {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "14px 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #000000",
          paddingBottom: "10px",
          marginBottom: "10px",
          fontSize: "0.8rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
            {voucher.voucherType.toUpperCase()} — #{voucher.voucherNo}
          </div>
          <div>Party: <strong>{voucher.partyName}</strong></div>
          <div>Party GSTIN: <strong>{voucher.partyGstin || "Unregistered"}</strong></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Date: <strong>{voucher.date}</strong></div>
          <div>Counter: <strong>{voucher.counter}</strong></div>
          <div>
            Place of Supply: <strong>{voucher.placeOfSupplyCode ? `${voucher.placeOfSupplyCode} - ` : ""}{voucher.placeOfSupplyName}</strong>{" "}
            ({voucher.isInterState ? "Inter-State" : "Intra-State"})
          </div>
        </div>
      </div>

      {voucher.mismatchReasons.length > 0 && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #b91c1c",
            color: "#991b1b",
            padding: "8px 10px",
            marginBottom: "10px",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          Validation / Mismatch Issues: {voucher.mismatchReasons.join(" | ")}
        </div>
      )}

      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "center" }}>#</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "left" }}>Item</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "center" }}>HSN</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "center" }}>UQC</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>Qty</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>Rate (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>Taxable (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>GST%</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>CGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>SGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>IGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>Cess (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 6px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {voucher.items.map((it, idx) => (
              <tr key={it.id}>
                <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #000000", padding: "4px 6px", fontWeight: 600 }}>{it.productName}</td>
                <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center", color: it.hasMissingHsn ? "#b91c1c" : undefined }}>
                  {it.hsnCode || "MISSING"}
                </td>
                <td style={{ border: "1px solid #000000", padding: "4px 6px", textAlign: "center" }}>{it.uqc}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.quantity}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.rate.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.taxableValue.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.gstRate}%</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.cgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.sgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.igst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px" }}>{it.cess.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "4px 6px", fontWeight: 700 }}>{it.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
              <td colSpan={4} style={{ border: "1px solid #000000", padding: "5px 6px" }}>TOTAL</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>
                {voucher.items.reduce((a, i) => a + i.quantity, 0)}
              </td>
              <td style={{ border: "1px solid #000000", padding: "5px 6px" }}></td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.taxableValue.toFixed(2)}</td>
              <td style={{ border: "1px solid #000000", padding: "5px 6px" }}></td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.cgst.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.sgst.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.igst.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.cess.toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 6px" }}>{voucher.totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

/* PAGE 7: HSN SUMMARY */
const HsnTableBlock: React.FC<{
  title: string;
  rows: GstTallyReportBundle["hsnSummary"];
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}> = ({ title, rows, onOpenVouchers }) => (
  <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
    <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>{title}</div>
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ border: "1px solid #000000", padding: "10px", textAlign: "center" }}>
                No HSN records found.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={`${r.hsnCode}-${r.uqc}`}
                className="gst-clickable-row"
                onClick={() => onOpenVouchers({ title: `HSN ${r.hsnCode} Vouchers`, voucherIds: r.voucherIds }, `HSN ${r.hsnCode}`)}
              >
                <td style={{ border: "1px solid #000000", padding: "4px 8px", fontWeight: 700, color: "#1d4ed8" }}>{r.hsnCode}</td>
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
            ))
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
            <td colSpan={3} style={{ border: "1px solid #000000", padding: "5px 8px" }}>TOTAL</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.totalQty, 0)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.totalValue, 0).toFixed(2)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.taxableValue, 0).toFixed(2)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.igst, 0).toFixed(2)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.cgst, 0).toFixed(2)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.sgst, 0).toFixed(2)}</td>
            <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.cess, 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);

export const HsnSummaryView: React.FC<{
  bundle: GstTallyReportBundle;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}> = ({ bundle, onOpenVouchers }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
    <HsnTableBlock
      title="Sales Data — HSN-wise Summary (Outward Supplies)"
      rows={bundle.hsnSummary}
      onOpenVouchers={onOpenVouchers}
    />
    <HsnTableBlock
      title="Purchase Data — HSN-wise Summary (Inward Supplies)"
      rows={bundle.purchaseHsnSummary}
      onOpenVouchers={onOpenVouchers}
    />
  </div>
);

/* PAGE 8: TAX RATE-WISE SUMMARY */
export const RateSummaryView: React.FC<{
  bundle: GstTallyReportBundle;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}> = ({ bundle, onOpenVouchers }) => {
  const rows = bundle.rateSummary;
  return (
    <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
        Tax Rate-wise Summary (0%, 0.25%, 3%, 5%, 12%, 18%, 28%)
      </div>
      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Rate (%)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Taxable Value (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>IGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>CGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>SGST (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Cess (₹)</th>
              <th style={{ border: "1px solid #000000", padding: "5px 8px", textAlign: "right" }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.gstRate}
                className={r.voucherIds.length > 0 ? "gst-clickable-row" : undefined}
                onClick={() =>
                  r.voucherIds.length > 0 &&
                  onOpenVouchers({ title: `Vouchers at ${r.gstRate}% GST`, voucherIds: r.voucherIds }, `${r.gstRate}% GST`)
                }
              >
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700, color: "#1d4ed8" }}>
                  {r.gstRate}%
                </td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.taxableValue.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.igst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.sgst.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{r.cess.toFixed(2)}</td>
                <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px", fontWeight: 700 }}>{r.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f2f2f2", fontWeight: 800 }}>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>TOTAL</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.taxableValue, 0).toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.igst, 0).toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.cgst, 0).toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.sgst, 0).toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.cess, 0).toFixed(2)}</td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "5px 8px" }}>{rows.reduce((a, r) => a + r.totalAmount, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

/* PAGE 9: INPUT vs OUTPUT TAX */
export const InputOutputView: React.FC<{
  bundle: GstTallyReportBundle;
  onOpenVouchers: (ctx: VoucherFilterContext, label: string) => void;
}> = ({ bundle, onOpenVouchers }) => {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #000000", borderRadius: "4px", padding: "12px 14px" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "8px" }}>
        Input vs Output Tax Summary (Click Output or Input column to inspect vouchers)
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr style={{ background: "#f2f2f2" }}>
            <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "left" }}>Tax Head</th>
            <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "right" }}>Output Tax (Sales) (₹)</th>
            <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "right" }}>Input Tax (Purchases) (₹)</th>
            <th style={{ border: "1px solid #000000", padding: "6px 10px", textAlign: "right" }}>Net Payable / (Carry Forward) (₹)</th>
          </tr>
        </thead>
        <tbody>
          {bundle.inputVsOutput.map((r) => {
            const isTotal = r.taxHead === "Total";
            return (
              <tr key={r.taxHead} style={{ background: isTotal ? "#f2f2f2" : undefined, fontWeight: isTotal ? 800 : 400 }}>
                <td style={{ border: "1px solid #000000", padding: "6px 10px", fontWeight: 700 }}>{r.taxHead}</td>
                <td
                  className="gst-num gst-clickable-row"
                  style={{ border: "1px solid #000000", padding: "6px 10px", color: "#1d4ed8", cursor: "pointer" }}
                  onClick={() => onOpenVouchers({ title: "Outward Sales Vouchers", direction: "outward" }, "Output Vouchers")}
                >
                  {r.outputTax.toFixed(2)}
                </td>
                <td
                  className="gst-num gst-clickable-row"
                  style={{ border: "1px solid #000000", padding: "6px 10px", color: "#1d4ed8", cursor: "pointer" }}
                  onClick={() => onOpenVouchers({ title: "Inward Purchase Vouchers", direction: "inward" }, "Input Vouchers")}
                >
                  {r.inputTax.toFixed(2)}
                </td>
                <td
                  className="gst-num"
                  style={{
                    border: "1px solid #000000",
                    padding: "6px 10px",
                    fontWeight: 800,
                    color: r.netPayable > 0 ? "#b91c1c" : "#15803d",
                  }}
                >
                  {r.netPayable.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
