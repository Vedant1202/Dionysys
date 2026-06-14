import express from 'express';
import type { DecisionService } from '../services/DecisionService.js';
import { DecisionValidationError } from '../services/DecisionService.js';
import { internalError, validationError } from '../http/errors.js';

export function createDecisionsRouter(decisionService: DecisionService) {
  const router = express.Router();

  const resolve = async (req: express.Request, res: express.Response) => {
    try {
      res.json(await decisionService.resolve(req.body));
    } catch (error) {
      if (error instanceof DecisionValidationError) {
        return res.status(400).json(validationError(error.message, error.details));
      }
      res.status(500).json(internalError('Failed to resolve decision'));
    }
  };

  router.post('/decisions:resolve', resolve);
  router.post('/decisions/resolve', resolve);

  return router;
}
