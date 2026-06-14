# Implementation Plan: Direction 2 — Confidence-Gated, Self-Evolving MCP Decision Engine

## Overview

This plan implements the approved spec in `docs/direction-2-decision-engine-spec.md`. It replaces the hard `=== lockedModality` override in `McpModeResolver` with a confidence/ambiguity **gate**, adds an evidence-weighted **blend** of the LLM and a Thompson-sampling bandit on weak signal, and closes the **learning loop** from feedback. It is internal to the decision engine: no HTTP/route changes, no MCP-protocol server.

Work proceeds incrementally. Every phase leaves all builds and tests green, keeps the REST surface byte-for-byte unchanged, and keeps the current demo working. New configuration is additive (optional with defaults), and new resolver parameters are optional so packages stay green between phases.

## Locked decisions (from the spec)

- The LLM connector is called on **every** MCP decision; the gate/blend govern its weight, not whether it runs.
- Weak-signal resolution **blends**: `score(m) = (1 - wBandit)·llm(m) + wBandit·thompson(m)`, `wBandit = n / (n + banditEvidenceK)`.
- `stateId = "<lockedModality>:<selectedExpertise>"`; arms are the **applied modality**; expertise stays the deterministic overlay.
- Reward = explicit keep/revert (full weight) **plus** a low-weight passive session reward.
- Browser-prior warm-start deferred to v2.
- All randomness goes through an **injectable RNG** (default `Math.random`).
- Defaults: `lockMinEvents = 2`, `lockMargin = 0.15`, `banditEvidenceK = 3`, `passiveRewardWeight = 0.25`.

## Design clarifications (refining the spec)

These add precision the spec left implicit; flagged for one-line back-port into the spec if approved:

1. **`stateId` uses the deterministic guess**, not the applied modality: `stateId = "<lockedModality>:<selectedExpertise>"`, arm = applied modality. This keeps context and arm independent (no circularity).
2. **Resolver back-compat:** new resolver inputs (`gate`, `bandit`, `banditArms`, `rng`) are optional. When absent, the weak branch degrades to a pure free LLM choice (no bandit). This keeps `@dionysys/server` compiling and the demo working between Phase 2 and Phase 3.
3. **Feedback is server-authoritative:** the bandit arm to credit is resolved from the stored `DionysysDecision` (`storage.getDecisionsBySession`) → `metadata.blend.stateId` + applied modality. No `dionysys.decision_applied` payload change and no route change.

## Dependency graph

```text
P1 Core foundation  (config types/schemas, signalStrength, ThompsonBandit)
  |
  +-- P2 Core resolver (gate + blend in McpModeResolver)
        |
        +-- P3 Server decision wiring (defaultConfig, DecisionService reads arms + metadata)
              |
              +-- P4 Server learning loop (FeedbackService reward -> incrementBanditParams)
              |
              +-- P5 React admin knobs (gate/bandit controls)   [parallel with P4 after P3]
                    |
                    +-- P6 Demo verification + docs
```

## Phase 1: Core Foundation

### Task 1: Add gate and bandit config types and schemas

**Description:** Extend `AdminMcpConfig` with optional `gate` and `bandit` sub-configs and matching Zod schemas, defaulted so existing configs stay valid.

**Acceptance criteria:**
- [ ] `AdminMcpGateConfig` (`lockMinEvents`, `lockMargin`) and `AdminMcpBanditConfig` (`enabled`, `banditEvidenceK`, `priorAlpha`, `priorBeta`, `keepReward`, `revertReward`, `passiveRewardWeight`) exported from `@dionysys/core`.
- [ ] Zod schemas apply documented defaults when fields are absent and reject out-of-range values (e.g. negative `lockMinEvents`, `lockMargin` outside 0..1).
- [ ] Existing MCP config (with no `gate`/`bandit`) parses unchanged.

**Verification:**
- [ ] `npm run build --workspace=packages/core`
- [ ] `npm run test --workspace=packages/core -- admin`

**Dependencies:** None
**Files:** `packages/core/src/admin/types.ts`, `packages/core/src/admin/schemas.ts`, `packages/core/src/index.ts`, `packages/core/src/admin/*.test.ts`
**Scope:** Small

### Task 2: Add the signal-strength module

**Description:** Pure functions to measure deterministic signal strength from modality scores/events.

**Acceptance criteria:**
- [ ] `signalStrength.ts` exposes total modality events, normalized top1−top2 margin, and `isStrongSignal(scores, events, gateConfig)`.
- [ ] `STRONG` iff `totalModalityEvents >= lockMinEvents && margin >= lockMargin`; otherwise `WEAK`.
- [ ] Boundary cases covered: at/below `lockMinEvents`, at/below `lockMargin`, exact ties, zero-event sessions.

