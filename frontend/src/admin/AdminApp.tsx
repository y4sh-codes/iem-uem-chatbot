import { useEffect, useState } from "react";
import {
  adminLogin,
  fetchContent,
  refreshBackendIndex,
  updateEvents,
  updateTickers,
  uploadEventImages,
  type KioskContent,
} from "../api";
import TickerEditor from "./TickerEditor";
import EventEditor from "./EventEditor";
import "./AdminApp.css";

const TOKEN_STORAGE_KEY = "iem_uem_admin_token";

export default function AdminApp() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [content, setContent] = useState<KioskContent | null>(null);
  const [loadError, setLoadError] = useState("");

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
    loadContent();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  };

  if (!token) {
    return (
      <LoginScreen
        onLoggedIn={(t) => {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-header-title">IEM-UEM Kiosk Admin</div>
          <div className="admin-header-subtitle">Manage what's shown on the campus-gate display</div>
        </div>
        <button className="admin-btn secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="admin-main">
        {loadError && <div className="admin-error-banner">{loadError}</div>}

        {content && (
          <>
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

            <TickerEditor
              title="Top Ticker -- Accreditations & Achievements"
              description="Scrolls across the top of the kiosk screen (accreditations, rankings, awards, etc.)"
              items={content.top_ticker}
              onSave={async (items) => {
                const updated = await updateTickers(token, items, null);
                setContent(updated);
              }}
            />

            <TickerEditor
              title="Bottom Ticker -- Campus Updates"
              description="Scrolls across the bottom of the kiosk screen (notices, placement drives, events, etc.)"
              items={content.bottom_ticker}
              onSave={async (items) => {
                const updated = await updateTickers(token, null, items);
                setContent(updated);
              }}
            />

            <RagIndexCard token={token} />
          </>
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = await adminLogin(username, password);
      onLoggedIn(token);
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

function RagIndexCard({ token }: { token: string }) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setStatus("");
    try {
      const result = await refreshBackendIndex(token);
      setStatus(`Index refreshed -- ${result.chunk_count} chunks indexed.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to refresh index.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Chatbot Knowledge Base</h2>
      <p className="admin-card-desc">
        After adding new files to the backend's <code>knowledge_base/</code> folder, click below
        to re-index them without restarting the server.
      </p>
      <div className="admin-card-footer">
        <button className="admin-btn" onClick={handleRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Index"}
        </button>
        {status && <span className="admin-saved-message">{status}</span>}
      </div>
    </div>
  );
}
