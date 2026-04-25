export interface BaseEvent {
  eventType: string;
  timestamp: number;
  payload?: unknown;
}

export interface BaselineMetrics {
  sessionDurationMs: number;
  totalEvents: number;
  timeToFirstEvent?: number;
  eventCountsByType: Record<string, number>;
}

export interface RewardConfig<TEvent extends BaseEvent = BaseEvent> {
  rewardFormula: (baseline: BaselineMetrics, events: TEvent[], sessionStartMs: number) => number;
}
