import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdaptiveDecision } from '@dionysys/core';

/**
 * Manages threshold-based passive feedback evaluation and timed prompt visibility for a session.
 *
 * **Passive evals** fire on two conditions:
 * 1. When `lastDecision` first becomes non-null (initial reading immediately after persona switch).
 * 2. When `hiddenToolClickCount` grows by ≥ `frictionThreshold` (default 2) since the last eval.
 *
 * Hard cap: never fires more than `maxEvals` (default 3) times per session.
 *
 * **Prompt visibility** is gated on two industry-standard conditions (both must pass):
 * - Time elapsed since the decision ≥ `promptDelayMs` (default 30 s). Ensures the user has
 *   had a chance to experience the adapted UI before being asked.
 * - `productiveActionCount` ≥ `minProductiveActions` (default 3). Ensures the user has
 *   actually interacted with the workspace — not just been idle.
 *
 * If the user doesn't engage with the prompt within `autoDismissMs` (default 15 s) it
 * silently closes so it never permanently blocks the canvas.
 *
 * Industry basis: threshold-based sliding window from the dynamic event-triggered mechanism
 * literature — re-evaluate when friction crosses a meaningful delta, not on every event;
 * ask for feedback at a "moment of demonstrated engagement", not at entry (Pendo / Appcues).
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
   * Prompt gates restart whenever this reference changes (i.e. a new decision was applied).
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
  /**
   * Productive actions (creates + edits) recorded since the last decision was applied.
   * Tracked by the consumer from the event stream. Defaults to 0.
   */
  productiveActionCount?: number | undefined;
  /**
   * Minimum milliseconds after the decision before the prompt can appear.
   * Ensures the user has had a chance to experience the adapted UI. Defaults to 30 000 (30 s).
   */
  promptDelayMs?: number | undefined;
  /**
   * Minimum productive actions since the decision before the prompt can appear.
   * Ensures the user has actually interacted with the workspace. Defaults to 3.
   */
  minProductiveActions?: number | undefined;
  /**
   * Milliseconds of inactivity after the prompt appears before it silently auto-dismisses.
   * Prevents the widget from permanently blocking the canvas. Defaults to 15 000 (15 s).
   * Pass 0 to disable auto-dismiss.
   */
  autoDismissMs?: number | undefined;
}

export interface UseFeedbackTriggerResult {
  /** How many passive evaluations have been fired in this session. */
  passiveEvalCount: number;
  /**
   * True when both the time gate and the activity gate have passed and the prompt
   * has not yet been dismissed or auto-dismissed for the current decision.
   * Drive the feedback widget's visibility from this value.
   */
  promptVisible: boolean;
  /** Call to hide the prompt without submitting a rating (e.g. user clicks ×). */
  dismissPrompt: () => void;
}

export function useFeedbackTrigger({
  triggerPassiveEval,
  lastDecision,
  hiddenToolClickCount = 0,
  maxEvals = 3,
  frictionThreshold = 2,
  productiveActionCount = 0,
  promptDelayMs = 30_000,
  minProductiveActions = 3,
  autoDismissMs = 15_000,
}: UseFeedbackTriggerOptions): UseFeedbackTriggerResult {
  // Reactive count so callers can observe changes
  const [passiveEvalCount, setPassiveEvalCount] = useState(0);
  // True once promptDelayMs has elapsed since the current decision was applied
  const [timeGatePassed, setTimeGatePassed] = useState(false);
  // The actual visibility flag — true when both gates pass and not yet dismissed
  const [promptVisible, setPromptVisible] = useState(false);

  // Internal refs — avoid closure staleness and prevent double-fires in strict mode
  const evalCountRef = useRef(0);
  const decisionAppliedRef = useRef(false);
  const lastEvalClickCountRef = useRef(0);
  // Tracks whether the prompt was dismissed for the current decision window
  const promptDismissedRef = useRef(false);

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

  // ── Time gate: start/restart the delay timer whenever the decision changes ──
  useEffect(() => {
    if (!lastDecision) return;

    // Reset gate state for the new decision window
    setTimeGatePassed(false);
    setPromptVisible(false);
    promptDismissedRef.current = false;

    const timer = setTimeout(() => setTimeGatePassed(true), promptDelayMs);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDecision, promptDelayMs]); // restart on new decision or delay config change

  // ── Prompt gate: show when BOTH time gate AND activity gate pass ──────────
  useEffect(() => {
    if (!timeGatePassed) return;
    if (productiveActionCount < minProductiveActions) return;
    if (promptDismissedRef.current) return;

    setPromptVisible(true);
  }, [timeGatePassed, productiveActionCount, minProductiveActions]);

  // ── Auto-dismiss: silently close the prompt if the user doesn't engage ────
  useEffect(() => {
    if (!promptVisible) return;
    if (!autoDismissMs) return;

    const timer = setTimeout(() => {
      setPromptVisible(false);
      promptDismissedRef.current = true;
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [promptVisible, autoDismissMs]);

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

  const dismissPrompt = useCallback(() => {
    setPromptVisible(false);
    promptDismissedRef.current = true;
  }, []);

  return { passiveEvalCount, promptVisible, dismissPrompt };
}
