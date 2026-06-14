import express from 'express';
import { ZodError } from 'zod';
import type { AdminConfigService } from '../services/AdminConfigService.js';
import { forbiddenError, internalError, validationError } from '../http/errors.js';

export function createAdminRouter(adminService: AdminConfigService) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!adminService.isEnabled()) {
      return res.status(404).json(forbiddenError('Admin console is disabled'));
    }
    next();
  });

  router.get('/config', (_req, res) => {
    res.json({ success: true, config: adminService.getConfig() });
  });

  router.put('/config', (req, res) => {
    try {
      res.json({ success: true, config: adminService.updateConfig(req.body?.config ?? req.body) });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.post('/config/reset', (_req, res) => {
    res.json({ success: true, config: adminService.resetConfig() });
  });

  router.get('/config/export', (_req, res) => {
    res.json({ success: true, ...adminService.exportConfig() });
  });

  router.get('/overview', async (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
      res.json({ success: true, overview: await adminService.buildOverview(sessionId) });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.get('/overview/stream', async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Persistent SSE: push the overview now and on an interval rather than closing
    // immediately (which made EventSource reconnect-loop and log connection errors).
    const send = async () => {
      try {
        res.write(`data: ${JSON.stringify(await adminService.buildOverview(sessionId))}\n\n`);
      } catch {
        // Transient build error — keep the stream open and retry on the next tick.
      }
    };

    await send();
    const interval = setInterval(() => { void send(); }, 3000);
    req.on('close', () => clearInterval(interval));
  });

  router.get('/cohort-overview', (_req, res) => {
    // Empty-but-correctly-shaped cohort overview so the admin Data tab renders its
    // empty state instead of crashing on missing fields. Real aggregation is a later task.
    res.json({
      success: true,
      overview: {
        totalSessions: 0,
        totalFeedbackRecords: 0,
        byVariant: {},
        overallRecommendations: { keep: 0, revert: 0, observe: 0 },
        overallSentiments: { helpful: 0, in_the_way: 0 },
      },
    });
  });

  return router;
}

function handleAdminError(error: unknown, res: express.Response): void {
  if (error instanceof ZodError || isZodLikeError(error)) {
    res.status(400).json(validationError('Invalid admin configuration', (error as { issues?: unknown }).issues));
    return;
  }

  res.status(500).json(internalError('Admin route failed'));
}

function isZodLikeError(error: unknown): error is { issues: unknown } {
  return Boolean(
    error
    && typeof error === 'object'
    && 'issues' in error
    && Array.isArray((error as { issues?: unknown }).issues),
  );
}
