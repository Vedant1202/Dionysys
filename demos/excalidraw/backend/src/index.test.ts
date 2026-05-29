import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { statusRouter } from './routes/status.js';
import { createDionysysRouter } from './routes/dionysys.js';

function setupApp() {
  const app = express();
  app.use('/api/dionysys', createDionysysRouter());
  app.use('/api/status', statusRouter);
  return app;
}

describe('index route surface', () => {
  const legacyPaths = [
    '/api/events',
    '/api/inference',
    '/api/policy',
    '/api/reward',
    '/api/adaptive',
    '/api/adaptive-feedback',
    '/api/admin',
  ];

  it.each(legacyPaths)('GET %s returns 404', async (path) => {
    const res = await request(setupApp()).get(path);
    expect(res.status).toBe(404);
  });

  it.each(legacyPaths)('POST %s returns 404', async (path) => {
    const res = await request(setupApp()).post(path).send({});
    expect(res.status).toBe(404);
  });

  it('/api/dionysys/health still responds', async () => {
    const res = await request(setupApp()).get('/api/dionysys/health');
    expect(res.status).toBe(200);
  });

  it('/api/status/live still responds', async () => {
    const res = await request(setupApp()).get('/api/status/live');
    expect(res.status).toBe(200);
  });
});
