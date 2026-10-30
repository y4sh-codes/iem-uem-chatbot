# Deployment

> **Note:** the primary deployment target is now Vercel, using the unified
> Next.js app at the repository root (see the root `README.md`). The
> FastAPI/nginx/systemd files below are legacy self-hosting references from
> the pre-migration layout and are not used by the Vercel deployment.

Everything needed to run this as a persistent, monitored service instead of
`python run_api.py` in a terminal window.

```
deploy/
├── systemd/
│   └── iem-uem-backend.service   -- keeps the backend running, auto-restarts on crash/reboot
├── nginx/
│   └── iem-uem.conf               -- SPA fallback for the frontend + reverse proxy for the backend
└── monitoring/
    ├── docker-compose.yml           -- Prometheus + Grafana + Loki + Promtail
    ├── prometheus/prometheus.yml
    ├── loki/loki-config.yml
    ├── promtail/promtail-config.yml
    └── grafana/                      -- auto-provisioned datasources + a starter dashboard
```

## 1. systemd -- keep the backend running

See `systemd/iem-uem-backend.service` for the full unit file and inline
install instructions. Short version:

```bash
# Edit the paths, User/Group, and environment values in the file first
sudo cp deploy/systemd/iem-uem-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now iem-uem-backend
sudo systemctl status iem-uem-backend
```

Without this, the backend only runs while a terminal/SSH session stays open
-- it won't survive a reboot or a dropped connection.

## 2. nginx -- SPA fallback + reverse proxy

See `nginx/iem-uem.conf` for the full config and inline install
instructions. This does two things:

- **SPA fallback**: serves the built frontend (`frontend/dist/`) and falls
  back to `index.html` for unknown paths, so navigating directly to
  `/admin` (typed URL, bookmark, page refresh) works -- not just clicking a
  link from `/`.
- **Reverse proxy** (optional): puts the backend behind a single public
  entrypoint alongside the frontend, useful for TLS termination and
  request-size limits at the nginx layer.

Build the frontend first (`cd frontend && npm run build`), then point the
`root` directive at the resulting `dist/` folder.

An HTTPS block template is included at the bottom of the config, commented
out -- see the notes there for Let's Encrypt (public domain) vs. a
self-signed cert (internal-only LAN).

## 3. Rate limiting

Already built into the backend itself (`app/api.py`, via `slowapi`) -- no
separate deployment step needed. Current limits, set in `app/config.py`:

- `/auth/login`: 5 requests/minute per IP (brute-force protection)

Adjust `LOGIN_RATE_LIMIT` in `app/config.py` if these feel
too tight or too loose for real kiosk traffic. Note: limits are in-memory
and per-process -- fine for a single backend instance, but would need a
shared store (e.g. Redis) if this were ever scaled to multiple backend
processes behind a load balancer.

## 4. Monitoring -- Prometheus + Grafana + Loki

The backend exposes Prometheus metrics at `/metrics` (request counts,
latencies, error rates, in-progress requests) automatically -- nothing to
configure there. This stack collects and visualizes them, plus ships
backend logs for searching.

**Runs in Docker** (the backend itself stays native on the host for direct
GPU access to Ollama -- only the monitoring tools are containerized):

```bash
cd deploy/monitoring
docker compose up -d
```

Then:
- **Grafana**: `http://localhost:3000` (default login `admin`/`admin`,
  you'll be prompted to set a real password on first login). A starter
  dashboard ("IEM-UEM Kiosk Backend") is auto-provisioned with request
  rate, p95 latency, 5xx error rate, 429 rate-limit hits, and a live log
  panel.
- **Prometheus**: `http://localhost:9090` (raw metrics browser/query UI)
- **Loki**: not meant to be browsed directly -- query it through Grafana's
  Explore view or the dashboard's log panel.

**Before this works:**
- The backend must already be running on port 8000 (Prometheus scrapes
  `host.docker.internal:8000/metrics` -- see `prometheus/prometheus.yml` if
  your backend runs elsewhere).
- Log shipping (Promtail) reads the backend's **systemd journal**, so it
  only picks up logs if the backend is running as the systemd service from
  step 1 -- not from a plain `python run_api.py` in a terminal.

**Don't expose `/metrics` publicly** -- the nginx config in this folder
already blocks it on the public-facing reverse proxy; Prometheus reaches it
directly on the backend's own port instead.

## Suggested order

1. Get the backend running correctly before worrying about any of this.
2. Set up Postgres + create an admin account (`manage_admin.py`) --
   see `backend/README.md`.
3. systemd (step 1 above) -- so the backend survives reboots/crashes.
4. nginx (step 2 above) -- so the frontend/`admin` route works when deployed.
5. Monitoring (step 4 above) -- optional but recommended once things are
   running for real, so you'll actually notice if something breaks.
