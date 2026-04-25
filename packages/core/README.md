# `@dionysys/core`

Core adaptive-UI logic for Dionysys.

## What lives here

- UI schemas in `src/schema/`
- deterministic inference and policy logic in `src/inference/` and `src/policy/`
- reward/baseline metrics in `src/reward/`
- MCP-mode types, schemas, summarization, scoring, and resolver logic in `src/mcp/`
- admin/runtime configuration contracts in `src/admin/`

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

Type contracts are separated from engine implementations so contributors can find public types without digging through class bodies.

## Development

```bash
npm run build --workspace=packages/core
npm run test --workspace=packages/core
```
