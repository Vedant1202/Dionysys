# Implementation Plan: Feedback Loop Completion

## Overview

The feedback system has a well-designed backend (FeedbackLoopService, LangGraph graph, MongoDB schema, three REST endpoints) and a UI widget (`AdaptiveFeedback`) — but the two halves are not connected and the recommendation output is never acted on. This plan closes those gaps in four phases: wiring the frontend, triggering passive evaluation automatically, feeding recommendations back to the policy layer, and surfacing meaningful signals in the admin console. A fifth phase adds calibration once real data exists.

---

## Architecture Decisions

- **Hook-first API wiring** — add `useFeedback` and `useFeedbackTrigger` hooks rather than hard-coding fetch calls into the component. This keeps `AdaptiveFeedback` dumb and composable, which matches the rest of the package's design (see `useAdaptiveUI`).
- **No new `AdaptiveProvider` props for feedback** — the provider is already complex. Feedback hooks subscribe to the Zustand store directly and run as siblings, not parents.
- **Close the loop via the existing `setManualOverride` store action** — `revert` recommendations translate to `setManualOverride({ variant: defaultVariant })`. This is the existing escape hatch; no new state machine needed.
- **Backend endpoint responses already carry `graphRecommendation`** — the existing `record` response from `POST /api/adaptive-feedback` already contains `graphRecommendation`. No backend change needed to act on revert; only the frontend hook needs to read and forward it.
- **Admin panel first-pass is structure only, no charting library** — avoid adding a chart dependency. Use compact stat rows (same `ComparisonRows` primitive already used in `DataPanel`) so the panel stays zero-dependency.

## Resolved Design Decisions

### Revert flow: user-confirmed
When `graphRecommendation === 'revert'`, the system does **not** auto-revert. Instead it presents a dismissible prompt inside the `AdaptiveFeedback` panel: _"This layout doesn't seem to be working for you. Reset to default?"_ with Confirm / Dismiss buttons. Confirm fires `onRevert()`. This pattern is configurable — a future `autoRevert` prop on the hook can bypass confirmation once the system is trusted enough.

### Passive re-evaluation: threshold-based, capped
Aligned with the sliding window / dynamic event-triggered mechanism pattern from the research literature. `useFeedbackTrigger` re-fires `POST /evaluate` when `hiddenToolClicks` has grown by **≥2** since the last passive evaluation. Hard cap of **3 passive evaluations per session** to prevent noise accumulation. This avoids continuous re-evaluation overhead while still catching sustained friction.

### `keep` recommendation UX: ambient, non-interruptive
Matched to the Netflix / Spotify industry pattern: the selected sentiment button stays in its filled state (visual acknowledgment). Additionally, a small auto-dismissing note (`"Workspace calibrated to your style"`, 4 seconds) appears inline inside the feedback panel — no toast, no modal. After dismissal: complete silence. Users should not be congratulated; they should just notice the UI working.

---

## Dependency Graph

```
MongoDB FeedbackLoopRecord (exists)
    │
    ├── GET /api/adaptive-feedback/overview (exists)
    │       └── Task 5: FeedbackLoopPanel in admin console
    │
    ├── POST /api/adaptive-feedback (exists, gated)
    │       └── Task 1: useFeedback hook
    │               └── Task 2: AdaptiveFeedback wired via hook
    │                       └── Task 4b: revert via setManualOverride on 'revert' recommendation
    │
    └── POST /api/adaptive-feedback/evaluate (exists, never called)
            └── Task 3: useFeedbackTrigger — auto-fires after decision applied

AdaptiveUIStore (Zustand)
    ├── lastDecision / currentVariant / currentPersonality — read by Task 3
    └── setManualOverride — used by Task 4b to apply revert

FeedbackLoopService.activityScore weights (hardcoded)
    └── Task 6: expose as AdminConfig field (post-data, deferred)
```

---

## Phase 1 — Frontend Wiring

### Task 1: `useFeedback` hook

