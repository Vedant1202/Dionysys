import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createDionysysRouter } from './dionysys.js';

function setupApp() {
  const app = express();
  app.use('/api/dionysys', createDionysysRouter());
  return app;
}

describe('/api/dionysys router', () => {
  afterEach(() => {
    delete process.env.ADMIN_CONSOLE_ENABLED;
  });

  it('mounts server SDK health and session routes', async () => {
    const app = setupApp();

    const health = await request(app).get('/api/dionysys/health');
    const session = await request(app).post('/api/dionysys/sessions').send({ id: 's1' });

    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(session.status).toBe(200);
    expect(session.body.id).toBe('s1');
  });

  it('keeps admin routes gated by backend config', async () => {
    const res = await request(setupApp()).get('/api/dionysys/admin/config');
    expect(res.status).toBe(404);
  });
});
