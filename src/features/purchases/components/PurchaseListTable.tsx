import React, { useState, useEffect } from "react";
import { Purchase } from "../types";
import { Pagination } from "../../../components/common/Pagination";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface PurchaseListTableProps {
  purchases: Purchase[];
  onViewDetails: (purchaseId: number) => void;
}

export const PurchaseListTable: React.FC<PurchaseListTableProps> = ({
  purchases,
  onViewDetails,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [purchases]);

  if (purchases.length === 0) {
    return (
      <div className="empty-state">
        No purchase records found. Click "+ RECORD NEW PURCHASE" above to record a stock entry!
      </div>
    );
  }

  const totalItems = purchases.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedPurchases = purchases.slice(startIndex, startIndex + pageSize);

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Supplier Name</th>
              <th>GST No</th>
              <th>Contact No</th>
              <th>Items</th>
              <th>Total Expenditure</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPurchases.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td className="font-semibold">{p.invoice_no}</td>
                <td>{formatTo12Hour(p.created_at || p.purchase_date)}</td>
                <td>{p.supplier_name}</td>
                <td>{p.gst_no || "-"}</td>
                <td>{p.contact_no || "-"}</td>
                <td>{p.item_count} items</td>
                <td className="price-tag">₹{p.total_amount.toFixed(2)}</td>
                <td>
                  <button
                    className="btn secondary-btn"
                    style={{ padding: "3px 8px", fontSize: "0.82rem" }}
                    onClick={() => onViewDetails(p.id)}
                  >
                    View Items
                  </button>
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
