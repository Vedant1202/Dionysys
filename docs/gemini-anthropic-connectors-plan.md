# Implementation Plan: Gemini and Anthropic Decision Connectors

## Overview

Add two optional provider connector packages, `@dionysys/connector-gemini` and `@dionysys/connector-anthropic`, then wire them into the Excalidraw demo backend provider selection path. The work follows the existing `@dionysys/connector-openai` package pattern: provider SDKs stay isolated, clients are injectable for tests, connector output is validated with `DionysysConnectorDecisionSchema`, and docs explain server-side configuration.

## Architecture Decisions

- Connector packages are independent workspace packages under `packages/*`, mirroring `packages/connector-openai`.
- Gemini uses `@google/genai`, `GEMINI_API_KEY`, and default model `gemini-3.1-flash-lite`.
- Anthropic uses `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, and default model `claude-3-5-haiku-20241022`.
- Anthropic uses forced tool calling to produce structured output; Gemini uses structured JSON response configuration.
- Demo backend provider selection supports `mock`, `custom-http`, `openai`, `gemini`, and `anthropic`.
- Tests use injected mock provider clients only; automated tests must not call live provider APIs.

## Dependency Graph

```txt
Core connector contract and schema
  |
  |-- New connector packages
  |     |-- Gemini connector implementation and tests
  |     |-- Anthropic connector implementation and tests
  |
  |-- Admin connector status type update
        |
        |-- Demo backend provider selection
              |
              |-- Demo backend config tests
              |
              |-- Docs and pack-check updates
