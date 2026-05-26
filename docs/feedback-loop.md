# Feedback Loop (beta)

The feedback loop lets end users tell and show whether a persona-driven UI change is helping, then feeds that signal back into variant selection. It is beta-only and disabled by default.

The loop never changes the active UI mid-session. Feedback shapes the *next* decision — the bandit reweights variant selection on later decisions, and a cross-session prior warm-starts the next session.

## Enabling it

Set both flags:

```bash
ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=backend
VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=frontend
```

When the backend flag is off, the feedback routes are not mounted and beta-only event types are dropped from event ingestion. Nothing in this document runs unless both flags are true.

## Two feedback channels

The loop reads two kinds of signal after a decision has been applied (marked by an `adaptive_decision_applied` event, which starts the metrics window):

- **Passive** — behavioral metrics scored over the post-decision window: productive actions per minute, creations and text additions, lower-weight modifications, negative-weight deletions, and hidden-tool clicks from overflow toolbar selections.
- **Explicit** — a lightweight thumbs prompt ("This helped" / "Got in my way") with an optional note.

Both channels are turned into a single recommendation by a backend LangGraph workflow: `keep`, `revert`, or `observe`.

## When the prompt appears

The framework asks for explicit feedback only at a moment of demonstrated engagement, not the instant the UI changes. The prompt is gated on two conditions, both of which must pass:

- **Time gate** — at least `promptDelayMs` (default 30s) since the decision was applied.
- **Activity gate** — at least `minProductiveActions` (default 3) productive actions since the decision.

Once shown, the prompt can be dismissed with the × button, and it auto-dismisses after `autoDismissMs` (default 15s) if ignored so it never blocks the canvas. Passive evaluation runs on its own schedule (on the first applied decision and again when hidden-tool friction crosses a threshold), independent of whether the user ever sees the prompt.

These gates live in `useFeedbackTrigger`; see [Usage](./usage.md) for the hook options.

## Closing the loop on session end

When a session ends, the frontend calls `POST /api/reward/complete`. That triggers two fire-and-forget updates:

### 1. Thompson-sampling bandit

`BanditService` keeps a Beta distribution per variant. It folds the session's recommendations into the params:

- `keep` → increment the variant's `alpha`
- `revert` → increment the variant's `beta`
- `observe` → no change

At decision time (`AdaptiveDecisionService`, deterministic mode), the bandit samples `Beta(alpha, beta)` for each variant, multiplies the deterministic persona score by `(1 + sample)`, and renormalizes. Variants with no history use a uniform `Beta(1, 1)`. This is the mechanism that turns accumulated feedback into a shift in which variant gets chosen.

### 2. Cross-session browser prior (warm-start)

When the frontend sends a `browserId`, `BrowserPriorService` blends the session's inferred persona distribution into a stored per-browser prior using an exponential moving average (α = 0.3):

```
newPrior = 0.3 × thisSession + 0.7 × existingPrior   (then normalized)
```

On the next visit, the frontend fetches the prior (`GET /api/inference/prior?browserId=…`) and seeds the first inference with it, so a returning user starts closer to their established persona instead of cold.

## Recommendation rules

The LangGraph workflow (`FeedbackLoopGraphService`) maps signals to a recommendation:

- **revert** — explicit "in the way", or strong passive friction (e.g. high hidden-tool friction with low productivity).
- **keep** — explicit "helped", or healthy passive activity.
- **observe** — not enough signal to act on yet.

Recommendations are recorded on every `IFeedbackLoopRecord` along with the metrics window and the applied decision, so they can be studied as well as acted on.

## Monitoring

- **Per session** — `GET /api/adaptive-feedback/overview?sessionId=…` returns the records and metrics for one session.
- **Across sessions** — `GET /api/admin/cohort-overview` aggregates feedback-loop records into a cohort view (admin-gated).

## Where it lives

| Concern | File |
| --- | --- |
| Passive metrics + records | `backend/src/services/FeedbackLoopService.ts` |
| Recommendation workflow | `backend/src/services/FeedbackLoopGraphService.ts` |
| Bandit params + score blend | `backend/src/services/BanditService.ts` |
| Cross-session prior (EMA) | `backend/src/services/BrowserPriorService.ts` |
| Reward + loop trigger on session end | `backend/src/services/RewardService.ts`, `backend/src/routes/reward.ts` |
| Bandit wired into selection | `backend/src/services/AdaptiveDecisionService.ts` |
| Cohort aggregation | `backend/src/services/CohortService.ts` |
| Feedback APIs | `backend/src/routes/adaptiveFeedback.ts` |
| Prompt timing | `packages/react/src/feedback/useFeedbackTrigger.ts` |
| Feedback widget | `packages/react/src/feedback/AdaptiveFeedback.tsx` |
| Warm-start seeding | `frontend/src/App.tsx` |

## Boundaries

- Disabled unless both beta flags are true.
- Feedback applies to the next decision, never a mid-session auto-revert.
- No beta-only telemetry or feedback-loop records are sent when the flag is off.

For the original design notes, see the [Persona Feedback Loop Beta spec](./specs/persona-feedback-loop-beta.md).