**Description:** Create a hook that wraps the two feedback API calls (`POST /api/adaptive-feedback` for explicit, `POST /api/adaptive-feedback/evaluate` for passive). Returns `{ submitFeedback, triggerPassiveEval, isSubmitting, lastRecord, error }`. Accepts `baseUrl` and `sessionId`. When `lastRecord.graphRecommendation` is returned, the hook calls an optional `onRecommendation(rec, record)` callback so callers can act on it.

**Acceptance criteria:**
- [ ] `submitFeedback({ sentiment, comment })` calls `POST /api/adaptive-feedback` with `sessionId` and returns the record
- [ ] `triggerPassiveEval()` calls `POST /api/adaptive-feedback/evaluate` with `sessionId` and returns the record
- [ ] `onRecommendation` callback fires after any successful call that returns a record
- [ ] Errors are caught and surfaced via the returned `error` field (no unhandled rejections)
- [ ] The hook is exported from `packages/react/src/index.ts`

**Verification:**
- [ ] Unit tests: `useFeedback.test.ts` — mock fetch, assert correct URL, body, and callback firing for both paths
- [ ] TypeScript: `npm run build -w packages/react` succeeds with no errors

**Dependencies:** None

**Files likely touched:**
- `packages/react/src/feedback/useFeedback.ts` (new)
- `packages/react/src/feedback/useFeedback.test.ts` (new)
- `packages/react/src/index.ts`

**Estimated scope:** S

---

### Task 2: Wire `AdaptiveFeedback` to `useFeedback`

**Description:** Add a `sessionId` and `baseUrl` prop pair to `AdaptiveFeedback`. When both are provided, the component uses `useFeedback` internally and eliminates the need for the caller to pass a manual `onSubmit`. The existing `onSubmit` prop is preserved for controlled usage. The component should show a loading state while submitting and surface the error string if the call fails.

**Acceptance criteria:**
- [ ] `<AdaptiveFeedback sessionId="s1" baseUrl="http://localhost:3001" />` submits feedback without any `onSubmit` prop
- [ ] Existing `onSubmit` prop still works when `sessionId`/`baseUrl` are absent
- [ ] Button shows disabled state while `isSubmitting` is true
- [ ] Error from the API is shown instead of "Feedback could not be sent." generic text

**Verification:**
- [ ] `npm run build -w packages/react` succeeds
- [ ] Manual smoke test: render the component with a valid `sessionId`, click "This helped", confirm network request and status message

**Dependencies:** Task 1

**Files likely touched:**
- `packages/react/src/feedback/AdaptiveFeedback.tsx`

**Estimated scope:** S

---

### ✅ Checkpoint: Phase 1

- [ ] `useFeedback` unit tests pass: `npm test -w packages/react`
- [ ] Build clean: `npm run build -w packages/react`
- [ ] End-to-end: clicking "This helped" in a running app creates a `FeedbackLoopRecord` in MongoDB with `source: 'explicit'` and `sentiment: 'helpful'`
- [ ] **Human review before Phase 2**

---

## Phase 2 — Passive Evaluation Trigger

### Task 3: `useFeedbackTrigger` hook

**Description:** Create a hook that subscribes to the `AdaptiveUIStore` and manages threshold-based passive evaluation. Fires `triggerPassiveEval()` (from `useFeedback`) on two conditions: (1) when `lastDecision` first becomes non-null (initial passive reading), and (2) when `hiddenToolClicks` has increased by ≥2 since the last passive evaluation (friction accumulation). Hard cap: max **3 passive evaluations per session** total. Tracks counts via `useRef` to guard against noise and re-renders.

**Acceptance criteria:**
- [ ] `POST /api/adaptive-feedback/evaluate` fires once immediately when `lastDecision` first becomes non-null
- [ ] Re-fires when `hiddenToolClicks` grows by ≥2 since the previous passive evaluation's click count snapshot
- [ ] Never fires more than 3 times per session regardless of friction accumulation
- [ ] Does not fire before a decision is applied
- [ ] Exports a `passiveEvalCount` value so callers can observe how many times it has fired
- [ ] Exported from `packages/react/src/index.ts`

**Verification:**
- [ ] Unit tests: mock the store, assert initial fire, assert re-fire at +2 hidden clicks, assert cap at 3
- [ ] Manual check: apply a decision, click 2 hidden tools, confirm a second `FeedbackLoopRecord` with `source: 'passive'` appears in MongoDB

