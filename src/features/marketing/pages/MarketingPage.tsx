import React, { useEffect, useState } from "react";
import { MarketingPerson, MarketingPersonInput } from "../types";
import {
  fetchMarketingPersons,
  createMarketingPerson,
  updateMarketingPerson,
  deleteMarketingPerson,
} from "../services/marketingService";
import { MarketingTable } from "../components/MarketingTable";
import { MarketingModal } from "../components/MarketingModal";
import { MarketingDetailsModal } from "../components/MarketingDetailsModal";
import { MonthYearPicker } from "../components/MonthYearPicker";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const MarketingPage: React.FC = () => {
  const [persons, setPersons] = useState<MarketingPerson[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<MarketingPerson | null>(null);

  // Details Modal state
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewDetailsPerson, setViewDetailsPerson] = useState<MarketingPerson | null>(null);

  async function loadData(monthStr?: string, silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const m = monthStr !== undefined ? monthStr : selectedMonth;
      const list = await fetchMarketingPersons(m);
      setPersons(list);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load marketing personnel:", err);
        setError(err?.message || "Failed to load marketing personnel from database.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadData(selectedMonth, true), 3000);

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  function handleOpenAddModal() {
    setEditingPerson(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(person: MarketingPerson) {
    setEditingPerson(person);
    setIsModalOpen(true);
  }

  function handleOpenDetailsModal(person: MarketingPerson) {
    setViewDetailsPerson(person);
    setIsDetailsOpen(true);
  }

  async function handleSavePerson(payload: MarketingPersonInput) {
    if (editingPerson) {
      await updateMarketingPerson(editingPerson.id, payload);
    } else {
      await createMarketingPerson(payload);
    }
    setIsModalOpen(false);
    await loadData(selectedMonth);
  }

  async function handleDeletePerson(id: number) {
    if (!window.confirm("Are you sure you want to delete this marketing record?")) {
      return;
    }
    try {
      await deleteMarketingPerson(id);
      await loadData(selectedMonth);
    } catch (err: any) {
      console.error("Delete marketing person error:", err);
      setError(err?.message || "Failed to delete record.");
    }
  }

  const filteredPersons = persons.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Marketing & Delivery Personnel ({filteredPersons.length})</h2>

          <div className="list-actions">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, phone, area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label
                style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a385c" }}
              >
                Month:
              </label>
              <MonthYearPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                idPrefix="page-mkt"
              />
            </div>

            <button className="btn primary-btn" onClick={handleOpenAddModal}>
              + ADD PERSONNEL
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading marketing personnel...</div>
        ) : filteredPersons.length === 0 ? (
          <div className="empty-state">
            {searchTerm
              ? "No matching personnel records found."
              : "No marketing or delivery personnel recorded yet."}
          </div>
        ) : (
          <MarketingTable
            persons={filteredPersons}
            onEdit={handleOpenEditModal}
            onDelete={handleDeletePerson}
            onViewDetails={handleOpenDetailsModal}
          />
        )}
      </section>

      {isModalOpen && (
        <MarketingModal
          editingPerson={editingPerson}
          onSave={handleSavePerson}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <MarketingDetailsModal
        person={viewDetailsPerson}
        isOpen={isDetailsOpen}
        initialMonth={selectedMonth}
        onClose={() => {
          setIsDetailsOpen(false);
          setViewDetailsPerson(null);
        }}
      />
    </>
  );
};
