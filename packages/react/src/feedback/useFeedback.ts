import { useCallback, useRef, useState } from 'react';

// ─── Shared types ────────────────────────────────────────────────────────────

export type FeedbackSentiment = 'helpful' | 'in_the_way';
export type FeedbackGraphRecommendation = 'keep' | 'revert' | 'observe';

export interface FeedbackSubmission {
  sentiment: FeedbackSentiment;
  comment?: string | undefined;
}

export interface FeedbackLoopRecord {
  sessionId: string;
  timestamp: string;
  source: 'passive' | 'explicit';
  graphRecommendation: FeedbackGraphRecommendation;
  graphRationale: string;
  sentiment?: FeedbackSentiment | undefined;
  comment?: string | undefined;
  metrics: {
    activityScore: number;
    hiddenToolClicks: number;
    hiddenToolFrictionRate: number;
    productiveActionsPerMinute: number;
    creationCount: number;
    textAdditionCount: number;
    modificationCount: number;
    deletionCount: number;
    windowDurationMs: number;
    totalToolSelections: number;
  };
  appliedDecision: {
    variant: string;
    personalityId?: string | undefined;
    mode?: string | undefined;
    confidence?: number | undefined;
    [key: string]: unknown;
  };
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseFeedbackOptions {
  /** Session ID to associate all feedback with. */
  sessionId: string;
  /** Base URL of the backend, e.g. "http://localhost:3001". */
  baseUrl: string;
  /**
   * Called when the feedback loop produces a `revert` recommendation.
   * In connected mode, this is fired after the user confirms the prompt
   * (unless `autoRevert` is true, in which case it fires immediately).
   * Typically: `() => store.setManualOverride({ variant: defaultVariant })`
   */
  onRevert?: (() => void) | undefined;
  /**
   * When true, a `revert` recommendation immediately calls `onRevert` without
   * showing the user-confirmation prompt. Defaults to false.
   */
  autoRevert?: boolean | undefined;
  /**
   * Optional observer that fires after any feedback API call produces a record.
   * Receives the raw recommendation and the full record.
   */
  onRecommendation?: ((recommendation: FeedbackGraphRecommendation, record: FeedbackLoopRecord) => void) | undefined;
}

export interface UseFeedbackResult {
  /** Submit explicit user feedback (sentiment + optional comment). */
  submitFeedback: (submission: FeedbackSubmission) => Promise<void>;
  /**
   * Trigger a passive (no user input) evaluation of the current session.
   * Treats 409 (no decision applied yet) as a silent no-op.
   * Treats 404 / non-ok as a dev-mode warning (beta flag not set).
   */
  triggerPassiveEval: () => Promise<void>;
  /** True while an API call is in flight. */
  isSubmitting: boolean;
  /** The most recent feedback record returned by the backend. */
  lastRecord: FeedbackLoopRecord | undefined;
  /** Non-null when the most recent explicit submission failed. */
  error: string | undefined;
  /**
   * True when the graph recommends `revert` and `autoRevert` is false.
   * The component should render a confirmation prompt while this is true.
   */
  pendingRevert: boolean;
  /**
   * True for 4 seconds after a `keep` recommendation.
   * The component should show a brief ambient calibration note.
   */
  showCalibrationNote: boolean;
  /** Call when the user confirms the revert prompt. Fires `onRevert` and clears `pendingRevert`. */
  confirmRevert: () => void;
  /** Call when the user dismisses the revert prompt without reverting. */
  dismissRevert: () => void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

const CALIBRATION_NOTE_DURATION_MS = 4_000;

/** Safe dev-mode check that works in both Node and browser environments. */
function isDev(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any)?.process?.env?.NODE_ENV === 'development';
  } catch {
    return false;
  }
}

export function useFeedback({
  sessionId,
  baseUrl,
  onRevert,
  autoRevert = false,
  onRecommendation,
}: UseFeedbackOptions): UseFeedbackResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRecord, setLastRecord] = useState<FeedbackLoopRecord | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pendingRevert, setPendingRevert] = useState(false);
  const [showCalibrationNote, setShowCalibrationNote] = useState(false);
  const calibrationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleRecord = useCallback(
    (record: FeedbackLoopRecord) => {
      setLastRecord(record);
      onRecommendation?.(record.graphRecommendation, record);

      if (record.graphRecommendation === 'revert') {
        if (autoRevert) {
          onRevert?.();
        } else {
          setPendingRevert(true);
        }
      } else if (record.graphRecommendation === 'keep') {
        setShowCalibrationNote(true);
        clearTimeout(calibrationTimerRef.current);
        calibrationTimerRef.current = setTimeout(() => {
          setShowCalibrationNote(false);
        }, CALIBRATION_NOTE_DURATION_MS);
      }
    },
    [autoRevert, onRevert, onRecommendation],
  );

  const submitFeedback = useCallback(
    async (submission: FeedbackSubmission) => {
      setIsSubmitting(true);
      setError(undefined);

      try {
        const response = await fetch(`${baseUrl}/api/adaptive-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, ...submission }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? `Request failed with status ${response.status}`);
        }

        const data = await response.json() as { success: boolean; record: FeedbackLoopRecord };
        handleRecord(data.record);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Feedback could not be sent.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionId, baseUrl, handleRecord],
  );

  const triggerPassiveEval = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/api/adaptive-feedback/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      // 409 = no adaptive decision applied yet; treat as a silent no-op
      if (response.status === 409) return;

      if (!response.ok) {
        if (isDev()) {
          console.warn(
            '[useFeedback] Passive eval failed (status %d). ' +
            'Is ADAPTIVE_FEEDBACK_BETA_ENABLED=true set on the backend?',
            response.status,
          );
        }
        return;
      }

      const data = await response.json() as { success: boolean; record: FeedbackLoopRecord };
      handleRecord(data.record);
    } catch {
      // Passive evals are best-effort — don't surface network errors to the user
      if (isDev()) {
        console.warn('[useFeedback] Passive eval network request failed.');
      }
    }
  }, [sessionId, baseUrl, handleRecord]);

  const confirmRevert = useCallback(() => {
    setPendingRevert(false);
    onRevert?.();
  }, [onRevert]);

  const dismissRevert = useCallback(() => {
    setPendingRevert(false);
  }, []);

  return {
    submitFeedback,
    triggerPassiveEval,
    isSubmitting,
    lastRecord,
    error,
    pendingRevert,
    showCalibrationNote,
    confirmRevert,
    dismissRevert,
  };
}
