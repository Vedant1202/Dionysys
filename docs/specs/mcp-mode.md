# Spec: MCP-Driven Adaptive UI Mode

## Objective

MCP mode adds a configurable adaptive path beside deterministic inference and policy selection. Personality resources define both how user behavior is scored and which UI actions can be selected. The backend summarizes interaction events, computes persona scores from those resources, sends only summarized evidence to a configurable LLM connector, and applies the selected UI state in the Excalidraw demo.

Success means a consumer can keep deterministic mode unchanged, opt into MCP mode, define personality resources with scoring rules and UI actions, and receive a validated `AdaptiveDecision` with persona scores, confidence, and UI state.

## Tech Stack

- TypeScript across `@dionysys/core`, `@dionysys/react`, `backend`, and `frontend`.
- Zod for resource and decision validation.
- React + Zustand for adaptive UI state.
- Express for backend bridge routes.
- Vitest for package/backend/frontend tests.
- No provider-specific LLM SDK in core or React.

## Commands

```bash
npm run build
npm run test
npm run test --workspace=packages/core
npm run test --workspace=backend
npm run test --workspace=frontend
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

## Project Structure

```text
packages/core/src/mcp/      MCP contracts, schemas, summarizer, scorer, resolver
packages/react/src/         AdaptiveProvider and useAdaptiveUI MCP state support
backend/src/services/       Excalidraw resources, LLM connectors, decision service
backend/src/routes/         /api/adaptive endpoints
frontend/src/components/    Excalidraw shell, mode switch, toolbar, debug panel
frontend/src/core/          Shared session ID and event collection
docs/specs/                 Feature specs
```

## Code Style

Use provider-neutral TypeScript interfaces and validate external/resource input at boundaries.

```ts
const resolver = new McpModeResolver({
  resources: EXCALIDRAW_PERSONALITY_RESOURCES,
  llmConnector,
  fallbackVariant: 'neutral',
  minConfidence: 0.5,
});

const decision = await resolver.resolve({
  events: toSummarizableEvents(events),
  summaryOptions: { sessionStartMs, nowMs: Date.now() },
});
```

## Persona Score Calculation

Each personality resource owns deterministic scoring rules:

- Start with `baseWeight`, defaulting to `1`.
- Add each matching signal rule’s `weight`.
- Clamp each raw score to `>= 0`.
- Normalize raw scores into persona probabilities.
- If all raw scores are zero, return a uniform distribution.

Supported signal metrics include `totalEvents`, `eventCount`, `eventRatio`, `elementCount`, `toolDiversity`, `textToShapeRatio`, `timeToFirstEventMs`, `timeSinceLastEventMs`, and `recentEventType`.

The LLM receives the available personality/action set, the sanitized `InteractionSummary`, raw scores, and normalized persona scores. It must choose from the exposed actions; invalid or low-confidence output falls back to a safe resource action.

## Testing Strategy

- Core unit tests cover schemas, summarization, scoring, resolver success, and fallback.
- Backend tests cover deterministic decisions, MCP connector input, and MCP UI-state output.
- Frontend checks cover provider compatibility, mode switching, and Excalidraw UI adaptation.
- Full verification should run build and tests once local native dependencies are healthy.

## Boundaries

- Always: validate MCP resources, validate route input, sanitize/cap event payloads before LLM calls, keep deterministic mode compatible.
- Ask first: adding provider SDKs, changing database schemas, changing CORS/auth behavior, replacing deterministic mode.
- Never: commit secrets, send raw uncapped user text to an LLM by default, remove existing tests, or edit vendor directories.

## Success Criteria

- `@dionysys/core` exports MCP contracts, schemas, summarizer, scorer, and resolver.
- `@dionysys/react` exposes MCP decision state while preserving deterministic APIs.
- `backend` serves `GET /api/adaptive/resources` and `POST /api/adaptive/decision`.
- `frontend` can switch between deterministic and MCP mode with one shared session ID.
- Debug UI shows mode, selected personality, confidence, and persona scores.
- Docs explain how to configure scoring resources and LLM decision flow.
