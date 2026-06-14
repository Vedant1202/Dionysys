# Feedback Loop

The feedback loop lets users tell and show whether a persona-driven UI change is helping, then feeds that signal back into variant selection. It never changes the active UI mid-session — feedback shapes the *next* decision in the same context.

## SDK learning loop (canonical)

The canonical loop lives in `@dionysys/server` and runs in MCP mode (no beta flags required). After a weak-signal blend decision is applied, feedback updates a per-context Thompson-sampling bandit:

- **Explicit** keep/revert → `bandit.keepReward` / `bandit.revertReward` applied to the `(stateId, modality)` arm (`FeedbackService.submit` / `evaluate`).
- **Passive** session reward on `POST /api/dionysys/sessions/:sessionId/complete` → applied at `bandit.passiveRewardWeight`.

At decision time `DecisionService` reads the arms for the current context and blends them with the connector via `wBandit = n / (n + banditEvidenceK)` (`n` derived from the arm's `alpha + beta` minus priors). The context key is `stateId = "<modality>:<expertise>"` (the deterministic guess); the arms are the applied modality. Cold arms reduce the blend to the model's free choice. Tune everything via `mcp.gate` / `mcp.bandit` — see [Configuration](./configuration.md).

## How the demo collects feedback (beta)

The Excalidraw demo adds an optional feedback UI on top of the canonical loop, gated behind beta flags (off by default):

```bash
ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-backend
VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED=true npm run dev --workspace=@dionysys-demo/excalidraw-frontend
```

After a decision is applied (a `dionysys.decision_applied` event starts the metrics window), two signals are collected:

- **Explicit** — a thumbs prompt ("This helped" / "Got in my way"), gated on engagement rather than the instant the UI changes: at least `promptDelayMs` (default 30s) since the decision **and** at least `minProductiveActions` (default 3) productive actions; it auto-dismisses after `autoDismissMs` (default 15s). These gates live in `useFeedbackTrigger`.
- **Passive** — behavioral metrics over the post-decision window (productive actions, creations/text, deletions, hidden-tool friction), evaluated on its own schedule.

Both reach the server through `@dionysys/client` over the standard SDK routes:

| Signal | Route |
| --- | --- |
| Explicit keep/revert | `POST /api/dionysys/feedback` |
| Passive evaluation | `POST /api/dionysys/feedback/evaluate` |
| Per-session records | `GET /api/dionysys/feedback/overview?sessionId=…` |
| Session end (reward) | `POST /api/dionysys/sessions/:sessionId/complete` |

There is one feedback path now — the SDK routes. The demo no longer has its own `/api/reward` or `/api/adaptive-feedback` endpoints.

## Where it lives

| Concern | File |
| --- | --- |
| Bandit math (sampleBeta, blend, reward→increments) | `packages/core/src/bandit/ThompsonBandit.ts` |
| Decision blend (reads arms) | `packages/server/src/services/DecisionService.ts` |
| Feedback → bandit update | `packages/server/src/services/FeedbackService.ts` |
| Feedback routes | `packages/server/src/routes/feedback.ts` |
| Feedback widget | `packages/react/src/feedback/AdaptiveFeedback.tsx` |
| Feedback submission hook | `packages/react/src/feedback/useFeedback.ts` |
| Prompt timing | `packages/react/src/feedback/useFeedbackTrigger.ts` |
| Demo beta wiring | `demos/excalidraw/backend/src/services/FeedbackBetaService.ts` |

## Not yet implemented

The pre-extraction demo had extra cross-session machinery that was **removed** during the SDK split and is not yet reimplemented in `@dionysys/server`:

- **Cohort aggregation** — `GET /api/dionysys/admin/cohort-overview` returns an empty shape; per-variant / cross-session stats are not computed yet, so the admin Data tab shows "no cohort data yet".
- **Cross-session browser-prior warm-start** — `DionysysBrowserPrior` exists in the storage contract but is not wired, so each context cold-starts on the model until the bandit warms.
- **Graph/LLM recommendation workflow** — feedback maps directly to keep/revert/observe; there is no separate recommendation graph.

The bandit learning itself (the canonical section) is fully wired; the items above are known gaps.

## Boundaries

- The demo feedback UI is disabled unless both beta flags are true; the SDK bandit loop runs in MCP mode without any flags.
- Feedback applies to the next decision in the same context — never a mid-session auto-revert.

For the broader productization roadmap, see the [SDK upgrade spec](./sdk-upgrade-spec.md).
