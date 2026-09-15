import React, { useState, useEffect } from "react";
import { Supplier, SupplierInput } from "../types/supplier";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../services/supplierService";
import { Pagination } from "../../../components/common/Pagination";

interface ManageSuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierUpdated?: () => void;
}

export const ManageSuppliersModal: React.FC<ManageSuppliersModalProps> = ({
  isOpen,
  onClose,
  onSupplierUpdated,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Add / Edit form toggle & states
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setShowForm(false);
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function resetForm() {
    setEditingSupplier(null);
    setName("");
    setCompanyName("");
    setGstNo("");
    setContactNo("");
    setEmail("");
    setAddress("");
    setErrorMsg("");
  }

  function handleOpenAdd() {
    resetForm();
    setShowForm(true);
  }

  function handleOpenEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setCompanyName(supplier.company_name || "");
    setGstNo(supplier.gst_no || "");
    setContactNo(supplier.contact_no || "");
    setEmail(supplier.email || "");
    setAddress(supplier.address || "");
    setShowForm(true);
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Supplier name is required.");
      return;
    }

    const payload: SupplierInput = {
      name: name.trim(),
      company_name: companyName.trim(),
      gst_no: gstNo.trim(),
      contact_no: contactNo.trim(),
      email: email.trim(),
      address: address.trim(),
    };

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
      } else {
        await createSupplier(payload);
      }

      setShowForm(false);
      resetForm();
      await loadData();
      if (onSupplierUpdated) onSupplierUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save supplier info.");
    }
  }

  async function handleDeleteSupplier(id: number) {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await deleteSupplier(id);
      await loadData();
      if (onSupplierUpdated) onSupplierUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete supplier.");
    }
  }

  const filteredSuppliers = searchQuery.trim()
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.company_name && s.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.gst_no && s.gst_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.contact_no && s.contact_no.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : suppliers;

  const totalItems = filteredSuppliers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + pageSize);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        style={{
          maxWidth: "850px",
          width: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Manage Saved Suppliers Directory</h2>
          <button className="close-btn" onClick={onClose}>
            X
          </button>
        </div>

        <div style={{ padding: "14px", overflowY: "auto", flex: 1 }}>
          {errorMsg && (
            <div className="error-banner" style={{ marginBottom: "12px" }}>
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")}>X</button>
            </div>
          )}

          {/* Action Row */}
          <div className="list-header" style={{ marginBottom: "12px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search supplier by name, company, GST or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "300px" }}
            />

            {!showForm ? (
              <button className="btn primary-btn" onClick={handleOpenAdd}>
                + Add New Supplier
              </button>
            ) : (
              <button className="btn secondary-btn" onClick={() => setShowForm(false)}>
                Cancel Form
              </button>
            )}
          </div>

          {/* Add / Edit Form Panel */}
          {showForm && (
            <form
              onSubmit={handleSaveSupplier}
              style={{
                background: "#edf4fc",
                border: "1px solid #7092be",
                padding: "12px",
                marginBottom: "14px",
              }}
            >
              <h3 style={{ fontSize: "0.92rem", color: "#103c6b", marginBottom: "10px", fontWeight: 700 }}>
                {editingSupplier ? "Edit Supplier Details" : "Add New Supplier Entry"}
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input
                    type="text"
                    placeholder="Full Name / Representative"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Company / Firm Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ABC Wholesalers Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginTop: "6px" }}>
                <div className="form-group">
                  <label>GST No</label>
                  <input
                    type="text"
                    placeholder="22AAAAA0000A1Z5"
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={contactNo}
                    onChange={(e) => setContactNo(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="supplier@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "6px" }}>
                <label>Billing Address / Notes</label>
                <input
                  type="text"
                  placeholder="Street, City, State, Pincode"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="btn secondary-btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary-btn">
                  {editingSupplier ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          )}

          {/* Suppliers List Table */}
          {loading ? (
            <div className="loading">Loading suppliers directory...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="empty-state">
              No saved suppliers found. Click "+ Add New Supplier" above to save supplier details in advance!
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: "350px" }}>
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Company / Firm</th>
                      <th>GST No</th>
                      <th>Contact Phone</th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSuppliers.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}</td>
                        <td>{s.company_name || "-"}</td>
                        <td>
                          <code className="barcode-tag">{s.gst_no || "-"}</code>
                        </td>
                        <td>{s.contact_no || "-"}</td>
                        <td>{s.email || "-"}</td>
                        <td>{s.address || "-"}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon edit-btn"
                              onClick={() => handleOpenEdit(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-icon delete-btn"
                              onClick={() => handleDeleteSupplier(s.id)}
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
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </>
          )}
        </div>

        <div className="form-actions" style={{ padding: "10px 14px", background: "#e8eff7", borderTop: "1px solid #7092be", justifyContent: "flex-end" }}>
          <button className="btn secondary-btn" onClick={onClose}>
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
};
