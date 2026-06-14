import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { mockConnector } from '../connectors/mockConnector.js';
import { DecisionService } from '../services/DecisionService.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createDecisionsRouter } from './decisions.js';

function setupApp() {
  const app = express();
  app.use(express.json());
  const storage = createMemoryStorage();
  const decisionService = new DecisionService({
    config: createDefaultDionysysConfig(),
    storage,
    llmConnector: mockConnector(),
  });
  app.use(createDecisionsRouter(decisionService));
  return { app, storage };
}

describe('decisions route', () => {
  it('resolves a deterministic decision through the preferred route', async () => {
    const { app, storage } = setupApp();
    await storage.saveEvents([{ type: 'element_drawn', sessionId: 's1' }]);

    const res = await request(app)
      .post('/decisions:resolve')
      .send({ sessionId: 's1', mode: 'deterministic' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('s1');
    expect(res.body.mode).toBe('deterministic');
  });

  it('resolves through the slash alias', async () => {
    const { app } = setupApp();

    const res = await request(app)
      .post('/decisions/resolve')
      .send({ sessionId: 's2', mode: 'mcp' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('mcp');
  });

  it('rejects invalid requests', async () => {
    const { app } = setupApp();

    const res = await request(app)
      .post('/decisions:resolve')
      .send({ sessionId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
