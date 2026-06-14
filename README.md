# Dionysys

Self-hosted adaptive UI infrastructure for products that want persona-aware decisions, reusable React bindings, and a reference app that proves the APIs end to end.

## What ships

- `@dionysys/server`: mounts the Dionysys backend surface under `/api/dionysys`
- `@dionysys/client`: framework-agnostic client SDK for sessions, events, decisions, feedback, and admin APIs
- `@dionysys/react`: `AdaptiveProvider`, `useAdaptiveUI`, `AdaptiveFeedback`, and `AdminConsole`
- `@dionysys/storage-mongodb`: MongoDB adapter for the server SDK
- `@dionysys/connector-openai`: OpenAI-backed decision connector
- `@dionysys/connector-gemini`: Gemini-backed decision connector
- `@dionysys/connector-anthropic`: Anthropic-backed decision connector
- `demos/excalidraw/frontend/`: Excalidraw reference app using the public SDK path
- `demos/excalidraw/backend/`: thin Express host wiring around the server SDK

## Reference links

- Demo: [https://dionysys-frontend.vercel.app/](https://dionysys-frontend.vercel.app/)
- Docs: [https://personal-db95a29b.mintlify.app/](https://personal-db95a29b.mintlify.app/)

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure the backend

Create `demos/excalidraw/backend/.env`:

```bash
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
ADMIN_CONSOLE_ENABLED=true

DIONYSYS_STORAGE=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017/autoui_ab_testing

DIONYSYS_LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
DIONYSYS_OPENAI_MODEL=gpt-5
```

Keep API keys on the server only. Do not put `OPENAI_API_KEY` in frontend env files.

Gemini and Anthropic are also supported:

```bash
DIONYSYS_LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
DIONYSYS_GEMINI_MODEL=gemini-3.1-flash-lite

DIONYSYS_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
DIONYSYS_ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

Keep all provider API keys out of frontend env files.

### 3. Configure the frontend

Create `demos/excalidraw/frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_CONSOLE_ENABLED=true
```

### 4. Run locally

```bash
npm run dev --workspace=@dionysys-demo/excalidraw-backend
npm run dev --workspace=@dionysys-demo/excalidraw-frontend
```

The frontend defaults to `http://localhost:5173` and the backend defaults to `http://localhost:3001`.

## SDK shape

### Server

```ts
import express from 'express';
import { createDionysysServer } from '@dionysys/server';
import { createMongoDionysysStorage } from '@dionysys/storage-mongodb';
import { openAiConnector } from '@dionysys/connector-openai';
// import { geminiConnector } from '@dionysys/connector-gemini';
// import { anthropicConnector } from '@dionysys/connector-anthropic';

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

### Client

```ts
import { createDionysysClient } from '@dionysys/client';

const dionysys = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: { persistence: 'browser' },
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

const decision = await dionysys.decisions.resolve({
  sessionId: session.id,
  mode: 'deterministic',
});
```

### React

```tsx
import { createDionysysClient } from '@dionysys/client';
import { AdaptiveProvider } from '@dionysys/react';

const client = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: { persistence: 'browser' },
});

export function App() {
  return (
    <AdaptiveProvider
      client={client}
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

## Event naming guidance

Use loose but structured event envelopes:

```ts
{
  type: 'ui.interaction',
  subject: 'toolbar.text',
  action: 'selected',
  payload: { tool: 'text' },
  metadata: { source: 'excalidraw' }
}
```

Recommended conventions:

- `type`: lowercase dot namespace such as `ui.interaction`
- `subject`: lowercase dot namespace such as `toolbar.text`
- `action`: simple verb such as `selected`, `created`, `completed`
- `payload` and `metadata`: camelCase keys

## Commands

| Command | Description |
| --- | --- |
| `npm run build` | Build all workspaces |
| `npm run test` | Run workspace tests |
| `npm run build:demo:frontend` | Build the Excalidraw reference app |
| `npm run build:demo:backend` | Build the Excalidraw backend host |
| `npm run docs` | Start the docs site |
| `npm run docs:build` | Build the docs site |

## Docs

Start with the canonical markdown docs in [`docs/`](./docs):

- [Usage](./docs/usage.md)
- [Configuration](./docs/configuration.md)
- [Architecture](./docs/architecture.md)
- [OpenAPI Reference](./docs/openapi.md) — REST API spec at [`docs/openapi/dionysys-api.yaml`](./docs/openapi/dionysys-api.yaml)
- [Admin Console](./docs/admin-console.md)
- [Feedback Loop](./docs/feedback-loop.md)
