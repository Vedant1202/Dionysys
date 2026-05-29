import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FeedbackService } from '../services/FeedbackService.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createCompletionRouter, createFeedbackRouter } from './feedback.js';

function setupApp() {
  const app = express();
  app.use(express.json());
  const storage = createMemoryStorage();
  const service = new FeedbackService(storage);
  app.use('/feedback', createFeedbackRouter(service));
  app.use('/sessions', createCompletionRouter(service));
  return { app, storage };
}

describe('feedback routes', () => {
  it('submits explicit feedback', async () => {
    const { app, storage } = setupApp();
    await storage.saveEvents([
      { type: 'adaptive_decision_applied', sessionId: 's1', payload: { decision: { variant: 'neutral' } } },
    ]);

    const res = await request(app)
      .post('/feedback')
      .send({ sessionId: 's1', sentiment: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.record.graphRecommendation).toBe('keep');
  });

  it('completes a session', async () => {
    const { app, storage } = setupApp();
    await storage.createSession('s2');

    const res = await request(app).post('/sessions/s2/complete').send({});

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('s2');
  });
});
