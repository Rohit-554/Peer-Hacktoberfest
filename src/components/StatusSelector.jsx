import { useState, useEffect } from "react";

// Define the available statuses
const STATUS_OPTIONS = [
  { label: "Online 🟢", value: "online" },
  { label: "Away 🟠", value: "away" },
  { label: "Busy 🔴", value: "busy" },
  { label: "Offline ⚫", value: "offline" },
];

export default function StatusSelector({ status: initialStatus, onChange }) {
  const [status, setStatus] = useState(initialStatus || "online");

  // Keep local state & trigger callback
  useEffect(() => {
    if (onChange) onChange(status);
  }, [status]);

  return (
    <select
      value={status}
      onChange={(e) => setStatus(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: "6px",
        fontWeight: 500,
        background: "#1e293b",
        color: "#e2e8f0",
        border: "1px solid #334155",
      }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
