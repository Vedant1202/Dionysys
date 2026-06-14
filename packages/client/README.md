# `@dionysys/client`

Framework-agnostic Dionysys client SDK for browser and app-side integrations.

## Install

```bash
npm install @dionysys/client
```

## Quickstart

```ts
import { createDionysysClient } from '@dionysys/client';

const dionysys = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: {
    persistence: 'browser',
  },
});

const session = await dionysys.sessions.create();

await dionysys.events.track({
  sessionId: session.id,
  events: [
    {
      type: 'ui.interaction',
      subject: 'toolbar.text',
      action: 'selected',
      payload: { tool: 'text' },
    },
  ],
});

await dionysys.events.flush();

const decision = await dionysys.decisions.resolve({
  sessionId: session.id,
  mode: 'deterministic',
});
```

## What it provides

- session create/get/update/end/delete helpers
- current-session persistence helpers
- buffered event ingestion with explicit flush
- decision resolution
- feedback submission and passive evaluation
- admin config and overview access
- bandit inspection and maintenance (`admin.getBandit`, `decayBandit`, `exportBandit`, `importBandit`, `resetBandit`)

## Development

```bash
npm run build --workspace=packages/client
npm run test --workspace=packages/client
```
