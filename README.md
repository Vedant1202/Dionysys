# Dionysys

Adaptive UI experimentation for deterministic and MCP-driven modes.

Dionysys is a monorepo that combines:

- `@dionysys/core`: framework-neutral inference, policy, reward, schema, MCP, and admin/runtime contracts
- `@dionysys/react`: React provider, hooks, feedback UI, and runtime admin console
- `backend`: Express services for telemetry, deterministic decisions, MCP decisions, and admin APIs
- `frontend`: Excalidraw demo used to validate adaptive behavior
- `web-docs`: Docusaurus shell that renders the canonical root `docs/` content

## Quick start

```bash
npm install
npm run build
```

Run the docs and demo from the repository root:

```bash
npm run docs
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

Enable the runtime admin console API when needed:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
```

## Core concepts

- `deterministic` mode: `InferenceEngine` scores personas and `PolicyEngine` picks a variant
- `mcp` mode: validated personality resources define scoring rules and action-backed UI states, and an LLM connector chooses from those exposed actions
- `prototype` presentation: show scores, personalities, pending decisions, and admin/debug controls
- `production` presentation: hide experiment internals and expose only the experience plus feedback
- `next-refresh` decision application: store a resolved decision now and apply the UI change on the next provider mount or page refresh

## Docs

Start with the root markdown docs:

- [Usage](./docs/usage.md)
- [Configuration](./docs/configuration.md)
- [Admin Console](./docs/admin-console.md)
- [Excalidraw Configuration](./docs/excalidraw-configuration.md)
- [Architecture](./docs/architecture.md)

Or launch the web docs locally with `npm run docs`.

## Package notes

- `@dionysys/react` still preserves top-level exports while its implementation is split into feature folders.
- `useAdaptiveUI()._store` still exists for compatibility, but new integrations should prefer explicit hook fields plus `setManualOverride(...)`.
- `@dionysys/core` uses `unknown` at event payload boundaries so apps can narrow payloads intentionally.
