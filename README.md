# Dionysys

Adaptive UI experimentation for product teams building personalized interfaces with either deterministic rules or MCP-guided decisioning.

Dionysys packages the decision logic, React runtime, telemetry backend, and reference demo needed to test adaptive experiences without hard-wiring everything into a single app. It is designed for teams that want to iterate on persona inference, variant selection, and runtime UI control while keeping the core logic reusable across products.

## Promo Video

[![Watch the 25-second Dionysys promo video](https://img.youtube.com/vi/U45lPx95GfU/hqdefault.jpg)](https://www.youtube.com/watch?v=U45lPx95GfU)

### Blog 
Notion Page - [https://mewing-tuck-66c.notion.site/Dionysys-Adaptive-User-Interface-framework-36283d3a8f1d805d8bf0d4f31e3dcaa1](https://mewing-tuck-66c.notion.site/Dionysys-Adaptive-User-Interface-framework-36283d3a8f1d805d8bf0d4f31e3dcaa1)

Demo - [https://dionysys-frontend.vercel.app/](https://dionysys-frontend.vercel.app/)

Docs - [https://personal-db95a29b.mintlify.app/](https://personal-db95a29b.mintlify.app/)

## Features

- Deterministic adaptive mode powered by `InferenceEngine` and `PolicyEngine`
- MCP mode driven by validated personality resources and action-backed UI states
- Reusable `@dionysys/core` and `@dionysys/react` workspace packages
- Runtime admin console for inspecting and tuning active configuration
- Excalidraw-based reference frontend for validating adaptive behavior end to end
- Session-aware telemetry capture and backend decision APIs
- `prototype` and `production` presentation modes for internal testing vs user-facing experiences
- `next-refresh` decision application to avoid mid-session UI churn
- Docusaurus docs site backed by the canonical root `docs/` directory

## Repository Layout

- `packages/core`: framework-neutral inference, policy, reward, MCP, schema, and admin contracts
- `packages/react`: React provider, hooks, feedback UI, and runtime admin console
- `backend`: Express API for telemetry, deterministic decisions, MCP decisions, admin APIs, and health checks
- `frontend`: Vite + React Excalidraw demo that exercises the adaptive runtime
- `docs`: canonical markdown documentation source
- `web-docs`: Docusaurus shell that renders the root docs as a deployable site

## Docs

Start with the canonical markdown docs in [`docs/`](./docs):

- [Usage](./docs/usage.md)
- [Configuration](./docs/configuration.md)
- [Admin Console](./docs/admin-console.md)
- [Excalidraw Configuration](./docs/excalidraw-configuration.md)
- [Architecture](./docs/architecture.md)

You can also run the web docs locally with `npm run docs`.

## Quick Start

### Prerequisites

- Node.js 20+ (`.nvmrc` is pinned to `20.19.0`)
- npm 10+
- MongoDB running locally or a remote MongoDB Atlas connection string

### Install dependencies

Run everything from the repository root:

```bash
npm install
```

### Configure environment files

Copy the example files before starting services:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Optional docs-hosting variables are documented in `web-docs/.env.example`. Set them in your shell or hosting provider before running `npm run build:docs`.

Default env contracts:

- Backend: `PORT`, `MONGO_URI`, `ALLOWED_ORIGIN`, `ADMIN_CONSOLE_ENABLED`
- Frontend: `VITE_API_BASE_URL`, `VITE_ADMIN_CONSOLE_ENABLED`
- Docs: `DOCS_SITE_URL`, `DOCS_BASE_URL`

### Build the workspace

```bash
npm run build
npm run build:docs
```

### Run locally

Start the backend:

```bash
npm run dev --workspace=backend
```

Start the frontend in a separate terminal:

```bash
npm run dev --workspace=frontend
```

Start the docs site when needed:

```bash
npm run docs
```

The frontend defaults to `http://localhost:5173` and the backend defaults to `http://localhost:3001`.

## Local Development Deployment

For a realistic development setup:

1. Start MongoDB locally or point `MONGO_URI` at MongoDB Atlas.
2. Set `ALLOWED_ORIGIN=http://localhost:5173` in `backend/.env`.
3. Set `VITE_API_BASE_URL=http://localhost:3001` in `frontend/.env`.
4. Run the backend and frontend from the repo root using the workspace commands above.
5. Verify backend health at [http://localhost:3001/health](http://localhost:3001/health).

Enable the admin backend only when needed:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
```

In frontend development, the admin trigger is visible automatically because Vite is running in dev mode. For preview or deployed environments, set `VITE_ADMIN_CONSOLE_ENABLED=true` only if you intentionally want the control surface exposed.

## Commands

| Command | Description |
| --- | --- |
| `npm run build` | Build all npm workspaces (`packages/*`, `frontend`, `backend`) |
| `npm run build:backend` | Build the backend production bundle |
| `npm run build:frontend` | Build the frontend static assets |
| `npm run build:docs` | Build the Docusaurus site |
| `npm run dev --workspace=backend` | Run the backend in watch mode |
| `npm run dev --workspace=frontend` | Run the frontend in Vite dev mode |
| `npm run start:backend` | Start the compiled backend from `backend/dist/index.js` |
| `npm run preview:frontend` | Preview the frontend production build |
| `npm run test` | Run workspace tests |
| `npm run docs` | Start the Docusaurus docs site |
| `npm run docs:serve` | Serve the built docs site locally |

## Deployment

### Self-hosted production

The production split is:

- Serve `frontend/dist` from any static host
- Run `backend` as a separate long-lived Node service
- Point the backend at a production MongoDB instance
- Keep `ADMIN_CONSOLE_ENABLED=false` unless you explicitly need the admin APIs

Build the production assets from the repository root:

```bash
npm install
npm run build:frontend
npm run build:backend
```

Run the compiled backend:

```bash
npm run start:backend
```

Required production backend env values:

- `MONGO_URI`: production MongoDB connection string
- `ALLOWED_ORIGIN`: deployed frontend origin, such as `https://app.example.com`
- `PORT`: service port exposed by your host
- `ADMIN_CONSOLE_ENABLED=false`

MongoDB Atlas note:

- Atlas access lists accept IPs or CIDR ranges, not domains.
- If your backend runs on Render, allow the service's outbound IP range(s) in Atlas instead of relying on `0.0.0.0/0`.

Recommended verification:

- `GET /health` returns `{ status: "ok", dbConnected: true }`
- frontend requests reach the backend origin configured in `VITE_API_BASE_URL`
- browser CORS errors are absent after setting `ALLOWED_ORIGIN`

### Dockerized backend

The repository includes a backend Dockerfile intended for a repository-root build context:

```bash
docker build -f backend/Dockerfile -t dionysys-backend .
```

Run it with a production env file or explicit environment variables:

```bash
docker run --env-file /path/to/backend.env -p 3001:3001 dionysys-backend
```

For production, use a non-committed env file with a real `MONGO_URI` and a deployed `ALLOWED_ORIGIN`.

### Optional Vercel hosting for frontend and docs

The backend should remain an external Node service. Do not deploy the current Express app as a Vercel serverless rewrite target.

For the frontend Vercel project:

- Root Directory: repository root
- Install Command: `npm install --include=optional && npm install --workspace=frontend @tailwindcss/oxide-linux-x64-gnu@4.2.2 --no-save`
- Build Command: `npm run build:frontend`
- Output Directory: `frontend/dist`
- Build Environment Variable: `VITE_API_BASE_URL=https://your-backend.example.com`
- Optional Build Environment Variable: `VITE_ADMIN_CONSOLE_ENABLED=true`

Important:

- This frontend is built with Vite, so `VITE_*` values must be present at build time.
- On Vercel, prefer build-time env configuration or commit a non-secret `frontend/.env.production` for stable production defaults.
- The deployed frontend uses the same `VITE_API_BASE_URL` for admin requests, adaptive decisions, telemetry event flushes, and feedback submission. If this value is wrong, admin reads, admin saves, and session event persistence will all fail together.

For the docs Vercel project:

- Root Directory: repository root
- Install Command: `npm install`
- Build Command: `npm run build:docs`
- Output Directory: `web-docs/build`
- Environment Variables:
  - `DOCS_SITE_URL=https://docs.example.com`
  - `DOCS_BASE_URL=/`

If you deploy the docs site under a subpath instead of a root domain, set `DOCS_BASE_URL` accordingly, for example `/Dionysys/`.

## Core Concepts

- `deterministic` mode: `InferenceEngine` scores personas and `PolicyEngine` picks a variant
- `mcp` mode: validated personality resources define scoring rules and action-backed UI states, and an LLM connector chooses from those exposed actions
- `prototype` presentation: show scores, personalities, pending decisions, and admin/debug controls
- `production` presentation: hide experiment internals and expose only the experience plus feedback
- `next-refresh` decision application: store a resolved decision now and apply the UI change on the next provider mount or page refresh
- `memory` / `tab` / `browser` persistence modes: align session-id lifetime with built-in pending-decision persistence

In non-production builds, the admin console includes a session randomize tool for testing persistence behavior without exposing that reset path in production.

## Operational Notes

- Health endpoint: [`GET /health`](http://localhost:3001/health)
- Admin APIs are intentionally environment-gated and should stay off by default in production
- Runtime admin edits are in-memory only; they do not write back to source files or the database
- The frontend and backend share local workspace packages, so build and deploy commands should run from the monorepo root

## Contributing

Contribution guidelines live in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Package Notes

- `@dionysys/react` preserves top-level exports while the implementation is split into feature folders
- `useAdaptiveUI()._store` still exists for compatibility, but new integrations should prefer explicit hook fields plus `setManualOverride(...)`
- `@dionysys/core` uses `unknown` at event payload boundaries so apps can narrow payloads intentionally
