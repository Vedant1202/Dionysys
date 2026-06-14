# Spec: Direction 2 — Confidence-Gated, Self-Evolving MCP Decision Engine

## Status

Open questions resolved per review (see Locked Decisions). Implementation has not started; ready for a task breakdown (`/plan`).

## Objective

Make the Dionysys MCP-mode decision engine **genuinely let the AI decide** where deterministic rules are weak, while keeping deterministic rules in charge where they are strong, and letting the system **improve with usage** through the already-defined contextual bandit.

Today, MCP mode locks the modality persona deterministically, calls the LLM connector, and then discards the LLM's answer unless it exactly matches the deterministic lock (`selected.resource.id === lockedModality` in `packages/core/src/mcp/McpModeResolver.ts`). The model is effectively an advisor that can only rubber-stamp the rules. This work replaces that hard override with a **confidence/ambiguity gate** and wires in the **Thompson-sampling bandit** that already exists in the storage contract but is currently connected to nothing.

This is an **internal decision-engine change only**. It does not change the HTTP/REST surface, does not add an MCP server, and does not touch the client SDK transport. (Exposing Dionysys to external AI hosts via the Model Context Protocol is a separate effort — "Direction 1" — and is explicitly out of scope here.)

### Target users

- **Integrating developers** who configure Dionysys and want adaptive decisions that are both safe (deterministic where confident) and intelligent (model-driven where ambiguous) without writing their own routing logic.
- **Product/operations owners** who tune behavior at runtime through the existing admin console and the export/import config workflow.
- **End users** of an integrating app (e.g. the Excalidraw reference app), who should see better-fitting UI adaptations that improve as they keep using the product.

## Assumptions

1. MCP mode **always** calls the LLM connector on every decision (locked decision below). The gate governs whether the LLM's answer is *honored*, not whether the model is *called*.
2. Deterministic rules are trustworthy when the interaction signal is strong (enough events and a clear winner) and unreliable when the signal is sparse or ambiguous — which is exactly where an LLM, and later a bandit, add value.
3. The contextual bandit is **Thompson sampling** over a Beta distribution per `(stateId, variant)`, matching the existing `DionysysBanditParams { stateId, variant, alpha, beta, lastUpdated }` and the `getBanditParams` / `upsertBanditParams` / `incrementBanditParams` / `getAllBanditParams` storage methods.
4. The existing validate-and-fallback guardrails stay in force: an applied decision must reference an allowed persona, an action that exists for that persona, a confidence at or above `minConfidence` (for model-chosen decisions), and a valid `uiState`; anything else falls back to a configured safe action.
5. Deterministic-only mode (`mode: 'deterministic'`) is unaffected. The existing epsilon-greedy `PolicyEngine` on the deterministic path is left as-is.
6. New configuration is additive and backward compatible: every new field is optional with a documented default, so existing configs and the current demo keep working.

## Scope

In scope (approved as "Gate + bandit + admin UI"):

1. **Confidence/ambiguity gate** in `McpModeResolver` replacing the hard `=== lockedModality` override.
2. **Bandit integration** into the MCP decision path: read bandit params to drive explore/exploit in weak-signal contexts, and update them from feedback/session reward.
3. **Admin console knobs** for the new gate thresholds and bandit controls, surfaced in the overview and carried through export/import like `epsilon` and `minConfidence` today.

Out of scope:

- Any MCP-protocol server, JSON-RPC, resources/tools exposure (Direction 1).
- Changes to HTTP routes, OpenAPI surface, client SDK transport, or React provider public props.
- New LLM provider connectors or changes to connector contracts.
- Replacing MongoDB or changing the storage contract shape (the bandit methods already exist).

## Decision Model

The engine resolves an MCP decision through three layers. The LLM is always consulted; the gate and bandit decide whether and how its answer is used.

