import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { SessionService } from '../services/SessionService.js';
import { createSessionsRouter } from './sessions.js';

function setupApp() {
  const app = express();
  app.use(express.json());
  const storage = createMemoryStorage();
  const sessionService = new SessionService(storage);
  app.use('/sessions', createSessionsRouter(sessionService));
  return { app, storage };
}

describe('sessions route', () => {
  it('creates and gets a session', async () => {
    const { app } = setupApp();
    const createRes = await request(app).post('/sessions').send({ id: 's1', metadata: { foo: 'bar' } });
    expect(createRes.status).toBe(200);
    expect(createRes.body.id).toBe('s1');

    const getRes = await request(app).get('/sessions/s1');
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe('s1');
    expect(getRes.body.metadata.foo).toBe('bar');
  });

  it('updates a session', async () => {
    const { app } = setupApp();
    await request(app).post('/sessions').send({ id: 's2' });
    const patchRes = await request(app).patch('/sessions/s2').send({ metadata: { foo: 'baz' } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.metadata.foo).toBe('baz');
  });

  it('ends a session', async () => {
    const { app } = setupApp();
    await request(app).post('/sessions').send({ id: 's3' });
    const endRes = await request(app).post('/sessions/s3/end').send({});
    expect(endRes.status).toBe(200);
    expect(endRes.body.metadata.endedAt).toBeDefined();
  });

  it('deletes a session', async () => {
    const { app } = setupApp();
    await request(app).post('/sessions').send({ id: 's4' });
    const delRes = await request(app).delete('/sessions/s4');
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get('/sessions/s4');
    expect(getRes.status).toBe(404);
  });
});
