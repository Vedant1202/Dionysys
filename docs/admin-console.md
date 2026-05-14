# Admin Console

The Dionysys admin console is a reusable package UI for inspecting and changing adaptive UI configuration at runtime. It is designed as an information and control center for deterministic mode, MCP mode, personalities, calculations, session summaries, resources, and adaptive API status.

The console does not write edits back into source files. It starts from file-seeded backend configuration, saves changes into the backend's in-memory runtime config, and lets you export the active configuration as JSON for future use.

## Prototype vs Production

The admin runtime config includes a presentation mode:

- `prototype`: show the control room: admin controls, mode switch, debug panel, variants, personalities, scores, resources, and pending-decision notices.
- `production`: hide experiment details from front-facing users and show only lightweight feedback controls.

It also includes a decision application mode:

- `immediate`: apply the selected variant or MCP UI state as soon as the decision resolves.
- `next-refresh`: store the resolved personality/decision now, keep the active workspace stable, and apply the UI change on the next refresh/provider mount.

For prototype testing, the admin console also shows the active persistence mode and includes a non-production session randomize tool. That reset clears the session id plus both queued and applied adaptive state for the current session before reloading.

The Excalidraw demo defaults to `prototype` plus `next-refresh`.

## Enable / Disable

Admin routes are disabled unless the backend opt-in flag is set:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
```

To disable the backend admin API, omit `ADMIN_CONSOLE_ENABLED` or set it to anything other than `true`.

The admin API routes live under `/api/admin`:

```http
GET  /api/admin/config
PUT  /api/admin/config
POST /api/admin/config/reset
GET  /api/admin/config/export
GET  /api/admin/overview?sessionId=session_123
```

The Excalidraw demo renders the admin console as an in-app overlay, not as a standalone browser route. The demo shows the Admin button in development or when the frontend flag is enabled:

```bash
VITE_ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=frontend
```

The backend remains the authority. If the frontend button is visible but `ADMIN_CONSOLE_ENABLED` is not set, the console will show that the admin API is disabled.

## Package Component

`@dionysys/react` exports the reusable console:

```tsx
import { AdminConsole } from '@dionysys/react';

export function ExperimentAdmin() {
  return (
    <AdminConsole
      apiBaseUrl="http://localhost:3001"
      sessionId="session_123"
      onConfigSaved={(config) => {
        console.log('Saved runtime config', config.mode.defaultMode);
      }}
    />
  );
}
```

Props:

| Prop | Type | Purpose |
| --- | --- | --- |
| `apiBaseUrl` | `string` | Backend origin. Defaults to `http://localhost:3001`. |
| `sessionId` | `string` | Optional active session to summarize in the Data and Overview tabs. |
| `onConfigSaved` | `(config) => void` | Called after save or reset so an app can remount providers from the new runtime config. |
| `onClose` | `() => void` | Optional close handler for modal or drawer integrations. |

Behind that single export, the package now keeps the admin console split into:

- a root shell component
- a state/orchestration hook for load/save/reset/export behavior
- focused section modules for overview, modes, personalities, calculations, data, APIs, and export
- shared primitives and styles

That split is internal to the package. Consumers still mount the same `<AdminConsole />` component from `@dionysys/react`.

## What You Can Control

The console has focused tabs for the main adaptive surfaces:

| Tab | What it shows or edits |
| --- | --- |
| Overview | Current default mode, connector status, session event count, top deterministic and MCP persona scores, resources, supported tools, and fallback variant. |
| Modes | Default adaptive mode, `presentationMode`, `decisionApplication`, provider event threshold, polling interval, MCP minimum confidence, and fallback variant. |
| Personalities | MCP personality resource names, ids, descriptions, decision hints, base weights, scoring signals, actions, and UI states. |
| Calculations | Deterministic personas, initial counts, policy epsilon, event weight rules, and heuristic rules. |
| Data | Summarized interaction data, derived counts, timing metrics, and sanitized recent events for the selected session. |
| MCP APIs | Runtime API status and the active MCP resource catalog. |
| Export | Full JSON editor, local JSON apply, and JSON export for future use. |

## Runtime Config API

When enabled, the backend exposes the same `/api/admin` routes listed above.

`PUT /api/admin/config` validates the full admin config payload before updating runtime state. Invalid config returns `400` with schema issues.

`GET /api/admin/overview` summarizes session events before returning them. The console sees capped, sanitized recent event metadata rather than raw unbounded payloads.

## Excalidraw Demo Integration

The Excalidraw demo mounts the console as an overlay. When the console saves or resets config, the demo:

1. Reads `config.mode.defaultMode`.
2. Reads `config.mode.presentationMode` and `config.mode.decisionApplication`.
3. Updates `minEventsBeforeLock` and `pollingIntervalMs`.
4. Remounts `AdaptiveProvider` so lock state and active decisions reset cleanly.

This means you can change the default mode from `deterministic` to `mcp`, tune thresholds, edit MCP resources, save, and immediately continue the demo with the active runtime configuration.

## Exporting Configuration

Use Export to download:

```json
{
  "exportedAt": "2026-04-19T00:00:00.000Z",
  "config": {
    "version": 1,
    "mode": {
      "defaultMode": "mcp",
      "presentationMode": "prototype",
      "decisionApplication": "next-refresh",
      "minEventsBeforeLock": 5,
      "pollingIntervalMs": 3000
    }
  }
}
```

The export is for future use outside the current runtime session. It does not overwrite `frontend/src/config/variantConfig.ts` or `backend/src/services/ExcalidrawMcpResources.ts`.

The same rule applies to every control in the console: it edits validated runtime state only. The browser does not rewrite tracked markdown, TypeScript, or config files in the repository.

## Safety Model

- Admin APIs are disabled by default and require `ADMIN_CONSOLE_ENABLED=true`.
- LLM API keys remain server-side.
- Session data is summarized and sanitized before display or LLM connector use.
- Source files are not mutated from the browser.
- Deterministic and MCP decision paths continue to validate config through package schemas.
