# `@dionysys/core`

Core adaptive-UI logic for Dionysys.

## Public surface

Prefer importing from the package root:

```ts
import {
  InferenceEngine,
  PolicyEngine,
  RewardEngine,
  InteractionSummarizer,
  PersonalityScorer,
  McpModeResolver,
} from '@dionysys/core';
```

This is the stable consumer-facing API. Internal folder names help contributors navigate the codebase, but they are not intended to be app-level import paths.

## What lives here

- UI schemas in `src/schema/`
- deterministic inference and policy logic in `src/inference/` and `src/policy/`
- reward/baseline metrics in `src/reward/`
- MCP-mode types, schemas, summarization, scoring, and resolver logic in `src/mcp/`
- admin/runtime configuration contracts in `src/admin/`

## Type boundaries

Type contracts are separated from engine implementations so contributors can find public types without digging through class bodies.

Event payloads are typed with `unknown` at the package boundary. That is intentional: app code should narrow payloads deliberately rather than inheriting `any` and accidentally coupling business logic to loose event shapes.

`AdaptiveUIDefinition` now formally includes commonly used UI fields such as `showWelcomeScreen`, `canvasActions`, and `mainMenuItems`, while still allowing extension fields where an app needs local UI metadata.

## Development

```bash
npm run build --workspace=packages/core
npm run test --workspace=packages/core
```
