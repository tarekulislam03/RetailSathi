import React, { useEffect, useState } from "react";
import { Product, ProductInput } from "../types";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/inventoryService";
import { StatsGrid } from "../components/StatsGrid";
import { LowStockModal } from "../components/LowStockModal";
import { ProductTable } from "../components/ProductTable";
import { ProductModal } from "../components/ProductModal";
import { BulkPrintLabelsModal } from "../components/BulkPrintLabelsModal";
import { pullDataFromCloud } from "../../../services/syncProcessor";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Search State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState<boolean>(false);
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeFilter, setBarcodeFilter] = useState<"ALL" | "WITH_BARCODE" | "WITHOUT_BARCODE">("ALL");

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      let data = await fetchProducts();
      if (data.length === 0 && typeof navigator !== "undefined" && navigator.onLine) {
        await pullDataFromCloud();
        data = await fetchProducts();
      }
      setProducts(data);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load products:", err);
        setError(err?.message || "Failed to load products from database.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadData(true), 3000);

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenAdd() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  async function handleSaveProduct(payload: ProductInput) {
    if (editingProduct) {
      await updateProduct(editingProduct.id, payload);
    } else {
      await createProduct(payload);
    }
    setIsModalOpen(false);
    setEditingProduct(null);
    await loadData();
  }

  async function handleDeleteProduct(id: number) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(id);
      await loadData();
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      const msg =
        typeof err === "string" ? err : err?.message || "Failed to delete product.";
      setError(msg);
    }
  }

  const lowStockCount = products.filter((p) => p.stock <= p.reorder_threshold).length;

  const filteredProducts = products.filter((p) => {
    const hasBarcode = Boolean(p.barcode && p.barcode.trim());
    if (barcodeFilter === "WITH_BARCODE" && !hasBarcode) return false;
    if (barcodeFilter === "WITHOUT_BARCODE" && hasBarcode) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.batch_no.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <StatsGrid
        products={products}
        onLowStockClick={() => setIsLowStockModalOpen(true)}
      />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Product & Batch Directory ({filteredProducts.length})</h2>
          <div className="list-actions">
            <button
              className="btn secondary-btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: lowStockCount > 0 ? "#873800" : "#104175",
                background: lowStockCount > 0
                  ? "linear-gradient(to bottom, #fffbe6 0%, #fff1b8 100%)"
                  : "linear-gradient(to bottom, #ffffff 0%, #ebf2f9 100%)",
                borderColor: lowStockCount > 0 ? "#ffe58f" : "#7092be",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() => setIsLowStockModalOpen(true)}
              title="Open Reorder List for low stock items"
            >
              Manage Low Stock
              {lowStockCount > 0 && (
                <span
                  style={{
                    background: "#b91c1c",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontWeight: 700,
                  }}
                >
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              className="btn secondary-btn"
              style={{
                padding: "6px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#065f46",
                background: "linear-gradient(to bottom, #ecfdf5 0%, #d1fae5 100%)",
                borderColor: "#6ee7b7",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() => setIsBulkPrintOpen(true)}
              title="Select products and quantities to print barcode labels"
            >
              🏷️ Print Labels
            </button>

            <select
              className="search-input"
              style={{ width: "150px", height: "34px", fontSize: "0.82rem", fontWeight: 600 }}
              value={barcodeFilter}
              onChange={(e) => setBarcodeFilter(e.target.value as any)}
            >
              <option value="ALL">All Products</option>
              <option value="WITH_BARCODE">With Barcode</option>
              <option value="WITHOUT_BARCODE">Without Barcode</option>
            </select>

            <input
              type="text"
              className="search-input"
              placeholder="Search name, barcode, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="btn primary-btn add-product-btn" onClick={handleOpenAdd}>
              + ADD PRODUCT
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading database items...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              "No matching product batches found."
            ) : (
              <div>
                <p>No products in database yet.</p>
                <button
                  className="btn primary-btn"
                  style={{ marginTop: "12px" }}
                  onClick={handleOpenAdd}
                >
                  + ADD PRODUCT NOW
                </button>
              </div>
            )}
          </div>
        ) : (
          <ProductTable
            products={filteredProducts}
            allProducts={products}
            searchTerm={`${searchTerm}|${barcodeFilter}`}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteProduct}
          />
        )}
      </section>

      {isModalOpen && (
        <ProductModal
          editingProduct={editingProduct}
          existingProducts={products}
          onSave={handleSaveProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <LowStockModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        products={products}
        allProducts={products}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteProduct}
      />

      <BulkPrintLabelsModal
        products={products}
        isOpen={isBulkPrintOpen}
        onClose={() => setIsBulkPrintOpen(false)}
      />
    </>
  );
};
