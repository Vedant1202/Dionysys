# Spec: Persistence Modes and Admin-Only Non-Prod Session Reset

## Summary

- Fix the refresh-loss bug by making session lifetime and pending-decision persistence use the same explicit persistence mode instead of the current split behavior (`sessionStorage` session id in the demo, `localStorage` pending decision in the provider).
- Add a shared `AdaptivePersistenceMode = 'memory' | 'tab' | 'browser'`.
- Ship a non-production-only "randomize session" control in the admin console that generates a new session id, clears persistence for the active mode, and reloads the app.

## Commands

- Dev: `npm run dev`
- Frontend tests: `npm run test --workspace=frontend`
- Core tests: `npm run test --workspace=@dionysys/core`
- Backend tests: `npm run test --workspace=backend`
- Frontend build: `npm run build --workspace=frontend`
- React package typecheck/build: `npm run build --workspace=@dionysys/react`

## Key Changes

- Shared types and config:
  - Add `AdaptivePersistenceMode` and `AdaptivePersistenceModeSchema` in `packages/core/src/mcp/{types,schemas}.ts`.
  - Extend admin config `mode` with `persistenceMode`, defaulting to `'browser'`.
  - Update admin config types/schemas/tests and backend seeded config so runtime config can round-trip the new field.
- React provider persistence:
  - Add `persistenceMode?: AdaptivePersistenceMode` to `AdaptiveProviderProps`.
  - Keep `loadPendingDecision` / `savePendingDecision` / `clearPendingDecision` as highest precedence; `persistenceMode` only affects the built-in default persistence path.
  - Built-in semantics:
    - `memory`: do not read/write web storage for pending decisions.
    - `tab`: use `window.sessionStorage`.
    - `browser`: use `window.localStorage`.
  - Keep storage keys session-scoped; only the storage backend changes.
- Frontend session handling:
  - Replace the current module-level session helper with a mode-aware session manager in `frontend/src/core/session.ts`.
  - Session semantics:
    - `memory`: generate a new id per page load and keep it only in memory.
    - `tab`: store the id in `sessionStorage`.
    - `browser`: store the id in `localStorage`.
  - `App.tsx` should bootstrap admin config, derive the active `persistenceMode`, and pass it both to the session manager and to `AdaptiveProvider`.
  - When runtime config changes `persistenceMode`, the app should regenerate/read the correct session for that mode and remount the provider so state is internally consistent.
- Non-prod session reset:
  - Add the control to the admin console, not the prototype shell.
  - Guard it twice:
    - render only in non-production/dev-capable admin sessions;
    - underlying reset helper no-ops outside non-prod so it cannot function in prod builds.
  - Action behavior:
    - clear the current mode's stored session id;
    - clear any built-in persisted pending decision associated with that session id in the active storage backend;
    - generate a new session id;
    - reload the page.
  - The admin console should surface the current session id and persistence mode next to the action so testers know exactly what they are resetting.
- Admin/UI updates:
  - Add a persistence mode selector to the admin console Modes panel.
  - Add an admin-console-only session tools area for "Randomize session".
  - Keep prototype session diagnostics read-only; remove any need for a reset button there.
  - Update docs/README usage examples to explain `memory`, `tab`, and `browser`, plus the admin-only dev session randomize behavior.

## Test Plan

- Core/admin tests:
  - schema accepts/rejects valid persistence modes;
  - seeded admin config includes `persistenceMode: 'browser'`;
  - config update/reset/export preserves the new field.
- React/provider tests:
  - built-in persistence uses no storage in `memory`, `sessionStorage` in `tab`, and `localStorage` in `browser`;
  - custom persistence hooks still override built-in storage behavior;
  - pending decisions survive refresh only in `tab`/`browser` according to storage semantics.
- Frontend tests:
  - session helper reuses ids correctly for `tab` and `browser`;
  - `memory` creates a fresh id on reload;
  - switching persistence mode rehydrates from the correct storage backend;
  - admin-console randomize action clears scoped state and results in a new session id.
- Manual verification:
  - In `browser` mode, repeated refreshes keep the same session id and preserve queued next-refresh decisions.
  - In `tab` mode, refresh in the same tab keeps state, but a new tab gets a different session.
  - In `memory` mode, refresh starts a clean session with no persisted pending decision.
  - In a production build, no session-randomize control is rendered in the admin console and the reset helper cannot execute.

## Assumptions and Boundaries

- Session id ownership stays app-side in the demo frontend; we are not moving session creation into `@dionysys/react`.
- Default runtime behavior after this change is `browser` to resolve the reported refresh issue.
- Always: preserve existing custom persistence-hook behavior and current provider decision logic.
- Ask first: adding dependencies or changing backend APIs beyond admin config shape.
- Never: expose or enable the session-randomize feature in production.
