import React, { useState, useEffect } from "react";
import { StockMovement } from "../types";
import { Pagination } from "../../../components/common/Pagination";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface LedgerTableProps {
  movements: StockMovement[];
}

export const LedgerTable: React.FC<LedgerTableProps> = ({ movements }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [movements]);

  const totalItems = movements.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedMovements = movements.slice(startIndex, startIndex + pageSize);

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>MOVEMENT TYPE</th>
              <th>PRODUCT NAME</th>
              <th>BARCODE / BATCH</th>
              <th>QUANTITY</th>
              <th>REFERENCE NO</th>
              <th>PARTY / SOURCE</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMovements.map((m) => (
              <tr key={m.id}>
                <td style={{ fontSize: "0.82rem", color: "#3b5370" }}>
                  {formatTo12Hour(m.timestamp)}
                </td>
                <td>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "3px",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      backgroundColor: m.type === "IN" ? "#e6f4ea" : "#fef2f2",
                      color: m.type === "IN" ? "#137333" : "#b91c1c",
                      border:
                        m.type === "IN"
                          ? "1px solid #a8dab5"
                          : "1px solid #fca5a5",
                      display: "inline-block",
                    }}
                  >
                    {m.type === "IN"
                      ? m.category === "Inventory"
                        ? "STOCK IN (Inventory)"
                        : "STOCK IN (Purchase)"
                      : m.category === "Adjustment"
                        ? "STOCK OUT (Adjustment)"
                        : "STOCK OUT (Sale)"}
                  </span>
                </td>
                <td className="font-semibold">{m.product_name}</td>
                <td>
                  {m.barcode || m.batch_no ? (
                    <span className="barcode-tag">
                      {m.barcode}
                      {m.barcode && m.batch_no ? ` | ${m.batch_no}` : m.batch_no}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      color: m.type === "IN" ? "#055e37" : "#b91c1c",
                    }}
                  >
                    {m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: "#103c6b" }}>
                  {m.reference_no || "—"}
                </td>
                <td>{m.party_name || "—"}</td>
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
      />
    </>
  );
};
