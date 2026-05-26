# Spec: Persona Feedback Loop Beta

## Objective
Add a beta-only feedback loop that lets end users tell and show whether persona-driven UI changes are helping, then feed that signal back into variant selection. The loop combines explicit thumbs feedback, passive post-decision activity metrics, hidden-tool friction, and backend LangGraph recommendations. On session end the recommendations update a Thompson-sampling bandit that reweights future variant selection, and the session's inferred persona is blended into a cross-session browser prior that warm-starts the next session. The loop never mutates the active UI mid-session; it shapes the next decision, not the current one.

## Tech Stack
- TypeScript across backend, packages, and frontend.
- Express and MongoDB/Mongoose for beta API and storage.
- `@langchain/langgraph` plus `@langchain/core` for backend-only graph orchestration.
- Existing React `AdaptiveFeedback`, `AdaptiveProvider`, and Excalidraw event collector for frontend wiring.

## Commands
- Backend tests: `npm run test --workspace=backend`
- Backend build: `npm run build --workspace=backend`
- Frontend tests: `npm run test --workspace=frontend`
- Frontend build: `npm run build --workspace=frontend`
- Full test suite: `npm run test --workspaces --if-present`
- Full build: `npm run build --workspaces --if-present`

## Project Structure
- `backend/src/services/FeedbackLoopService.ts` computes post-decision metrics and records evaluations.
- `backend/src/services/FeedbackLoopGraphService.ts` owns the LangGraph recommendation workflow.
- `backend/src/services/BanditService.ts` keeps a Thompson-sampling Beta distribution per variant. It updates the params from a session's recommendations (`keep` raises alpha, `revert` raises beta, `observe` is a no-op) and blends sampled weights into persona scores at decision time.
- `backend/src/services/BrowserPriorService.ts` EMA-blends each session's inferred persona distribution (α=0.3) into a per-browser prior.
- `backend/src/services/RewardService.ts` and `backend/src/routes/reward.ts` calculate session reward on session end and trigger the bandit and browser-prior updates.
- `backend/src/services/AdaptiveDecisionService.ts` blends bandit weights into deterministic variant selection when the beta flag is on.
- `backend/src/services/CohortService.ts` aggregates feedback-loop records across sessions for the admin overview.
- `backend/src/routes/adaptiveFeedback.ts` exposes beta-only feedback APIs.
- `frontend/src/components/EditorShell.tsx` gates feedback UI, decision-applied events, and passive evaluation calls.
- `frontend/src/App.tsx` seeds the first `pollInference` call from the cross-session browser prior.
- `packages/react/src/feedback/useFeedbackTrigger.ts` decides when to show the prompt: a time gate plus an activity gate, with dismiss and auto-dismiss.
- `frontend/src/plugins/DrawingPlugin.ts` emits creation, modification, text update, and deletion telemetry.

## Code Style
Prefer narrow, explicit contracts and safe disabled-by-default gates:

```ts
if (isAdaptiveFeedbackBetaEnabled()) {
  app.use('/api/adaptive-feedback', adaptiveFeedbackRouter);
}
```

## Testing Strategy
Unit tests cover metric scoring, graph recommendations, bandit updates, and browser-prior blending. Backend build verifies route/service contracts. Frontend build verifies beta prompt and telemetry wiring. Browser-level validation should confirm that the prompt appears only after the time and activity gates pass following an applied non-neutral decision when `VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED=true`.

## Boundaries
- Always: keep the feature disabled unless the backend and frontend beta flags are explicitly true.
- Always: apply feedback to the next decision, not the active one — no mid-session auto-revert.
- Ask first: changing the bandit update rule, the blend formula, or the EMA weight.
- Never: send beta-only telemetry or feedback-loop records when the beta flag is off.

## Success Criteria
- Backend feedback routes are mounted only with `ADAPTIVE_FEEDBACK_BETA_ENABLED=true`.
- Beta-only event types are dropped by event ingestion when the backend flag is off.
- Feedback records link to an `adaptive_decision_applied` event and include post-decision metrics.
- LangGraph returns `keep`, `revert`, or `observe`; `keep` increments the variant's Beta alpha, `revert` increments beta, `observe` is a no-op.
- When the beta flag is on, variant selection blends Thompson-sampled bandit weights into deterministic persona scores.
- A session's inferred persona is EMA-blended (α=0.3) into the browser prior and seeds the returning browser's first inference.
- The feedback prompt appears only after both the time gate (default 30s) and the activity gate (default 3 productive actions) pass, and it can be dismissed or auto-dismisses.
