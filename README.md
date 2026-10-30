# IEM-UEM Kiosk

A single **Next.js (App Router)** application containing the kiosk display, the
admin portal, and the REST API. It deploys to Vercel as one project and uses a
hosted PostgreSQL database (Neon).

## Prerequisites

1. **Node.js** 20.9 or newer
2. A **Neon Postgres** database (or any hosted PostgreSQL)

## 1. Environment setup

Create `.env.local` in the repository root:

```env
# Neon pooled connection string (hostname contains "-pooler")
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Random secret used to sign admin portal JWTs
JWT_SECRET_KEY="your_secure_random_string_here"

# Optional super-admin overrides (defaults live in src/lib/db.ts)
# SUPER_ADMIN_USERNAME="you@example.edu"
# SUPER_ADMIN_PASSWORD="a-strong-password"
```

Generate a JWT secret with:

```bash
openssl rand -hex 32
```

## 2. Install and initialize

```bash
npm install
npm run init-db
```

`init-db` creates the tables and seeds a default admin account
(`admin` / `admin`). Change that password before exposing the admin portal.

## 3. Run locally

```bash
npm run dev
```

- Kiosk display: `http://localhost:3000`
- Admin portal: `http://localhost:3000/admin`

The kiosk fetches `/api/content` every 60 seconds and falls back to mock data in
`src/data/mockData.ts` if the API is unavailable.

## Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repository.
3. Leave the **Root Directory** as the repository root. Vercel detects Next.js
   automatically; do not set a custom build command.
4. Add these **Environment Variables** for Production (and Preview if desired):
   - `DATABASE_URL` — the Neon **pooled** connection string (`-pooler` host),
     including `?sslmode=require`
   - `JWT_SECRET_KEY` — a random secret
   - optionally `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`
5. Deploy.

Run `npm run init-db` once from your machine with the Neon `DATABASE_URL` in
`.env.local` before logging into the deployed admin portal. It is not run
automatically on Vercel.

Notes:

- `next.config.mjs` disables `output: "standalone"` when `VERCEL` is set, so
  Vercel uses its native output while the Dockerfile still works for
  self-hosting.
- Uploaded images are stored in Postgres and served through `/api/images/[id]`.
  Vercel's request body limit (4.5 MB) therefore caps each upload.
- Use the Neon pooled connection string on serverless deployments to avoid
  exhausting database connections.

## Project structure

```
src/
  app/
    page.tsx                 kiosk display (/)
    admin/page.tsx           admin portal (/admin)
    layout.tsx, globals.css  root layout and global styles
    api/                     REST API route handlers
  components/                kiosk UI (header, tickers, event banner)
  admin/                     admin portal components
  lib/
    api.ts                   client-side API helpers (same-origin)
    db.ts, auth.ts           server-side database and auth
  data/mockData.ts           fallback kiosk content
  scripts/initDb.ts          database bootstrap
public/                      branding and static assets
```

## Legacy self-hosting

The `deploy/` directory contains the old FastAPI/nginx/systemd setup and predates
this unified Next.js migration. It is not required for Vercel. For a Docker
deployment, the root `Dockerfile` builds the Next.js standalone server.
