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
  /**
   * Called when the user closes the prompt without submitting a rating.
   * If provided, a dismiss (×) button is rendered in the panel header.
   */
  onDismiss?: (() => void) | undefined;
}

/**
 * Controlled mode: caller provides `onSubmit` and handles everything.
 * Use when you want full control or don't have a backend session available.
 */
interface AdaptiveFeedbackControlledProps extends AdaptiveFeedbackBaseProps {
  onSubmit: (feedback: AdaptiveFeedbackSubmission) => void | Promise<void>;
  pendingRevert?: boolean;
  onKeep?: () => void;
  onRevertClick?: () => void;
  showCalibrationNote?: boolean;
  isSubmitting?: boolean;
  error?: string;
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

export function AdaptiveFeedback(props: AdaptiveFeedbackProps) {
  if (props.sessionId != null && props.baseUrl != null) {
    return (
      <AdaptiveFeedbackConnected
        sessionId={props.sessionId}
        baseUrl={props.baseUrl}
        title={props.title}
        onRevert={props.onRevert}
        autoRevert={props.autoRevert}
        onDismiss={props.onDismiss}
      />
    );
  }

  return (
    <AdaptiveFeedbackControlled
      onSubmit={(props as AdaptiveFeedbackControlledProps).onSubmit}
      title={props.title}
      onDismiss={props.onDismiss}
      pendingRevert={(props as AdaptiveFeedbackControlledProps).pendingRevert}
      onKeep={(props as AdaptiveFeedbackControlledProps).onKeep}
      onRevertClick={(props as AdaptiveFeedbackControlledProps).onRevertClick}
      showCalibrationNote={(props as AdaptiveFeedbackControlledProps).showCalibrationNote}
      isSubmitting={(props as AdaptiveFeedbackControlledProps).isSubmitting}
      error={(props as AdaptiveFeedbackControlledProps).error}
    />
  );
}

// ─── Connected implementation ─────────────────────────────────────────────────

function AdaptiveFeedbackConnected({
  sessionId,
  baseUrl,
  title = 'Dionysys simplified the toolbar for Focus.',
  onRevert,
  autoRevert,
  onDismiss,
}: Required<Pick<AdaptiveFeedbackConnectedProps, 'sessionId' | 'baseUrl'>> &
  Pick<AdaptiveFeedbackConnectedProps, 'title' | 'onRevert' | 'autoRevert'> &
  Pick<AdaptiveFeedbackBaseProps, 'onDismiss'>) {
  const [showSurvey, setShowSurvey] = React.useState(false);

  const {
    submitFeedback,
    isSubmitting,
    error,
    pendingRevert,
    showCalibrationNote,
    confirmRevert,
    dismissRevert,
  } = useFeedback({ sessionId, baseUrl, onRevert, autoRevert });

  const handleKeep = async () => {
    dismissRevert();
    await submitFeedback({ sentiment: 'helpful' });
  };

  const handleRevertClick = () => {
    confirmRevert();
    setShowSurvey(true);
  };

  const submitDetailedFeedback = async (reason: string) => {
    await submitFeedback({ sentiment: 'in_the_way', comment: reason });
    setShowSurvey(false);
  };

  if (showSurvey) {
    return (
      <section style={styles.surveyPanel} aria-label="Feedback survey">
        <div style={styles.surveyHeader}>
          <h3 style={styles.surveyTitle}>
            <svg style={styles.icon} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Layout Reverted
          </h3>
          <p style={styles.surveySubtitle}>Help Dionysys learn. What went wrong?</p>
        </div>
        <div style={styles.surveyOptions}>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Needed a hidden tool')} disabled={isSubmitting}>
            I needed a hidden tool
          </button>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Layout was distracting')} disabled={isSubmitting}>
            The layout was distracting
          </button>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Other reason')} disabled={isSubmitting}>
            Other reason
          </button>
        </div>
        {error && <p style={styles.errorStatus}>{error}</p>}
      </section>
    );
  }

  if (pendingRevert) {
    return (
      <section style={styles.toastPanel} aria-label="Workspace revert prompt">
        <div style={styles.toastContent}>
          <span style={styles.toastPulseRing}></span>
          <span style={styles.toastText}>{title}</span>
        </div>
        <div style={styles.toastDivider}></div>
        <div style={styles.toastActions}>
          <button type="button" style={styles.toastKeepBtn} onClick={() => void handleKeep()} disabled={isSubmitting}>Keep</button>
          <button type="button" style={styles.toastRevertBtn} onClick={handleRevertClick} disabled={isSubmitting}>Revert</button>
        </div>
      </section>
    );
  }

  if (showCalibrationNote && !error) {
    return (
      <div style={styles.successToast}>
        <svg style={{...styles.icon, stroke: '#065f46'}} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Thanks! Your feedback helps us improve.
      </div>
    );
  }

  return null;
}

// ─── Controlled implementation (original behaviour) ───────────────────────────

function AdaptiveFeedbackControlled({
  onSubmit,
  title = 'Dionysys simplified the toolbar for Focus.',
  onDismiss,
  pendingRevert,
  onKeep,
  onRevertClick,
  showCalibrationNote,
  isSubmitting,
  error,
}: Pick<AdaptiveFeedbackControlledProps, 'onSubmit' | 'title' | 'pendingRevert' | 'onKeep' | 'onRevertClick' | 'showCalibrationNote' | 'isSubmitting' | 'error'> &
  Pick<AdaptiveFeedbackBaseProps, 'onDismiss'>) {
  const [showSurvey, setShowSurvey] = React.useState(false);

  const handleKeepClick = async () => {
    onKeep?.();
    await onSubmit({ sentiment: 'helpful' });
  };

  const handleRevertAction = () => {
    onRevertClick?.();
    setShowSurvey(true);
  };

  const submitDetailedFeedback = async (reason: string) => {
    await onSubmit({ sentiment: 'in_the_way', comment: reason });
    setShowSurvey(false);
  };

  if (showSurvey) {
    return (
      <section style={styles.surveyPanel} aria-label="Feedback survey">
        <div style={styles.surveyHeader}>
          <h3 style={styles.surveyTitle}>
            <svg style={styles.icon} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Layout Reverted
          </h3>
          <p style={styles.surveySubtitle}>Help Dionysys learn. What went wrong?</p>
        </div>
        <div style={styles.surveyOptions}>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Needed a hidden tool')} disabled={isSubmitting}>
            I needed a hidden tool
          </button>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Layout was distracting')} disabled={isSubmitting}>
            The layout was distracting
          </button>
          <button type="button" style={styles.surveyOptionBtn} onClick={() => void submitDetailedFeedback('Other reason')} disabled={isSubmitting}>
            Other reason
          </button>
        </div>
        {error && <p style={styles.errorStatus}>{error}</p>}
      </section>
    );
  }

  if (pendingRevert) {
    return (
      <section style={styles.toastPanel} aria-label="Workspace revert prompt">
        <div style={styles.toastContent}>
          <span style={styles.toastPulseRing}></span>
          <span style={styles.toastText}>{title}</span>
        </div>
        <div style={styles.toastDivider}></div>
        <div style={styles.toastActions}>
          <button type="button" style={styles.toastKeepBtn} onClick={() => void handleKeepClick()} disabled={isSubmitting}>Keep</button>
          <button type="button" style={styles.toastRevertBtn} onClick={handleRevertAction} disabled={isSubmitting}>Revert</button>
        </div>
      </section>
    );
  }

  if (showCalibrationNote && !error) {
    return (
      <div style={styles.successToast}>
        <svg style={{...styles.icon, stroke: '#065f46'}} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Thanks! Your feedback helps us improve.
      </div>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // ── Controlled Form Fallback (Unchanged for compatibility) ─────────────
  panel: { width: 280, borderRadius: 8, border: '1px solid rgba(15, 118, 110, 0.22)', background: 'rgba(255, 255, 255, 0.94)', boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)', padding: 14, color: '#1f2933', fontFamily: 'Inter, sans-serif' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 10 },
  title: { margin: 0, fontSize: 14, lineHeight: 1.3, flex: 1 },
  dismissButton: { width: 22, height: 22, border: 'none', background: 'transparent', color: '#8c9aad', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  button: { minHeight: 38, border: '1px solid #c8c0b2', borderRadius: 6, background: '#ffffff', color: '#273444', fontWeight: 800, cursor: 'pointer' },
  activeButton: { minHeight: 38, border: '1px solid #0f766e', borderRadius: 6, background: '#0f766e', color: '#ffffff', fontWeight: 900, cursor: 'pointer' },
  commentLabel: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 },
  commentText: { color: '#596579', fontSize: 12, fontWeight: 800 },
  textarea: { width: '100%', boxSizing: 'border-box', border: '1px solid #c8c0b2', borderRadius: 6, padding: 8, color: '#1f2933', resize: 'vertical' },
  status: { margin: '8px 0 0', color: '#0f766e', fontSize: 12, fontWeight: 800 },
  pendingStatus: { margin: '8px 0 0', color: '#596579', fontSize: 12, fontWeight: 700 },
  errorStatus: { margin: '8px 0 0', color: '#be123c', fontSize: 12, fontWeight: 800 },
  calibrationNote: { margin: '8px 0 0', color: '#0f766e', fontSize: 12, fontWeight: 800 },
  
  // ── Connected Flow Styles (Placements A & C) ──────────────────────────
  surveyPanel: {
    width: 320,
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.9)',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 24px 50px -12px rgba(99, 102, 241, 0.15)',
    padding: 20,
    fontFamily: 'Inter, sans-serif',
    position: 'fixed',
    bottom: 32,
    right: 32,
    zIndex: 9999,
  },
  surveyHeader: {
    marginBottom: 16,
  },
  surveyTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    width: 18,
    height: 18,
    fill: 'none',
    stroke: '#6366f1',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  surveySubtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#64748b',
  },
  surveyOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderTop: '1px solid #f1f5f9',
    paddingTop: 12,
  },
  surveyOptionBtn: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 500,
    color: '#334155',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  toastPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 9999,
    border: '1px solid rgba(255, 255, 255, 0.9)',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 4px 6px -2px rgba(99, 102, 241, 0.05)',
    padding: '8px 16px',
    fontFamily: 'Inter, sans-serif',
    position: 'absolute',
    top: '115%',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    whiteSpace: 'nowrap',
  },
  toastContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toastText: {
    fontSize: 12,
    fontWeight: 500,
    color: '#334155',
  },
  toastPulseRing: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#6366f1',
    boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
  },
  toastDivider: {
    width: 1,
    height: 12,
    background: '#cbd5e1',
  },
  toastActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  toastKeepBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  toastRevertBtn: {
    background: 'rgba(255, 241, 242, 0.5)',
    border: '1px solid #fecdd3',
    color: '#e11d48',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
  successToast: {
    position: 'fixed',
    bottom: 32,
    right: 32,
    zIndex: 9999,
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#065f46',
    padding: '8px 16px',
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }
};
