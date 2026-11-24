import React from "react";
import { GstPageId, GstTallyReportBundle } from "../types/gstTallyTypes";

interface GstHomeViewProps {
  bundle: GstTallyReportBundle;
  onOpenPage: (page: GstPageId, label: string) => void;
}

export const GstHomeView: React.FC<GstHomeViewProps> = ({ bundle, onOpenPage }) => {
  const netCashPayable = bundle.gstr3b.table61.reduce((a, r) => a + r.cashPaid, 0);
  const netInputOutput = bundle.inputVsOutput[4]?.netPayable || 0;

  const menuItems: {
    page: GstPageId;
    title: string;
    subtitle: string;
    badge: string;
  }[] = [
    {
      page: "gstr1_summary",
      title: "GSTR-1",
      subtitle: "Outward Supplies Return — B2B, B2C Large/Small, Nil/Exempt, Credit Notes, HSN & Docs Issued",
      badge: `${bundle.gstr1.includedInReturn} / ${bundle.gstr1.totalVouchers} Vouchers`,
    },
    {
      page: "gstr3b",
      title: "GSTR-3B",
      subtitle: "Monthly / Quarterly Summary Return — Tables 3.1, 3.2, 4 (ITC), 5 & 6.1 (Tax Payment)",
      badge: `Cash Payable: ₹${netCashPayable.toFixed(2)}`,
    },
    {
      page: "hsn_summary",
      title: "HSN Summary",
      subtitle: "HSN-wise Outward Supplies with UQC, Total Qty, Taxable Value & Tax Breakup",
      badge: `${bundle.hsnSummary.length} HSN Codes`,
    },
    {
      page: "rate_summary",
      title: "Tax Rate-wise Summary",
      subtitle: "Tax Slabs (0%, 0.25%, 3%, 5%, 12%, 18%, 28%) — Taxable, IGST, CGST, SGST, Cess & Total",
      badge: `${bundle.rateSummary.filter((r) => r.totalAmount !== 0).length} Active Slabs`,
    },
    {
      page: "input_output",
      title: "Input vs Output Tax",
      subtitle: "Output Tax Liability vs Input Tax Credit (ITC) & Net Payable / Carry Forward",
      badge: `Net: ₹${netInputOutput.toFixed(2)}`,
    },
    {
      page: "ca_pack",
      title: "CA GST Audit Pack (13-Page PDF / Excel / CSV)",
      subtitle: "Complete 13-page CA handoff pack: Cover, Rate-wise B2B/B2C, Registers, HSN, ITC Reversals, Counter Day-End & GSTR-3B",
      badge: "13 Pages A4",
    },
  ];

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #000000",
        borderRadius: "4px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 800,
          textTransform: "uppercase",
          borderBottom: "1px solid #000000",
          paddingBottom: "6px",
          marginBottom: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Gateway of GST Reports</span>
        <button
          type="button"
          onClick={() => onOpenPage("voucher_register", "All Vouchers")}
          style={{
            background: "#f1f5f9",
            border: "1px solid #000000",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open Voucher Register ({bundle.allVouchers.length})
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ background: "#f2f2f2" }}>
            <th style={{ border: "1px solid #000000", padding: "7px 10px", textAlign: "left", width: "22%" }}>
              Report Name
            </th>
            <th style={{ border: "1px solid #000000", padding: "7px 10px", textAlign: "left" }}>
              Particulars
            </th>
            <th style={{ border: "1px solid #000000", padding: "7px 10px", textAlign: "right", width: "22%" }}>
              Summary
            </th>
          </tr>
        </thead>
        <tbody>
          {menuItems.map((item) => (
            <tr
              key={item.page}
              className="gst-clickable-row"
              onClick={() => onOpenPage(item.page, item.title)}
            >
              <td style={{ border: "1px solid #000000", padding: "9px 10px", fontWeight: 800, color: "#1d4ed8" }}>
                {item.title}
              </td>
              <td style={{ border: "1px solid #000000", padding: "9px 10px" }}>
                {item.subtitle}
              </td>
              <td className="gst-num" style={{ border: "1px solid #000000", padding: "9px 10px", fontWeight: 700 }}>
                {item.badge}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
