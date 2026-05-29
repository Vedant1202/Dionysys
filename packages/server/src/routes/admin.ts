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
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.write(`data: ${JSON.stringify(await adminService.buildOverview(sessionId))}\n\n`);
      res.end();
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.get('/cohort-overview', (_req, res) => {
    res.json({
      success: true,
      overview: {
        variants: [],
        totalRecords: 0,
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
