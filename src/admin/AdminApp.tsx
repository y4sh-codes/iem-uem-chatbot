import { useEffect, useState } from "react";
import {
  adminLogin,
  fetchContent,
  updateEvents,
  updateTickers,
  uploadEventImages,
  addAdminUser,
  type AdminRole,
  type AdminSession,
  type KioskContent,
} from "@/lib/api";
import TickerEditor from "./TickerEditor";
import EventEditor from "./EventEditor";
import EventSubmissionEditor from "./EventSubmissionEditor";
import SubmissionReviewCard from "./SubmissionReviewCard";
import "./AdminApp.css";

const TOKEN_STORAGE_KEY = "iem_uem_admin_token";
const ROLE_STORAGE_KEY = "iem_uem_admin_role";
const USERNAME_STORAGE_KEY = "iem_uem_admin_username";

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [role, setRole] = useState<AdminRole>(
    () => (sessionStorage.getItem(ROLE_STORAGE_KEY) as AdminRole) || "admin"
  );
  const [content, setContent] = useState<KioskContent | null>(null);
  const [loadError, setLoadError] = useState("");

  const isSuperAdmin = role === "super_admin";

  const loadContent = async () => {
    try {
      const data = await fetchContent();
      setContent(data);
      setLoadError("");
    } catch {
      setLoadError("Could not reach the backend. Is it running?");
    }
  };

  useEffect(() => {
    if (token && isSuperAdmin) loadContent();
  }, [token, isSuperAdmin]);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(ROLE_STORAGE_KEY);
    sessionStorage.removeItem(USERNAME_STORAGE_KEY);
    setToken(null);
    setRole("admin");
    setContent(null);
  };

  if (!token) {
    return (
      <LoginScreen
        onLoggedIn={(session: AdminSession) => {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, session.token);
          sessionStorage.setItem(ROLE_STORAGE_KEY, session.role);
          sessionStorage.setItem(USERNAME_STORAGE_KEY, session.username);
          setToken(session.token);
          setRole(session.role);
        }}
      />
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-header-title">IEM-UEM Kiosk Admin</div>
          <div className="admin-header-subtitle">
            {isSuperAdmin
              ? "Super admin -- full kiosk access"
              : "Event admin -- submit slides for super-admin approval"}
          </div>
        </div>
        <button className="admin-btn secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="admin-main">
        {loadError && <div className="admin-error-banner">{loadError}</div>}

        {isSuperAdmin ? (
          <>
            {content && (
              <EventEditor
                events={content.events || []}
                rightSlides={content.right_slides || []}
                onSave={async (events, rightSlides) => {
                  const updated = await updateEvents(token, events, rightSlides);
                  setContent(updated);
                }}
                onUploadImage={async (file) => {
                  // uploadEventImages now returns { urls: string[] }
                  return await uploadEventImages(token, [file]);
                }}
              />
            )}

            <SubmissionReviewCard token={token} onReviewed={loadContent} />

            {content && (
              <TickerEditor
                title="Top Ticker -- Accreditations & Achievements"
                description="Scrolls across the top of the kiosk screen (accreditations, rankings, awards, etc.)"
                items={content.top_ticker}
                onSave={async (items) => {
                  const updated = await updateTickers(token, items, null);
                  setContent(updated);
                }}
              />
            )}

            {content && (
              <TickerEditor
                title="Bottom Ticker -- Campus Updates"
                description="Scrolls across the bottom of the kiosk screen (notices, placement drives, events, etc.)"
                items={content.bottom_ticker}
                onSave={async (items) => {
                  const updated = await updateTickers(token, null, items);
                  setContent(updated);
                }}
              />
            )}

            <AdminUserCard token={token} />
          </>
        ) : (
          <EventSubmissionEditor token={token} />
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: AdminSession) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await adminLogin(username, password);
      onLoggedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1 className="admin-login-title">IEM-UEM Kiosk Admin</h1>
        <p className="admin-login-subtitle">Sign in to manage kiosk content</p>

        <label className="admin-label">Username</label>
        <input
          className="admin-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="admin-label">Password</label>
        <input
          className="admin-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="admin-error-banner">{error}</div>}

        <button className="admin-btn admin-login-btn" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function AdminUserCard({ token }: { token: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const result = await addAdminUser(token, username, password);
      setStatus(result.message);
      setUsername("");
      setPassword("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to add user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Manage Event Admins</h2>
      <p className="admin-card-desc">
        Create an admin account. Event admins can only submit right-panel text slides,
        which go live after you approve them.
      </p>
      <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1rem" }}>
        <input
          className="admin-input"
          placeholder="New Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="admin-input"
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="admin-card-footer" style={{ marginTop: "0.5rem" }}>
          <button className="admin-btn" type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add User"}
          </button>
          {status && <span className="admin-saved-message">{status}</span>}
        </div>
      </form>
    </div>
  );
}
