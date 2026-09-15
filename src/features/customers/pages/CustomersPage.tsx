import React, { useEffect, useState } from "react";
import { Customer, CustomerInput } from "../types";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  settleCustomerDues,
} from "../services/customerService";
import { CustomerTable } from "../components/CustomerTable";
import { CustomerModal } from "../components/CustomerModal";
import { CustomerPurchasesModal } from "../components/CustomerPurchasesModal";
import { ClearDuesModal } from "../components/ClearDuesModal";

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Search & Modal State
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // View Purchases Modal State
  const [viewPurchasesCustomer, setViewPurchasesCustomer] = useState<Customer | null>(null);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState<boolean>(false);

  // Clear Dues Modal State
  const [clearDuesCustomer, setClearDuesCustomer] = useState<Customer | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const list = await fetchCustomers();
      setCustomers(list);
    } catch (err: any) {
      console.error("Failed to load customer records:", err);
      setError(err?.message || "Failed to load customers from database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function showToast(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }

  function handleOpenAdd() {
    setEditingCustomer(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(customer: Customer) {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  }

  function handleOpenPurchases(customer: Customer) {
    setViewPurchasesCustomer(customer);
    setIsPurchasesModalOpen(true);
  }

  function handleOpenClearDues(customer: Customer) {
    setClearDuesCustomer(customer);
  }

  async function handleSaveCustomer(payload: CustomerInput) {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, payload);
      showToast(`Updated customer "${payload.name}" successfully!`);
    } else {
      await createCustomer(payload);
      showToast(`Added new customer "${payload.name}" successfully!`);
    }
    setIsModalOpen(false);
    setEditingCustomer(null);
    await loadData();
  }

  async function handleDeleteCustomer(id: number) {
    const cust = customers.find((c) => c.id === id);
    const confirmMsg = cust
      ? `Are you sure you want to delete customer "${cust.name}"?`
      : "Are you sure you want to delete this customer?";

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteCustomer(id);
      showToast("Customer record deleted.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete customer.");
    }
  }

  async function handleConfirmSettleDues(customerId: number, amountToClear: number) {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    try {
      await settleCustomerDues(customerId, amountToClear);
      if (amountToClear >= cust.dues) {
        showToast(`Cleared full dues of ₹${cust.dues.toFixed(2)} for "${cust.name}".`);
      } else {
        const remaining = cust.dues - amountToClear;
        showToast(
          `Cleared partial dues of ₹${amountToClear.toFixed(2)} for "${cust.name}". Remaining due: ₹${remaining.toFixed(2)}.`
        );
      }
      setClearDuesCustomer(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to clear customer dues.");
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.purchase_item_name &&
        c.purchase_item_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      {notification && (
        <div
          className="error-banner"
          style={{
            background: "linear-gradient(to bottom, #e3f2fd 0%, #bbdefb 100%)",
            color: "#0d47a1",
            borderColor: "#1976d2",
          }}
        >
          <span>{notification}</span>
          <button onClick={() => setNotification(null)}>X</button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Customer Directory ({filteredCustomers.length})</h2>
          <div className="list-actions">
            <input
              type="text"
              className="search-input"
              placeholder="Search name, phone, address, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              className="btn primary-btn add-product-btn"
              onClick={handleOpenAdd}
            >
              + ADD CUSTOMER
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading customer database...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              "No matching customer records found."
            ) : (
              <div>
                <p>No customers recorded in database yet.</p>
                <button
                  className="btn primary-btn"
                  style={{ marginTop: "12px" }}
                  onClick={handleOpenAdd}
                >
                  + ADD CUSTOMER NOW
                </button>
              </div>
            )}
          </div>
        ) : (
          <CustomerTable
            customers={filteredCustomers}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteCustomer}
            onSettleDues={handleOpenClearDues}
            onViewPurchases={handleOpenPurchases}
          />
        )}
      </section>

      {isModalOpen && (
        <CustomerModal
          editingCustomer={editingCustomer}
          onSave={handleSaveCustomer}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <CustomerPurchasesModal
        customer={viewPurchasesCustomer}
        isOpen={isPurchasesModalOpen}
        onClose={() => {
          setIsPurchasesModalOpen(false);
          setViewPurchasesCustomer(null);
        }}
      />

      <ClearDuesModal
        customer={clearDuesCustomer}
        isOpen={Boolean(clearDuesCustomer)}
        onClose={() => setClearDuesCustomer(null)}
        onConfirm={handleConfirmSettleDues}
      />
    </>
  );
};
