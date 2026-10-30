# Unified Next.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the separate Vite frontend and Next.js backend into one root-level Next.js app that serves the kiosk, admin portal, and API, deployable to Vercel with Neon Postgres.

**Architecture:** Promote `backend/` to the repository root so Next.js owns `src/app`, `src/components`, `src/admin`, and all `/api` routes. Port the Vite kiosk/admin UI into App Router pages (`/` and `/admin`), delete the Vite project, and call the API through same-origin relative URLs so no CORS or separate frontend host is needed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `pg` (Neon Postgres), `jsonwebtoken`, `bcryptjs`.

**Spec:** User request (2026-10-30): "make the whole thing a full nextjs app so that i can deploy the whole frontend and backend as a unified app on vercel"; database is Neon.

## Global Constraints

- Keep all existing kiosk and admin functionality; this is a migration, not a redesign.
- Do not change API route paths or response shapes.
- Do not commit the existing uncommitted changes unless the human asks.
- Secrets stay in `.env.local` / Vercel environment settings; never in tracked files.
- Preserve the current visual design and CSS.
- Vercel must work with zero config beyond Root Directory `/` and environment variables.

## Review Focus

- Browser-only code (`sessionStorage`, `useEffect`, polling) must run as client components.
- Same-origin API calls must not double-prefix `/api` when `NEXT_PUBLIC_API_BASE_URL` is unset.
- Image URLs returned as `/api/images/...` must resolve on the same origin.
- Server-only `pg` code must never be imported by client components.
- Neon connections must use the pooled connection string and survive serverless cold starts.

---

### Task 1: Promote `backend/` to the repository root

**Files:**
- Move: `backend/src/**` → `src/**`
- Move: `backend/{package.json,package-lock.json,tsconfig.json,next.config.mjs,eslint.config.mjs,Dockerfile,.dockerignore,AGENTS.md,CLAUDE.md}` → repo root
- Delete: `backend/next.config.ts`, `backend/postcss.config.mjs`, `backend/README.md`, `backend/.gitignore`

**Interfaces:**
- Produces: root `package.json` with `next dev`, `next build`, `next start`, `init-db`, `lint`; `@/*` path alias resolves to `./src/*`.

- [ ] Move tracked backend files to root with `git mv`.
- [ ] Remove duplicate/obsolete backend config files.
- [ ] Move `backend/.env.local` to root `.env.local`; delete the obsolete Vite env file.
- [ ] Delete untracked `backend/node_modules`, `backend/.next`, and `backend/tsconfig.tsbuildinfo`.

### Task 2: Port the kiosk UI into the App Router

**Files:**
- Move: `frontend/src/App.tsx` → `src/app/page.tsx`
- Move: `frontend/src/App.css` → `src/app/kiosk.css`
- Move: `frontend/src/components/**` → `src/components/**`
- Move: `frontend/src/data/mockData.ts` → `src/data/mockData.ts`
- Move: `frontend/src/index.css` → `src/app/globals.css`
- Move: `frontend/public/**` → `public/**`
- Modify: `src/app/page.tsx`, `src/components/EventBanner.tsx`

**Interfaces:**
- Produces: `src/app/page.tsx` default-exports the kiosk page and uses `@/components/*`, `@/data/mockData`, `@/lib/api`.

- [ ] Add `"use client"` to the kiosk page and rewrite relative imports to `@/`.
- [ ] Import kiosk CSS from the page and globals from the layout.
- [ ] Move public branding/favicon assets to `public/`.

### Task 3: Port the admin portal to `/admin`

**Files:**
- Move: `frontend/src/admin/**` → `src/admin/**`
- Move: `frontend/src/api.ts` → `src/lib/api.ts`
- Create: `src/app/admin/page.tsx`
- Modify: `src/admin/*.tsx` imports, `src/lib/api.ts`

**Interfaces:**
- Produces: `/admin` renders `AdminApp`; all client API helpers use same-origin URLs.

- [ ] Create `src/app/admin/page.tsx` as a client page rendering `AdminApp`.
- [ ] Rewrite `../api` imports to `@/lib/api`.
- [ ] Change `API_BASE_URL` to `process.env.NEXT_PUBLIC_API_BASE_URL || ""`.

### Task 4: Configure the unified Next.js app

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `next.config.mjs`, `package.json`, `.gitignore`
- Delete: remaining Vite project files (`frontend/index.html`, `frontend/*.config.*`, `frontend/vercel.json`, `frontend/src/main.tsx`, `frontend/src/assets`, `frontend/package*.json`, `frontend/bun.lock`, `frontend/README.md`)

**Interfaces:**
- Produces: root layout with kiosk metadata and `globals.css`; `next.config.mjs` disables `output: standalone` only on Vercel.

- [ ] Replace the default layout with kiosk metadata and no Tailwind fonts/classes.
- [ ] Remove Tailwind dependencies/config, since the UI uses plain CSS.
- [ ] Delete the Vite project and update `.gitignore` for a root Next app.

### Task 5: Update documentation for Vercel + Neon

**Files:**
- Modify: `README.md`, `docs/architecture.md`
- Modify (light touch): `deploy/README.md`, `deploy/nginx/iem-uem.conf`, `deploy/systemd/iem-uem-backend.service`

- [ ] Document `npm install`, `.env.local`, `npm run init-db`, `npm run dev`.
- [ ] Document Vercel import at repo root, env vars, Neon pooled URL, and the 4.5 MB upload limit.
- [ ] Update architecture paths from FastAPI/separate folders to the unified Next app.

### Task 6: Verify

- [ ] `npm install` at root.
- [ ] `npm run build` passes and lists `/`, `/admin`, and all existing `/api/*` routes.
- [ ] `npm run lint` passes (or only pre-existing errors remain).
- [ ] `npm run dev` serves `/` and `/admin` HTML.
- [ ] Grep confirms no Vite/`import.meta.env`/separate-frontend references remain.
