import type { IEvent } from '../db/IDatabaseAdapter.js';
import { RewardEngine } from '@antigravity/core';

export interface RewardResult {
  sessionId: string;
  reward: number; // normalized 0-1
  metrics: {
    timeToFirstElement?: number | undefined; // ms
    totalElementsCreated?: number | undefined;
    textToShapeRatio?: number | undefined;
    sessionDurationMs?: number | undefined;
    [key: string]: number | undefined;
  };
}

export const drawingAppRewardEngine = new RewardEngine({
  rewardFormula: (baseline, events, sessionStartMs) => {
    if (events.length === 0) return 0;
    
    let reward = 0.5;

    const drawnEvents = baseline.eventCountsByType['element_drawn'] || 0;
    const textEvents = baseline.eventCountsByType['text_added'] || 0;
    const totalElementsCreated = drawnEvents + textEvents;

    const firstCreativeEvent = events.find(
      e => e.eventType === 'element_drawn' || e.eventType === 'text_added'
    );

    if (firstCreativeEvent) {
      const timeToFirstElement = firstCreativeEvent.timestamp - sessionStartMs;
      if (timeToFirstElement < 10_000) reward = 1.0;
      else if (timeToFirstElement < 30_000) reward = 0.8;
      else if (timeToFirstElement < 60_000) reward = 0.6;
      else reward = 0.3;
    }

    if (totalElementsCreated > 5) {
      reward += 0.1;
    }

    return reward;
  }
});

export class RewardService {
  /**
   * Calculates a 0-1 reward score from session events using the generic RewardEngine.
   */
  static calculate(sessionId: string, events: IEvent[], sessionStartTime: Date): RewardResult {
    if (events.length === 0) {
      return { sessionId, reward: 0, metrics: {} };
    }

    const startMs = sessionStartTime.getTime();

    // Map IEvent (Date) to native timestamp (number) for the generic engine
    const normalizedEvents = events.map(e => ({
      eventType: e.eventType,
      timestamp: e.timestamp.getTime(),
      payload: e.payload
    }));

    const { reward, metrics } = drawingAppRewardEngine.calculate(normalizedEvents, startMs);

    // Compute application-specific metrics that extend the generic baseline
    const drawnEvents = metrics['element_drawn'] || 0;
    const textEvents = metrics['text_added'] || 0;
    
    const firstCreativeEvent = normalizedEvents.find(
      e => e.eventType === 'element_drawn' || e.eventType === 'text_added'
    );

    const finalMetrics = {
      sessionDurationMs: metrics['sessionDurationMs'],
      totalElementsCreated: drawnEvents + textEvents,
      timeToFirstElement: firstCreativeEvent ? firstCreativeEvent.timestamp - startMs : undefined,
      textToShapeRatio: drawnEvents > 0 ? textEvents / drawnEvents : (textEvents > 0 ? 1 : 0),
      ...metrics
    };

    return { sessionId, reward, metrics: finalMetrics };
  }
}