**Dependencies:** Task 1

**Files likely touched:**
- `packages/react/src/feedback/useFeedbackTrigger.ts` (new)
- `packages/react/src/feedback/useFeedbackTrigger.test.ts` (new)
- `packages/react/src/index.ts`

**Estimated scope:** S

---

### ✅ Checkpoint: Phase 2

- [ ] All tests pass: `npm test --workspaces`
- [ ] A full session flow (open app → decision applied → passive record created → explicit feedback submitted → both records in DB) works end-to-end
- [ ] **Human review before Phase 3**

---

## Phase 3 — Close the Loop

### Task 4: Act on recommendations in the frontend

**Description:** Wire all three recommendation paths. (a) **`revert` — user-confirmed:** when `graphRecommendation === 'revert'` (from explicit or passive), `AdaptiveFeedback` shows an inline confirmation prompt: _"This layout doesn't seem to be working for you. Reset to default?"_ with Confirm / Dismiss. Confirm calls the optional `onRevert` prop (callers pass `() => store.setManualOverride({ variant: defaultVariant })`); Dismiss does nothing. A future `autoRevert` boolean prop on the hook can bypass the prompt. (b) **`keep` — ambient acknowledgment:** when the recommendation is `'keep'`, the selected sentiment button stays filled (already handled by existing button state) and a small 4-second auto-dismissing inline note appears: _"Workspace calibrated to your style."_ No toast, no modal. (c) **`observe` — silent:** no UI response.

**Acceptance criteria:**
- [ ] On `revert` from explicit feedback: confirmation prompt appears inside the `AdaptiveFeedback` panel; Confirm calls `onRevert`, Dismiss does nothing
- [ ] On `revert` from passive trigger: same prompt appears; hook surfaces `pendingRevert: true` state that the parent can use to show the panel if it was not already visible
- [ ] `onRevert` calls `setManualOverride({ variant: defaultVariant })` and `currentVariant` reverts
- [ ] On `keep`: selected button state is maintained + 4s auto-dismiss note appears, then disappears automatically
- [ ] On `observe`: no UI change beyond the existing button selected state
- [ ] `autoRevert?: boolean` prop exists on `useFeedback` and when `true` skips the confirmation prompt

**Verification:**
- [ ] Unit tests: mock `onRevert`, assert called/not-called for all three recommendation types; assert `pendingRevert` state for passive revert path
- [ ] Manual check: "Got in my way" → prompt appears → Confirm → toolbar reverts to default variant in UI
- [ ] Manual check: "This helped" → button stays filled + "Workspace calibrated" note appears and disappears after 4s

**Dependencies:** Task 2, Task 3

**Files likely touched:**
- `packages/react/src/feedback/useFeedback.ts`
- `packages/react/src/feedback/AdaptiveFeedback.tsx`

**Estimated scope:** M

---

### ✅ Checkpoint: Phase 3

- [ ] All tests pass: `npm test --workspaces`
- [ ] Build clean: `npm run build --workspaces`
- [ ] Full closed-loop flow verified manually: decision applied → "Got in my way" → UI reverts → MongoDB record shows `sentiment: 'in_the_way'`, `graphRecommendation: 'revert'`
- [ ] **Human review before Phase 4**

---

## Phase 4 — Admin Console Visibility

### Task 5: Structured `FeedbackLoopPanel` in admin console

**Description:** Replace the raw `<JsonBlock value={feedbackLoop} />` in `DataPanel` with a dedicated `FeedbackLoopPanel` component. Use the existing `ComparisonRows` and `SectionCard` primitives (no new dependencies). Show: latest recommendation badge (colour-coded `keep` / `revert` / `observe`), sentiment breakdown (helpful vs in_the_way counts), average activity score, total records, and the last 3 records as a compact list with timestamp, source, and recommendation.

