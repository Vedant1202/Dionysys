import * as React from 'react';
import { ComparisonRows, EmptyState, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';

// ─── Local types (mirrors backend FeedbackLoopOverview) ───────────────────────

interface FeedbackRecord {
  timestamp: string | Date;
  source: 'passive' | 'explicit';
  graphRecommendation: 'keep' | 'revert' | 'observe';
  sentiment?: 'helpful' | 'in_the_way' | undefined;
  metrics: { activityScore: number };
}

interface FeedbackLoopSummary {
  totalRecords: number;
  averageActivityScore: number;
  recommendations: Record<string, number>;
  sentiments: Record<string, number>;
}

interface FeedbackLoopOverview {
  sessionId: string;
  records: FeedbackRecord[];
  summary: FeedbackLoopSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFeedbackLoopOverview(value: unknown): value is FeedbackLoopOverview {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['sessionId'] === 'string' &&
    Array.isArray(obj['records']) &&
    typeof obj['summary'] === 'object'
  );
}

function formatTimestamp(ts: string | Date): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

// ─── Recommendation badge ─────────────────────────────────────────────────────

const RECOMMENDATION_BADGE: Record<
  'keep' | 'revert' | 'observe',
  { label: string; style: React.CSSProperties }
> = {
  keep: {
    label: 'Keep',
    style: {
      borderRadius: 999,
      background: 'rgba(209, 250, 229, 0.94)',
      color: '#065f46',
      padding: '3px 10px',
      fontSize: 12,
      fontWeight: 900,
      display: 'inline-block',
    },
  },
  revert: {
    label: 'Revert',
    style: {
      borderRadius: 999,
      background: 'rgba(254, 226, 226, 0.94)',
      color: '#b91c1c',
      padding: '3px 10px',
      fontSize: 12,
      fontWeight: 900,
      display: 'inline-block',
    },
  },
  observe: {
    label: 'Observe',
    style: {
      borderRadius: 999,
      background: 'rgba(243, 244, 246, 0.94)',
      color: '#374151',
      padding: '3px 10px',
      fontSize: 12,
      fontWeight: 900,
      display: 'inline-block',
    },
  },
};

function RecommendationBadge({ rec }: { rec: 'keep' | 'revert' | 'observe' }) {
  const { label, style } = RECOMMENDATION_BADGE[rec] ?? RECOMMENDATION_BADGE.observe;
  return <span style={style}>{label}</span>;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FeedbackLoopPanel({ data }: { data: unknown }) {
  if (!isFeedbackLoopOverview(data)) {
    return (
      <SectionCard title="Beta Feedback Loop">
        <EmptyState
          title="No feedback data"
          description="Feedback loop overview could not be parsed. Ensure ADAPTIVE_FEEDBACK_BETA_ENABLED=true is set."
        />
      </SectionCard>
    );
  }

  const { records, summary } = data;

  if (records.length === 0) {
    return (
      <SectionCard title="Beta Feedback Loop">
        <EmptyState
          title="No feedback records yet"
          description="Feedback records will appear here once a persona decision has been applied and evaluated."
        />
      </SectionCard>
    );
  }

  const latestRec = records[0]?.graphRecommendation ?? 'observe';
  const helpfulCount = summary.sentiments['helpful'] ?? 0;
  const inTheWayCount = summary.sentiments['in_the_way'] ?? 0;
  const keepCount = summary.recommendations['keep'] ?? 0;
  const revertCount = summary.recommendations['revert'] ?? 0;
  const observeCount = summary.recommendations['observe'] ?? 0;

  const recentRecords = records.slice(0, 3);

  return (
    <SectionCard title="Beta Feedback Loop">
      <p className={styles.helpText}>
        Activity scoring, explicit feedback, and graph recommendations for the current session.
      </p>

      {/* Latest recommendation */}
      <div style={latestRecStyle}>
        <span style={latestRecLabel}>Latest recommendation</span>
        <RecommendationBadge rec={latestRec} />
      </div>

      {/* Summary rows */}
      <ComparisonRows
        rows={[
          ['Total records', String(summary.totalRecords)],
          ['Avg activity score', summary.averageActivityScore.toFixed(2)],
          ['Sentiment: Helpful', String(helpfulCount)],
          ['Sentiment: In the way', String(inTheWayCount)],
          ['Rec: Keep / Revert / Observe', `${keepCount} / ${revertCount} / ${observeCount}`],
        ]}
      />

      {/* Recent record list */}
      <h3 style={recentHeaderStyle}>Recent evaluations</h3>
      <div style={recentListStyle}>
        {recentRecords.map((record, idx) => (
          <div key={idx} style={recentRowStyle}>
            <span style={recentTimestampStyle}>{formatTimestamp(record.timestamp)}</span>
            <span style={recentSourceStyle}>{record.source}</span>
            {record.sentiment && (
              <span style={recentSentimentStyle}>
                {record.sentiment === 'helpful' ? '👍 helpful' : '👎 in the way'}
              </span>
            )}
            <RecommendationBadge rec={record.graphRecommendation} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const latestRecStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 14,
  padding: '10px 12px',
  background: 'rgba(248, 250, 255, 0.9)',
  border: '1px solid rgba(129, 140, 248, 0.14)',
  borderRadius: 12,
};

const latestRecLabel: React.CSSProperties = {
  flexGrow: 1,
  fontWeight: 800,
  fontSize: 13,
  color: '#1d2640',
};

const recentHeaderStyle: React.CSSProperties = {
  margin: '18px 0 10px',
  fontSize: 13,
  fontWeight: 900,
  color: '#5b4fcf',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

const recentListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const recentRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  padding: '8px 10px',
  background: 'rgba(248, 250, 255, 0.88)',
  border: '1px solid rgba(129, 140, 248, 0.1)',
  borderRadius: 10,
};

const recentTimestampStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  color: '#64748b',
  minWidth: 80,
};

const recentSourceStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6366f1',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const recentSentimentStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#374151',
};
