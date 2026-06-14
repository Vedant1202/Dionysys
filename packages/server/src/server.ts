import express from 'express';
import type { AdminConsoleConfig } from '@dionysys/core';
import type { DionysysStorage } from './storage/types.js';
import { createMemoryStorage } from './storage/memoryStorage.js';
import { SessionService } from './services/SessionService.js';
import { EventService } from './services/EventService.js';
import { DecisionService } from './services/DecisionService.js';
import { FeedbackService } from './services/FeedbackService.js';
import { AdminConfigService } from './services/AdminConfigService.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createEventsRouter } from './routes/events.js';
import { createDecisionsRouter } from './routes/decisions.js';
import { createCompletionRouter, createFeedbackRouter } from './routes/feedback.js';
import { createAdminRouter, type AdminAuthorize } from './routes/admin.js';
import { createDefaultDionysysConfig } from './config/defaultConfig.js';
import { mockConnector } from './connectors/mockConnector.js';
import type { DionysysDecisionConnector } from './connectors/types.js';
import type { AdminConfigServiceOptions } from './services/AdminConfigService.js';
export * from './storage/index.js';
export * from './connectors/index.js';

export type CreateDionysysServerOptions = {
  config?: AdminConsoleConfig;
  storage?: DionysysStorage;
  llmConnector?: DionysysDecisionConnector;
  admin?: {
    enabled?: boolean;
    connectorStatus?: AdminConfigServiceOptions['connectorStatus'];
    // Optional authorization hook applied to every admin route (beyond the enabled flag).
    authorize?: AdminAuthorize;
  };
};

export function createDionysysServer(options: CreateDionysysServerOptions) {
  const config = options.config ?? createDefaultDionysysConfig();
  const storage = options.storage || createMemoryStorage();
  const llmConnector = options.llmConnector ?? mockConnector();
  const sessionService = new SessionService(storage);
  const eventService = new EventService(storage);
  const decisionService = new DecisionService({ config, storage, llmConnector });
  const feedbackService = new FeedbackService(storage, config);
  const adminService = new AdminConfigService({
    config,
    storage,
    enabled: options.admin?.enabled ?? false,
    connectorStatus: options.admin?.connectorStatus ?? {
      type: options.llmConnector ? 'custom-http' : 'mock',
      endpointConfigured: Boolean(options.llmConnector),
      apiKeyConfigured: false,
    },
  });

  return {
    router: () => {
      const router = express.Router();
      router.use(express.json());
      
      router.get('/health', (req, res) => res.json({ status: 'ok' }));
      router.use('/sessions', createSessionsRouter(sessionService));
      router.use('/sessions', createCompletionRouter(feedbackService));
      router.use('/events', createEventsRouter(eventService));
      router.use(createDecisionsRouter(decisionService));
      router.use('/feedback', createFeedbackRouter(feedbackService));
      router.use('/admin', createAdminRouter(adminService, options.admin?.authorize));
      
      return router;
    }
  };
}
