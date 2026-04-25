# `@dionysys/react`

React bindings for Dionysys adaptive UI.

## Package layout

- `src/adaptive-provider/` - provider, store, persistence, and provider-facing types
- `src/admin-console/` - runtime control center split into sections, primitives, styles, and state orchestration
- `src/feedback/` - lightweight feedback component
- `src/hooks/` - React hooks such as `useAdaptiveUI`

Root files remain as compatibility re-exports so existing imports continue to work.

## Preferred usage

```tsx
import { AdaptiveProvider, useAdaptiveUI, AdminConsole, AdaptiveFeedback } from '@dionysys/react';
```

## Deprecations

- `useAdaptiveUI()._store` is now a compatibility shim and should be treated as deprecated.
- Prefer explicit hook fields and `setManualOverride(...)` for manual/debug layout changes.

## Development

```bash
npm run build --workspace=packages/react
npm run test --workspace=packages/react
```
