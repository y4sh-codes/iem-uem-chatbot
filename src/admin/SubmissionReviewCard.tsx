import { useEffect, useState } from "react";
import {
  fetchEventSubmissions,
  reviewEventSubmission,
  type EventSubmission,
} from "@/lib/api";

/**
 * Super-admin queue for event slides submitted by regular admins.
 * Approving publishes the slide to the kiosk right-hand panel.
 */
interface SubmissionReviewCardProps {
  token: string;
  /** Called after a review so the parent can refresh live kiosk content. */
  onReviewed?: () => void | Promise<void>;
}

export default function SubmissionReviewCard({ token, onReviewed }: SubmissionReviewCardProps) {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await fetchEventSubmissions(token);
      setSubmissions(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pending = submissions.filter((submission) => submission.status === "pending");

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    setMessage("");
    try {
      await reviewEventSubmission(token, id, action);
      setMessage(
        action === "approve"
          ? "Approved -- the slide is now live on the kiosk."
          : "Rejected -- the slide will not be shown."
      );
      await loadSubmissions();
      await onReviewed?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to review submission.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Pending Event Approvals</h2>
      <p className="admin-card-desc">
        Slides submitted by event admins. Approve to publish them to the right-hand
        event panel, or reject to keep them off the kiosk.
      </p>

      {loading ? (
        <p className="admin-empty">Loading...</p>
      ) : pending.length === 0 ? (
        <p className="admin-empty">No pending submissions.</p>
      ) : (
        <div className="submission-list">
          {pending.map((submission) => (
            <div className="submission-row" key={submission.id}>
              <div className="submission-row-head">
                <strong>{submission.title || "(untitled event)"}</strong>
                <span className="admin-status pending">Pending</span>
              </div>
              <div className="submission-meta">
                Submitted by {submission.created_by}
              </div>
              {submission.subtitle && (
                <div className="submission-subtitle">{submission.subtitle}</div>
              )}
              {submission.details && (
                <div className="submission-details">{submission.details}</div>
              )}
              <div className="admin-card-footer" style={{ marginTop: "12px" }}>
                <button
                  className="admin-btn"
                  onClick={() => handleReview(submission.id, "approve")}
                  disabled={busyId === submission.id}
                >
                  {busyId === submission.id ? "Working..." : "Approve"}
                </button>
                <button
                  className="admin-btn secondary"
                  onClick={() => handleReview(submission.id, "reject")}
                  disabled={busyId === submission.id}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <span className="admin-saved-message">{message}</span>}
    </div>
  );
}
