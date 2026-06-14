# Spec: Dionysys Self-Hosted SDK Upgrade

## Assumptions

1. Dionysys is positioned as a persona-driven decision SDK for UI adaptation.
2. The first productization target is the current Excalidraw demo, refactored to consume the public SDK APIs.
3. The SDK is self-hosted: developers run the Dionysys backend/server package in their own app infrastructure.
4. Decisions are server-backed first. Local-only deterministic decisions can be added later, but are not required for v0.
5. Developers can bring their own LLM agent through a connector contract. Dionysys validates connector output before applying UI decisions.
6. The admin console is part of the SDK surface, initially exposed through the React package.
7. Excalidraw-specific integration code can remain internal and does not need to be published as an npm package for v0.
8. Multi-tenant hosted SaaS concerns are out of scope for this upgrade.

## Objective

Transform the current Dionysys monorepo from a working adaptive Excalidraw demo into a self-hosted SDK suite with stable public APIs.

The upgraded system should let an application developer:

1. Install Dionysys packages.
2. Mount a Dionysys server/router in their backend.
3. Configure storage, personas, UI actions, and an LLM decision connector.
4. Create/manage sessions through Dionysys APIs.
5. Track loose, app-agnostic UI events from the browser.
6. Resolve full persona-driven UI decisions.
7. Use React bindings and the admin console in an app.
8. Use the Excalidraw demo as a reference implementation and public live demo.

Success means the Excalidraw app uses the same public SDK APIs that external developers would use. Demo-only shortcuts, backend internals, provider-specific LLM code, and app-specific event names should not leak into stable package surfaces.

## Tech Stack

- Language: TypeScript
- Runtime: Node.js 20+ currently, with package support documented through `engines`
- Frontend: React and Vite for the Excalidraw demo
- Backend: Express for the current reference server
- Storage: MongoDB through a storage adapter
- Validation: Zod
- Tests: Vitest
- Package manager: npm workspaces
- Docs: root `docs/` markdown plus existing docs site

## Commands

Use these commands from the repository root unless noted otherwise:

```bash
npm install
npm run build
npm run test
npm run lint
npm run build --workspace=packages/core
npm run build --workspace=packages/react
npm run build --workspace=backend
npm run build --workspace=frontend
npm run test --workspace=packages/core
npm run test --workspace=backend
npm run test --workspace=frontend
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
npm run dev --workspace=frontend
npm run docs
```

Backend route tests may need permission to bind local ephemeral ports when run inside a sandboxed environment.

## Project Structure

Target package structure:

```text
packages/core
  Framework-neutral schemas, event/decision/session types, persona resources,
  deterministic inference, policy, reward, MCP/persona resolution, and validation.

packages/client
  Framework-agnostic browser/client SDK for sessions, event tracking, flushing,
  decision requests, feedback, and API transport.

packages/react
  React bindings, AdaptiveProvider, hooks, AdaptiveFeedback, and AdminConsole.
  This package should depend on packages/client rather than duplicating API calls.

packages/server
  Self-hosted backend SDK: createDionysysServer, router factories, service
  orchestration, connector contracts, and storage contracts.

packages/storage-mongodb
  MongoDB storage adapter. This may start inside packages/server and split later
  if that keeps the first migration smaller.

packages/connector-openai
  Optional OpenAI connector. This may start inside packages/server/connectors and
  split later once the connector API stabilizes.

backend
  Reference Express server consuming packages/server. It should become thin glue.

frontend
  Excalidraw demo consuming packages/client and packages/react public APIs.

docs
  Canonical product, integration, and API documentation.
```

Current Excalidraw-specific code should move behind internal integration boundaries before any public SDK API is declared stable.

## Public API Shape

### Client SDK

```ts
import { createDionysysClient } from '@dionysys/client';

const dionysys = createDionysysClient({
  apiBaseUrl: '/api/dionysys',
  session: {
    persistence: 'browser',
  },
});

const session = await dionysys.sessions.create();

await dionysys.events.track({
  type: 'ui.interaction',
  subject: 'toolbar.text',
  action: 'selected',
  payload: {
    tool: 'text',
  },
});

const decision = await dionysys.decisions.resolve({
  sessionId: session.id,
});
```

### Server SDK

```ts
import { createDionysysServer } from '@dionysys/server';
import { openAiConnector } from '@dionysys/connector-openai';

const dionysys = createDionysysServer({
  config,
  storage,
  llmConnector: openAiConnector({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.DIONYSYS_OPENAI_MODEL ?? 'gpt-5',
  }),
});

app.use('/api/dionysys', dionysys.router());
```

### React SDK

```tsx
import { AdaptiveProvider, useAdaptiveUI, AdminConsole } from '@dionysys/react';

export function App() {
  return (
    <AdaptiveProvider client={dionysysClient} defaultVariant="neutral">
      <Workspace />
    </AdaptiveProvider>
  );
}

function Workspace() {
  const { currentVariant, currentUIState, selectedPersona } = useAdaptiveUI();
  return null;
}
```

