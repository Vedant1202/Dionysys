import * as React from 'react';

export type AdaptiveFeedbackSentiment = 'helpful' | 'in_the_way';

export interface AdaptiveFeedbackSubmission {
  sentiment: AdaptiveFeedbackSentiment;
  comment?: string | undefined;
}

export interface AdaptiveFeedbackProps {
  onSubmit?: (feedback: AdaptiveFeedbackSubmission) => void | Promise<void>;
  title?: string;
}

export function AdaptiveFeedback({
  onSubmit,
  title = 'How is this workspace feeling?',
}: AdaptiveFeedbackProps) {
  const [comment, setComment] = React.useState('');
  const [selected, setSelected] = React.useState<AdaptiveFeedbackSentiment | undefined>();
  const [status, setStatus] = React.useState<string | undefined>();

  const submitFeedback = async (sentiment: AdaptiveFeedbackSentiment) => {
    setSelected(sentiment);
    setStatus(undefined);

    try {
      await onSubmit?.({
        sentiment,
        comment: comment.trim() || undefined,
      });
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

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 280,
    borderRadius: 8,
    border: '1px solid rgba(15, 118, 110, 0.22)',
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
    padding: 14,
    color: '#1f2933',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
};