**Verification:**
- [ ] `npm run test --workspace=packages/core -- signalStrength`

**Dependencies:** Task 1
**Files:** `packages/core/src/mcp/signalStrength.ts`, `packages/core/src/mcp/signalStrength.test.ts`
**Scope:** Small

### Task 3: Add the Thompson bandit + blend module

**Description:** Pure, RNG-injectable bandit math used by the resolver.

**Acceptance criteria:**
- [ ] `ThompsonBandit.ts` exposes `sampleBeta(alpha, beta, rng)`, `evidenceWeight(n, k)`, `blendScores({ candidates, llmChoice, llmConfidence, arms, banditEvidenceK, rng })`, and `rewardToIncrements(reward, weight)`.
- [ ] `evidenceWeight(n, k)` is `0` at `n=0`, `0.5` at `n=k`, and monotonically increasing.
- [ ] `blendScores` returns the LLM choice when all arms are cold (`n=0`) and the high-reward arm once warm (asserted with a seeded RNG).
- [ ] `rewardToIncrements(r, w)` returns `{ alphaInc: w*r, betaInc: w*(1-r) }`.
- [ ] No direct `Math.random()` calls; RNG is a parameter.

**Verification:**
- [ ] `npm run test --workspace=packages/core -- bandit`

**Dependencies:** Task 1
**Files:** `packages/core/src/bandit/ThompsonBandit.ts`, `packages/core/src/bandit/index.ts`, `packages/core/src/bandit/ThompsonBandit.test.ts`, `packages/core/src/index.ts`
**Scope:** Medium

### Checkpoint: Core Foundation — ✅ complete (commits d726dc9, eb9ae7d, c7acea0)
- [x] `npm run build --workspace=packages/core` (tsc clean)
- [x] `npm run test --workspace=packages/core` (49 passed, +28 new across T1–T3)
- [x] New public exports resolve; server/react/storage/connector builds stay green.

## Phase 2: Core Resolver (Gate + Blend)

### Task 4: Replace the hard override with the gate + blend in `McpModeResolver`

**Description:** Implement the three-layer decision model in the resolver. Add optional `gate`, `bandit`, `banditArms`, and `rng` inputs (back-compat per clarification 2).

**Acceptance criteria:**
- [ ] **Strong** signal → deterministic pick; LLM honored only when it agrees with `lockedModality` and meets `minConfidence`.
- [ ] **Weak** signal → `blendScores` over modality candidates; final variant = `chosenModality : selectedExpertise`.
- [ ] Cold arms (or no `banditArms` provided) → blend equals the LLM's free choice.
- [ ] Warm arms (seeded RNG) → bandit-favored modality wins.
- [ ] Invalid/disallowed persona, missing action, low-confidence cold pick, or connector throw → configured safe fallback.
- [ ] Result carries `resolvedBy` (`deterministic | blended | fallback`), `signalStrength`, and blend details (llm modality/confidence, chosen modality, bandit weight).
- [ ] The `=== lockedModality` hard override is gone.

**Verification:**
- [ ] `npm run test --workspace=packages/core -- mcp`
- [ ] `npm run build --workspace=packages/core`

**Dependencies:** Tasks 2, 3
**Files:** `packages/core/src/mcp/McpModeResolver.ts`, `packages/core/src/mcp/types.ts`, `packages/core/src/mcp/mcp.test.ts`
**Scope:** Medium

### Checkpoint: Core Resolver — ✅ complete (commit 2f36db9)
- [x] `npm run build --workspace=packages/core` (tsc clean) and `npm run test --workspace=packages/core` (53 passed)
- [x] `npm run build --workspace=packages/server` + full server suite green (54 passed) — no regression through the new optional-param resolver
- [x] Without bandit wiring, weak-signal decisions already let the LLM decide freely (interim milestone = the core "let the AI decide" behavior). react typecheck + storage/connector builds green.

## Phase 3: Server Decision Wiring

### Task 5: Add gate/bandit defaults to server config

**Description:** Populate `defaultConfig` with gate/bandit defaults so the server and demo run without explicit config.

**Acceptance criteria:**
- [ ] `mcp.gate` and `mcp.bandit` defaults present and schema-valid.
- [ ] Existing server config and tests unaffected.

**Verification:**
- [ ] `npm run build --workspace=packages/server`
- [ ] `npm run test --workspace=packages/server`

**Dependencies:** Task 1
**Files:** `packages/server/src/config/defaultConfig.ts`, related config tests
**Scope:** Small

### Task 6: Wire `DecisionService.resolveMcp` to the bandit and metadata

**Description:** Read bandit arms for the context, pass them plus config and an injectable RNG to the resolver, and persist the decision with blend metadata.

