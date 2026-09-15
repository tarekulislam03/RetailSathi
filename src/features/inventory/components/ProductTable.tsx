import React, { useState, useEffect } from "react";
import { Product } from "../types";
import { getBatchStatusMap } from "../utils/batchUtils";
import { Pagination } from "../../../components/common/Pagination";

interface ProductTableProps {
  products: Product[];
  allProducts?: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  allProducts,
  onEdit,
  onDelete,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  const totalItems = products.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

  const statusMap = getBatchStatusMap(
    allProducts && allProducts.length > 0 ? allProducts : products
  );

  return (
    <>
      <div className="table-responsive">
        <table className="product-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Product Name</th>
              <th>Batch No</th>
              <th>Batch Status</th>
              <th>MRP</th>
              <th>Selling Rate</th>
              <th>Stock</th>
              <th>HSN</th>
              <th>GST %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((item) => {
              const batchStatus = statusMap.get(item.id) || "New Stock";
              return (
                <tr key={item.id}>
                  <td>
                    <code className="barcode-tag">{item.barcode || "-"}</code>
                  </td>
                  <td className="font-semibold">
                    {item.name}
                    {item.stock <= item.reorder_threshold && (
                      <span className="low-stock-badge">Low Stock</span>
                    )}
                  </td>
                  <td>{item.batch_no || "-"}</td>
                  <td>
                    <span
                      className={`stock-status-badge ${
                        batchStatus === "New Stock" ? "new-stock" : "old-stock"
                      }`}
                    >
                      {batchStatus}
                    </span>
                  </td>
                  <td>₹ {item.mrp ? item.mrp.toFixed(2) : "-"}</td>
                  <td className="price-tag">₹ {item.price.toFixed(2)}</td>
                  <td>{item.stock}</td>
                  <td>{item.hsn_code || "-"}</td>
                  <td>{item.gst_rate}%</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon edit-btn"
                        onClick={() => onEdit(item)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-icon delete-btn"
                        onClick={() => onDelete(item.id)}
                        title="Delete"
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
