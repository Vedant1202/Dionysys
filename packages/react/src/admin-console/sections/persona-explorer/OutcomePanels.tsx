import { DashboardCard, EmptyDashboardState, MetricRow, formatDuration, formatPercent } from './DashboardPrimitives.js';

type FeedbackOverview = {
  records?: Array<{
    metrics?: {
      productiveActionsPerMinute?: number;
      hiddenToolClicks?: number;
      hiddenToolFrictionRate?: number;
      activityScore?: number;
      deletionCount?: number;
      totalToolSelections?: number;
      windowDurationMs?: number;
    };
    graphRecommendation?: string;
    sentiment?: string;
  }>;
  summary?: {
    totalRecords?: number;
    averageActivityScore?: number;
    recommendations?: Record<string, number>;
    sentiments?: Record<string, number>;
  };
};

export function OutcomePanels({ feedbackLoop }: { feedbackLoop?: unknown | undefined }) {
  const overview = normalizeFeedbackOverview(feedbackLoop);
  const latest = overview?.records?.[0];
  const totalRecords = overview?.summary?.totalRecords ?? overview?.records?.length ?? 0;

  return (
    <>
      <DashboardCard
        title="Friction Radar"
        help={{
          label: 'Friction radar',
          description: 'Signals that the adapted UI might be getting in the user way.',
          example: 'If a user opens hidden overflow tools repeatedly, hidden-tool friction increases.',
        }}
      >
        {!overview || totalRecords === 0 || !latest?.metrics ? (
          <EmptyDashboardState>Feedback loop metrics are unavailable for this session.</EmptyDashboardState>
        ) : (
          <div className="dionysys-dashboardMetricList">
            <MetricRow
              label="Hidden friction"
              value={formatPercent(latest.metrics.hiddenToolFrictionRate)}
              help={{
                label: 'Hidden-tool friction rate',
                description: 'The share of tool selections that came from tools hidden by the active persona UI.',
                example: '1 hidden click out of 10 tool selections is 10% friction.',
              }}
            />
            <MetricRow
              label="Hidden clicks"
              value={String(latest.metrics.hiddenToolClicks ?? 0)}
              help={{
                label: 'Hidden tool clicks',
                description: 'How many times the user selected a tool that the persona UI deprioritized.',
                example: 'A text-first UI hiding shapes can still record a hidden rectangle click.',
              }}
            />
            <MetricRow
              label="Deletions"
              value={String(latest.metrics.deletionCount ?? 0)}
              help={{
                label: 'Deletion count',
                description: 'Deleted elements inside the current post-decision evaluation window.',
                example: 'A spike in deletions after adaptation can suggest mismatch or correction work.',
              }}
            />
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title="Variant Outcome"
        help={{
          label: 'Variant outcome',
          description: 'Feedback-loop summary for whether the applied UI variant should be kept, watched, or reverted.',
          example: 'High activity score plus helpful feedback usually leads to a keep recommendation.',
        }}
      >
        {!overview || totalRecords === 0 ? (
          <EmptyDashboardState>Outcome records appear after feedback beta evaluates an applied decision.</EmptyDashboardState>
        ) : (
          <div className="dionysys-dashboardMetricList">
            <MetricRow
              label="Recommendation"
              value={topCountLabel(overview.summary?.recommendations)}
              help={{
                label: 'Recommendation',
                description: 'The most common keep, observe, or revert recommendation in this session feedback window.',
                example: 'observe means the signal is not strong enough to keep or revert confidently.',
              }}
            />
            <MetricRow
              label="Avg activity"
              value={formatNumber(overview.summary?.averageActivityScore)}
              help={{
                label: 'Average activity score',
                description: 'Weighted productive activity after adaptation, minus deletion and hidden-tool penalties.',
                example: 'Drawing and text creation add points; hidden-tool clicks subtract points.',
              }}
            />
            <MetricRow
              label="Latest window"
              value={formatDuration(latest?.metrics?.windowDurationMs)}
              help={{
                label: 'Evaluation window',
                description: 'How much post-decision activity was considered for the latest feedback record.',
                example: 'A 60 s window includes events recorded during the minute after adaptation.',
              }}
            />
            <MetricRow
              label="Sentiment"
              value={topCountLabel(overview.summary?.sentiments)}
              help={{
                label: 'User sentiment',
                description: 'Explicit helpful or in-the-way feedback submitted by the user.',
                example: 'A helpful vote supports keeping the current adaptive UI.',
              }}
            />
          </div>
        )}
      </DashboardCard>
    </>
  );
}

function normalizeFeedbackOverview(value: unknown): FeedbackOverview | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as FeedbackOverview;
}

function topCountLabel(counts: Record<string, number> | undefined): string {
  if (!counts || Object.keys(counts).length === 0) return 'n/a';
  const [label, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return label ? `${label} (${count})` : 'n/a';
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(1);
}