```text
1. Deterministic scoring (unchanged)
   - score modality + expertise from the interaction summary
   - compute lockedModality (top modality) and a signal-strength measure

2. Gate: is the deterministic signal STRONG?
   STRONG iff totalModalityEvents >= lockMinEvents AND (top1 - top2) >= lockMargin
   - STRONG  -> deterministic rules decide. Honor the LLM only if it agrees
               with lockedModality and meets minConfidence; otherwise apply the
               deterministic pick. (Rules win where they are confident.)
   - WEAK    -> go to step 3. (Rules are unreliable; defer.)

3. Weak-signal resolution: BLEND the LLM and the bandit (no hard switch)
   For each candidate modality m (draw_first / text_first / neutral):
       llm(m)     = llmConfidence if m is the LLM's choice, else 0
       bandit(m)  = sampleBeta(alpha, beta, rng) for arm (stateId, m)   // Thompson draw
       n(m)       = reward observations recorded for (stateId, m)
       wBandit(m) = n(m) / (n(m) + banditEvidenceK)                     // 0..1, grows with evidence
       score(m)   = (1 - wBandit(m)) * llm(m) + wBandit(m) * bandit(m)
   apply argmax score(m).
   - Cold arm (n = 0): wBandit = 0  -> pure LLM choice (cold-start).
   - Warm arm:         wBandit -> 1 -> bandit dominates, LLM still nudges.
   Expertise remains the deterministic overlay; the applied variant is
   <chosen-modality> : <deterministic-expertise>.

4. Validate the chosen decision (allowed persona, action exists, valid uiState;
   the minConfidence floor still applies when the winner is an LLM-dominated cold
   pick). Invalid -> configured safe fallback.

5. Learning (asynchronous, via feedback/session end)
   - reward in [0,1] -> alpha/beta increments for arm (stateId, applied-modality)
   - higher reward raises that arm's Beta mean and wBandit, biasing later blends
     in the same context toward it.
```

`stateId` is the **context key** for the contextual bandit: the deterministic state guess `"<selectedModality>:<selectedExpertise>"`. `variant` is the **applied modality** (`draw_first` / `text_first` / `neutral`) — expertise stays a deterministic overlay, which holds the action space to three arms per context. This keeps arms scoped per context, which is what makes it a *contextual* bandit rather than a single global one.

### Why this shape

- It follows the routing pattern (cheap deterministic path for confident cases, model for ambiguous ones) rather than calling the model where rules already suffice.
- It preserves safety: the model never mutates UI without validation and a fallback.
- It assigns "improve with usage" to the component actually designed for it (the bandit) while keeping the LLM's per-session judgment permanently in the mix; the bandit's weight grows with evidence rather than switching on abruptly.

## Data Contracts

No storage-contract changes. New configuration types extend `AdminMcpConfig`.

```ts
// packages/core/src/admin/types.ts (extends existing AdminMcpConfig)
export interface AdminMcpGateConfig {
  // Minimum modality events before the deterministic signal counts as "strong".
  lockMinEvents: number;        // default: 2
  // Minimum gap between the top and runner-up modality scores to count as "confident".
  lockMargin: number;           // default: 0.15
}

export interface AdminMcpBanditConfig {
  enabled: boolean;             // default: true
  // Observation count at which the bandit and the LLM carry equal weight in the
  // blend (wBandit = n / (n + banditEvidenceK)). Replaces the pre-blend "minObservations".
  banditEvidenceK: number;      // default: 3
  // Beta priors for a fresh arm (1/1 = uniform).
  priorAlpha: number;           // default: 1
  priorBeta: number;            // default: 1
  // Explicit-feedback reward applied to the chosen arm on "keep" vs "revert".
  keepReward: number;           // default: 1
  revertReward: number;         // default: 0
  // Weight of the passive session-level reward relative to explicit feedback.
  passiveRewardWeight: number;  // default: 0.25
}

export interface AdminMcpConfig {
  axes: { /* existing modality/expertise resources */ };
  minConfidence: number;        // existing
  fallbackVariant: string;      // existing
  gate?: AdminMcpGateConfig;    // new, optional with defaults
  bandit?: AdminMcpBanditConfig;// new, optional with defaults
}
```

