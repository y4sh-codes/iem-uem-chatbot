// Empty by default: the UI and API are served from the same Next.js origin.
// Set NEXT_PUBLIC_API_BASE_URL only if the API lives somewhere else.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface RightPanelSlide {
  title: string;
  subtitle: string;
  details: string;
}

export interface EventSlide {
  title: string;
  subtitle: string;
  image_url: string;
}

export interface KioskContent {
  top_ticker: string[];
  bottom_ticker: string[];
  events: EventSlide[];
  right_slides?: RightPanelSlide[];
}

export async function fetchContent(): Promise<KioskContent> {
  const res = await fetch(`${API_BASE_URL}/api/content`);
  if (!res.ok) throw new Error(`Failed to fetch content (${res.status})`);
  return res.json();
}

/** Resolves a possibly-relative image URL (e.g. "/uploads/xyz.jpg") returned
 * by the backend into a full URL pointing at the backend server. */
export function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

// --- Admin API -----------------------------------------------------------------
export type AdminRole = "super_admin" | "admin";

export interface AdminSession {
  token: string;
  username: string;
  role: AdminRole;
}

export async function adminLogin(username: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid username or password");
  const data = await res.json();
  return {
    token: data.access_token as string,
    username: (data.username as string) || username,
    role: data.role === "super_admin" ? "super_admin" : "admin",
  };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function updateTickers(
  token: string,
  top_ticker: string[] | null,
  bottom_ticker: string[] | null
): Promise<KioskContent> {
  const res = await fetch(`${API_BASE_URL}/api/admin/content/tickers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ top_ticker, bottom_ticker }),
  });
  if (!res.ok) throw new Error(`Failed to update tickers (${res.status})`);
  return res.json();
}

export async function updateEvents(
  token: string,
  events: EventSlide[],
  right_slides: RightPanelSlide[]
): Promise<KioskContent> {
  const res = await fetch(`${API_BASE_URL}/api/admin/content/event`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ events, right_slides }),
  });
  if (!res.ok) throw new Error(`Failed to update events (${res.status})`);
  return res.json();
}

export async function uploadEventImages(token: string, files: FileList | File[]): Promise<{ urls: string[] }> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  const res = await fetch(`${API_BASE_URL}/api/admin/content/event/images`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to upload images (${res.status})`);
  }
  return res.json();
}

export async function addAdminUser(token: string, username: string, password: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add user (${res.status})`);
  }
  return res.json();
}

// --- Event submissions (regular admins request, super admin approves) ----------
export type EventSubmissionStatus = "pending" | "approved" | "rejected";

export interface EventSubmission {
  id: number;
  created_by: string;
  title: string;
  subtitle: string;
  details: string;
  status: EventSubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export async function fetchEventSubmissions(token: string): Promise<EventSubmission[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/event-submissions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to load event submissions (${res.status})`);
  const data = await res.json();
  return (data.submissions || []) as EventSubmission[];
}

export async function submitEventSlides(
  token: string,
  slides: RightPanelSlide[]
): Promise<EventSubmission[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/event-submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ slides }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to submit event (${res.status})`);
  }
  const data = await res.json();
  return (data.submissions || []) as EventSubmission[];
}

export async function updateEventSubmission(
  token: string,
  id: number,
  slide: RightPanelSlide
): Promise<EventSubmission> {
  const res = await fetch(`${API_BASE_URL}/api/admin/event-submissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ id, ...slide }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update event (${res.status})`);
  }
  const data = await res.json();
  return data.submission as EventSubmission;
}

export async function deleteEventSubmission(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/event-submissions?id=${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete event (${res.status})`);
  }
}

export async function reviewEventSubmission(
  token: string,
  id: number,
  action: "approve" | "reject"
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/event-submissions/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ id, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to review event (${res.status})`);
  }
}
