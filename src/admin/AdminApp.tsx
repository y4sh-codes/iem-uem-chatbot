import { useEffect, useState } from "react";
import {
  adminLogin,
  fetchContent,
  updateEvents,
  updateTickers,
  uploadEventImages,
  addAdminUser,
  resetPassword,
  submitContentChange,
  type AdminRole,
  type AdminSession,
  type KioskContent,
} from "@/lib/api";
import TickerEditor from "./TickerEditor";
import EventEditor from "./EventEditor";
import EventSubmissionEditor from "./EventSubmissionEditor";
import SubmissionReviewCard from "./SubmissionReviewCard";
import ContentChangeReviewCard from "./ContentChangeReviewCard";
import AdminActivityCard from "./AdminActivityCard";
import EventLogCard from "./EventLogCard";
import "./AdminApp.css";

const TOKEN_STORAGE_KEY = "iem_uem_admin_token";
const ROLE_STORAGE_KEY = "iem_uem_admin_role";
const USERNAME_STORAGE_KEY = "iem_uem_admin_username";

/** Plain eye when the password is visible, crossed-out eye when it is hidden. */
function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6.4 0 10 6 10 6a18.4 18.4 0 0 1-3.2 3.9" />
      <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4.4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [role, setRole] = useState<AdminRole>(
    () => (sessionStorage.getItem(ROLE_STORAGE_KEY) as AdminRole) || "admin"
  );
  const [username, setUsername] = useState(
    () => sessionStorage.getItem(USERNAME_STORAGE_KEY) || ""
  );
  const [content, setContent] = useState<KioskContent | null>(null);
  const [loadError, setLoadError] = useState("");

  const isSuperAdmin = role === "super_admin";
  const isVcOffice = role === "vc_office";
  const hasFullAccess = isSuperAdmin || isVcOffice;

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
    if (token && hasFullAccess) loadContent();
  }, [token, hasFullAccess]);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(ROLE_STORAGE_KEY);
    sessionStorage.removeItem(USERNAME_STORAGE_KEY);
    setToken(null);
    setRole("admin");
    setUsername("");
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
          setUsername(session.username);
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
              : isVcOffice
              ? "VC office -- changes require super-admin approval"
              : "Event admin -- submit slides for super-admin approval"}
          </div>
        </div>
        <button className="admin-btn secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="admin-main">
        {loadError && <div className="admin-error-banner">{loadError}</div>}

        {hasFullAccess ? (
          <>
            {content && (
              <EventEditor
                events={content.events || []}
                rightSlides={content.right_slides || []}
                onSave={async (events, rightSlides) => {
                  if (isVcOffice) {
                    const result = await submitContentChange(token, {
                      events,
                      right_slides: rightSlides,
                    });
                    return result.message;
                  }
                  const updated = await updateEvents(token, events, rightSlides);
                  setContent(updated);
                }}
                onUploadImage={async (file) => {
                  // uploadEventImages now returns { urls: string[] }
                  return await uploadEventImages(token, [file]);
                }}
              />
            )}

            {isSuperAdmin && (
              <SubmissionReviewCard token={token} onReviewed={loadContent} />
            )}
            {isSuperAdmin && (
              <ContentChangeReviewCard token={token} onReviewed={loadContent} />
            )}

            {content && (
              <TickerEditor
                title="Top Ticker -- Accreditations & Achievements"
                description="Scrolls across the top of the kiosk screen (accreditations, rankings, awards, etc.)"
                items={content.top_ticker}
                onSave={async (items) => {
                  if (isVcOffice) {
                    const result = await submitContentChange(token, {
                      top_ticker: items,
                    });
                    return result.message;
                  }
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
                  if (isVcOffice) {
                    const result = await submitContentChange(token, {
                      bottom_ticker: items,
                    });
                    return result.message;
                  }
                  const updated = await updateTickers(token, null, items);
                  setContent(updated);
                }}
              />
            )}

            {isSuperAdmin && (
              <AdminActivityCard token={token} currentUsername={username} />
            )}
            {isSuperAdmin && <EventLogCard token={token} />}
            {isSuperAdmin && <AdminUserCard token={token} />}
          </>
        ) : (
          <EventSubmissionEditor token={token} />
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: AdminSession) => void }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: "login" | "reset") => {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "reset") {
        const result = await resetPassword(username, password);
        setNotice(result.message || "Password updated. You can sign in now.");
        setMode("login");
        setPassword("");
      } else {
        const session = await adminLogin(username, password);
        onLoggedIn(session);
      }
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
        <p className="admin-login-subtitle">
          {mode === "reset"
            ? "Enter your username and a new password"
            : "Sign in to manage kiosk content"}
        </p>

        <label className="admin-label">Username</label>
        <input
          className="admin-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="admin-label">
          {mode === "reset" ? "New Password" : "Password"}
        </label>
        <div className="admin-password-wrap">
          <input
            className="admin-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="admin-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>

        {error && <div className="admin-error-banner">{error}</div>}
        {notice && <div className="admin-saved-message" style={{ marginTop: 12 }}>{notice}</div>}

        <button className="admin-btn admin-login-btn" type="submit" disabled={loading}>
          {loading ? "Working..." : mode === "reset" ? "Reset Password" : "Sign In"}
        </button>

        <button
          type="button"
          className="admin-link-button"
          onClick={() => switchMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? "Back to sign in" : "Forgot password? Reset it"}
        </button>
      </form>
    </div>
  );
}

function AdminUserCard({ token }: { token: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"admin" | "vc_office">("admin");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const result = await addAdminUser(token, username, password, role);
      setStatus(result.message);
      setUsername("");
      setPassword("");
      setShowPassword(false);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to add user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Manage admins</h2>
      <p className="admin-card-desc">
        Create an event admin or a VC office user. VC office changes require
        super-admin approval.
      </p>
      <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1rem" }}>
        <input
          className="admin-input"
          placeholder="New Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <div className="admin-password-wrap">
          <input
            className="admin-input"
            type={showPassword ? "text" : "password"}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="admin-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>

        <div className="admin-radio-group">
          <label className="admin-radio">
            <input
              type="radio"
              name="new-user-role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />
            Event admin (event panel access)
          </label>
          <label className="admin-radio">
            <input
              type="radio"
              name="new-user-role"
              value="vc_office"
              checked={role === "vc_office"}
              onChange={() => setRole("vc_office")}
            />
            VC office (changes need approval)
          </label>
        </div>

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