The decision object (`DionysysDecision`) shape is unchanged, but its `metadata` gains observable fields so behavior is debuggable and visible in the admin console:

- `metadata.signalStrength`: `"strong" | "weak"`
- `metadata.resolvedBy`: `"deterministic" | "blended" | "fallback"`
- `metadata.blend` (on weak signal): `{ stateId, llmModality, llmConfidence, chosenModality, banditWeight }`, where `banditWeight` is `wBandit` for the chosen arm

## Commands

From the repository root unless noted.

```bash
npm install

# Core (gate, signal strength, bandit math, config schemas)
npm run build --workspace=packages/core
npm run test  --workspace=packages/core
npm run test  --workspace=packages/core -- src/mcp
npm run test  --workspace=packages/core -- src/bandit

# Server (decision precedence + feedback->reward wiring)
npm run build --workspace=packages/server
npm run test  --workspace=packages/server -- decisions
npm run test  --workspace=packages/server -- feedback

# React admin console (new knobs)
npm run build --workspace=packages/react
npm run test  --workspace=packages/react

# Reference app end-to-end
npm run build:demo:backend
npm run build:demo:frontend

# Full sweep before completion
npm run build
npm run test
```

## Project Structure

New and changed files, grouped by package.

```text
packages/core
  src/mcp/McpModeResolver.ts        (change) replace hard override with gate;
                                     weak-signal branch allows free LLM choice;
                                     accept an injected bandit selector + RNG
  src/mcp/signalStrength.ts         (new)    totalModalityEvents, top1-top2 margin,
                                     isStrongSignal(scores, gateConfig)
  src/mcp/types.ts                  (change) gate/bandit config types on resolver input
  src/mcp/schemas.ts                (change) zod schema for gate/bandit config
  src/bandit/ThompsonBandit.ts      (new)    sampleBeta(alpha,beta,rng), evidenceWeight(n,k),
                                     blendScores(...), rewardToIncrements(reward)
  src/bandit/index.ts               (new)    public exports
  src/admin/types.ts                (change) AdminMcpGateConfig, AdminMcpBanditConfig
  src/admin/schemas.ts              (change) validation for the above
  src/index.ts                      (change) export new bandit + gate types
  src/mcp/mcp.test.ts               (change) gate branch coverage
  src/mcp/signalStrength.test.ts    (new)
  src/bandit/ThompsonBandit.test.ts (new)

packages/server
  src/services/DecisionService.ts   (change) apply gate; on weak signal blend
                                     LLM + bandit (read params by stateId); record
                                     chosen arm + weights in decision metadata
  src/services/FeedbackService.ts   (change) map reward in [0,1] -> incrementBanditParams
  src/config/defaultConfig.ts       (change) defaults for gate + bandit
  src/services/DecisionService.test.ts  (change) precedence + bandit-read tests
  src/services/FeedbackService.test.ts  (change) reward -> alpha/beta tests

packages/react
  src/admin-console/sections/ModesPanel.tsx        (change) gate threshold fields
  src/admin-console/sections/FeedbackLoopPanel.tsx (change) bandit controls + status
  src/admin-console/sections/OverviewPanel.tsx     (change) surface new knobs/state
  src/admin-console/useAdminConsoleState.ts        (change) read/edit new fields
  src/admin-console/types.ts                       (change) typed config fields

demos/excalidraw
  backend  (verify) storage adapter already implements bandit methods; ensure the
           DecisionService/FeedbackService wiring is exercised; remove any
           now-duplicated demo-local bandit selection if present
  frontend (verify) existing keep/revert feedback flows into reward; no UI rework

docs
  direction-2-decision-engine-spec.md  (this file)
```

## Code Style

Follow the conventions already established in `docs/sdk-upgrade-spec.md` and the existing packages:

