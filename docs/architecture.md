# Architecture Overview

Dionysys is organized as a small set of packages plus a backend and a reference frontend. The design goal is to keep decision logic, React orchestration, and app-specific rendering separate enough that contributors can understand each layer without reading the whole repo at once.

## `@dionysys/core`

`@dionysys/core` is the framework-neutral layer. It owns validated contracts and the decision logic that can run on the backend or in any non-React environment.

- `schema/`: UI and config schemas such as `AdaptiveUIDefinition`
- `inference/`: deterministic persona inference types and `InferenceEngine`
- `policy/`: contextual bandit policy selection with `PolicyEngine`
- `reward/`: reward/baseline metrics contracts and `RewardEngine`
- `mcp/`: interaction summarization, personality resources, scoring, resolver logic, and MCP schemas
- `admin/`: runtime/admin config contracts shared between backend and package UI

The core package is where scoring, policy selection, MCP validation, and shared data contracts belong. Event payloads are typed with `unknown` at package boundaries so apps must narrow them intentionally instead of inheriting `any`.

## `@dionysys/react`

`@dionysys/react` is the React-facing package. It keeps the public API compact while splitting internal responsibilities into feature folders.

- `adaptive-provider/`: `AdaptiveProvider`, Zustand store creation, pending-decision persistence helpers, and provider-facing types
- `admin-console/`: reusable runtime control center split into shell, state hook, sections, primitives, and styles
- `feedback/`: `AdaptiveFeedback` for front-facing production feedback
- `hooks/`: `useAdaptiveUI()` and related React access

Top-level exports remain stable. Consumers still import from `@dionysys/react`, even though the internal code is now organized by responsibility.

## Backend and Demo

- `backend/`: session event ingestion, deterministic inference/policy endpoints, MCP decision routing, admin APIs, and the Excalidraw resource bridge
- `frontend/`: Excalidraw demo that renders deterministic variants or MCP-selected UI state, plus prototype/production controls for validation
- `web-docs/`: Docusaurus shell that renders the root `docs/` markdown as the canonical documentation site

## Runtime Flow

1. The app emits interaction events and associates them with a shared session id.
2. The backend stores events and exposes deterministic or MCP decision endpoints.
3. `AdaptiveProvider` polls or resolves decisions through app-supplied hooks.
4. The provider updates a package-owned Zustand store and exposes state through `useAdaptiveUI()`.
5. In `immediate` mode, the chosen variant or MCP UI state is applied right away.
6. In `next-refresh` mode, the provider stores a pending decision and keeps the active workspace UI stable until the next provider mount or refresh.

## Pending-Decision Model

The provider is now intentionally split into:

- a public API layer (`AdaptiveProvider` props and exported hook types)
- a store layer (state plus actions)
- a persistence layer (load/save/clear pending decision helpers)
- a runtime orchestration layer (polling, decision resolution, next-refresh behavior)

That split keeps package consumers on stable exports while making the implementation easier to extend. Manual layout previews should go through `setManualOverride(...)` rather than mutating the raw store directly.
