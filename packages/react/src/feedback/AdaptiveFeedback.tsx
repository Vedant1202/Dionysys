import * as React from 'react';
import { useFeedback } from './useFeedback.js';
import type { FeedbackSentiment, UseFeedbackOptions } from './useFeedback.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/** @deprecated Use `FeedbackSentiment` from `useFeedback` instead. */
export type AdaptiveFeedbackSentiment = FeedbackSentiment;

export interface AdaptiveFeedbackSubmission {
  sentiment: FeedbackSentiment;
  comment?: string | undefined;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdaptiveFeedbackBaseProps {
  title?: string | undefined;
}

/**
 * Controlled mode: caller provides `onSubmit` and handles everything.
 * Use when you want full control or don't have a backend session available.
 */
interface AdaptiveFeedbackControlledProps extends AdaptiveFeedbackBaseProps {
  onSubmit: (feedback: AdaptiveFeedbackSubmission) => void | Promise<void>;
  sessionId?: never;
  baseUrl?: never;
  onRevert?: never;
  autoRevert?: never;
}

/**
 * Connected mode: provide `sessionId` + `baseUrl` and the component handles
 * API calls, recommendation handling, revert prompts, and calibration notes.
 */
interface AdaptiveFeedbackConnectedProps extends AdaptiveFeedbackBaseProps {
  onSubmit?: never;
  /** Session ID to associate all feedback with. */
  sessionId: string;
  /** Base URL of the backend, e.g. "http://localhost:3001". */
  baseUrl: string;
  /**
   * Called when the user confirms a revert prompt (or immediately if `autoRevert` is true).
   * Typically: `() => store.setManualOverride({ variant: defaultVariant })`
   */
  onRevert?: UseFeedbackOptions['onRevert'];
  /**
   * When true, a `revert` recommendation skips the user-confirmation prompt and
   * immediately calls `onRevert`. Defaults to false.
   */
  autoRevert?: boolean | undefined;
}

export type AdaptiveFeedbackProps = AdaptiveFeedbackControlledProps | AdaptiveFeedbackConnectedProps;

// ─── Root component (mode dispatch) ──────────────────────────────────────────

/**
 * A feedback widget that captures whether a persona/UI adaptation is helping.
 *
 * **Connected mode** (recommended): pass `sessionId` + `baseUrl`. The component
 * wires itself to the backend, handles the `revert` confirmation prompt, and
 * shows a brief ambient note on `keep`.
 *
 * **Controlled mode**: pass `onSubmit` to handle submissions yourself.
 */
export function AdaptiveFeedback(props: AdaptiveFeedbackProps) {
  if (props.sessionId != null && props.baseUrl != null) {
    return (
      <AdaptiveFeedbackConnected
        sessionId={props.sessionId}
        baseUrl={props.baseUrl}
        title={props.title}
        onRevert={props.onRevert}
        autoRevert={props.autoRevert}
      />
    );
  }

  return (
    <AdaptiveFeedbackControlled
      onSubmit={(props as AdaptiveFeedbackControlledProps).onSubmit}
      title={props.title}
    />
  );
}

// ─── Connected implementation ─────────────────────────────────────────────────

function AdaptiveFeedbackConnected({
  sessionId,
  baseUrl,
  title = 'How is this workspace feeling?',
  onRevert,
  autoRevert,
}: Required<Pick<AdaptiveFeedbackConnectedProps, 'sessionId' | 'baseUrl'>> &
  Pick<AdaptiveFeedbackConnectedProps, 'title' | 'onRevert' | 'autoRevert'>) {
  const [comment, setComment] = React.useState('');
  const [selected, setSelected] = React.useState<FeedbackSentiment | undefined>();

  const {
    submitFeedback,
    isSubmitting,
    error,
    pendingRevert,
    showCalibrationNote,
    confirmRevert,
    dismissRevert,
  } = useFeedback({ sessionId, baseUrl, onRevert, autoRevert });

  const handleSentiment = async (sentiment: FeedbackSentiment) => {
    setSelected(sentiment);
    await submitFeedback({ sentiment, comment: comment.trim() || undefined });
    setComment('');
  };

  if (pendingRevert) {
    return (
      <section style={styles.panel} aria-label="Workspace revert prompt">
        <p style={styles.revertPrompt}>
          This layout doesn&apos;t seem to be working for you. Reset to default?
        </p>
        <div style={styles.revertActions}>
          <button type="button" style={styles.confirmButton} onClick={confirmRevert}>
            Reset layout
          </button>
          <button type="button" style={styles.dismissButton} onClick={dismissRevert}>
            Keep it
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.panel} aria-label="Workspace feedback">
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.actions}>
        <button
          type="button"
          style={selected === 'helpful' ? styles.activeButton : styles.button}
          onClick={() => void handleSentiment('helpful')}
          disabled={isSubmitting}
        >
          This helped
        </button>
        <button
          type="button"
          style={selected === 'in_the_way' ? styles.activeButton : styles.button}
          onClick={() => void handleSentiment('in_the_way')}
          disabled={isSubmitting}
        >
          Got in my way
        </button>
      </div>
      <label style={styles.commentLabel}>
        <span style={styles.commentText}>Optional note</span>
        <textarea
          style={styles.textarea}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
        />
      </label>
      {error && <p style={styles.errorStatus}>{error}</p>}
      {showCalibrationNote && !error && (
        <p style={styles.calibrationNote}>Workspace calibrated to your style.</p>
      )}
      {isSubmitting && !error && !showCalibrationNote && (
        <p style={styles.pendingStatus}>Sending…</p>
      )}
    </section>
  );
}

