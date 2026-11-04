import { useEffect, useState } from "react";
import {
  fetchContentChangeRequests,
  reviewContentChange,
  type ContentChangePayload,
  type ContentChangeRequest,
} from "@/lib/api";

function ChangePreview({ changes }: { changes: ContentChangePayload }) {
  return (
    <div className="content-change-preview">
      {changes.events && (
        <div>
          <strong>Event banners:</strong>{" "}
          {changes.events.length === 0
            ? "none"
            : changes.events.map((slide) => slide.title || "(untitled)").join(", ")}
        </div>
      )}
      {changes.right_slides && (
        <div>
          <strong>Event panel:</strong>{" "}
          {changes.right_slides.length === 0
            ? "none"
            : changes.right_slides
                .map((slide) => slide.title || "(untitled)")
                .join(", ")}
        </div>
      )}
      {changes.top_ticker && (
        <div>
          <strong>Top ticker:</strong>{" "}
          {changes.top_ticker.length === 0 ? "none" : changes.top_ticker.join(" · ")}
        </div>
      )}
      {changes.bottom_ticker && (
        <div>
          <strong>Bottom ticker:</strong>{" "}
          {changes.bottom_ticker.length === 0
            ? "none"
            : changes.bottom_ticker.join(" · ")}
        </div>
      )}
    </div>
  );
}

/**
 * Super-admin queue for content changes proposed by VC-office users. Approving
 * publishes the proposed content to the live kiosk.
 */
export default function ContentChangeReviewCard({
  token,
  onReviewed,
}: {
  token: string;
  onReviewed?: () => void | Promise<void>;
}) {
  const [requests, setRequests] = useState<ContentChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      setRequests(await fetchContentChangeRequests(token));
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load change requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    setMessage("");
    try {
      const result = await reviewContentChange(token, id, action);
      await loadRequests();
      setMessage(result.message);
      if (action === "approve") await onReviewed?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to review change request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Pending Content Changes</h2>
      <p className="admin-card-desc">
        Changes proposed by VC-office users. Approve to publish them to the kiosk,
        or reject to discard them.
      </p>

      {loading ? (
        <p className="admin-empty">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="admin-empty">No pending content changes.</p>
      ) : (
        <div className="submission-list">
          {requests.map((request) => (
            <div className="submission-row" key={request.id}>
              <div className="submission-row-head">
                <strong>{request.summary || "Content change"}</strong>
                <span className="admin-status pending">Pending</span>
              </div>
              <div className="submission-meta">
                Proposed by {request.created_by} ·{" "}
                {new Date(request.created_at).toLocaleString("en-IN")}
              </div>
              <ChangePreview changes={request.changes} />
              <div className="admin-card-footer" style={{ marginTop: "12px" }}>
                <button
                  className="admin-btn"
                  onClick={() => handleReview(request.id, "approve")}
                  disabled={busyId === request.id}
                >
                  {busyId === request.id ? "Working..." : "Approve"}
                </button>
                <button
                  className="admin-btn secondary"
                  onClick={() => handleReview(request.id, "reject")}
                  disabled={busyId === request.id}
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
