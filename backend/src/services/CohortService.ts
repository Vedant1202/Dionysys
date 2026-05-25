import type { FeedbackGraphRecommendation, IFeedbackLoopRecord } from '../db/IDatabaseAdapter.js';
import { dbAdapter } from '../db.js';

export interface CohortVariantStats {
  sessions: number;
  avgActivityScore: number;
  recommendations: Record<FeedbackGraphRecommendation, number>;
  sentiments: { helpful: number; in_the_way: number };
}

export interface CohortOverview {
  totalSessions: number;
  totalFeedbackRecords: number;
  byVariant: Record<string, CohortVariantStats>;
  overallRecommendations: Record<FeedbackGraphRecommendation, number>;
  overallSentiments: { helpful: number; in_the_way: number };
}

const EMPTY_RECOMMENDATIONS = (): Record<FeedbackGraphRecommendation, number> => ({
  keep: 0,
  revert: 0,
  observe: 0,
});

const EMPTY_SENTIMENTS = () => ({ helpful: 0, in_the_way: 0 });

export class CohortService {
  static async getOverview(): Promise<CohortOverview> {
    const records = await dbAdapter.getAllFeedbackLoopRecords();
    return CohortService.aggregateRecords(records);
  }

  /** Pure aggregation — exposed for unit testing without DB. */
  static aggregateRecords(records: IFeedbackLoopRecord[]): CohortOverview {
    if (records.length === 0) {
      return {
        totalSessions: 0,
        totalFeedbackRecords: 0,
        byVariant: {},
        overallRecommendations: EMPTY_RECOMMENDATIONS(),
        overallSentiments: EMPTY_SENTIMENTS(),
      };
    }

    const byVariant: Record<string, {
      sessionIds: Set<string>;
      activityScoreSum: number;
      recommendations: Record<FeedbackGraphRecommendation, number>;
      sentiments: { helpful: number; in_the_way: number };
    }> = {};

    const overallRecommendations = EMPTY_RECOMMENDATIONS();
    const overallSentiments = EMPTY_SENTIMENTS();
    const allSessionIds = new Set<string>();

    for (const record of records) {
      const variant = record.appliedDecision.variant ?? 'unknown';

      if (!byVariant[variant]) {
        byVariant[variant] = {
          sessionIds: new Set(),
          activityScoreSum: 0,
          recommendations: EMPTY_RECOMMENDATIONS(),
          sentiments: EMPTY_SENTIMENTS(),
        };
      }

      const v = byVariant[variant]!;
      v.sessionIds.add(record.sessionId);
      v.activityScoreSum += record.metrics.activityScore;
      v.recommendations[record.graphRecommendation]++;

      if (record.sentiment === 'helpful') {
        v.sentiments.helpful++;
        overallSentiments.helpful++;
      } else if (record.sentiment === 'in_the_way') {
        v.sentiments.in_the_way++;
        overallSentiments.in_the_way++;
      }

      overallRecommendations[record.graphRecommendation]++;
      allSessionIds.add(record.sessionId);
    }

    const result: CohortOverview['byVariant'] = {};
    for (const [variant, stats] of Object.entries(byVariant)) {
      result[variant] = {
        sessions: stats.sessionIds.size,
        avgActivityScore: stats.activityScoreSum / records.filter(
          (r) => (r.appliedDecision.variant ?? 'unknown') === variant,
        ).length,
        recommendations: stats.recommendations,
        sentiments: stats.sentiments,
      };
    }

    return {
      totalSessions: allSessionIds.size,
      totalFeedbackRecords: records.length,
      byVariant: result,
      overallRecommendations,
      overallSentiments,
    };
  }
}
