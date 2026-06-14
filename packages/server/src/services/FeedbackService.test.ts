import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { FeedbackService, computePassiveReward } from './FeedbackService.js';

type IncrementCall = { stateId: string; variant: string; alphaInc: number; betaInc: number };

function trackIncrements(storage: ReturnType<typeof createMemoryStorage>): IncrementCall[] {
  const calls: IncrementCall[] = [];
  const original = storage.incrementBanditParams.bind(storage);
  storage.incrementBanditParams = async (stateId, variant, alphaInc, betaInc) => {
    calls.push({ stateId, variant, alphaInc, betaInc });
    return original(stateId, variant, alphaInc, betaInc);
  };
  return calls;
}

async function seedMcpDecision(
  storage: ReturnType<typeof createMemoryStorage>,
  sessionId: string,
  modality: string,
  stateId: string,
): Promise<void> {
  await storage.saveDecision({
    id: `dec_${sessionId}`,
    sessionId,
    mode: 'mcp',
    variant: modality,
    uiState: { variant: modality },
    selectedPersona: { id: modality, confidence: 0.7 },
    scores: {},
    metadata: { selectedModality: modality, blend: { stateId, chosenModality: modality, banditWeight: 0 } },
  });
  await storage.saveEvents([
    { type: 'dionysys.decision_applied', sessionId, timestamp: 100, payload: { decision: { variant: modality } } },
  ]);
}

describe('FeedbackService', () => {
  it('records explicit feedback after an applied decision event', async () => {
    const storage = createMemoryStorage();
    const service = new FeedbackService(storage);
    await storage.saveEvents([
      {
        type: 'adaptive_decision_applied',
        sessionId: 's1',
        timestamp: 100,
        payload: { decision: { variant: 'draw_first', confidence: 0.8 } },
      },
      { type: 'element_drawn', sessionId: 's1', timestamp: 200 },
    ]);

    const record = await service.submit({ sessionId: 's1', sentiment: 'helpful' });

    expect(record?.graphRecommendation).toBe('keep');
    expect(await storage.getFeedbackLoopRecordsBySession('s1')).toHaveLength(1);
  });

  it('returns null when no applied decision exists', async () => {
    const storage = createMemoryStorage();
    const service = new FeedbackService(storage);
    expect(await service.evaluate({ sessionId: 's2', source: 'passive' })).toBeNull();
  });

  it('completes sessions with a graded reward in (0,1)', async () => {
    const storage = createMemoryStorage();
    await storage.createSession('s3');
    await storage.saveEvents([{ type: 'text_added', sessionId: 's3' }]);

    const result = await new FeedbackService(storage).complete({ sessionId: 's3' });

    expect(result.reward).toBeGreaterThan(0);
    expect(result.reward).toBeLessThan(1);
    expect(result.metrics.totalCreativeEvents).toBe(1);
  });
});

describe('FeedbackService bandit learning', () => {
  it('credits the bandit arm with success on explicit keep', async () => {
    const storage = createMemoryStorage();
    const calls = trackIncrements(storage);
    await seedMcpDecision(storage, 's1', 'text_first', 'neutral:standard');

    await new FeedbackService(storage, createDefaultDionysysConfig()).submit({ sessionId: 's1', sentiment: 'helpful' });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ stateId: 'neutral:standard', variant: 'text_first' });
    expect(calls[0]!.alphaInc).toBeGreaterThan(calls[0]!.betaInc); // keep -> success
  });

  it('credits the bandit arm with failure on explicit revert', async () => {
    const storage = createMemoryStorage();
    const calls = trackIncrements(storage);
    await seedMcpDecision(storage, 's1', 'text_first', 'neutral:standard');

    await new FeedbackService(storage, createDefaultDionysysConfig()).submit({ sessionId: 's1', sentiment: 'in_the_way' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.betaInc).toBeGreaterThan(calls[0]!.alphaInc); // revert -> failure
  });

  it('does not credit the bandit when disabled or without config', async () => {
    const storage = createMemoryStorage();
    const calls = trackIncrements(storage);
    await seedMcpDecision(storage, 's1', 'text_first', 'neutral:standard');
    const disabled = createDefaultDionysysConfig();
    disabled.mcp.bandit = { ...disabled.mcp.bandit!, enabled: false };

    await new FeedbackService(storage, disabled).submit({ sessionId: 's1', sentiment: 'helpful' });
    await new FeedbackService(storage).submit({ sessionId: 's1', sentiment: 'helpful' });

    expect(calls).toHaveLength(0);
  });

  it('applies a low-weight passive reward on session completion', async () => {
    const storage = createMemoryStorage();
    const calls = trackIncrements(storage);
    await storage.createSession('s1');
    await seedMcpDecision(storage, 's1', 'text_first', 'neutral:standard');
    await storage.saveEvents([{ type: 'element_drawn', sessionId: 's1', timestamp: 300 }]); // creative activity -> graded passive reward

    await new FeedbackService(storage, createDefaultDionysysConfig()).complete({ sessionId: 's1' });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ stateId: 'neutral:standard', variant: 'text_first' });
    expect(calls[0]!.alphaInc).toBeGreaterThan(0);
    // rewardToIncrements splits the weight: alphaInc + betaInc === passiveRewardWeight (0.25)
    expect(calls[0]!.alphaInc + calls[0]!.betaInc).toBeCloseTo(0.25, 10);
  });

  it('does not credit the bandit for deterministic-only decisions', async () => {
    const storage = createMemoryStorage();
    const calls = trackIncrements(storage);
    await storage.saveDecision({
      id: 'det1',
      sessionId: 's1',
      mode: 'deterministic',
      variant: 'neutral',
      selectedPersona: { id: 'neutral', confidence: 0.5 },
      scores: {},
    });
    await storage.saveEvents([
      { type: 'dionysys.decision_applied', sessionId: 's1', timestamp: 100, payload: { decision: { variant: 'neutral' } } },
    ]);

    await new FeedbackService(storage, createDefaultDionysysConfig()).submit({ sessionId: 's1', sentiment: 'helpful' });

    expect(calls).toHaveLength(0);
  });
});

describe('computePassiveReward', () => {
  const weights = {
    creationWeight: 3,
    textAdditionWeight: 3,
    modificationWeight: 1,
    deletionPenalty: 2,
    hiddenToolPenalty: 3,
  };
  const ev = (type: string) => ({ type });

  it('is 0 with no events', () => {
    expect(computePassiveReward([], weights)).toBe(0);
  });

  it('grades by amount of productive activity rather than returning a binary 0/1', () => {
    const few = computePassiveReward([ev('element_drawn')], weights);
    const many = computePassiveReward(Array.from({ length: 5 }, () => ev('element_drawn')), weights);

    expect(few).toBeGreaterThan(0);
    expect(few).toBeLessThan(1);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThan(1);
  });

  it('is reduced by friction events (deletions)', () => {
    const productive = Array.from({ length: 5 }, () => ev('element_drawn'));
    const clean = computePassiveReward(productive, weights);
    const withFriction = computePassiveReward([...productive, ev('element_deleted'), ev('element_deleted')], weights);

    expect(withFriction).toBeLessThan(clean);
  });

  it('stays within [0,1]', () => {
    const reward = computePassiveReward(Array.from({ length: 100 }, () => ev('element_drawn')), weights);
    expect(reward).toBeGreaterThanOrEqual(0);
    expect(reward).toBeLessThanOrEqual(1);
  });
});
