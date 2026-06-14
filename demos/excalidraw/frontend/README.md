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
npm run dev --workspace=@dionysys-demo/excalidraw-backend
npm run dev --workspace=@dionysys-demo/excalidraw-frontend
```

For production-style build verification:

```bash
npm run build --workspace=@dionysys-demo/excalidraw-frontend
```

## Modes and visibility

- `deterministic`: the demo resolves a deterministic decision through the Dionysys client/server SDK path
- `mcp`: the demo resolves an MCP-backed decision through the Dionysys client/server SDK path and renders the selected UI state
- `prototype`: shows debug panel, mode switch, variant information, and admin entry points
- `production`: hides experiment details and shows only front-facing feedback controls

The demo defaults are controlled by the backend runtime config plus the frontend admin-visibility gate.

## Admin console visibility

The admin overlay is available in development, or when the frontend flag is set:

```bash
VITE_ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-frontend
```

The backend admin API must also be enabled:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-backend
```

## Beta feedback loop

The persona feedback loop is disabled by default. Enable both sides for beta sessions:

```bash
ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-backend
VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-frontend
```

## More docs

- [Package usage](../../../docs/usage.md)
- [Configuration](../../../docs/configuration.md)
- [Admin console](../../../docs/admin-console.md)
- [Excalidraw configuration](../../../docs/excalidraw-configuration.md)

## Build note

The admin route is lazy-loaded so the default app path does not pay the full explorer/admin cost up front. The production build may still warn about large chunks because Excalidraw and graph/diagram dependencies remain heavy; treat those warnings as known bundle debt rather than a broken build.
