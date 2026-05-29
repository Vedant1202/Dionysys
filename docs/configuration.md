# Configuration Guide

This guide covers every environment variable, client option, and connector selection used by the Dionysys SDK stack.

## Runtime configuration layers

| Layer | Responsibility |
| --- | --- |
| `@dionysys/core` | Schemas, deterministic logic, MCP resources, shared contracts |
| `@dionysys/server` | Route wiring, storage integration, connector dispatch, admin orchestration |
| `@dionysys/client` | API transport and current-session persistence |
| `@dionysys/react` | Provider behavior, feedback UI, admin console UI |
| App code | Event translation, UI rendering, app-specific metadata |

## Backend environment variables

| Variable | Type | Default | Effect |
| --- | --- | --- | --- |
| `PORT` | `number` | `3001` | Port the Express server binds to |
| `ALLOWED_ORIGIN` | `string` | `http://localhost:5173` | CORS allowed origin(s); comma-separate for multiple; `*` allows all |
| `MONGO_URI` | `string` | `mongodb://127.0.0.1:27017/autoui_ab_testing` | MongoDB connection string when using the MongoDB storage adapter |
| `ADMIN_CONSOLE_ENABLED` | `boolean` | `false` | Enables the admin config endpoints (`/api/dionysys/admin/*`) |
| `DIONYSYS_STORAGE` | `memory\|mongodb` | `memory` | Storage backend; `mongodb` requires `MONGO_URI` |
| `DIONYSYS_LLM_PROVIDER` | `mock\|custom-http\|openai` | `mock` | Decision connector to use |

### OpenAI connector variables

| Variable | Type | Default | Effect |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | `string` | — | **Server-side only.** Required when `DIONYSYS_LLM_PROVIDER=openai` |
| `DIONYSYS_OPENAI_MODEL` | `string` | `gpt-4o` | OpenAI model to use for MCP decision calls |
| `DIONYSYS_OPENAI_TEMPERATURE` | `number` | `0.2` | Sampling temperature (0–2) |
| `DIONYSYS_OPENAI_TIMEOUT_MS` | `number` | `15000` | Request timeout in milliseconds |

### Custom HTTP connector variables

| Variable | Type | Default | Effect |
| --- | --- | --- | --- |
| `DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT` | `string` | — | Required. Full URL of the custom connector endpoint |
| `DIONYSYS_CUSTOM_CONNECTOR_METHOD` | `string` | `POST` | HTTP method |
| `DIONYSYS_CUSTOM_CONNECTOR_BEARER_TOKEN` | `string` | — | Bearer token added to `Authorization` header |
| `DIONYSYS_CUSTOM_CONNECTOR_HEADERS_JSON` | `string` | — | JSON-serialized object of additional request headers |
| `DIONYSYS_CUSTOM_CONNECTOR_TIMEOUT_MS` | `number` | `15000` | Request timeout in milliseconds |

> **Security:** Never expose `OPENAI_API_KEY` or connector credentials to the browser. All connector variables are server-side only.

## Connector selection

Choose a decision connector based on your needs:

```
Need deterministic scoring only?
  └─ Leave DIONYSYS_LLM_PROVIDER=mock (default) — no LLM calls, always returns deterministic output.

Need an OpenAI-powered MCP connector?
  └─ DIONYSYS_LLM_PROVIDER=openai + OPENAI_API_KEY + optional DIONYSYS_OPENAI_MODEL

Need to call your own inference endpoint?
  └─ DIONYSYS_LLM_PROVIDER=custom-http + DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT
```

In code:

```ts
import { createDionysysServer } from '@dionysys/server';
import { openAiConnector } from '@dionysys/connector-openai';
import { mockConnector } from '@dionysys/server';  // built-in

// OpenAI
createDionysysServer({ llmConnector: openAiConnector({ apiKey: process.env.OPENAI_API_KEY }) });

// Mock (deterministic only, no LLM)
createDionysysServer({ llmConnector: mockConnector() });

// Custom HTTP
createDionysysServer({
  llmConnector: customHttpConnector({ endpoint: process.env.DIONYSYS_CUSTOM_CONNECTOR_ENDPOINT }),
});
```

## Client configuration

```ts
import { createDionysysClient } from '@dionysys/client';

export const dionysys = createDionysysClient({
  apiBaseUrl: 'http://localhost:3001',
  session: {
    persistence: 'browser',      // 'memory' | 'tab' | 'browser'
    storageKey: 'dionysys_current_session',  // optional, customise the storage key
  },
});
```

`persistence` options:

| Value | Storage | Lifetime |
| --- | --- | --- |
| `memory` | In-memory | Page lifetime only |
| `tab` | `sessionStorage` | Tab lifetime |
| `browser` | `localStorage` | Persistent across tabs and refreshes |

## React provider configuration

```tsx
<AdaptiveProvider
  client={dionysys}
  mode="mcp"                      // 'deterministic' | 'mcp'
  presentationMode="production"   // 'prototype' | 'production'
  decisionApplication="next-refresh" // 'immediate' | 'next-refresh'
  persistenceMode="browser"       // 'memory' | 'tab' | 'browser'
  sessionId="session_123"
  defaultVariant="neutral"
  minEventsBeforeLock={5}
  pollingIntervalMs={3000}
/>
```

Key settings:

| Prop | Type | Effect |
| --- | --- | --- |
| `mode` | `deterministic\|mcp` | Deterministic uses local scoring; MCP calls the connector |
| `presentationMode` | `prototype\|production` | Prototype shows decision debug UI; production is silent |
| `decisionApplication` | `immediate\|next-refresh` | Immediate applies instantly; next-refresh queues until next page load |
| `persistenceMode` | `memory\|tab\|browser` | Where the provider stores pending/applied decision state |
| `minEventsBeforeLock` | `number` | Minimum events collected before a decision can lock in |
| `pollingIntervalMs` | `number` | Interval between automatic passive feedback evaluations |

## Event envelope guidance

Preferred envelope:

```ts
{
  type: 'ui.interaction',
  subject: 'toolbar.text',
  action: 'selected',
  payload: { tool: 'text' },
  metadata: { source: 'my-app' }
}
```

Naming conventions:

- `type` — required; lowercase dot namespace (e.g. `ui.interaction`, `session.start`)
- `subject` — recommended; lowercase dot namespace targeting the UI element
- `action` — recommended; simple verb (`selected`, `opened`, `completed`)
- `payload` — app-specific structured detail; camelCase keys
- `metadata` — optional non-decision context; camelCase keys

## Admin runtime config

When `ADMIN_CONSOLE_ENABLED=true` the backend exposes runtime admin state:

```http
GET  /api/dionysys/admin/config         Read current config
PUT  /api/dionysys/admin/config         Update config at runtime
POST /api/dionysys/admin/config/reset   Reset to file defaults
GET  /api/dionysys/admin/config/export  Export as downloadable JSON
GET  /api/dionysys/admin/overview       Current session overview snapshot
GET  /api/dionysys/admin/overview/stream  Server-sent events stream
```

Use the React `AdminConsole` to edit runtime config in memory. Export a snapshot when you want to promote tuned configuration back into source control.
