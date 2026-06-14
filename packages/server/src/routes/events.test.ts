import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { EventService } from '../services/EventService.js';
import { createEventsRouter } from './events.js';

function setupApp() {
  const app = express();
  app.use(express.json());
  const storage = createMemoryStorage();
  app.use('/events', createEventsRouter(new EventService(storage)));
  return { app, storage };
}

describe('events route', () => {
  it('accepts valid event batches', async () => {
    const { app, storage } = setupApp();

    const res = await request(app)
      .post('/events')
      .send({
        sessionId: 's1',
        tabId: 'tab-1',
        events: [{ type: 'element_drawn' }, { type: 'text_added' }],
      });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(2);
    expect(await storage.getEventsBySession('s1')).toHaveLength(2);
  });

  it('accepts a single event', async () => {
    const { app, storage } = setupApp();

    const res = await request(app)
      .post('/events')
      .send({
        sessionId: 's2',
        event: { type: 'ui.interaction', action: 'selected' },
      });

    expect(res.status).toBe(202);
    expect(await storage.getEventsBySession('s2')).toHaveLength(1);
  });

  it('rejects invalid events', async () => {
    const { app } = setupApp();

    const res = await request(app)
      .post('/events')
      .send({ sessionId: 's3', events: [{ type: '' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