**Acceptance criteria:**
- [ ] The "Beta Feedback Loop" card shows structured rows instead of raw JSON
- [ ] `graphRecommendation` values are rendered with distinct visual treatment (`keep` = green, `revert` = red, `observe` = grey)
- [ ] Sentiment counts are displayed as `Helpful: N / In the way: N`
- [ ] Average activity score is displayed
- [ ] Latest 3 records are listed with timestamp, source, and recommendation
- [ ] Falls back to an empty state message when `feedbackLoop.records` is empty

**Verification:**
- [ ] `npm run build -w packages/react` succeeds
- [ ] Manual check: open admin console with `ADAPTIVE_FEEDBACK_BETA_ENABLED=true`, verify structured panel renders correctly

**Dependencies:** None (UI-only, consumes existing `overview` API)

**Files likely touched:**
- `packages/react/src/admin-console/sections/FeedbackLoopPanel.tsx` (new)
- `packages/react/src/admin-console/sections/DataPanel.tsx`

**Estimated scope:** M

---

### ✅ Checkpoint: Phase 4 — Final

- [ ] All tests pass: `npm test --workspaces`
- [ ] Full build clean: `npm run build --workspaces`
- [ ] Admin console renders feedback loop panel with real data
- [ ] Complete flow documented: decision → passive eval → explicit feedback → revert → admin view
- [ ] **Human sign-off: system is production-ready for beta**

---

## Phase 5 — Calibration (Post-Data, Deferred)

### Task 6: Expose activity score weights as configurable

**Description:** Once enough feedback records exist to observe whether the current weights (`creations×3, texts×3, mods×1, deletions×−2, hiddenClicks×−3`) are producing sensible activity scores, surface them as admin-configurable fields. Add a `feedbackWeights` field to the admin config schema (in `packages/core`), pass them to `FeedbackLoopService.calculateMetrics`, and display them in the admin console as editable fields.

**Acceptance criteria:**
- [ ] `feedbackWeights` in admin config is validated by Zod schema with sane defaults matching current hardcoded values
- [ ] `FeedbackLoopService` accepts weights as a parameter (not a global)
- [ ] Admin console lets you edit weights and see the change reflected in the next evaluation
- [ ] Export/import of config includes `feedbackWeights`

**Verification:**
- [ ] Unit tests: `FeedbackLoopService.evaluateEvents` with custom weights produces expected `activityScore`
- [ ] Admin console edit round-trip: change a weight, trigger evaluation, confirm new score in overview

**Dependencies:** Task 5, real feedback data

**Files likely touched:**
- `packages/core/src/admin/types.ts`
- `backend/src/services/FeedbackLoopService.ts`
- `packages/react/src/admin-console/sections/FeedbackLoopPanel.tsx`

**Estimated scope:** M

> **Deferred**: Do not implement Task 6 until at least 50 feedback records exist in production. The current weights are reasonable defaults; tuning them without data will produce overfitting.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Beta flag (`ADAPTIVE_FEEDBACK_BETA_ENABLED`) not set in consumer app | High — all hooks silently no-op | Document clearly in hook JSDoc; hooks should log a warning in dev mode if the API returns 404 |
| `setManualOverride` to revert changes `currentVariant` but not the server-side policy record | Med — logs show variant that was reverted, not the re-applied baseline | Emit a `revert_applied` event from the hook so the event log captures it |
| Passive evaluation fires before enough post-decision events accumulate (empty window) | Low — `FeedbackLoopService` returns `null` and the route returns 409, which the hook should handle gracefully | Hook treats 409 as a no-op, not an error |
| LangGraph single-node graph adds async overhead without benefit | Low — it works, just slower than a plain function call | Acceptable for MVP; annotated in `FeedbackLoopGraphService.ts` as scaffolding |
| Activity score weights are wrong for the actual use case | Med — could produce misleading recommendations | Phase 5 calibration; `observe` is the safe default for ambiguous cases |

---

## Open Questions

- Should the `revert` action be user-confirmed (show a prompt) or automatic? Currently planned as automatic on explicit "Got in my way", but a confirmation step would give the user agency.
- Should the passive evaluation re-fire if the user continues working and hits more hidden tool friction after the first passive record? Currently: no, only fires once per decision.
- Is there a desired UX for `keep` recommendations? Currently a no-op. Could reinforce with a subtle "Your workspace is calibrated to your style" message.
