import React, { useState, useEffect } from "react";
import { Sale } from "../../billing/types";
import { Pagination } from "../../../components/common/Pagination";
import { formatTo12Hour } from "../../../utils/dateUtils";

interface SalesTableProps {
  sales: Sale[];
  onViewInvoice: (saleId: number) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
}

export const SalesTable: React.FC<SalesTableProps> = ({
  sales,
  onViewInvoice,
  onEditSale,
  onDeleteSale,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [sales]);

  const totalItems = sales.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedSales = sales.slice(startIndex, startIndex + pageSize);

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Subtotal</th>
              <th>Discount</th>
              <th>Grand Total</th>
              <th>Payment Mode</th>
              <th>Date & Time</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSales.map((sale) => (
              <tr key={sale.id}>
                <td className="font-semibold">{sale.invoice_no}</td>
                <td>{sale.customer_name || "Walk-in"}</td>
                <td>{sale.customer_phone || "-"}</td>
                <td>₹{sale.total_amount.toFixed(2)}</td>
                <td>₹{sale.discount.toFixed(2)}</td>
                <td className="price-tag">₹{sale.grand_total.toFixed(2)}</td>
                <td>
                  <span className="category-badge">{sale.payment_mode}</span>
                </td>
                <td>{formatTo12Hour(sale.created_at)}</td>
                <td>
                  <div className="action-buttons" style={{ justifyContent: "center" }}>
                    <button
                      type="button"
                      className="btn-icon edit-btn"
                      onClick={() => onViewInvoice(sale.id)}
                      title="View Receipt Invoice"
                    >
                      View Invoice
                    </button>
                    <button
                      type="button"
                      className="btn-icon edit-btn"
                      onClick={() => onEditSale(sale)}
                      title="Edit Sale Record"
                      style={{
                        background: "linear-gradient(to bottom, #ffffff 0%, #dbeafd 100%)",
                        borderColor: "#3b82f6",
                        color: "#1d4ed8",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-icon delete-btn"
                      onClick={() => onDeleteSale(sale)}
                      title="Delete Sale Record"
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
