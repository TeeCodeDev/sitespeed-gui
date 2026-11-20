# Project Context: SiteSpeed GUI (Sitespeed.io + Browsertime)

## 1. Project Goals
Build a Dockerized web GUI and historical analytics platform for **Sitespeed.io** and **Browsertime** to run website performance tests, store historical metrics, filter results by client/project/tags/date, view embedded Sitespeed.io HTML reports & Browsertime videos/filmstrips, schedule recurring tests, and export/share reports (PDF / shareable client links).

Target deployment: **Linux server** running Docker Compose.

## 2. Tech Stack
- **Backend (`backend/`):** Node.js 24, TypeScript, Fastify, `better-sqlite3`, `dockerode`, `node-cron`, `zod`
- **Frontend (`frontend/`):** React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
- **Test Runner:** `sitespeedio/sitespeed.io` sibling containers launched via `/var/run/docker.sock` (via `dockerode` Engine API, never shell interpolation)
- **Database:** SQLite stored in a persistent Docker volume (`/data/db/sitespeed.sqlite`)
- **Storage:** Shared Docker volume (`/data/results`) mounted by both the GUI backend and ephemeral `sitespeedio/sitespeed.io` containers
- **Quality Gates:** TypeScript (`tsc --noEmit`), ESLint, Prettier, Vitest / Node test runner

## 3. High-Level Architecture & Separation of Concerns
```text
backend/src/
├── config/         # Environment validation (zod), constants, paths
├── db/             # SQLite connection, schema migrations, health check
├── dal/            # Data Access Layer (clients, projects, runs, metrics, schedules, shared_reports)
├── services/       # Business logic (DockerRunnerService, MetricsParserService, QueueService, SchedulerService, UrlGuardService)
├── routes/         # Fastify route definitions + request/response schemas
├── controllers/    # Thin HTTP handlers delegating to services/DAL
└── server.ts       # Fastify app bootstrap, static report serving, /healthz
```

```text
frontend/src/
├── api/            # Typed API client
├── components/     # Reusable UI components (charts, tables, filters, modals)
├── pages/          # Dashboard, Clients, Runs, RunDetail (Report/Video), Schedules, SharedReport
└── App.tsx         # Router & layout
```

## 4. Core Data Models (SQLite)
1. **clients**: `id`, `name`, `slug`, `contact_email`, `notes`, `created_at`
2. **projects**: `id`, `client_id`, `name`, `base_url`, `default_tags`, `created_at`
3. **test_runs**: `id`, `client_id`, `project_id`, `url`, `browser`, `connectivity`, `iterations`, `mobile`, `tags`, `status`, `container_id`, `report_dir`, `error_message`, `started_at`, `finished_at`, `created_at`
4. **run_metrics**: `id`, `run_id`, `url`, `fcp_ms`, `lcp_ms`, `cls`, `tbt_ms`, `ttfb_ms`, `speed_index_ms`, `fully_loaded_ms`, `page_size_bytes`, `requests_count`, `coach_score`, `video_rel_path`, `har_rel_path`, `created_at`
5. **schedules**: `id`, `client_id`, `project_id`, `name`, `url`, `cron_expression`, `browser`, `connectivity`, `iterations`, `mobile`, `tags`, `enabled`, `last_run_at`, `created_at`
6. **shared_reports**: `id`, `token`, `client_id`, `title`, `filters_json`, `expires_at`, `created_at`

## 5. Security & Reliability Decisions (aligned with `master-engineer` & `security-audit`)
- **No Command/Docker Injection:** `dockerode` uses structured Docker Engine API calls. Container image is pinned/allowlisted (`SITESPEED_IMAGE`). User-supplied URLs and options are strictly validated with `zod` and mapped to an allowlisted CLI flag array.
- **SSRF Prevention:** `UrlGuardService` restricts URLs to `http:`/`https:` and blocks loopback/private/link-local IP ranges by default (`ALLOW_PRIVATE_NETWORKS=false`).
- **Path Traversal Prevention:** Report/video static file serving resolves paths against `RESULTS_DIR` and enforces `resolved.startsWith(base + path.sep)`.
- **Resource Limits & Queueing:** Bounded concurrency (`MAX_CONCURRENT_RUNS=1` default), container memory/CPU/shm limits, and `RUN_TIMEOUT_MS` watchdog to kill hung containers.
- **Optional Auth:** Configurable `AUTH_USERNAME` / `AUTH_PASSWORD` (Basic Auth / session or token) for LAN/VPN protection; shareable client reports use cryptographically random tokens with optional expiration and read-only scoped queries.
- **Health Check:** `GET /healthz` verifies SQLite connectivity and Docker daemon reachability.

## 6. Current State & Next Steps
- **Current State:** Full-stack application (`backend/`, `frontend/`), `Dockerfile`, `docker-compose.yml`, `.env.example`, and `README.md` implemented. Backend uses Node.js 24 built-in `node:sqlite` (`DatabaseSync`) to avoid native C++ compilation dependencies. Backend `typecheck`, `lint`, `build`, and unit tests (`urlGuard.service.test.ts`, `dockerRunner.service.test.ts`) pass.
- **Next Steps:**
  1. Deploy on the target Linux server with `docker compose up -d --build`.
  2. Verify `/healthz` reports `database: "up"` and `docker: "up"`.
  3. Run a live smoke test against a public URL and verify Browsertime video & Sitespeed.io HTML report rendering.