// ─── Controlled implementation (original behaviour) ───────────────────────────

function AdaptiveFeedbackControlled({
  onSubmit,
  title = 'How is this workspace feeling?',
}: Pick<AdaptiveFeedbackControlledProps, 'onSubmit' | 'title'>) {
  const [comment, setComment] = React.useState('');
  const [selected, setSelected] = React.useState<FeedbackSentiment | undefined>();
  const [status, setStatus] = React.useState<string | undefined>();

  const submitFeedback = async (sentiment: FeedbackSentiment) => {
    setSelected(sentiment);
    setStatus(undefined);

    try {
      await onSubmit?.({ sentiment, comment: comment.trim() || undefined });
      setStatus('Thanks for the feedback.');
      setComment('');
    } catch {
      setStatus('Feedback could not be sent.');
    }
  };

  return (
    <section style={styles.panel} aria-label="Workspace feedback">
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.actions}>
        <button
          type="button"
          style={selected === 'helpful' ? styles.activeButton : styles.button}
          onClick={() => void submitFeedback('helpful')}
        >
          This helped
        </button>
        <button
          type="button"
          style={selected === 'in_the_way' ? styles.activeButton : styles.button}
          onClick={() => void submitFeedback('in_the_way')}
        >
          Got in my way
        </button>
      </div>
      <label style={styles.commentLabel}>
        <span style={styles.commentText}>Optional note</span>
        <textarea
          style={styles.textarea}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
        />
      </label>
      {status && <p style={styles.status}>{status}</p>}
    </section>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 280,
    borderRadius: 8,
    border: '1px solid rgba(15, 118, 110, 0.22)',
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
    padding: 14,
    color: '#1f2933',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  title: {
    margin: '0 0 10px',
    fontSize: 14,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  button: {
    minHeight: 38,
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    background: '#ffffff',
    color: '#273444',
    fontWeight: 800,
    cursor: 'pointer',
  },
  activeButton: {
    minHeight: 38,
    border: '1px solid #0f766e',
    borderRadius: 6,
    background: '#0f766e',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  commentLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    marginTop: 10,
  },
  commentText: {
    color: '#596579',
    fontSize: 12,
    fontWeight: 800,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    padding: 8,
    color: '#1f2933',
    resize: 'vertical',
  },
  status: {
    margin: '8px 0 0',
    color: '#0f766e',
    fontSize: 12,
    fontWeight: 800,
  },
  pendingStatus: {
    margin: '8px 0 0',
    color: '#596579',
    fontSize: 12,
    fontWeight: 700,
  },
  errorStatus: {
    margin: '8px 0 0',
    color: '#be123c',
    fontSize: 12,
    fontWeight: 800,
  },
  calibrationNote: {
    margin: '8px 0 0',
    color: '#0f766e',
    fontSize: 12,
    fontWeight: 800,
  },
  // ── Revert prompt styles ───────────────────────────────────────────────────
  revertPrompt: {
    margin: '0 0 12px',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#1f2933',
  },
  revertActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  confirmButton: {
    minHeight: 38,
    border: '1px solid rgba(190, 18, 60, 0.3)',
    borderRadius: 6,
    background: 'rgba(255, 241, 242, 0.94)',
    color: '#be123c',
    fontWeight: 900,
    cursor: 'pointer',
  },
  dismissButton: {
    minHeight: 38,
    border: '1px solid #c8c0b2',
    borderRadius: 6,
    background: '#ffffff',
    color: '#273444',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
