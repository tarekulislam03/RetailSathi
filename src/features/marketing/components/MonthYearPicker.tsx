import React from "react";

export interface MonthYearPickerProps {
  value: string; // Format: "YYYY-MM"
  onChange: (value: string) => void;
  idPrefix?: string;
}

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  idPrefix = "mkt",
}) => {
  const currentYearNum = new Date().getFullYear();

  // Parse YYYY-MM
  const parts = (value || "").split("-");
  const yearVal = parts[0] || String(currentYearNum);
  const monthVal =
    parts[1] || String(new Date().getMonth() + 1).padStart(2, "0");

  // Years range: 2020 to currentYear + 5
  const startYear = 2020;
  const endYear = Math.max(currentYearNum + 5, 2035);
  const years: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(String(y));
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <select
        id={`${idPrefix}-month-select`}
        className="search-input"
        style={{
          height: "30px",
          padding: "2px 8px",
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#1c3d5a",
          backgroundColor: "#ffffff",
          border: "1px solid #7092be",
          borderRadius: "3px",
          cursor: "pointer",
        }}
        value={monthVal}
        onChange={(e) => onChange(`${yearVal}-${e.target.value}`)}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        id={`${idPrefix}-year-select`}
        className="search-input"
        style={{
          height: "30px",
          padding: "2px 8px",
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#1c3d5a",
          backgroundColor: "#ffffff",
          border: "1px solid #7092be",
          borderRadius: "3px",
          cursor: "pointer",
        }}
        value={yearVal}
        onChange={(e) => onChange(`${e.target.value}-${monthVal}`)}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
};
