import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { AdminConfigService } from '../services/AdminConfigService.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createAdminRouter } from './admin.js';

function setupApp(enabled: boolean) {
  const app = express();
  app.use(express.json());
  const service = new AdminConfigService({
    config: createDefaultDionysysConfig(),
    storage: createMemoryStorage(),
    enabled,
  });
  app.use('/admin', createAdminRouter(service));
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
});
