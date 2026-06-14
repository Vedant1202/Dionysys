# `@dionysys/react`

React bindings for Dionysys adaptive UI.

## What it exports

The public surface is intentionally small:

```tsx
import {
  AdaptiveProvider,
  useAdaptiveUI,
  AdminConsole,
  AdaptiveFeedback,
} from '@dionysys/react';
```

- `AdaptiveProvider`: orchestrates polling, decision resolution, queued next-refresh decisions, and applied adaptive-state persistence
- `useAdaptiveUI()`: reads adaptive state from the provider
- `AdminConsole`: reusable runtime configuration UI
- `AdaptiveFeedback`: front-facing feedback component for production experiences
- `useFeedback` / `useFeedbackTrigger`: hooks that submit feedback and decide when to show the prompt (time gate plus activity gate, with dismiss and auto-dismiss)

## Package layout

- `src/adaptive-provider/` - provider, store, persistence, and provider-facing types
- `src/admin-console/` - runtime control center split into sections, primitives, styles, and state orchestration
- `src/feedback/` - feedback component plus the `useFeedback` and `useFeedbackTrigger` hooks
- `src/hooks/` - React hooks such as `useAdaptiveUI`

Root files remain as compatibility re-exports so existing imports continue to work.

## Preferred usage

Use `@dionysys/react` with `@dionysys/client`:

```tsx
import { createDionysysClient } from '@dionysys/client';
import { AdaptiveProvider, useAdaptiveUI, AdminConsole, AdaptiveFeedback } from '@dionysys/react';

const dionysys = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: { persistence: 'browser' },
});

export function App() {
  return (
    <AdaptiveProvider
      client={dionysys}
      mode="mcp"
      sessionId="session_123"
      defaultVariant="neutral"
      presentationMode="production"
      decisionApplication="next-refresh"
      persistenceMode="browser"
    >
      <Workspace />
    </AdaptiveProvider>
  );
}
```

Use the package root as the stable import surface. The internal folder structure is for contributors, not for consumer import paths.

## Manual overrides

For debug panels, preview tools, or builder-facing prototype controls, prefer the explicit override API:

```tsx
import { useAdaptiveUI } from '@dionysys/react';

export function VariantPreviewButton() {
  const { setManualOverride } = useAdaptiveUI();

  return (
    <button
      type="button"
      onClick={() =>
        setManualOverride({
          variant: 'guided_novice',
          personalityId: 'guided_novice',
        })
      }
    >
      Preview guided layout
    </button>
  );
}
```

## Deprecations

- `useAdaptiveUI()._store` is now a compatibility shim and should be treated as deprecated.
- `baseUrl` and `apiBaseUrl` are legacy compatibility props. Prefer `client={dionysysClient}`.
- Prefer explicit hook fields and `setManualOverride(...)` for manual/debug layout changes.

The raw store still exists so older integrations do not break, but it is no longer the recommended extension point for new consumers.

## Development

```bash
npm run build --workspace=packages/react
npm run test --workspace=packages/react
```
