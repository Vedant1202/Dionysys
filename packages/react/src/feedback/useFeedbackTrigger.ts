import { useEffect, useRef, useState } from 'react';
import type { AdaptiveDecision } from '@dionysys/core';

/**
 * Manages threshold-based passive feedback evaluation for a session.
 *
 * Fires `triggerPassiveEval` on two conditions:
 * 1. When `lastDecision` first becomes non-null (initial reading immediately after persona switch).
 * 2. When `hiddenToolClickCount` grows by ≥ `frictionThreshold` (default 2) since the last eval.
 *
 * Hard cap: never fires more than `maxEvals` (default 3) times per session.
 *
 * Industry basis: threshold-based sliding window from the dynamic event-triggered mechanism
 * literature — re-evaluate when friction crosses a meaningful delta, not on every event.
 */
export interface UseFeedbackTriggerOptions {
  /**
   * The `triggerPassiveEval` function from `useFeedback`.
   * This hook decides WHEN to trigger; `useFeedback` decides HOW.
   */
  triggerPassiveEval: () => Promise<void>;
  /**
   * The `lastDecision` from `useAdaptiveUI()`.
   * Initial passive eval fires when this transitions from undefined to non-null.
   */
  lastDecision: AdaptiveDecision | undefined;
  /**
   * Number of hidden tool clicks since the session start, tracked by the consumer.
   * A hidden tool click is any `tool_selected` event where `wasHiddenByPersona === true`.
   * Defaults to 0.
   */
  hiddenToolClickCount?: number | undefined;
  /**
   * Maximum number of passive evaluations per session. Defaults to 3.
   */
  maxEvals?: number | undefined;
  /**
   * Number of new hidden tool clicks (delta since last eval) required to re-trigger.
   * Defaults to 2.
   */
  frictionThreshold?: number | undefined;
}

export interface UseFeedbackTriggerResult {
  /** How many passive evaluations have been fired in this session. */
  passiveEvalCount: number;
}

export function useFeedbackTrigger({
  triggerPassiveEval,
  lastDecision,
  hiddenToolClickCount = 0,
  maxEvals = 3,
  frictionThreshold = 2,
}: UseFeedbackTriggerOptions): UseFeedbackTriggerResult {
  // Reactive count so callers can observe changes
  const [passiveEvalCount, setPassiveEvalCount] = useState(0);

  // Internal refs — avoid closure staleness and prevent double-fires in strict mode
  const evalCountRef = useRef(0);
  const decisionAppliedRef = useRef(false);
  const lastEvalClickCountRef = useRef(0);

  // ── Condition 1: initial eval on first applied decision ──────────────────
  useEffect(() => {
    if (!lastDecision) return;
    if (decisionAppliedRef.current) return;
    if (evalCountRef.current >= maxEvals) return;

    decisionAppliedRef.current = true;
    lastEvalClickCountRef.current = hiddenToolClickCount;
    evalCountRef.current += 1;
    setPassiveEvalCount(evalCountRef.current);
    void triggerPassiveEval();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDecision]); // intentionally omit others — fires exactly once on decision

  // ── Condition 2: re-eval on friction accumulation ─────────────────────────
  useEffect(() => {
    if (!decisionAppliedRef.current) return;
    if (evalCountRef.current >= maxEvals) return;

    const delta = hiddenToolClickCount - lastEvalClickCountRef.current;
    if (delta < frictionThreshold) return;

    lastEvalClickCountRef.current = hiddenToolClickCount;
    evalCountRef.current += 1;
    setPassiveEvalCount(evalCountRef.current);
    void triggerPassiveEval();
  }, [hiddenToolClickCount, frictionThreshold, maxEvals, triggerPassiveEval]);

  return { passiveEvalCount };
}