- TypeScript throughout; object option bags for constructors and public methods; required fields required, optional behavior optional with documented defaults.
- Use `unknown` / structured records at boundaries, never `any`.
- Validate all external/config input with zod; reuse `@dionysys/core` schemas.
- `PascalCase` types/classes/components, `camelCase` values/methods, `UPPER_SNAKE_CASE` only for internal constants. American English. Same word for the same concept across packages (`connector` for model integrations, `adapter` for app/UI/storage integrations).
- No `$` in identifiers or user-facing text (existing project rule).
- **Determinism for testability:** all randomness (Thompson sampling) must go through an **injectable RNG** (default `Math.random`), so tests seed it and assert exact selections. Do not call `Math.random()` directly inside the resolver. (Note: the existing `PolicyEngine` calls `Math.random()` inline; the new bandit module must not repeat that pattern.)
- Keep new public exports stable and documented; no deep `src` imports across packages.

## Testing Strategy

Vitest, tests beside the code. Required coverage:

- **Signal strength** (`signalStrength.test.ts`): below/at/above `lockMinEvents`; margin below/at/above `lockMargin`; ties; zero-event sessions. Boundary values are explicit cases.
- **Gate branches** (`mcp.test.ts`):
  - Strong signal + LLM agrees with lock + confident → LLM honored.
  - Strong signal + LLM disagrees → deterministic pick wins (LLM ignored).
  - Weak signal + cold arm (n=0) → blended argmax equals the LLM's choice (pure LLM).
  - Weak signal + warm arm (seeded rng) → bandit-favored arm wins the blend.
  - Weak signal + LLM returns an invalid/disallowed persona, cold arms, low confidence → safe fallback.
  - Invalid connector output / thrown connector → safe fallback (existing behavior preserved).
- **Thompson bandit** (`ThompsonBandit.test.ts`): `sampleBeta` with a seeded RNG is deterministic; `evidenceWeight(n,k)` is 0 at n=0, 0.5 at n=k, and monotonically increasing; `blendScores` returns the LLM pick when all arms are cold and the high-reward arm once warm; `rewardToIncrements` maps `keep`/`revert` and graded rewards; fresh arms use configured priors.
- **DecisionService** (`DecisionService.test.ts`): weak-signal context reads `getBanditParams` by `stateId`; cold arms → blend resolves to the LLM choice; warm arms (seeded) → blend resolves to the bandit-favored arm; `metadata.resolvedBy` and `metadata.blend` populated; deterministic mode untouched.
- **FeedbackService** (`FeedbackService.test.ts`): explicit `keep` → `incrementBanditParams` with `keepReward`; `revert` → `revertReward`; passive/observe handled; correct `(stateId, variant)` targeted.
- **Admin config** (core schema tests): defaults applied when fields absent; invalid threshold values rejected; export/import round-trips the new fields unchanged.
- **Admin console** (react tests): new fields render, edit state, and are included in the exported payload.
- **Build tests:** every touched package builds; full `npm run build` and `npm run test` pass.

Manual verification before completion:

- Run the demo in MCP mode; confirm a strong-signal session is decided deterministically and a sparse/ambiguous session yields a model-chosen variant.
- Confirm the admin console shows and exports the new gate/bandit knobs.
- Confirm keep/revert feedback shifts subsequent weak-signal decisions in the same context toward the rewarded variant.

## Boundaries

**Always**

- Keep the validate-and-fallback safety net: every applied decision is validated; invalid output falls back to a configured safe action.
- Keep deterministic rules in charge on strong signal.
- Keep the LLM call on every MCP decision (per locked decision); the gate and blend govern how much weight its answer carries, not whether it runs.
- Keep all provider API keys server-side.
- Keep the HTTP/REST surface, OpenAPI, client transport, and React provider props unchanged.
- Make new config additive with defaults; preserve existing configs and current demo behavior.
- Route all randomness through an injectable RNG.
- Run package builds and relevant tests before marking work complete.

**Ask first**

