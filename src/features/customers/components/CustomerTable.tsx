import React, { useState, useEffect } from "react";
import { Customer } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface CustomerTableProps {
  customers: Customer[];
  searchTerm?: string;
  onEdit: (customer: Customer) => void;
  onDelete: (id: number) => void;
  onSettleDues?: (customer: Customer) => void;
  onViewPurchases?: (customer: Customer) => void;
  onUpdateLuckyDrawUsed?: (customer: Customer, newUsedCount: number) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  searchTerm,
  onEdit,
  onDelete,
  onSettleDues,
  onViewPurchases,
  onUpdateLuckyDrawUsed,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalItems = customers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCustomers = customers.slice(startIndex, startIndex + pageSize);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>ID</th>
              <th>CUSTOMER NAME</th>
              <th>PHONE NO</th>
              <th>ADDRESS</th>
              <th>ACTIVE POINTS</th>
              <th>LUCKY DRAW USED</th>
              <th>ELIGIBLE LUCKY DRAW</th>
              <th>LIFETIME POINTS</th>
              <th>DUES (₹)</th>
              <th style={{ width: "240px", textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td className="font-semibold">{c.name}</td>
                <td>
                  <span className="barcode-tag">{c.phone}</span>
                </td>
                <td>{c.address || "—"}</td>
                <td>
                  <span
                    style={{
                      fontWeight: 700,
                      color: c.active_points > 0 ? "#16a34a" : "#666",
                    }}
                  >
                    {c.active_points} pts
                  </span>
                </td>
                <td>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={c.lucky_draw_used <= 0}
                      onClick={() =>
                        onUpdateLuckyDrawUsed &&
                        onUpdateLuckyDrawUsed(c, Math.max(0, c.lucky_draw_used - 1))
                      }
                      title="Decrease used draws"
                      style={{
                        padding: "2px 7px",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        backgroundColor: c.lucky_draw_used > 0 ? "#f9fafb" : "#f3f4f6",
                        color: c.lucky_draw_used > 0 ? "#111827" : "#9ca3af",
                        cursor: c.lucky_draw_used > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      -
                    </button>
                    <span
                      style={{
                        fontWeight: 700,
                        minWidth: "24px",
                        textAlign: "center",
                        color: c.lucky_draw_used > 0 ? "#4338ca" : "#666",
                      }}
                    >
                      {c.lucky_draw_used}
                    </span>
                    <button
                      type="button"
                      disabled={c.lucky_draw_count <= 0}
                      onClick={() =>
                        onUpdateLuckyDrawUsed &&
                        onUpdateLuckyDrawUsed(c, c.lucky_draw_used + 1)
                      }
                      title={c.lucky_draw_count > 0 ? "Mark 1 draw as used" : "No eligible draws left to use"}
                      style={{
                        padding: "2px 7px",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        backgroundColor: c.lucky_draw_count > 0 ? "#e0e7ff" : "#f3f4f6",
                        color: c.lucky_draw_count > 0 ? "#3730a3" : "#9ca3af",
                        cursor: c.lucky_draw_count > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td>
                  <span
                    style={{
                      fontWeight: 700,
                      color: c.lucky_draw_count > 0 ? "#d97706" : "#666",
                      backgroundColor: c.lucky_draw_count > 0 ? "#fef3c7" : "#f3f4f6",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      border: c.lucky_draw_count > 0 ? "1px solid #fde68a" : "1px solid #e5e7eb",
                      display: "inline-block",
                      fontSize: "0.8rem",
                    }}
                  >
                    🎟️ {c.lucky_draw_count} {c.lucky_draw_count === 1 ? "Draw" : "Draws"}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      fontWeight: 700,
                      color: c.loyalty_points > 0 ? "#0066cc" : "#666",
                    }}
                  >
                    {c.loyalty_points} pts
                  </span>
                </td>
                <td>
                  <span
                    className={c.dues > 0 ? "" : "price-tag"}
                    style={
                      c.dues > 0
                        ? {
                            color: "#b91c1c",
                            fontWeight: 700,
                            backgroundColor: "#fef2f2",
                            padding: "2px 6px",
                            borderRadius: "2px",
                            border: "1px solid #fca5a5",
                            display: "inline-block",
                          }
                        : undefined
                    }
                  >
                    ₹{c.dues.toFixed(2)}
                  </span>
                </td>
                <td style={{ textAlign: "center" }}>
                  <div className="action-buttons" style={{ justifyContent: "center" }}>
                    {onViewPurchases && (
                      <button
                        className="btn-icon"
                        style={{
                          background: "linear-gradient(to bottom, #ffffff 0%, #e1edfd 100%)",
                          color: "#104175",
                          borderColor: "#7092be",
                        }}
                        onClick={() => onViewPurchases(c)}
                        title="View Customer Purchase History"
                      >
                        View Purchases
                      </button>
                    )}
                    {c.dues > 0 && onSettleDues && (
                      <button
                        className="btn-icon"
                        style={{
                          background: "linear-gradient(to bottom, #e6f4ea 0%, #c8e6c9 100%)",
                          color: "#1b5e20",
                          borderColor: "#81c784",
                        }}
                        onClick={() => onSettleDues(c)}
                        title="Clear / Pay Dues"
                      >
                        Clear Dues
                      </button>
                    )}
                    <button
                      className="btn-icon edit-btn"
                      onClick={() => onEdit(c)}
                      title="Edit Customer Details"
                    >
                      Edit
                    </button>
                    <button
                      className="btn-icon delete-btn"
                      onClick={() => onDelete(c.id)}
                      title="Delete Customer"
                    >
                      Delete
                    </button>
                  </div>
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
        onPageSizeChange={handlePageSizeChange}
      />
    </>
  );
};
