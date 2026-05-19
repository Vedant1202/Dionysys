# Frontend Demo

This workspace contains the Excalidraw-based Dionysys demo. It is the reference app for validating deterministic mode, MCP mode, prototype vs production presentation, next-refresh decision application, the dynamic toolbar, and the runtime admin console overlay.

## What lives here

- Excalidraw rendering and adaptive shell components
- demo-specific UI config adapters for variants, menu items, and toolbar tools
- shared session id and telemetry/event collection
- prototype debug controls and production feedback surface

The frontend consumes `@dionysys/react` as a library. It should not be treated as the package API surface; it is the example application that proves those package APIs are usable.

## Local development

From the repository root:

```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

For production-style build verification:

```bash
npm run build --workspace=frontend
```

## Modes and visibility

- `deterministic`: frontend polls inference and requests policy decisions
- `mcp`: frontend requests MCP-backed adaptive decisions and renders the selected UI state
- `prototype`: shows debug panel, mode switch, variant information, and admin entry points
- `production`: hides experiment details and shows only front-facing feedback controls

The demo defaults are controlled by the backend runtime config plus the frontend admin-visibility gate.

## Admin console visibility

The admin overlay is available in development, or when the frontend flag is set:

```bash
VITE_ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=frontend
```

The backend admin API must also be enabled:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
```

For production deployments, both frontend settings are build-time Vite values:

```bash
VITE_API_BASE_URL=https://your-backend.example.com
VITE_ADMIN_CONSOLE_ENABLED=true
```

The demo uses the same backend base URL for:

- admin console reads and saves
- adaptive decision and inference requests
- telemetry event flushes
- feedback submission

If the production frontend is built with the wrong `VITE_API_BASE_URL`, the app can appear to load while admin actions and event persistence fail against the wrong origin.

## More docs

- [Package usage](../docs/usage.md)
- [Configuration](../docs/configuration.md)
- [Admin console](../docs/admin-console.md)
- [Excalidraw configuration](../docs/excalidraw-configuration.md)
