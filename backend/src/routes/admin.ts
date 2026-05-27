import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { dbAdapter } from '../db.js';
import {
  buildAdminOverview,
  exportAdminConfig,
  getAdminConfig,
  isAdminConsoleEnabled,
  resetAdminConfig,
  updateAdminConfig,
} from '../services/AdminConfigService.js';
import { isAdaptiveFeedbackBetaEnabled } from '../services/FeedbackBetaService.js';
import { FeedbackLoopService } from '../services/FeedbackLoopService.js';
import { CohortService } from '../services/CohortService.js';

export const adminRouter = Router();

adminRouter.use((req: Request, res: Response, next: NextFunction): void => {
  if (!isAdminConsoleEnabled()) {
    res.status(404).json({ error: 'Admin console is disabled' });
    return;
  }

  next();
});

adminRouter.get('/config', (_req: Request, res: Response): void => {
  res.json({ success: true, config: getAdminConfig() });
});

adminRouter.put('/config', (req: Request, res: Response): void => {
  try {
    const config = updateAdminConfig(req.body?.config ?? req.body);
    res.json({ success: true, config });
  } catch (error) {
    handleAdminError(error, res);
  }
});

adminRouter.post('/config/reset', (_req: Request, res: Response): void => {
  res.json({ success: true, config: resetAdminConfig() });
});

adminRouter.get('/config/export', (_req: Request, res: Response): void => {
  const exported = exportAdminConfig();
  res.setHeader('Content-Disposition', `attachment; filename="dionysys-admin-config-${Date.now()}.json"`);
  res.json({ success: true, ...exported });
});

import { EventEmitter } from 'events';

export const adminEmitter = new EventEmitter();

adminRouter.get('/overview/stream', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;

  const sendOverview = async () => {
    try {
      const events = sessionId ? await dbAdapter.getEventsBySession(sessionId) : [];
      const overview = buildAdminOverview(events, sessionId);
      const feedbackLoop = sessionId && isAdaptiveFeedbackBetaEnabled()
        ? await FeedbackLoopService.getOverview(sessionId)
        : undefined;
      
      const payload = feedbackLoop ? { ...overview, feedbackLoop } : overview;
      
      // Strip the massive config object from the live stream to save bandwidth and memory
      if ('config' in payload) {
        delete (payload as any).config;
      }
      
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      console.error('SSE sendOverview failed:', error);
    }
  };

  // Initial send
  void sendOverview();

  const onSessionUpdated = (updatedSessionId: string) => {
    if (sessionId && updatedSessionId !== sessionId) return;
    void sendOverview();
  };

  adminEmitter.on('sessionUpdated', onSessionUpdated);

  // Force close the connection every 60 seconds.
  // The browser's native EventSource will automatically reconnect.
  // This prevents the browser from buffering an infinite stream in memory (a common cause of Chrome OOMs).
  const flushTimeout = setTimeout(() => {
    res.end();
  }, 60000);

  req.on('close', () => {
    clearTimeout(flushTimeout);
    adminEmitter.off('sessionUpdated', onSessionUpdated);
  });
});

adminRouter.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const events = sessionId ? await dbAdapter.getEventsBySession(sessionId) : [];
    const overview = buildAdminOverview(events, sessionId);
    const feedbackLoop = sessionId && isAdaptiveFeedbackBetaEnabled()
      ? await FeedbackLoopService.getOverview(sessionId)
      : undefined;

    res.json({
      success: true,
      overview: feedbackLoop ? { ...overview, feedbackLoop } : overview,
    });
  } catch (error) {
    handleAdminError(error, res);
  }
});

adminRouter.get('/cohort-overview', async (_req: Request, res: Response): Promise<void> => {
  if (!isAdaptiveFeedbackBetaEnabled()) {
    res.status(403).json({ error: 'Feedback beta is not enabled' });
    return;
  }

  try {
    const overview = await CohortService.getOverview();
    res.json({ success: true, overview });
  } catch (error) {
    handleAdminError(error, res);
  }
});

function handleAdminError(error: unknown, res: Response): void {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid admin configuration', issues: error.issues });
    return;
  }

  console.error('Admin route failed:', error);
  res.status(500).json({ error: 'Internal Server Error' });
}
