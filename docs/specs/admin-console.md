# Spec: Admin Console

## Objective

Create a reusable admin console for Dionysys that acts as an information and control center for adaptive UI experiments. It should expose current modes, deterministic inference configuration, policy settings, MCP resources, scoring calculations, session data summaries, MCP/API metadata, and exportable runtime configuration.

Success means an engineer can open the console in the Excalidraw demo, inspect how a session is being scored, edit the runtime configuration in the UI, save it without mutating source files, reset it to file-seeded defaults, and export the active configuration as JSON.

## Tech Stack

- TypeScript, React, and inline component styles in `@dionysys/react`
- Express backend routes under `/api/admin`
- Existing `@dionysys/core` schemas, summarizer, scorer, inference, and policy engines
- Existing MongoDB-backed telemetry data for session summaries

## Commands

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/react
npm run test --workspace=backend
npm run test --workspace=frontend
npm run build
```

## Project Structure

- `packages/core/src/admin/` -> provider-neutral admin config contracts and schemas
- `packages/react/src/AdminConsole.tsx` -> reusable `AdminConsole` React UI
- `backend/src/services/AdminConfigService.ts` -> file-seeded in-memory runtime config
- `backend/src/routes/admin.ts` -> gated admin API
- `frontend/src/` -> demo integration and admin overlay mounting
- `docs/` -> usage/config documentation

## Code Style

Admin config should stay serializable and provider-neutral:

```ts
const config: AdminConsoleConfig = {
  mode: { defaultMode: 'deterministic', minEventsBeforeLock: 5, pollingIntervalMs: 3000 },
  deterministic: { personas, initialCounts, eventRules, heuristics, policy: { epsilon: 0.2 } },
  mcp: { resources, minConfidence: 0.5, fallbackVariant: 'neutral' },
};
```

The admin UI should use package-owned React and plain CSS-in-JS styles so consuming apps do not need Tailwind, DaisyUI, or app-specific CSS.

## Testing Strategy

- Core tests validate admin config schemas.
- Backend tests validate env gating, config get/update/reset/export, runtime decision integration, and session overview summaries.
- React/frontend tests validate that the admin console fetches config, saves changes, exports JSON, and can be mounted in the demo.
- Build checks prove package exports remain valid.

## Boundaries

- Always: validate admin payloads, keep API keys server-side, summarize/sanitize session data, preserve deterministic and MCP behavior.
- Ask first: writing UI edits back into source files, adding authentication, changing database schema, adding provider SDKs.
- Never: expose API keys, send raw uncapped text payloads to LLM connectors, mutate generated/vendor directories, require Tailwind for package components.

## Success Criteria

- `@dionysys/react` exports a reusable `AdminConsole`.
- Backend exposes `/api/admin/config`, `/api/admin/config/reset`, `/api/admin/config/export`, and `/api/admin/overview` when `ADMIN_CONSOLE_ENABLED=true`.
- Backend returns 404 for admin routes when the env gate is not enabled.
- Runtime config is seeded from existing files and can be changed through API/UI without changing those files.
- Adaptive decisions use the active runtime config after saves.
- UI exposes mode, deterministic policy/inference settings, MCP personalities/resources/actions, calculations, session data, API status, save/reset, and export controls.
