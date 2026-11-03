# Admin Roles, Event Scheduling & Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-service password reset, the `vc_office` role, category/date/time scheduling for right-panel slides, an event audit log with XLSX export, and improved admin management.

**Architecture:** Keep the existing single Next.js App Router app and PostgreSQL/JSONB content model. Add scheduling metadata to right-panel slides and event submissions, filter slides client-side against the local date, add an append-only `event_logs` table written by the existing mutation routes, and gate routes with `super_admin` vs. full-access (`super_admin` + `vc_office`) helpers.

**Tech Stack:** Next.js 16 route handlers, React 19, `pg`, `bcryptjs`, `jsonwebtoken`, `exceljs` (new dependency).

**Spec:** Conversation requirements 1–7 (2026-11-03). No separate design doc; user opted out of design questions.

## Global Constraints

- Do not change unrelated behavior, styling, or existing event workflows.
- `vc_office` gets every `super_admin` capability except Manage admins, admin activity, and event log access.
- Only `super_admin` may create users or view admin activity/logs.
- Categories are exactly `Conference`, `Hackathons`, `Events`; one per slide.
- Dates are `YYYY-MM-DD`; times are `HH:MM`; end date is inclusive; empty end date means single day.
- Past dates must never appear in the kiosk fallback.
- Password reset requires only username + new password (explicit user decision).

## Review Focus

- Date filtering at local midnight (timezone-safe, no UTC day shift).
- Category fallback when a dated event exists vs. does not exist.
- `vc_office` cannot reach any super-admin-only route even by calling the API directly.
- Log writes must not silently disappear on submit/update/delete/review.
- XLSX export must return a real workbook with the active filters applied.

---

### Task 1: Shared types and schedule logic

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/eventSchedule.ts`
- Test: `/tmp/opencode/eventSchedule.test.ts` (throwaway)

**Interfaces:**
- Produces: `EventCategory`, `EVENT_CATEGORIES`, `RightPanelSlide` with optional `category/start_date/end_date/start_time/end_time`, `localDateKey(date?)`, `selectVisibleRightSlides(slides, todayKey)`, `formatSchedule(slide)`.

- [ ] Add category/date/time fields to `RightPanelSlide` and `EventSlide` stays unchanged.
- [ ] Implement category normalization (unknown/missing → `Events`) and date/time parsing.
- [ ] Implement visibility: dated `Events` only on their inclusive range; `Conference`/`Hackathons` visible unless their end date is past; undated slides always visible.
- [ ] Implement selection: dated events today win; otherwise visible Conference/Hackathons + undated legacy slides.
- [ ] Write and run throwaway tests for today, past, future, range, single-day, and fallback cases.
- [ ] `npx tsc --noEmit`.

### Task 2: Database schema and logging helper

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/eventLog.ts`

**Interfaces:**
- Produces: `event_submissions` columns `category`, `start_date`, `end_date`, `start_time`, `end_time`; `event_logs` table; `logEvent(executor, input)`, `queryEventLogs(filters)`.

- [ ] Add idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements and `event_logs` DDL to `ensureAdminAuthSchema`.
- [ ] Create `logEvent` accepting a pool/client-like executor and an input containing action, actor, actorRole, targetUser, submissionId, title, category, dates, times, details.
- [ ] Create `queryEventLogs({ from, to, user, action, limit })` with parameterized filters.
- [ ] Run `initDb` against the test tunnel and confirm tables/columns.

### Task 3: Auth, roles, reset password

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`

**Interfaces:**
- Produces: `isVcOffice(user)`, `hasFullAccess(user)`, `fullAccessError(request)`; reset endpoint `POST /api/auth/reset-password` `{ username, newPassword }`.

- [ ] Preserve `vc_office` on login; demo fallback remains `admin`.
- [ ] Add full-access helper that returns 401/403 responses like `superAdminError`.
- [ ] Implement unauthenticated reset: validate inputs, hash, update by username, 404 when absent, 500 on error.
- [ ] Verify reset updates the hash and login accepts the new password.

### Task 4: Content and submission APIs with scheduling + logging

**Files:**
- Modify: `src/app/api/admin/content/event/route.ts`
- Modify: `src/app/api/admin/content/tickers/route.ts`
- Modify: `src/app/api/admin/content/event/images/route.ts`
- Modify: `src/app/api/admin/event-submissions/route.ts`
- Modify: `src/app/api/admin/event-submissions/review/route.ts`

**Interfaces:**
- Consumes: `hasFullAccess`, `fullAccessError`, `logEvent`.
- Produces: submission rows include category/date/time; approved slides copy those fields into `kiosk_content.right_slides`; every mutation writes one log row.

- [ ] Switch content/image routes from super-admin-only to full access.
- [ ] Accept and validate category/date/time on submission POST/PUT; return 400 for invalid values or end < start.
- [ ] Log submitted/updated/deleted/approved/rejected with actor, role, target user, schedule.
- [ ] Log direct event-content saves as `content_updated`.
- [ ] Ensure super admin/vc_office see all submissions; regular admins see their own.

### Task 5: Admin users, activity, logs, XLSX export

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/logs/route.ts`
- Create: `src/app/api/admin/logs/export/route.ts`
- Modify: `package.json` / lockfile (`exceljs`)

**Interfaces:**
- Produces: `POST /api/admin/users` accepts `role` (`admin` | `vc_office`); `GET /api/admin/users` returns `{ users, events }`; `GET /api/admin/logs` returns `{ logs }`; `GET /api/admin/logs/export` returns XLSX.

- [ ] Restrict user creation/list to `super_admin`; validate role; default to `admin`.
- [ ] Return users with event counts plus all submissions for the activity view.
- [ ] Implement filtered log listing and workbook export with `exceljs`.
- [ ] Install `exceljs` and verify build.

### Task 6: Admin UI — reset, roles, manage admins, activity, logs

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Modify: `src/admin/AdminApp.css`
- Modify: `src/admin/EventEditor.tsx`
- Modify: `src/admin/EventSubmissionEditor.tsx`
- Modify: `src/admin/SubmissionReviewCard.tsx`
- Create: `src/admin/EventScheduleFields.tsx`
- Create: `src/admin/AdminActivityCard.tsx`
- Create: `src/admin/EventLogCard.tsx`
- Modify: `src/lib/api.ts` (client helpers)

**Interfaces:**
- Consumes: all API endpoints above.
- Produces: login/reset toggle, eye toggle, role radio, scheduled slide form, super-admin activity/log cards.

- [ ] Login screen: add reset mode with username/new password, success/error, eye toggle.
- [ ] `vc_office` sees the full editor panel but no Manage admins/activity/log cards.
- [ ] Rename to "Manage admins"; add role radio and password eye toggle.
- [ ] Add shared schedule fields to direct editor and submission editor.
- [ ] Show category/date/time in submission lists and review queue.
- [ ] Add super-admin activity card and filtered log card with download.
- [ ] Add scoped CSS for forms, tables, password toggle, filters.

### Task 7: Kiosk date filtering and display

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/EventBanner.tsx`
- Modify: `src/components/EventBanner.css`

- [ ] Tick a local-date key every 60 seconds and filter right slides with `selectVisibleRightSlides`.
- [ ] Display category label and formatted date/time range in the right panel.
- [ ] Keep left image slides and tickers unchanged.

### Task 8: Verification

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] DB integration through local tunnel: init schema, reset password, role gates, submission scheduling, log query/export.
- [ ] Confirm dev server compiles after changes and document the remaining WSL DNS fix for the user.
