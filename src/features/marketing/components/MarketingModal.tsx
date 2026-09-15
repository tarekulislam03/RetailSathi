import React, { useState, useEffect } from "react";
import { MarketingPerson, MarketingPersonInput } from "../types";

interface MarketingModalProps {
  editingPerson: MarketingPerson | null;
  onSave: (payload: MarketingPersonInput) => Promise<void>;
  onClose: () => void;
}

export const MarketingModal: React.FC<MarketingModalProps> = ({
  editingPerson,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [commission, setCommission] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPerson) {
      setName(editingPerson.name);
      setPhone(editingPerson.phone);
      setArea(editingPerson.area);
      setCommission(editingPerson.commission);
    } else {
      setName("");
      setPhone("");
      setArea("");
      setCommission("");
    }
  }, [editingPerson]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        sales: editingPerson ? editingPerson.sales : 0,
        commission: commission === "" ? 0 : Number(commission),
      });
    } catch (err: any) {
      console.error("Save marketing person error:", err);
      setError(err?.message || "Failed to save record.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <div className="modal-header">
          <div>
            <h2>
              {editingPerson ? "Edit Marketing Personnel" : "Add Marketing Personnel"}
            </h2>
            <div className="hint-text">
              {editingPerson
                ? `Updating details for #${editingPerson.id}`
                : "Enter marketing or delivery person details"}
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        {error && (
          <div
            className="error-banner"
            style={{ margin: "10px 16px 0", borderRadius: "2px" }}
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              X
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mktName">Full Name *</label>
            <input
              id="mktName"
              type="text"
              placeholder="e.g. Rahul Verma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="mktPhone">Phone No</label>
            <input
              id="mktPhone"
              type="text"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="mktArea">Area / Sector</label>
            <input
              id="mktArea"
              type="text"
              placeholder="e.g. North Zone / Sector 62"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="mktCommission">Commission Rate (%)</label>
            <input
              id="mktCommission"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 5 for 5%"
              value={commission}
              onChange={(e) =>
                setCommission(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>

          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : editingPerson
                ? "UPDATE RECORD"
                : "SAVE RECORD"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
