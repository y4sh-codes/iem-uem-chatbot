import { useEffect, useState } from "react";
import {
  deleteEventSubmission,
  fetchEventSubmissions,
  submitEventSlides,
  updateEventSubmission,
  type EventSubmission,
  type RightPanelSlide,
} from "@/lib/api";
import { formatSchedule } from "@/lib/eventSchedule";
import EventScheduleFields from "./EventScheduleFields";

const EMPTY_SCHEDULE: Pick<
  RightPanelSlide,
  "category" | "start_date" | "end_date" | "start_time" | "end_time"
> = {
  category: "Events",
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
};

function statusLabel(status: EventSubmission["status"]) {
  if (status === "approved") return "Approved -- live on kiosk";
  if (status === "rejected") return "Rejected";
  return "Pending approval";
}

export default function EventSubmissionEditor({ token }: { token: string }) {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [details, setDetails] = useState("");
  const [schedule, setSchedule] = useState(EMPTY_SCHEDULE);
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
    setSchedule(EMPTY_SCHEDULE);
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
        await updateEventSubmission(token, editingId, { title, subtitle, details, ...schedule });
        setMessage("Updated and sent back for approval.");
      } else {
        await submitEventSlides(token, [{ title, subtitle, details, ...schedule }]);
        setMessage("Submitted -- waiting for approval.");
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
    setSchedule({
      category: submission.category || "Events",
      start_date: submission.start_date || null,
      end_date: submission.end_date || null,
      start_time: submission.start_time || null,
      end_time: submission.end_time || null,
    });
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
        only after a super admin approves them.
      </p>

      <form onSubmit={handleSubmit}>
        <label className="admin-label">Event Name</label>
        <input
          className="admin-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. UPCOMING EVENTS"
        />

        <label className="admin-label">Tagline</label>
        <input
          className="admin-input"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="e.g. Join us for our next big activities"
          maxLength={30}
        />

        <label className="admin-label">Description</label>
        <textarea
          className="admin-input"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. Detailed information about the event..."
          rows={3}
          maxLength={120}
        />

        <EventScheduleFields
          value={schedule}
          onChange={(patch) => setSchedule((prev) => ({ ...prev, ...patch }))}
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
              <div className="submission-meta">
                {submission.category || "Events"}
                {formatSchedule(submission) ? ` · ${formatSchedule(submission)}` : ""}
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
