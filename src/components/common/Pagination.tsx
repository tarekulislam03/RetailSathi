import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeOptions?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  showPageSizeOptions = true,
}) => {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push("...");

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safeCurrentPage < safeTotalPages - 2) pages.push("...");
      pages.push(safeTotalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{" "}
        <strong>{totalItems}</strong> entries
      </div>

      <div className="pagination-controls">
        {showPageSizeOptions && onPageSizeChange && (
          <div className="pagination-size-selector" style={{ marginRight: "10px" }}>
            <label style={{ marginRight: "4px", fontSize: "0.78rem" }}>Rows per page:</label>
            <select
              className="pagination-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          className="pagination-btn"
          disabled={safeCurrentPage === 1}
          onClick={() => onPageChange(1)}
          title="First Page"
        >
          «
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safeCurrentPage === 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          title="Previous Page"
        >
          ‹ Prev
        </button>

        {pages.map((p, index) =>
          typeof p === "number" ? (
            <button
              key={index}
              type="button"
              className={`pagination-btn ${safeCurrentPage === p ? "active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ) : (
            <span
              key={index}
              style={{ padding: "0 4px", fontSize: "0.8rem", color: "#666" }}
            >
              ...
            </span>
          )
        )}

        <button
          type="button"
          className="pagination-btn"
          disabled={safeCurrentPage === safeTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          title="Next Page"
        >
          Next ›
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safeCurrentPage === safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          title="Last Page"
        >
          »
        </button>
      </div>
    </div>
  );
};
