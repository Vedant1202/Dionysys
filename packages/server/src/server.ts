import express from 'express';
import type { DionysysDecisionConnector } from '@dionysys/core';
import { createMemoryStorage } from './storage/memoryStorage.js';
import { SessionService } from './services/SessionService.js';
import { createSessionsRouter } from './routes/sessions.js';
export * from './storage/index.js';

export type CreateDionysysServerOptions = {
  config?: any;
  storage?: any;
  llmConnector?: DionysysDecisionConnector;
};

export function createDionysysServer(options: CreateDionysysServerOptions) {
  const storage = options.storage || createMemoryStorage();
  const sessionService = new SessionService(storage);

  return {
    router: () => {
      const router = express.Router();
      router.use(express.json());
      
      router.get('/health', (req, res) => res.json({ status: 'ok' }));
      router.use('/sessions', createSessionsRouter(sessionService));
      
      return router;
    }
  };
}
