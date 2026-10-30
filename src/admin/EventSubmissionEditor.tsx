import { useEffect, useState } from "react";
import {
  deleteEventSubmission,
  fetchEventSubmissions,
  submitEventSlides,
  updateEventSubmission,
  type EventSubmission,
} from "@/lib/api";

function statusLabel(status: EventSubmission["status"]) {
  if (status === "approved") return "Approved -- live on kiosk";
  if (status === "rejected") return "Rejected";
  return "Pending super-admin approval";
}

export default function EventSubmissionEditor({ token }: { token: string }) {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [details, setDetails] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await fetchEventSubmissions(token);
      setSubmissions(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load your events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setDetails("");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !subtitle.trim() && !details.trim()) {
      setMessage("Add a title, subtitle, or details first.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      if (editingId !== null) {
        await updateEventSubmission(token, editingId, { title, subtitle, details });
        setMessage("Updated and sent back for approval.");
      } else {
        await submitEventSlides(token, [{ title, subtitle, details }]);
        setMessage("Submitted -- waiting for super-admin approval.");
      }
      resetForm();
      await loadSubmissions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to submit event.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (submission: EventSubmission) => {
    setEditingId(submission.id);
    setTitle(submission.title);
    setSubtitle(submission.subtitle);
    setDetails(submission.details);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this event submission?")) return;
    setMessage("");
    try {
      await deleteEventSubmission(token, id);
      if (editingId === id) resetForm();
      await loadSubmissions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete event.");
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Event Panel (Right Side Slideshow)</h2>
      <p className="admin-card-desc">
        Add text slides for the right-hand event panel. Your slides are shown on the kiosk
        only after the super admin approves them.
      </p>

      <form onSubmit={handleSubmit}>
        <label className="admin-label">Panel Title (Large)</label>
        <input
          className="admin-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. UPCOMING EVENTS"
        />

        <label className="admin-label">Panel Subtitle (Medium)</label>
        <input
          className="admin-input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="e.g. Join us for our next big activities"
        />

        <label className="admin-label">Panel Details (Small)</label>
        <textarea
          className="admin-input"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. Detailed information about the event..."
          rows={3}
        />

        <div className="admin-card-footer">
          <button className="admin-btn" type="submit" disabled={saving}>
            {saving
              ? "Submitting..."
              : editingId !== null
              ? "Update & Request Approval"
              : "Submit for Approval"}
          </button>
          {editingId !== null && (
            <button className="admin-btn secondary" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
          {message && <span className="admin-saved-message">{message}</span>}
        </div>
      </form>

      <h2 className="admin-card-title" style={{ marginTop: "28px" }}>Your Submissions</h2>
      <p className="admin-card-desc">
        Pending slides wait for the super admin. Approved slides are live on the kiosk.
      </p>

      {loading ? (
        <p className="admin-empty">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="admin-empty">No submissions yet -- add your first event above.</p>
      ) : (
        <div className="submission-list">
          {submissions.map((submission) => (
            <div className="submission-row" key={submission.id}>
              <div className="submission-row-head">
                <strong>{submission.title || "(untitled event)"}</strong>
                <span className={`admin-status ${submission.status}`}>
                  {statusLabel(submission.status)}
                </span>
              </div>
              {submission.subtitle && (
                <div className="submission-subtitle">{submission.subtitle}</div>
              )}
              {submission.details && (
                <div className="submission-details">{submission.details}</div>
              )}
              {(submission.status === "pending" || submission.status === "rejected") && (
                <div className="admin-card-footer" style={{ marginTop: "12px" }}>
                  <button
                    className="admin-btn secondary"
                    onClick={() => handleEdit(submission)}
                  >
                    {submission.status === "rejected" ? "Edit & Resubmit" : "Edit"}
                  </button>
                  <button
                    className="admin-btn secondary"
                    onClick={() => handleDelete(submission.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