- Changing default thresholds (`lockMinEvents`, `lockMargin`, `minObservations`) in a way that alters the current demo's observable behavior.
- Changing the blend formula or the evidence-weight curve `wBandit = n / (n + banditEvidenceK)`.
- Changing the `stateId` composition or the reward mapping semantics.
- Adding any new runtime dependency to a public package.
- Changing the storage contract or persisting bandit decay automatically.

**Never**

- Add an MCP-protocol server, JSON-RPC, or resource/tool exposure (that is Direction 1).
- Change or add HTTP routes as part of this work.
- Let unvalidated LLM output mutate UI.
- Remove the safe fallback or the `minConfidence` floor.
- Put provider API keys in browser/client code.
- Use `$` in identifiers or copy.
- Remove or skip failing tests to make the suite pass.
- Expose Mongoose models or deep internal paths as public API.

## Success Criteria

1. The hard `=== lockedModality` override in `McpModeResolver` is replaced by a configurable confidence/ambiguity gate.
2. On strong signal, deterministic rules decide; the LLM is honored only when it agrees and is confident.
3. On weak signal, each candidate modality is scored by `(1 - wBandit)·llm + wBandit·thompson` with `wBandit = n / (n + banditEvidenceK)`, and the argmax is applied.
4. At `n = 0` the blend equals the pure LLM choice; as evidence accrues the bandit dominates while the LLM still nudges. The chosen arm and weights are recorded in `metadata.blend`.
5. Feedback/session reward updates `(stateId, applied-modality)` params via `incrementBanditParams`, and subsequent weak-signal blends in that context demonstrably shift toward the rewarded arm.
6. New gate and bandit knobs are editable in the admin console, visible in the overview, and round-trip through export/import.
7. `DionysysDecision.metadata` exposes `signalStrength` and `resolvedBy` for observability.
8. Deterministic mode and all existing tests are unaffected; the REST surface is byte-for-byte unchanged.
9. All randomness is injectable; bandit tests are deterministic.
10. `npm run build` and `npm run test` pass across core, server, react, and the demo workspaces.

## Locked Decisions

1. The LLM connector is called on **every** MCP decision; the gate decides whether to honor its answer (per the user's choice).
2. Scope is **gate + bandit learning + admin UI**.
3. The spec is saved to `docs/direction-2-decision-engine-spec.md`; the existing root `SPEC.md` (AdaptiveFeedback component) is left untouched.
4. The contextual bandit is Thompson sampling over the existing `DionysysBanditParams` Beta arms; no storage-contract change.
5. This is internal to the decision engine; no MCP-protocol server and no HTTP/route changes.
6. Weak-signal resolution **blends** the LLM and the bandit via evidence-weighted scoring (`wBandit = n / (n + banditEvidenceK)`); no hard handoff. (Q1)
7. `stateId = "<selectedModality>:<selectedExpertise>"`; arms are the applied **modality**; expertise stays the deterministic overlay. (Q2)
8. Reward = explicit keep/revert as the primary signal **plus** a low-weight passive session reward via `RewardEngine`. (Q3)
9. Browser-prior warm-start is deferred to v2; v1 cold-start is handled by the LLM-dominated cold arm. (Q4)
10. Default thresholds: `lockMinEvents = 2`, `lockMargin = 0.15`, `banditEvidenceK = 3`; tuned live via the admin console. (Q5)

## Open Questions

The five review questions are resolved (see Locked Decisions 6–10). Remaining items are tuning/validation, not design forks:

1. **Threshold validation:** confirm `lockMinEvents = 2`, `lockMargin = 0.15`, `banditEvidenceK = 3` against the demo's real modality-score distributions by instrumenting `metadata.resolvedBy` (aim for a healthy spread across `deterministic` / `blended`, not ~100% of either).
2. **Future — raw-feature `stateId`:** if the inferred `"<modality>:<expertise>"` key proves too noisy (it is derived from the same weak signal), switch the context key to bucketed observed features (event-count bucket × draw/text ratio). Not in v1.
3. **Future — browser-prior warm start:** seed cold arms from `DionysysBrowserPrior` once cross-session identity/privacy is addressed (deferred per Locked Decision 9).
