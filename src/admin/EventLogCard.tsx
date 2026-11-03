import { useEffect, useState } from "react";
import {
  downloadEventLogs,
  fetchEventLogs,
  type EventLogEntry,
  type EventLogFilters,
} from "@/lib/api";

const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "submitted", label: "Submitted" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "content_updated", label: "Content updated" },
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-IN");
}

function scheduleLabel(log: EventLogEntry): string {
  const date = log.start_date
    ? log.start_date === log.end_date || !log.end_date
      ? log.start_date
      : `${log.start_date} – ${log.end_date}`
    : "";
  const time = log.start_time
    ? log.end_time
      ? `${log.start_time}–${log.end_time}`
      : log.start_time
    : "";
  return [date, time].filter(Boolean).join(" · ") || "—";
}

export default function EventLogCard({ token }: { token: string }) {
  const [filters, setFilters] = useState<EventLogFilters>({});
  const [logs, setLogs] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");

  const loadLogs = async (activeFilters: EventLogFilters = filters) => {
    setLoading(true);
    setMessage("");
    try {
      setLogs(await fetchEventLogs(token, activeFilters));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load the event log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDownload = async () => {
    setDownloading(true);
    setMessage("");
    try {
      const blob = await downloadEventLogs(token, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `event-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to export the event log.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Event log</h2>
      <p className="admin-card-desc">
        Audit trail of event submissions, reviews, edits, and deletions. Filter by
        date range, user, or action, then download as .xlsx.
      </p>

      <div className="admin-log-filters">
        <div className="admin-form-field">
          <label className="admin-label">From</label>
          <input
            className="admin-input"
            type="date"
            value={filters.from || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>
        <div className="admin-form-field">
          <label className="admin-label">To</label>
          <input
            className="admin-input"
            type="date"
            value={filters.to || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <div className="admin-form-field">
          <label className="admin-label">User</label>
          <input
            className="admin-input"
            placeholder="Username"
            value={filters.user || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, user: e.target.value }))}
          />
        </div>
        <div className="admin-form-field">
          <label className="admin-label">Action</label>
          <select
            className="admin-input"
            value={filters.action || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
          >
            {ACTIONS.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-log-filter-actions">
          <button className="admin-btn" onClick={() => loadLogs(filters)} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </button>
          <button
            className="admin-btn secondary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "Exporting..." : "Download .xlsx"}
          </button>
        </div>
      </div>

      {message && <div className="admin-error-banner">{message}</div>}

      {logs.length === 0 && !loading ? (
        <p className="admin-empty">No log entries match these filters.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Logged at</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Event</th>
                <th>Category</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTimestamp(log.created_at)}</td>
                  <td>{log.action}</td>
                  <td>{log.actor}</td>
                  <td>{log.actor_role}</td>
                  <td title={log.details || ""}>{log.title || "—"}</td>
                  <td>{log.category || "—"}</td>
                  <td>{scheduleLabel(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