```

## Task List

### Phase 1: Package Foundations

## Task 1: Scaffold Gemini Connector Package

**Description:** Create `@dionysys/connector-gemini` with package metadata, TypeScript config, exports, prompt builder, and README skeleton. Keep implementation minimal enough to compile after the connector source is added in the next task.

**Acceptance criteria:**

- [ ] `packages/connector-gemini/package.json` mirrors the OpenAI connector package shape.
- [ ] `@google/genai` is declared only in `packages/connector-gemini`.
- [ ] `src/index.ts` exports the package public API.
- [ ] README includes install and server-side key guidance.

**Verification:**

- [ ] Build target is present: `npm run build --workspace=packages/connector-gemini`

**Dependencies:** None

**Files likely touched:**

- `packages/connector-gemini/package.json`
- `packages/connector-gemini/tsconfig.json`
- `packages/connector-gemini/README.md`
- `packages/connector-gemini/src/index.ts`
- `packages/connector-gemini/src/prompt.ts`

**Estimated scope:** Medium

## Task 2: Scaffold Anthropic Connector Package

**Description:** Create `@dionysys/connector-anthropic` with package metadata, TypeScript config, exports, prompt builder, and README skeleton. Use the stable Haiku snapshot `claude-3-5-haiku-20241022` as the documented default.

**Acceptance criteria:**

- [ ] `packages/connector-anthropic/package.json` mirrors the OpenAI connector package shape.
- [ ] `@anthropic-ai/sdk` is declared only in `packages/connector-anthropic`.
- [ ] `src/index.ts` exports the package public API.
- [ ] README documents `ANTHROPIC_API_KEY` and default model `claude-3-5-haiku-20241022`.

**Verification:**

- [ ] Build target is present: `npm run build --workspace=packages/connector-anthropic`

**Dependencies:** None

**Files likely touched:**

- `packages/connector-anthropic/package.json`
- `packages/connector-anthropic/tsconfig.json`
- `packages/connector-anthropic/README.md`
- `packages/connector-anthropic/src/index.ts`
- `packages/connector-anthropic/src/prompt.ts`

**Estimated scope:** Medium

### Checkpoint: Package Foundations

- [ ] `npm install` completes and updates the workspace lockfile.
- [ ] Both new packages are recognized by npm workspaces.
- [ ] No provider SDK dependency appears in core, server, client, or react packages.

### Phase 2: Connector Implementations

## Task 3: Implement Gemini Connector and Unit Tests

**Description:** Implement `geminiConnector` with injectable client support, env fallback, structured JSON response configuration, response parsing, and schema validation.

**Acceptance criteria:**

- [ ] `geminiConnector` implements `DionysysDecisionConnector`.
- [ ] Default API key source is `GEMINI_API_KEY`.
- [ ] Default model is `gemini-3.1-flash-lite`.
- [ ] Provider response is parsed and validated with `DionysysConnectorDecisionSchema`.
- [ ] Tests cover success, env fallback, missing API key, invalid JSON, missing text, and invalid connector data.

**Verification:**

- [ ] Tests pass: `npm run test --workspace=packages/connector-gemini`
- [ ] Build succeeds: `npm run build --workspace=packages/connector-gemini`

**Dependencies:** Task 1

**Files likely touched:**

- `packages/connector-gemini/src/geminiConnector.ts`
- `packages/connector-gemini/src/geminiConnector.test.ts`
- `packages/connector-gemini/src/index.ts`
- `packages/connector-gemini/src/prompt.ts`

**Estimated scope:** Medium

## Task 4: Implement Anthropic Connector and Unit Tests

**Description:** Implement `anthropicConnector` with injectable client support, env fallback, forced decision tool use, tool input extraction, and schema validation.

**Acceptance criteria:**

- [ ] `anthropicConnector` implements `DionysysDecisionConnector`.
- [ ] Default API key source is `ANTHROPIC_API_KEY`.
- [ ] Default model is `claude-3-5-haiku-20241022`.
- [ ] Request uses a decision tool with an input schema for `personaId`, `actionId`, `confidence`, and optional `rationale`.
- [ ] Tests cover success, env fallback, missing API key, missing tool output, and invalid connector data.

**Verification:**

- [ ] Tests pass: `npm run test --workspace=packages/connector-anthropic`
- [ ] Build succeeds: `npm run build --workspace=packages/connector-anthropic`

**Dependencies:** Task 2

**Files likely touched:**

- `packages/connector-anthropic/src/anthropicConnector.ts`
- `packages/connector-anthropic/src/anthropicConnector.test.ts`
- `packages/connector-anthropic/src/index.ts`
- `packages/connector-anthropic/src/prompt.ts`

**Estimated scope:** Medium

### Checkpoint: Connector Implementations

- [ ] `npm run test --workspace=packages/connector-gemini` passes.
- [ ] `npm run test --workspace=packages/connector-anthropic` passes.
- [ ] `npm run build --workspace=packages/connector-gemini` passes.
- [ ] `npm run build --workspace=packages/connector-anthropic` passes.

### Phase 3: Runtime Wiring

## Task 5: Extend Admin Connector Status Types

**Description:** Update provider-neutral admin connector status unions to include `gemini` and `anthropic` so backend and admin overview typing accepts the new providers.

**Acceptance criteria:**

- [ ] Core `AdminConnectorStatus.type` includes `gemini` and `anthropic`.
- [ ] Server `AdminConfigServiceOptions.connectorStatus.type` includes `gemini` and `anthropic`.
- [ ] No admin UI behavior changes are required beyond accepting and displaying the new type strings.

**Verification:**

- [ ] Core tests pass: `npm run test --workspace=packages/core`
- [ ] Server tests pass: `npm run test --workspace=packages/server`

**Dependencies:** None

**Files likely touched:**

- `packages/core/src/admin/types.ts`
- `packages/server/src/services/AdminConfigService.ts`

**Estimated scope:** Small

## Task 6: Wire Gemini and Anthropic into Demo Backend Config

**Description:** Extend Excalidraw demo backend runtime config to import the new connectors, support new provider strings, parse provider-specific env vars, expose injectable test clients, and report connector status.

**Acceptance criteria:**

- [ ] `DionysysLlmProvider` includes `gemini` and `anthropic`.
- [ ] `getLlmProvider` accepts `gemini` and `anthropic`.
- [ ] `buildConnector` creates the correct connector with env-backed options.
- [ ] `buildConnectorStatus` reports `type`, `apiKeyConfigured`, `endpointConfigured`, and `model` for both providers.
- [ ] `RuntimeBuildOptions` exposes `geminiClient` and `anthropicClient` test hooks.

**Verification:**

- [ ] Backend config tests pass: `npm run test --workspace=@dionysys-demo/excalidraw-backend -- src/config/dionysys.test.ts`

**Dependencies:** Tasks 3, 4, 5

**Files likely touched:**

- `demos/excalidraw/backend/src/config/dionysys.ts`
- `demos/excalidraw/backend/src/config/dionysys.test.ts`
- `demos/excalidraw/backend/package.json`

**Estimated scope:** Medium

### Checkpoint: Runtime Wiring

- [ ] `npm run test --workspace=packages/core` passes.
- [ ] `npm run test --workspace=packages/server` passes.
- [ ] `npm run test --workspace=@dionysys-demo/excalidraw-backend` passes.

### Phase 4: Packaging and Documentation

## Task 7: Add Pack Check Coverage for New Packages

**Description:** Include the Gemini and Anthropic connector packages in the SDK package dry-run list so packaging leaks are caught.

**Acceptance criteria:**

- [ ] `scripts/pack-check.mjs` checks `connector-gemini`.
- [ ] `scripts/pack-check.mjs` checks `connector-anthropic`.
- [ ] Dry-run package output excludes source files, tests, and env files.

**Verification:**

- [ ] Pack check passes: `npm run pack:check`

**Dependencies:** Tasks 1, 2

**Files likely touched:**

- `scripts/pack-check.mjs`

**Estimated scope:** XS

## Task 8: Update Public Configuration and Usage Docs

**Description:** Document install commands, env vars, provider selection, default models, and server-side credential boundaries for Gemini and Anthropic.

**Acceptance criteria:**

- [ ] Configuration docs list `gemini` and `anthropic` as supported `DIONYSYS_LLM_PROVIDER` values.
- [ ] Docs include `GEMINI_API_KEY`, `DIONYSYS_GEMINI_MODEL`, `ANTHROPIC_API_KEY`, and `DIONYSYS_ANTHROPIC_MODEL`.
- [ ] Usage docs show basic imports and connector setup.
- [ ] README references both new connector packages.

**Verification:**

- [ ] Documentation links and commands are internally consistent by inspection.
- [ ] Full build still succeeds: `npm run build`

**Dependencies:** Tasks 3, 4, 6

**Files likely touched:**

- `docs/configuration.md`
- `docs/usage.md`
- `docs/architecture.md`
- `README.md`
- `packages/connector-gemini/README.md`
- `packages/connector-anthropic/README.md`

**Estimated scope:** Medium

### Checkpoint: Complete

- [ ] `npm run test --workspace=packages/connector-gemini` passes.
- [ ] `npm run test --workspace=packages/connector-anthropic` passes.
- [ ] `npm run test --workspace=@dionysys-demo/excalidraw-backend` passes.
- [ ] `npm run build` passes.
- [ ] `npm run pack:check` passes.
- [ ] Spec and plan reflect final implementation decisions.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini SDK structured-output shape differs from test assumptions | Medium | Keep client interface narrow and injectable; verify against installed SDK types during implementation. |
| Anthropic tool-use response typing is more complex than the local mock type | Medium | Parse only the needed content block shape and validate with Dionysys schema. |
| Default Gemini model string is unavailable in the installed SDK or provider account | Medium | Keep `DIONYSYS_GEMINI_MODEL` override and isolate the default in one constant. |
| New connector packages introduce dependency or lockfile churn | Low | Dependencies stay in connector package manifests only and are verified with package checks. |
| Admin connector type unions drift between core and server | Low | Update both types in one task and run core/server tests at the checkpoint. |

## Parallelization Opportunities

- Tasks 1 and 2 can be done in parallel.
- Tasks 3 and 4 can be done in parallel after their package scaffolds exist.
- Task 5 can be done independently before runtime wiring.
- Task 8 should wait until connector APIs and env names are final, but connector README drafts can be started during Tasks 1 and 2.

## Open Questions

None. The previous spec questions are resolved in `docs/gemini-anthropic-connectors-spec.md`.
