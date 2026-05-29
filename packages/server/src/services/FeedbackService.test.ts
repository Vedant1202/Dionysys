import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { FeedbackService } from './FeedbackService.js';

describe('FeedbackService', () => {
  it('records explicit feedback after an applied decision event', async () => {
    const storage = createMemoryStorage();
    const service = new FeedbackService(storage);
    await storage.saveEvents([
      {
        type: 'adaptive_decision_applied',
        sessionId: 's1',
        timestamp: 100,
        payload: { decision: { variant: 'draw_first', confidence: 0.8 } },
      },
      { type: 'element_drawn', sessionId: 's1', timestamp: 200 },
    ]);

    const record = await service.submit({ sessionId: 's1', sentiment: 'helpful' });

    expect(record?.graphRecommendation).toBe('keep');
    expect(await storage.getFeedbackLoopRecordsBySession('s1')).toHaveLength(1);
  });

  it('returns null when no applied decision exists', async () => {
    const storage = createMemoryStorage();
    const service = new FeedbackService(storage);
    expect(await service.evaluate({ sessionId: 's2', source: 'passive' })).toBeNull();
  });

  it('completes sessions with simple reward metrics', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s3');
    await storage.saveEvents([{ type: 'text_added', sessionId: 's3' }]);

    const result = await new FeedbackService(storage).complete({ sessionId: 's3' });

    expect(result.reward).toBe(1);
    expect(result.metrics.totalCreativeEvents).toBe(1);
  });
});
