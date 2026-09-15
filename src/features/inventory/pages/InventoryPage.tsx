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

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Search State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProducts();
      setProducts(data);
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError(err?.message || "Failed to load products from database.");
    } finally {
      setLoading(false);
    }
  }

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
      setError(err?.message || "Failed to delete product.");
    }
  }

  const lowStockCount = products.filter((p) => p.stock <= p.reorder_threshold).length;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.batch_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            >
              Manage Low Stocks
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
            onEdit={handleOpenEdit}
            onDelete={handleDeleteProduct}
          />
        )}
      </section>

      {isModalOpen && (
        <ProductModal
          editingProduct={editingProduct}
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
    </>
  );
};
