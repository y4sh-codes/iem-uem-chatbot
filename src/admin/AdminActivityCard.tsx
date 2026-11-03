import { useEffect, useState } from "react";
import {
  deleteAdminUser,
  fetchAdminActivity,
  updateAdminUserRole,
  type AdminActivity,
  type AdminRole,
  type AdminUser,
} from "@/lib/api";
import { formatSchedule } from "@/lib/eventSchedule";

function roleLabel(role: AdminRole): string {
  if (role === "super_admin") return "Super admin";
  if (role === "vc_office") return "VC office";
  return "Event admin";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN");
}

export default function AdminActivityCard({
  token,
  currentUsername,
}: {
  token: string;
  currentUsername?: string;
}) {
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<
    Record<number, "admin" | "vc_office">
  >({});
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadActivity = async () => {
    setLoading(true);
    setMessage("");
    try {
      setActivity(await fetchAdminActivity(token));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load admin activity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const draftRole = (user: AdminUser): "admin" | "vc_office" =>
    roleDrafts[user.id] ?? (user.role === "vc_office" ? "vc_office" : "admin");

  const handleRoleSave = async (id: number) => {
    const role = roleDrafts[id];
    if (!role) return;

    setSavingRoleId(id);
    try {
      const result = await updateAdminUserRole(token, id, role);
      await loadActivity();
      setRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to change role.");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!window.confirm(`Delete admin "${username}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      const result = await deleteAdminUser(token, id);
      await loadActivity();
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete admin.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-heading">
        <div>
          <h2 className="admin-card-title">Admin activity</h2>
          <p className="admin-card-desc">
            Every admin account and the events they have posted.
          </p>
        </div>
        <button className="admin-btn secondary" onClick={loadActivity} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {message && <div className="admin-error-banner">{message}</div>}

      {activity && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Events</th>
                  <th>Last event</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activity.users.map((user) => {
                  const canDelete =
                    user.role !== "super_admin" && user.username !== currentUsername;
                  const canChangeRole = user.role !== "super_admin";
                  const selectedRole = draftRole(user);
                  const roleChanged = canChangeRole && selectedRole !== user.role;
                  return (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>
                        {canChangeRole ? (
                          <select
                            className="admin-input admin-role-select"
                            value={selectedRole}
                            onChange={(e) =>
                              setRoleDrafts((prev) => ({
                                ...prev,
                                [user.id]: e.target.value as "admin" | "vc_office",
                              }))
                            }
                            disabled={savingRoleId === user.id}
                            aria-label={`Role for ${user.username}`}
                          >
                            <option value="admin">Event admin</option>
                            <option value="vc_office">VC office</option>
                          </select>
                        ) : (
                          roleLabel(user.role)
                        )}
                      </td>
                      <td>{user.event_count}</td>
                      <td>{formatTimestamp(user.last_event_at)}</td>
                      <td>
                        <div className="admin-row-actions">
                          {roleChanged && (
                            <button
                              className="admin-btn table-action"
                              onClick={() => handleRoleSave(user.id)}
                              disabled={savingRoleId === user.id}
                            >
                              {savingRoleId === user.id ? "Saving..." : "Save role"}
                            </button>
                          )}
                          {canDelete ? (
                            <button
                              className="admin-btn danger table-action"
                              onClick={() => handleDelete(user.id, user.username)}
                              disabled={deletingId === user.id}
                            >
                              {deletingId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : (
                            !roleChanged && <span className="admin-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="admin-subheading">Posted events</h3>
          {activity.events.length === 0 ? (
            <p className="admin-empty">No events have been posted yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Posted by</th>
                    <th>Event</th>
                    <th>Category</th>
                    <th>Schedule</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.created_by}</td>
                      <td>{event.title || "(untitled event)"}</td>
                      <td>{event.category || "Events"}</td>
                      <td>{formatSchedule(event) || "—"}</td>
                      <td>
                        <span className={`admin-status ${event.status}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
