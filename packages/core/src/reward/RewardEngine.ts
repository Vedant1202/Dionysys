import type { BaseEvent, BaselineMetrics, RewardConfig } from './types.js';

export type { BaseEvent, BaselineMetrics, RewardConfig } from './types.js';

export class RewardEngine<TEvent extends BaseEvent = BaseEvent> {
  private config: RewardConfig<TEvent>;

  constructor(config: RewardConfig<TEvent>) {
    this.config = config;
  }

  /**
   * Calculates generic baseline metrics out-of-the-box and then applies
   * the consumer-defined reward formula.
   */
  calculate(events: TEvent[], sessionStartMs: number): { reward: number; metrics: Record<string, number> } {
    if (events.length === 0) {
      return { reward: this.config.rewardFormula(this.getEmptyMetrics(), events, sessionStartMs), metrics: {} };
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    const baseline: BaselineMetrics = {
      sessionDurationMs: lastEvent.timestamp - sessionStartMs,
      totalEvents: events.length,
      timeToFirstEvent: firstEvent.timestamp - sessionStartMs,
      eventCountsByType: {}
    };

    // Calculate generic event counts
    for (const evt of events) {
      baseline.eventCountsByType[evt.eventType] = (baseline.eventCountsByType[evt.eventType] || 0) + 1;
    }

    // Process consumer formula
    const rawReward = this.config.rewardFormula(baseline, events, sessionStartMs);
    const reward = Math.max(0, Math.min(1, rawReward)); // Clamp to 0..1

    // Return the aggregated metrics and the clamped reward
    return {
      reward,
      metrics: {
        sessionDurationMs: baseline.sessionDurationMs,
        totalEvents: baseline.totalEvents,
        timeToFirstEvent: baseline.timeToFirstEvent ?? 0,
        ...baseline.eventCountsByType
      }
    };
  }

  private getEmptyMetrics(): BaselineMetrics {
    return {
      sessionDurationMs: 0,
      totalEvents: 0,
      eventCountsByType: {}
    };
  }
}
