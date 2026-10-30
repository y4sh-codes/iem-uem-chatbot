# Architecture

## Current state

```
┌──────────────────────────────────────────────┐
│                 Next.js app                  │
│                                              │
│  /            kiosk display (client page)    │
│  /admin       admin portal (client page)     │
│  /api/*       route handlers (Node runtime)  │
│                                              │
│              │ same-origin fetch             │
│              ▼                               │
│  PostgreSQL (Neon) via pg                    │
└──────────────────────────────────────────────┘
```

The frontend and backend are one Next.js application. Pages and API routes are
served from the same origin, so the client calls `/api/...` directly with no
CORS or separate backend URL.

## Request flow

**Kiosk loading content:**
`src/app/page.tsx` fetches `GET /api/content` on load and every 60 seconds,
then renders the header, tickers, and event banner. If the request fails it
keeps the mock data from `src/data/mockData.ts` on screen.

**Admin updating content:**
`/admin` → login (`POST /api/auth/login`) → JWT stored in `sessionStorage` →
`PUT /api/admin/content/tickers`, `PUT /api/admin/content/event`,
`POST /api/admin/content/event/images` (all require the JWT). Content is
persisted in PostgreSQL; uploaded images are stored in the `uploaded_images`
table and served by `GET /api/images/[id]`.

**Event submissions:**
Admins submit events through `/api/admin/event-submissions`; super-admins list
and review them through `/api/admin/event-submissions` and
`/api/admin/event-submissions/review`.

## Deployment

- **Platform:** Vercel, with the repository root as the project root.
- **Database:** Neon PostgreSQL, using the pooled connection string.
- **Environment variables:** `DATABASE_URL`, `JWT_SECRET_KEY`, and optional
  `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`.
- **Build output:** Vercel's native Next.js output. `output: "standalone"` is
  enabled only outside Vercel, for the Docker image.
- **Database bootstrap:** `npm run init-db` must be run once against Neon; it is
  not executed during the Vercel build.

## Serverless constraints

- Route handlers run as Node.js functions and use `pg`. Use Neon's pooled
  connection string (`-pooler` hostname) to avoid connection exhaustion.
- Uploaded images live in Postgres, so each upload is limited by Vercel's 4.5 MB
  request body limit.
- No application data is written to the local filesystem; the optional
  `data/content.json` seed is only used by `init-db` when present.

## Before deploying for real

- Change the seeded `admin` / `admin` account password.
- Set a real random `JWT_SECRET_KEY` in Vercel (the fallback is development-only).
- Confirm `DATABASE_URL` includes `sslmode=require`.
- Keep the admin portal behind HTTPS; Vercel provides this by default.
