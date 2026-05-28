import express from 'express';
import type { DionysysDecisionConnector } from '@dionysys/core';

export type CreateDionysysServerOptions = {
  config?: any;
  storage?: any;
  llmConnector?: DionysysDecisionConnector;
};

export function createDionysysServer(options: CreateDionysysServerOptions) {
  return {
    router: () => {
      const router = express.Router();
      router.get('/health', (req, res) => res.json({ status: 'ok' }));
      return router;
    }
  };
}
