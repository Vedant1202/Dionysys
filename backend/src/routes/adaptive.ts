import { Router, type Request, type Response } from 'express';
import type { AdaptiveMode } from '@dionysys/core';
import { dbAdapter } from '../db.js';
import { resolveAdaptiveDecisionForEvents } from '../services/AdaptiveDecisionService.js';
import { EXCALIDRAW_PERSONALITY_RESOURCES } from '../services/ExcalidrawMcpResources.js';

export const adaptiveRouter = Router();

adaptiveRouter.get('/resources', (_req: Request, res: Response): void => {
  res.json({ success: true, resources: EXCALIDRAW_PERSONALITY_RESOURCES });
});

adaptiveRouter.post('/decision', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, mode = 'deterministic' } = req.body;

    if (typeof sessionId !== 'string' || !sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    if (mode !== 'deterministic' && mode !== 'mcp') {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    const events = await dbAdapter.getEventsBySession(sessionId);
    const decision = await resolveAdaptiveDecisionForEvents(mode as AdaptiveMode, events);

    await dbAdapter.savePolicyDecision({
      sessionId,
      timestamp: new Date(),
      contextFeatures: decision.mode === 'mcp'
        ? {
            personaScores: decision.personaScores,
            rawScores: decision.rawScores,
            matchedSignals: decision.matchedSignals,
            interactionSummary: decision.interactionSummary,
          }
        : decision.personaScores,
      chosenVariant: decision.variant,
      propensity: decision.mode === 'mcp' ? decision.confidence : decision.propensity,
    });

    res.json({ success: true, ...decision });
  } catch (error) {
    console.error('Failed to resolve adaptive decision:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
