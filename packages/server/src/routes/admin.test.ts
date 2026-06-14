import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { AdminConfigService } from '../services/AdminConfigService.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createSeededRng } from '@dionysys/core';
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

describe('admin bandit routes', () => {
  function banditApp(authorize?: (req: express.Request) => boolean) {
    const app = express();
    app.use(express.json());
    const storage = createMemoryStorage();
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
      rng: createSeededRng(1),
    });
    app.use('/admin', createAdminRouter(service, authorize));
    return { app, storage };
  }

  it('GET /admin/bandit returns an overview', async () => {
    const { app, storage } = banditApp();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });

    const res = await request(app).get('/admin/bandit');

    expect(res.status).toBe(200);
    expect(res.body.overview.totalArms).toBe(1);
    expect(res.body.overview.contexts[0].stateId).toBe('neutral:standard');
  });

  it('POST /admin/bandit/reset resets an arm to priors', async () => {
    const { app, storage } = banditApp();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });

    const res = await request(app).post('/admin/bandit/reset').send({ stateId: 'neutral:standard', variant: 'text_first' });

    expect(res.status).toBe(200);
    expect((await storage.getBanditParams('neutral:standard', 'text_first'))?.alpha).toBe(1);
  });

  it('export then import round-trips learned arms', async () => {
    const { app, storage } = banditApp();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });

    const exported = await request(app).get('/admin/bandit/export');
    expect(exported.status).toBe(200);

    await request(app).post('/admin/bandit/reset').send({});
    const imported = await request(app).post('/admin/bandit/import').send({ arms: exported.body.arms });

    expect(imported.status).toBe(200);
    expect((await storage.getBanditParams('neutral:standard', 'text_first'))?.alpha).toBe(12);
  });

  it('POST /admin/bandit/decay moves arms toward priors', async () => {
    const { app, storage } = banditApp();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 50, beta: 1, lastUpdated: 0 });

    const res = await request(app).post('/admin/bandit/decay').send({});

    expect(res.status).toBe(200);
    expect(res.body.decayed).toBe(1);
    expect((await storage.getBanditParams('neutral:standard', 'text_first'))!.alpha).toBeLessThan(50);
  });

  it('honors the authorize hook (403)', async () => {
    const { app } = banditApp(() => false);
    expect((await request(app).get('/admin/bandit')).status).toBe(403);
  });
});