**Acceptance criteria:**
- [ ] Computes `stateId = "<lockedModality>:<selectedExpertise>"` and reads `storage.getBanditParams(stateId, m)` for each candidate modality.
- [ ] Passes `gate`, `bandit`, `banditArms`, and `rng` (default `Math.random`, overridable via service options) to the resolver.
- [ ] Persists `DionysysDecision` with `metadata.signalStrength`, `metadata.resolvedBy`, and `metadata.blend = { stateId, llmModality, llmConfidence, chosenModality, banditWeight }`.
- [ ] Cold arms → decision matches the LLM choice; warm arms (seeded) → bandit-favored; `getBanditParams` read asserted.
- [ ] Deterministic mode and the REST response shape are unchanged.

**Verification:**
- [ ] `npm run test --workspace=packages/server -- decisions`
- [ ] `npm run build --workspace=packages/server`

**Dependencies:** Tasks 4, 5
**Files:** `packages/server/src/services/DecisionService.ts`, `packages/server/src/services/DecisionService.test.ts`
**Scope:** Medium

### Checkpoint: Server Decision Wiring — ✅ complete (commits 84f1f87, 91af02e)
- [x] `npm run build` + `npm run test` for `packages/core` (53) and `packages/server` (61 passed, +4 wiring tests); all connector/storage builds green
- [x] No route/OpenAPI changes; `/api/dionysys/decisions:resolve` now returns blended decisions with `metadata.signalStrength` / `resolvedBy` / `blend` (incl. stateId). Bandit reads keyed by `stateId = lockedModality:selectedExpertise`; skipped when `bandit.enabled` is false.

## Phase 4: Server Learning Loop

### Task 7: Apply explicit-feedback reward to the bandit

**Description:** On explicit feedback, credit the correct arm using the stored decision.

**Acceptance criteria:**
- [ ] `submit`/`evaluate` resolve the session's latest stored `DionysysDecision` and read `metadata.blend.stateId` + applied modality.
- [ ] `keep` (helpful) → `incrementBanditParams(stateId, modality, …)` via `rewardToIncrements(keepReward, 1)`; `revert` (in_the_way) → `rewardToIncrements(revertReward, 1)`.
- [ ] No-op when the decision was not MCP, `bandit.enabled` is false, or no `stateId` is present.
- [ ] Existing feedback record behavior is preserved.

**Verification:**
- [ ] `npm run test --workspace=packages/server -- feedback`
- [ ] `npm run build --workspace=packages/server`

**Dependencies:** Task 6
**Files:** `packages/server/src/services/FeedbackService.ts`, `packages/server/src/services/FeedbackService.test.ts`
**Scope:** Medium

### Task 8: Apply low-weight passive reward on session completion

**Description:** On `complete`, compute a passive session reward and apply a low-weight increment to the session's decision arm.

**Acceptance criteria:**
- [ ] A passive reward in `[0,1]` is computed (reuse/extend `RewardEngine` or the existing creative-events metric).
- [ ] Applied with `passiveRewardWeight` via `rewardToIncrements(reward, passiveRewardWeight)` to `(stateId, appliedModality)`.
- [ ] Does not double-count when explicit feedback already fired; safe when no MCP decision exists.

**Verification:**
- [ ] `npm run test --workspace=packages/server -- feedback`

**Dependencies:** Task 7
**Files:** `packages/server/src/services/FeedbackService.ts`, `packages/server/src/services/FeedbackService.test.ts`
**Scope:** Small

### Checkpoint: Learning Loop — ✅ complete (commit b18b61f)
- [x] `npm run build` + `npm run test` for `packages/core` (53) and `packages/server` (66 passed, +5 learning tests); all connector/storage builds green
- [x] Demonstrated end-to-end (real services): cold context applied the LLM's `draw_first`; after 12× `keep` on `text_first` (arm α=13, β=1) the identical LLM ask resolved to `text_first` (bandit weight 0.80 override). Feedback shifts later decisions toward the rewarded arm.

## Phase 5: React Admin Knobs

### Task 9: Type and state-wire the new admin config fields

**Description:** Extend admin-console types and state to read/edit `mcp.gate` and `mcp.bandit`.

**Acceptance criteria:**
- [ ] New fields typed in the admin-console config types.
- [ ] `useAdminConsoleState` reads, edits, and includes them in the saved/exported payload.

**Verification:**
- [ ] `npm run build --workspace=packages/react`
- [ ] `npm run test --workspace=packages/react`

**Dependencies:** Task 1 (types), Task 6 (served via overview)
**Files:** `packages/react/src/admin-console/types.ts`, `packages/react/src/admin-console/useAdminConsoleState.ts`
**Scope:** Small

### Task 10: Render gate and bandit controls

**Description:** Add editable controls and surface state in the console.

