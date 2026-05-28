import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { eventsRouter } from './events.js';
import { dbAdapter } from '../db.js';

// Mock dependencies
vi.mock('../db.js', () => ({
  dbAdapter: {
    saveEvents: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../services/FeedbackBetaService.js', () => ({
  isAdaptiveFeedbackBetaEnabled: vi.fn().mockReturnValue(true),
  isBetaFeedbackEventType: vi.fn().mockReturnValue(false)
}));

const app = express();
app.use(express.json());
app.use('/api/events', eventsRouter);

describe('POST /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept valid payload with sequenceId and tabId and return 202', async () => {
    const payload = {
      sessionId: 'sess-123',
      tabId: 'tab-456',
      events: [
        {
          eventType: 'cognitive_state',
          timestamp: Date.now(),
          sequenceId: 1,
          payload: { erraticScore: 85, idleMs: 2000 }
        }
      ]
    };

    const res = await request(app)
      .post('/api/events')
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);

    // Wait for the setImmediate block to execute
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(dbAdapter.saveEvents).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(dbAdapter.saveEvents).mock.calls[0]![0];
    const savedDoc = callArgs![0]!;
    expect(savedDoc.tabId).toBe('tab-456');
    expect(savedDoc.sequenceId).toBe(1);
    expect(savedDoc.eventType).toBe('cognitive_state');
  });

  it('should reject payload missing sessionId', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ events: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should reject batch larger than 1000 events', async () => {
    const events = Array(1001).fill({
      eventType: 'test',
      timestamp: Date.now(),
      payload: {}
    });

    const res = await request(app)
      .post('/api/events')
      .send({ sessionId: 'sess-123', events });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });
});
