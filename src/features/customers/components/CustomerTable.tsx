import React, { useState, useEffect } from "react";
import { Customer } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (id: number) => void;
  onSettleDues?: (customer: Customer) => void;
  onViewPurchases?: (customer: Customer) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  onEdit,
  onDelete,
  onSettleDues,
  onViewPurchases,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [customers]);

  const totalItems = customers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCustomers = customers.slice(startIndex, startIndex + pageSize);

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
              <th>LOYALTY POINTS</th>
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
        onPageSizeChange={setPageSize}
      />
    </>
  );
};
