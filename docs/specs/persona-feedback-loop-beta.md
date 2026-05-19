# Spec: Persona Feedback Loop Beta

## Objective
Add a beta-only feedback loop that lets end users tell and show whether persona-driven UI changes are helping. The MVP combines explicit thumbs feedback, passive post-decision activity metrics, hidden-tool friction, and backend LangGraph recommendations. Recommendations are recorded for study only; the MVP does not automatically mutate the active UI.

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
- `backend/src/routes/adaptiveFeedback.ts` exposes beta-only feedback APIs.
- `frontend/src/components/EditorShell.tsx` gates feedback UI, decision-applied events, and passive evaluation calls.
- `frontend/src/plugins/DrawingPlugin.ts` emits creation, modification, text update, and deletion telemetry.

## Code Style
Prefer narrow, explicit contracts and safe disabled-by-default gates:

```ts
if (isAdaptiveFeedbackBetaEnabled()) {
  app.use('/api/adaptive-feedback', adaptiveFeedbackRouter);
}
```

## Testing Strategy
Unit tests cover metric scoring and graph recommendations. Backend build verifies route/service contracts. Frontend build verifies beta prompt and telemetry wiring. Browser-level validation should confirm that the prompt appears only after an applied non-neutral decision when `VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED=true`.

## Boundaries
- Always: keep the feature disabled unless the backend and frontend beta flags are explicitly true.
- Always: record graph recommendations only; do not auto-revert or auto-soften UI in the MVP.
- Ask first: changing the adaptive decision algorithm based on feedback.
- Never: send beta-only telemetry or feedback-loop records when the beta flag is off.

## Success Criteria
- Backend feedback routes are mounted only with `ADAPTIVE_FEEDBACK_BETA_ENABLED=true`.
- Beta-only event types are dropped by event ingestion when the backend flag is off.
- Feedback records link to an `adaptive_decision_applied` event and include post-decision metrics.
- LangGraph returns `keep`, `revert`, or `observe` recommendations without mutating UI.
- Frontend feedback appears only after an applied persona/UI change and is remembered per session decision.
