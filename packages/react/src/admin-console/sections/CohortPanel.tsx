import { ComparisonRows, EmptyState, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';

// ─── Types (mirrors CohortService.CohortOverview) ────────────────────────────

interface CohortVariantStats {
  sessions: number;
  avgActivityScore: number;
  recommendations: { keep: number; revert: number; observe: number };
  sentiments: { helpful: number; in_the_way: number };
}

export interface CohortOverview {
  totalSessions: number;
  totalFeedbackRecords: number;
  byVariant: Record<string, CohortVariantStats>;
  overallRecommendations: { keep: number; revert: number; observe: number };
  overallSentiments: { helpful: number; in_the_way: number };
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { background: string; color: string }> = {
  keep:    { background: 'rgba(209,250,229,0.9)', color: '#065f46' },
  revert:  { background: 'rgba(254,226,226,0.9)', color: '#991b1b' },
  observe: { background: 'rgba(241,245,249,0.9)', color: '#475569' },
};

function RecommendationBadge({ label, count }: { label: string; count: number }) {
  const colors = BADGE_COLORS[label] ?? BADGE_COLORS['observe']!;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 7px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      ...colors,
    }}>
      {label} {count}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CohortPanel({ overview }: { overview: CohortOverview }) {
  if (overview.totalFeedbackRecords === 0) {
    return (
      <SectionCard title="Cohort Overview">
        <EmptyState
          title="No cohort data yet"
          description="Feedback loop records will appear here once sessions with an applied decision have been evaluated."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Cohort Overview">
      <ComparisonRows
        rows={[
          ['Total sessions', String(overview.totalSessions)],
          ['Total feedback records', String(overview.totalFeedbackRecords)],
          ['Overall: helpful', String(overview.overallSentiments.helpful)],
          ['Overall: in the way', String(overview.overallSentiments.in_the_way)],
        ]}
      />

      <div style={{ marginTop: 14 }}>
        <p style={styles.helpText}>Per-variant performance</p>
        {Object.entries(overview.byVariant).map(([variant, stats]) => (
          <div key={variant} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 12 }}>{variant}</p>
            <ComparisonRows
              rows={[
                ['Sessions', String(stats.sessions)],
                ['Avg activity score', stats.avgActivityScore.toFixed(1)],
              ]}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <RecommendationBadge label="keep"    count={stats.recommendations.keep} />
              <RecommendationBadge label="revert"  count={stats.recommendations.revert} />
              <RecommendationBadge label="observe" count={stats.recommendations.observe} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