## Data Contracts

### Event Envelope

The event format should be loose enough for any application but structured enough for scoring, summaries, and documentation.

```ts
export type DionysysEvent = {
  type: string;
  timestamp?: number | string | Date;
  sessionId?: string;
  userId?: string;
  subject?: string;
  action?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
```

Required:

- `type`

Recommended:

- `subject`
- `action`
- `payload`

Naming rules:

- `type` uses lowercase dot namespaces, such as `ui.interaction`.
- `subject` uses lowercase dot namespaces, such as `toolbar.text`.
- `action` is a simple verb or past-tense action, such as `selected`, `created`, `completed`.
- `payload` and `metadata` keys use camelCase.
- Dionysys-generated events use the `dionysys.*` namespace.

### Decision Object

Decisions should always return a full object, not only a variant string.

```ts
export type DionysysDecision = {
  id: string;
  sessionId: string;
  mode: 'deterministic' | 'mcp';
  variant: string;
  uiState?: Record<string, unknown>;
  selectedPersona: {
    id: string;
    confidence: number;
  };
  scores: Record<string, number>;
  rationale?: string;
  metadata?: Record<string, unknown>;
};
```

### Session API

Dionysys owns internal session management and persistence. Developers may use generated sessions or provide their own session id.

```ts
await dionysys.sessions.create(options);
await dionysys.sessions.get(sessionId);
await dionysys.sessions.update(sessionId, metadata);
await dionysys.sessions.end(sessionId);
await dionysys.sessions.delete(sessionId);
await dionysys.sessions.getCurrent();
await dionysys.sessions.setCurrent(sessionId);
```

### Connector Contract

All model/provider integrations must adapt to one Dionysys connector contract.

```ts
export type DionysysDecisionConnector = {
  decide(input: DionysysDecisionInput): Promise<DionysysConnectorDecision>;
};

export type DionysysConnectorDecision = {
  personaId: string;
  actionId: string;
  confidence: number;
  rationale?: string;
  metadata?: Record<string, unknown>;
};
```

Dionysys must validate connector output:

- `personaId` is allowed.
- `actionId` exists for the selected persona.
- `confidence` is within `0..1`.
- `confidence` meets configured `minConfidence`.
- the selected action contains a valid `uiState`.
- invalid output falls back to a configured safe action.

Provider-specific connectors:

- `mockConnector`
- `customHttpConnector`
- `openAiConnector`
- `anthropicConnector` later
- `geminiConnector` later

API keys must stay server-side. Browser packages must not accept provider API keys.

## Code Style

Use TypeScript object option bags for constructors and most methods. Required fields should be required TypeScript properties; optional behavior should be optional properties with documented defaults.

```ts
export type CreateDionysysClientOptions = {
  apiBaseUrl: string;
  session?: {
    id?: string;
    persistence?: 'memory' | 'tab' | 'browser';
  };
  flushIntervalMs?: number;
};

export function createDionysysClient(options: CreateDionysysClientOptions): DionysysClient {
  return createClientFromOptions(options);
}
```

Naming conventions:

- `PascalCase` for exported types, interfaces, classes, React components.
- `camelCase` for variables, functions, methods, object fields.
- `UPPER_SNAKE_CASE` only for internal constants.
- Use American English names, for example `color` not `colour`.
- Use the same word for the same concept across packages.
- Use `connector` for LLM/model/provider integrations.
- Use `adapter` for app/UI integrations.
- Prefer `resolveDecision` or `decisions.resolve` over `makeDecision`.
- Prefer `uiState`, `selectedPersona`, `sessionId`, `metadata`, `payload`.
- Avoid vague public names such as `Manager`, `Data`, `Payload2`, `brain`, or `agentConfig`.

Package export rules:

- Use package root exports for stable public APIs.
- Use `package.json` `exports` to explicitly expose public entry points.
- Avoid public deep imports into `src` or internal folders.
- Generate `.d.ts` declarations for every published package.
- Use `files` in `package.json` to ship only intended files.

## HTTP API

Reference REST shape:

```text
POST   /api/dionysys/sessions
GET    /api/dionysys/sessions/:sessionId
PATCH  /api/dionysys/sessions/:sessionId
POST   /api/dionysys/sessions/:sessionId/end
DELETE /api/dionysys/sessions/:sessionId

POST   /api/dionysys/events
POST   /api/dionysys/decisions:resolve
POST   /api/dionysys/feedback

GET    /api/dionysys/admin/config
PUT    /api/dionysys/admin/config
GET    /api/dionysys/admin/config/export
GET    /api/dionysys/admin/overview
```

Errors should use one shape:

```ts
export type DionysysApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

HTTP contract requirements:

- Validate all external input at route boundaries.
- Return standard HTTP status codes.
- Document request and response schemas in OpenAPI before declaring the API stable.
- Keep admin APIs gated by explicit configuration.

## Configuration

Runtime admin config can be edited through the admin console. Persistence should use export/import as the official workflow:

1. Tune configuration in the admin console.
2. Export JSON.
3. Commit the exported config into the app.
4. Import/load the config in server startup.

Example:

```ts
import config from './dionysys.config.json' assert { type: 'json' };