**Acceptance criteria:**
- [ ] Gate thresholds (`lockMinEvents`, `lockMargin`) edit in `ModesPanel` (or `CalculationsPanel`).
- [ ] Bandit knobs (`enabled`, `banditEvidenceK`, priors, rewards, `passiveRewardWeight`) edit in `FeedbackLoopPanel`.
- [ ] `OverviewPanel` surfaces the new knobs; values round-trip through Export.

**Verification:**
- [ ] `npm run test --workspace=packages/react`
- [ ] `npm run build --workspace=packages/react`

**Dependencies:** Task 9
**Files:** `packages/react/src/admin-console/sections/ModesPanel.tsx`, `sections/FeedbackLoopPanel.tsx`, `sections/OverviewPanel.tsx`
**Scope:** Medium

### Checkpoint: Admin Knobs — ✅ complete (commit 5440864)
- [x] `npm run build` + `npm run test` (tsc --noEmit) for `packages/react` green; full monorepo build green (demo frontend + backend included)
- [x] Gate + bandit knobs edit via `updateConfig` and flow through Save/Export (export serializes the whole config); OverviewPanel shows a read-only summary. Live in-app render verified in Phase 6 (admin console needs a running backend, so a frontend-only preview can't exercise it).

## Phase 6: Demo Verification and Docs

### Task 11: Verify the demo end to end

**Description:** Confirm the Excalidraw demo exercises the new path; remove any now-duplicated demo-local bandit selection.

**Acceptance criteria:**
- [ ] Demo backend uses the storage adapter's bandit methods through the SDK services (no demo-local decision/bandit duplication left active).
- [ ] Frontend keep/revert flows reach `FeedbackService` and update arms.
- [ ] Manual: a sparse/ambiguous session yields a model-chosen variant; a strong session is deterministic.

**Verification:**
- [ ] `npm run build:demo:backend` and `npm run build:demo:frontend`
- [ ] Manual MCP-mode run with admin console open.

**Dependencies:** Tasks 6, 7, 8, 10
**Files:** `demos/excalidraw/backend/*`, `demos/excalidraw/frontend/*` (verification; minimal changes)
**Scope:** Small

### Task 12: Update documentation

**Description:** Document the decision model, knobs, and reward loop.

**Acceptance criteria:**
- [ ] `architecture.md` describes gate → blend → learning; `configuration.md` lists the new knobs; `feedback-loop.md` describes reward → bandit.
- [ ] Spec and plan are cross-linked.

**Verification:**
- [ ] `npm run docs:build`

**Dependencies:** Tasks 6–8
**Files:** `docs/architecture.md`, `docs/configuration.md`, `docs/feedback-loop.md`
**Scope:** Small

### Task 13: Final end-to-end verification

**Description:** Full build + test sweep and manual confirmation of success criteria.

**Acceptance criteria:**
- [ ] All spec Success Criteria met; REST surface unchanged; deterministic mode unaffected; randomness injectable.

**Verification:**
- [ ] `npm run build`
- [ ] `npm run test`

**Dependencies:** Tasks 11, 12
**Files:** none expected unless verification finds issues
**Scope:** Small

### Checkpoint: Complete
- [ ] Full `npm run build` and `npm run test` pass.
- [ ] Strong signal → deterministic; weak signal → blended; keep/revert shifts subsequent decisions.
- [ ] New knobs editable and exportable; docs build.

## Parallelization

- After Phase 1: signal-strength (T2) and bandit math (T3) are independent.
- After Phase 3: the React admin work (P5) can proceed in parallel with the server learning loop (P4).
- Docs (T12) can be drafted once route/metadata shapes lock at the end of Phase 3.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Removing the hard lock changes demo feel | High | Phase 2 ships gate-only first; tune `lockMinEvents`/`lockMargin` live via console; watch `resolvedBy` spread. |
| Sparse feedback → arms never warm | Medium | Low-weight passive reward (T8) plus explicit; `banditEvidenceK` keeps cold behavior = pure LLM. |
| Non-deterministic bandit tests | Medium | Injectable RNG everywhere (T3, T6); seed in tests. |
| Resolver signature break between phases | Medium | New resolver inputs optional with safe defaults (clarification 2). |
| Crediting the wrong arm on feedback | Medium | Server-authoritative `stateId` from the stored decision (clarification 3); covered by T7 tests. |

## Review gates

1. Approve this plan before implementation.
2. Review after Phase 2 (resolver behavior — "the AI decides" milestone).
3. Review after Phase 4 (closed learning loop) before admin/demo polish.

## Saved-location note

Per the established repo convention (`docs/sdk-upgrade-plan.md`) and the spec's location, this plan lives at `docs/direction-2-decision-engine-plan.md`. The existing `tasks/plan.md` and `tasks/todo.md` (unrelated prior work) are intentionally left untouched. The task checklist is embedded above rather than overwriting those files.
