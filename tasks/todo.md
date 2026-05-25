# Feedback Loop — Task List

## Phase 1: Frontend Wiring
- [ ] **Task 1** — `useFeedback` hook (`packages/react/src/feedback/useFeedback.ts`)
- [ ] **Task 2** — Wire `AdaptiveFeedback` component to `useFeedback` via `sessionId`/`baseUrl` props

### ✅ Checkpoint 1
- [ ] `useFeedback` unit tests pass
- [ ] Build clean
- [ ] End-to-end: clicking a sentiment button creates a MongoDB record
- [ ] Human review

## Phase 2: Passive Evaluation Trigger
- [ ] **Task 3** — `useFeedbackTrigger` hook — auto-fires `POST /evaluate` when a decision is first applied

### ✅ Checkpoint 2
- [ ] All tests pass
- [ ] Full session flow verified (decision → passive record → explicit record both in DB)
- [ ] Human review

## Phase 3: Close the Loop
- [ ] **Task 4** — Act on `revert` recommendation: `onRevert` callback + `setManualOverride` integration + in-UI confirmation

### ✅ Checkpoint 3
- [ ] Closed-loop manual test passes (decision → "Got in my way" → UI reverts → DB shows revert record)
- [ ] All tests pass
- [ ] Human review

## Phase 4: Admin Console Visibility
- [ ] **Task 5** — `FeedbackLoopPanel` component replacing raw JSON in DataPanel

### ✅ Checkpoint 4 (Final)
- [ ] Full build clean
- [ ] Admin console shows structured feedback data
- [ ] Human sign-off for beta

## Phase 5: Calibration (Deferred — needs real data first)
- [ ] **Task 6** — Expose activity score weights as admin-configurable fields
