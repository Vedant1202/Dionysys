import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { isAdminConsoleEnabled } from '../services/AdminConfigService.js';
import { isAdaptiveFeedbackBetaEnabled } from '../services/FeedbackBetaService.js';
import { buildPulseStatus, buildSystemStatus } from '../services/SystemStatusService.js';

export const statusRouter = Router();

statusRouter.get('/live', (_req: Request, res: Response): void => {
  res.json({ success: true, status: buildStatusPayload() });
});

statusRouter.get('/beta', (_req: Request, res: Response): void => {
  const flags = getStatusFlags();
  res.json({
    success: true,
    beta: {
      adaptiveFeedback: flags.adaptiveFeedbackBetaEnabled,
      adminConsole: flags.adminConsoleEnabled,
      live: flags.adaptiveFeedbackBetaEnabled || flags.adminConsoleEnabled,
    },
  });
});

statusRouter.get('/diagnostics', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    diagnostics: buildStatusPayload(),
  });
});

statusRouter.get('/pulse', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    pulse: buildPulseStatus({
      flags: getStatusFlags(),
    }),
  });
});

function buildStatusPayload() {
  return buildSystemStatus({
    dbReadyState: mongoose.connection.readyState,
    uptimeSeconds: process.uptime(),
    flags: getStatusFlags(),
  });
}

function getStatusFlags() {
  return {
    adminConsoleEnabled: isAdminConsoleEnabled(),
    adaptiveFeedbackBetaEnabled: isAdaptiveFeedbackBetaEnabled(),
  };
}
