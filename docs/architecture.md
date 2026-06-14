# Architecture Overview

Dionysys is organized around one public path through the system:

```text
app UI
  -> @dionysys/client
    -> /api/dionysys/*
      -> @dionysys/server
        -> storage adapter + decision connector
          -> @dionysys/core contracts and logic
```

## Package graph

```text
@dionysys/core
  ^-- @dionysys/client
        ^-- @dionysys/react
  ^-- @dionysys/server
        ^-- @dionysys/storage-mongodb
        ^-- @dionysys/connector-openai
        ^-- @dionysys/connector-gemini
        ^-- @dionysys/connector-anthropic
        (also: mockConnector, customHttpConnector — built into @dionysys/server)
```

## Package roles

### `@dionysys/core`

Framework-neutral contracts and adaptive logic:

- Event, session, decision, and admin schemas (Zod)
- Deterministic inference and policy logic
- MCP resource schemas and decision-support contracts
- Shared validation and contract boundaries
- Re-exports `z` from `zod` for downstream consumers

### `@dionysys/server`

Self-hosted backend SDK:

- Mounts the primary `/api/dionysys/*` routes (sessions, events, decisions, feedback, admin)
- Coordinates session, event, decision, feedback, and admin services
- Depends on a storage implementation and a decision connector
- Includes built-in `mockConnector` and `customHttpConnector`

### `@dionysys/client`

Framework-agnostic API client:

- Session CRUD and current-session persistence
- Buffered event tracking with explicit flush
- Decision resolution
- Feedback submission and passive evaluation
- Admin config and overview access

### `@dionysys/react`

React-facing runtime:

- `AdaptiveProvider` — wraps the app and drives adaptive state
- `useAdaptiveUI` — reads current variant, UI state, and pending decisions
- `AdaptiveFeedback` — connected feedback widget
- `AdminConsole` — runtime config and session overview UI

The preferred React integration is `client={dionysysClient}`.

### `@dionysys/storage-mongodb`

MongoDB-backed implementation of the server storage contract.

### `@dionysys/connector-openai`

OpenAI-backed implementation of the decision connector contract.

### `@dionysys/connector-gemini`

Gemini-backed implementation of the decision connector contract.

### `@dionysys/connector-anthropic`

Anthropic-backed implementation of the decision connector contract.

## Request flow

### 1. Session bootstrap

The app creates or restores a current session through `@dionysys/client`.

### 2. Event collection

App code translates local interaction events into `DionysysEvent` envelopes and sends them through `client.events.track(...)`.

### 3. Decision resolution

The client calls:

```http
POST /api/dionysys/decisions:resolve
```

The server reads recent events, computes the deterministic context, always consults the configured connector, and resolves the decision through a confidence gate:

- **Strong signal** (enough modality events and a clear score margin) — deterministic rules decide; the connector's answer is honored only when it agrees with the locked modality and clears `minConfidence`.
- **Weak / ambiguous signal** — the connector's choice is blended with a per-context Thompson-sampling bandit. Each candidate modality scores `(1 - wBandit)·llmConfidence + wBandit·thompsonSample`, where `wBandit = n / (n + banditEvidenceK)`. With no bandit history the blend reduces to the model's free choice; as evidence accrues the bandit dominates. A quiet arm is discounted toward its prior on read (`γ^(days idle)`, in memory only) so a context that has gone stale re-opens to exploration.

Invalid or low-confidence output falls back to a configured safe action. The stored decision carries `metadata.signalStrength`, `metadata.resolvedBy` (`deterministic` | `blended` | `fallback`), and `metadata.blend` for observability. Feedback then updates the `(stateId, modality)` bandit arm — discounting it toward its prior first (discounted Thompson sampling) so old evidence fades — so later weak-signal decisions in the same context shift toward what worked — see [Feedback Loop](./feedback-loop.md). The learned arms are inspectable and maintainable (posterior mean, credible interval, `P(best)`, decay, snapshot/reset) through the admin console's [Bandit tab](./admin-console.md#bandit-tab) and the `GET/POST /api/dionysys/admin/bandit*` routes. The gate, bandit, and decay are tunable via `mcp.gate` / `mcp.bandit` in [Configuration](./configuration.md).

### 4. React application

`AdaptiveProvider` stores the active and pending adaptive state and exposes it through `useAdaptiveUI()`.

### 5. Feedback and admin

Feedback and admin operations use the same `/api/dionysys/*` route family rather than separate ad hoc endpoints.

## OpenAPI document

The full REST API surface is described in `docs/openapi/dionysys-api.yaml`.

To regenerate after schema or route changes:

```bash
npm run openapi:build --workspace=packages/server
```

The generated YAML is checked in and deterministic — running the command twice on a clean tree produces no `git diff`. Hand-edits to the file are not allowed; corrections go in the source schemas or route registrations.

## Excalidraw as reference app

The Excalidraw demo is intentionally app-specific at the edges:

- It translates Excalidraw events in frontend-only adapter code
- It keeps demo UX decisions in app code
- It serves as the living example of the public SDK APIs

That split is important. Public packages stay generic; demo behavior stays local.
