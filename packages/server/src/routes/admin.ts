import express from 'express';
import { ZodError } from 'zod';
import type { AdminConfigService } from '../services/AdminConfigService.js';
import { forbiddenError, internalError, validationError } from '../http/errors.js';

/**
 * Optional authorization hook for admin routes. Receives the request and returns
 * (or resolves to) whether the request may read/modify admin config. When omitted,
 * the admin router stays gated only by the enabled flag (back-compatible).
 */
export type AdminAuthorize = (req: express.Request) => boolean | Promise<boolean>;

export function createAdminRouter(adminService: AdminConfigService, authorize?: AdminAuthorize) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    if (!adminService.isEnabled()) {
      return res.status(404).json(forbiddenError('Admin console is disabled'));
    }

    if (authorize) {
      let allowed = false;
      try {
        allowed = await authorize(req);
      } catch {
        allowed = false;
      }
      if (!allowed) {
        return res.status(403).json(forbiddenError('Admin request is not authorized'));
      }
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

  router.get('/cohort-overview', async (_req, res) => {
    try {
      res.json({ success: true, overview: await adminService.buildCohortOverview() });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.get('/bandit', async (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
      res.json({ success: true, overview: await adminService.buildBanditOverview(sessionId) });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.post('/bandit/reset', async (req, res) => {
    try {
      const stateId = typeof req.body?.stateId === 'string' ? req.body.stateId : undefined;
      const variant = typeof req.body?.variant === 'string' ? req.body.variant : undefined;
      const reset = await adminService.resetBandit({ stateId, variant });
      res.json({ success: true, reset });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.get('/bandit/export', async (_req, res) => {
    try {
      res.json({ success: true, ...await adminService.exportBandit() });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.post('/bandit/import', async (req, res) => {
    try {
      const imported = await adminService.importBandit({ arms: Array.isArray(req.body?.arms) ? req.body.arms : [] });
      res.json({ success: true, imported });
    } catch (error) {
      handleAdminError(error, res);
    }
  });

  router.post('/bandit/decay', async (_req, res) => {
    try {
      const decayed = await adminService.decayAllBanditArms();
      res.json({ success: true, decayed });
    } catch (error) {
      handleAdminError(error, res);
    }
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
