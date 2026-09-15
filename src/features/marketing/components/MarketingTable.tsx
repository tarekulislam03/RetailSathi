import React, { useState, useEffect } from "react";
import { MarketingPerson } from "../types";
import { Pagination } from "../../../components/common/Pagination";

interface MarketingTableProps {
  persons: MarketingPerson[];
  onEdit: (person: MarketingPerson) => void;
  onDelete: (id: number) => void;
  onViewDetails: (person: MarketingPerson) => void;
}

export const MarketingTable: React.FC<MarketingTableProps> = ({
  persons,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [persons]);

  const totalItems = persons.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedPersons = persons.slice(startIndex, startIndex + pageSize);

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>PHONE NO</th>
              <th>AREA</th>
              <th>MONTHLY SALES</th>
              <th>COMMISSION RATE</th>
              <th>MONTHLY COMMISSION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPersons.map((p) => {
              const monthlySales = p.monthly_sales ?? p.sales ?? 0;
              const monthlyCommission =
                p.monthly_commission ?? (monthlySales * p.commission) / 100;

              return (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td className="font-semibold">{p.name}</td>
                  <td>{p.phone || "—"}</td>
                  <td>
                    <span
                      style={{
                        backgroundColor: "#f0f4f9",
                        color: "#1c3d5a",
                        padding: "2px 6px",
                        borderRadius: "2px",
                        fontSize: "0.82rem",
                        border: "1px solid #d0dbe5",
                        display: "inline-block",
                      }}
                    >
                      {p.area || "General"}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#0d5c3a" }}>
                      ₹{monthlySales.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#4b5563" }}>
                      {p.commission}%
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#103c6b" }}>
                      ₹{monthlyCommission.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn secondary-btn"
                        style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                        onClick={() => onViewDetails(p)}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="btn secondary-btn"
                        style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                        onClick={() => onEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn danger-btn"
                        style={{ padding: "3px 8px", fontSize: "0.78rem" }}
                        onClick={() => onDelete(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
