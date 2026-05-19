import { Router, type Request, type Response } from 'express';
import type { FeedbackSentiment } from '../db/IDatabaseAdapter.js';
import { FeedbackLoopService } from '../services/FeedbackLoopService.js';

export const adaptiveFeedbackRouter = Router();

adaptiveFeedbackRouter.post('/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = readSessionId(req);
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const record = await FeedbackLoopService.recordEvaluation({
      sessionId,
      source: 'passive',
    });

    if (!record) {
      res.status(409).json({ error: 'No applied adaptive decision found for this session' });
      return;
    }

    res.json({ success: true, record });
  } catch (error) {
    handleFeedbackError(error, res);
  }
});

adaptiveFeedbackRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = readSessionId(req);
    const sentiment = req.body?.sentiment;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    if (sentiment !== 'helpful' && sentiment !== 'in_the_way') {
      res.status(400).json({ error: 'Invalid sentiment' });
      return;
    }

    const comment = typeof req.body?.comment === 'string' && req.body.comment.trim()
      ? req.body.comment.trim()
      : undefined;

    const record = await FeedbackLoopService.recordEvaluation({
      sessionId,
      source: 'explicit',
      sentiment: sentiment as FeedbackSentiment,
      comment,
    });

    if (!record) {
      res.status(409).json({ error: 'No applied adaptive decision found for this session' });
      return;
    }

    res.json({ success: true, record });
  } catch (error) {
    handleFeedbackError(error, res);
  }
});

adaptiveFeedbackRouter.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    res.json({ success: true, overview: await FeedbackLoopService.getOverview(sessionId) });
  } catch (error) {
    handleFeedbackError(error, res);
  }
});

function readSessionId(req: Request): string | undefined {
  return typeof req.body?.sessionId === 'string' && req.body.sessionId
    ? req.body.sessionId
    : undefined;
}

function handleFeedbackError(error: unknown, res: Response): void {
  console.error('Adaptive feedback route failed:', error);
  res.status(500).json({ error: 'Internal Server Error' });
}
