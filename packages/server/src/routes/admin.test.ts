import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { AdminConfigService } from '../services/AdminConfigService.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createAdminRouter } from './admin.js';

function setupApp(
  enabled: boolean,
  authorize?: (req: express.Request) => boolean | Promise<boolean>,
) {
  const app = express();
  app.use(express.json());
  const service = new AdminConfigService({
    config: createDefaultDionysysConfig(),
    storage: createMemoryStorage(),
    enabled,
  });
  app.use('/admin', createAdminRouter(service, authorize));
  return app;
}

describe('admin routes', () => {
  it('returns 404 when disabled', async () => {
    const res = await request(setupApp(false)).get('/admin/config');
    expect(res.status).toBe(404);
  });

  it('reads and exports config when enabled', async () => {
    const app = setupApp(true);

    const configRes = await request(app).get('/admin/config');
    const exportRes = await request(app).get('/admin/config/export');

    expect(configRes.status).toBe(200);
    expect(configRes.body.config.version).toBe(1);
    expect(exportRes.body.config.version).toBe(1);
  });

  it('rejects invalid config updates', async () => {
    const res = await request(setupApp(true)).put('/admin/config').send({ version: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('returns 403 when the authorize hook rejects', async () => {
    const app = setupApp(true, () => false);

    const getRes = await request(app).get('/admin/config');
    const putRes = await request(app).put('/admin/config').send({ config: createDefaultDionysysConfig() });

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('forbidden');
    expect(putRes.status).toBe(403);
  });

  it('allows requests when the authorize hook accepts', async () => {
    const res = await request(setupApp(true, () => true)).get('/admin/config');
    expect(res.status).toBe(200);
    expect(res.body.config.version).toBe(1);
  });

  it('authorizes from request headers (bearer token)', async () => {
    const app = setupApp(true, (req) => req.headers.authorization === 'Bearer s3cret');

    const denied = await request(app).get('/admin/config');
    const allowed = await request(app).get('/admin/config').set('Authorization', 'Bearer s3cret');

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it('checks the enabled gate before authorization (404 wins over 403)', async () => {
    const res = await request(setupApp(false, () => true)).get('/admin/config');
    expect(res.status).toBe(404);
  });
});
