# SDK Usage Guide

This guide shows the preferred Dionysys integration path today:

1. mount `@dionysys/server` in your backend
2. create a `@dionysys/client` instance in your app
3. pass that client into `@dionysys/react`

## Install

```bash
npm install @dionysys/server @dionysys/client @dionysys/react
```

Add adapters as needed:

```bash
npm install @dionysys/storage-mongodb @dionysys/connector-openai
```

## Backend setup

```ts
import express from 'express';
import { createDionysysServer } from '@dionysys/server';
import { createMongoDionysysStorage } from '@dionysys/storage-mongodb';
import { openAiConnector } from '@dionysys/connector-openai';

const app = express();

const dionysys = createDionysysServer({
  storage: createMongoDionysysStorage({
    uri: process.env.MONGODB_URI,
  }),
  llmConnector: openAiConnector({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.DIONYSYS_OPENAI_MODEL ?? 'gpt-5',
  }),
  admin: { enabled: true },
});

app.use('/api/dionysys', dionysys.router());
```

Keep provider keys like `OPENAI_API_KEY` on the server only.

## Client setup

```ts
import { createDionysysClient } from '@dionysys/client';

export const dionysys = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: {
    persistence: 'browser',
  },
});
```

The client handles:

- session CRUD and current-session persistence
- event tracking
- decision resolution
- feedback submission and passive evaluation
- admin config and overview access

## React setup

```tsx
import { AdaptiveProvider } from '@dionysys/react';
import { dionysys } from './dionysysClient';

export function App() {
  return (
    <AdaptiveProvider
      client={dionysys}
      mode="mcp"
      presentationMode="production"
      decisionApplication="next-refresh"
      persistenceMode="browser"
      sessionId="session_123"
      defaultVariant="neutral"
      minEventsBeforeLock={5}
    >
      <Workspace />
    </AdaptiveProvider>
  );
}
```


## Tracking events

The client accepts loose event envelopes:

```ts
await dionysys.events.track({
  sessionId: 'session_123',
  events: [
    {
      type: 'ui.interaction',
      subject: 'toolbar.text',
      action: 'selected',
      payload: {
        tool: 'text',
      },
      metadata: {
        source: 'my-app',
      },
    },
  ],
});
```

Recommended naming:

- `type`: lowercase dot namespace, such as `ui.interaction`
- `subject`: lowercase dot namespace, such as `toolbar.text`
- `action`: simple verb, such as `selected`, `opened`, `completed`
- `payload` and `metadata`: camelCase keys

Keep app-specific translation in your app. The Excalidraw demo does this in a frontend-only adapter instead of leaking Excalidraw event names into the public SDK.

## Resolving decisions

### Deterministic

```ts
const decision = await dionysys.decisions.resolve({
  sessionId: 'session_123',
  mode: 'deterministic',
});
```

### MCP

```ts
const decision = await dionysys.decisions.resolve({
  sessionId: 'session_123',
  mode: 'mcp',
});
```

Both use the same primary backend route:

```http
POST /api/dionysys/decisions:resolve
```

## Reading adaptive state

```tsx
import { useAdaptiveUI } from '@dionysys/react';

export function Workspace() {
  const {
    currentVariant,
    currentUIState,
    currentPersonality,
    pendingDecision,
    hasPendingUIChange,
    setManualOverride,
  } = useAdaptiveUI();

  return (
    <div>
      <pre>{JSON.stringify({ currentVariant, currentPersonality, pendingDecision, hasPendingUIChange }, null, 2)}</pre>
      <button
        type="button"
        onClick={() => setManualOverride({ variant: 'neutral' })}
      >
        Reset preview
      </button>
    </div>
  );
}
```

`useAdaptiveUI()._store` still exists as a compatibility shim, but new code should use the explicit hook fields and `setManualOverride(...)`.

## Feedback

Use the package-owned feedback component in connected mode:

```tsx
import { AdaptiveFeedback } from '@dionysys/react';

export function FeedbackSlot() {
  return (
    <AdaptiveFeedback
      sessionId="session_123"
      client={dionysys}
      onRevert={() => {
        console.log('User accepted revert');
      }}
    />
  );
}
```

## Admin console

```tsx
import { AdminConsole } from '@dionysys/react';

export function AdminPage() {
  return (
    <AdminConsole
      client={dionysys}
      sessionId="session_123"
      defaultTab="overview"
    />
  );
}
```

The admin console edits runtime state only. It does not rewrite source config files.

## Persistence modes

`@dionysys/client` and `@dionysys/react` share the same persistence vocabulary:

- `memory`: page lifetime only
- `tab`: `sessionStorage`
- `browser`: `localStorage`

Use `decisionApplication="next-refresh"` when you want decisions to queue safely instead of changing the interface mid-task.

## Where to go next

- **[Configuration reference](configuration.md)** — every env var, storage option, and connector selection guide.
- **[Architecture overview](architecture.md)** — package graph and request-flow walk-through.
- **[OpenAPI reference](openapi.md)** — full REST API spec at `docs/openapi/dionysys-api.yaml`.
- **[Excalidraw demo](https://github.com/Vedant1202/Dionysys/tree/main/demos/excalidraw)** — living example of the public SDK APIs in a real app.