const dionysys = createDionysysServer({
  config,
  storage,
  llmConnector,
});
```

Environment variable conventions:

```bash
DIONYSYS_LLM_PROVIDER=openai
DIONYSYS_OPENAI_MODEL=gpt-5
OPENAI_API_KEY=sk-...
```

Provider keys must not use `VITE_*` names and must not be exposed to browser code.

## Testing Strategy

Use Vitest for package tests.

Test levels:

- Unit tests for core schemas, inference, scoring, connector validation, storage contracts, and client helpers.
- Route tests for server SDK router behavior, request validation, error responses, and session CRUD.
- Integration tests proving the Excalidraw demo can use only public SDK APIs.
- Type-level/API tests for package exports and public declarations.
- Build tests for every package and app.

Required verification before merging SDK changes:

```bash
npm run build
npm run test
npm run lint
```

Additional recommended checks before publishing:

```bash
npm pack --dry-run --workspace=packages/core
npm pack --dry-run --workspace=packages/client
npm pack --dry-run --workspace=packages/react
npm pack --dry-run --workspace=packages/server
```

Future release tooling:

- API Extractor for public API review.
- Changesets for monorepo versioning and changelogs.
- npm trusted publishing/provenance for public package releases.

## Boundaries

Always:

- Keep API keys and provider secrets server-side.
- Validate external input at client/server boundaries.
- Return full decision objects.
- Use object option bags for public constructors and methods.
- Keep public imports stable and documented.
- Run package builds and relevant tests before marking work complete.
- Keep Excalidraw as the first SDK consumer and reference implementation.

Ask first:

- Adding a new runtime dependency to a public package.
- Changing package names.
- Changing route paths after the OpenAPI contract is drafted.
- Splitting connector packages into separate published packages.
- Removing existing public exports from `@dionysys/core` or `@dionysys/react`.
- Changing storage technology or requiring a non-MongoDB database.
- Persisting admin config automatically to disk or database.

Never:

- Put OpenAI, Anthropic, Gemini, or custom provider API keys in browser code.
- Expose raw Zustand stores as the recommended extension API.
- Expose Mongoose models as public SDK API.
- Make Excalidraw-specific event names part of `@dionysys/core`.
- Let LLM output directly mutate UI without validation and fallback.
- Commit `.env` secrets.
- Remove failing tests to make the suite pass.
- Publish deep internal paths as stable imports.

## Success Criteria

The upgrade is complete when:

1. The Excalidraw demo uses `@dionysys/client` and `@dionysys/react` public APIs for session management, event tracking, and decision resolution.
2. The backend app is thin glue around `@dionysys/server`.
3. Server decisions accept a configurable `DionysysDecisionConnector`.
4. At least `mockConnector`, `customHttpConnector`, and `openAiConnector` exist.
5. Provider API keys remain server-side and are documented.
6. The event envelope is documented and validated.
7. The decision object is documented and returned consistently.
8. Admin config supports runtime editing plus export/import.
9. Package entry points use explicit `exports`.
10. Public TypeScript declarations are generated.
11. Builds pass for all packages and apps.
12. Tests pass for core, client, react, server, backend, and frontend.
13. Documentation shows how to integrate Dionysys into a self-hosted app.

## Locked Decisions

1. The first server package is named `@dionysys/server`.
2. `storage-mongodb` is split immediately into `@dionysys/storage-mongodb`.
3. `openAiConnector` ships as `@dionysys/connector-openai` immediately.
4. The decision endpoint prefers `POST /api/dionysys/decisions:resolve`; `/api/dionysys/decisions/resolve` may be used if routing/tooling makes colon paths awkward.
5. Session deletion is included in v0 (create/get/update/end/delete).
6. Admin config import is a startup/programmatic option only in v0; HTTP import is deferred.
7. Public event names recommend a small starter vocabulary (`ui.interaction`, `content.created`, `workflow.completed`, `error.encountered`).
8. The React provider accepts a `DionysysClient` but preserves callback props like `pollInference`, `evaluatePolicy`, and `resolveDecision` temporarily for compatibility.

## Source Guidance

- Node.js package `exports` define public package entry points and prevent accidental unsupported entry points.
- npm package `files` controls published package contents.
- TypeScript declaration files should be generated for published TypeScript packages.
- SemVer requires a declared public API.
- API Extractor can generate public API reports and declaration rollups.
- OpenAPI describes HTTP APIs in a language-agnostic format.
- Google API naming guidance recommends simple, intuitive, consistent names.
- OpenTelemetry naming guidance recommends lowercase dot-namespaced event and attribute names.
- Azure TypeScript SDK guidance recommends idiomatic TypeScript, consistency, and `Options` suffixes for option bags.
