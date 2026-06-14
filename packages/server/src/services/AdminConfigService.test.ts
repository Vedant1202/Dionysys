import { describe, expect, it } from 'vitest';
import { createSeededRng, effectiveWindowToGamma } from '@dionysys/core';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import type { DionysysFeedbackRecommendation, DionysysFeedbackRecord, DionysysFeedbackSentiment } from '../storage/types.js';
import { AdminConfigService } from './AdminConfigService.js';
import { FeedbackService } from './FeedbackService.js';

function makeFeedbackRecord(
  sessionId: string,
  variant: string,
  graphRecommendation: DionysysFeedbackRecommendation,
  sentiment: DionysysFeedbackSentiment,
  activityScore: number,
): DionysysFeedbackRecord {
  return {
    sessionId,
    timestamp: 0,
    source: 'explicit',
    appliedDecision: { variant },
    windowStart: 0,
    windowEnd: 0,
    metrics: {
      productiveActionsPerMinute: 0,
      creationCount: 0,
      textAdditionCount: 0,
      modificationCount: 0,
      deletionCount: 0,
      hiddenToolClicks: 0,
      hiddenToolFrictionRate: 0,
      activityScore,
      windowDurationMs: 1,
      totalToolSelections: 0,
    },
    graphRecommendation,
    graphRationale: 'test',
    sentiment,
  };
}

describe('AdminConfigService', () => {
  it('reads, updates, resets, and exports config', () => {
    const config = createDefaultDionysysConfig();
    const service = new AdminConfigService({
      config,
      storage: createMemoryStorage(),
      enabled: true,
    });

    const updated = service.updateConfig({
      ...config,
      mode: { ...config.mode, defaultMode: 'mcp' },
    });

    expect(updated.mode.defaultMode).toBe('mcp');
    expect(service.exportConfig().config.mode.defaultMode).toBe('mcp');
    expect(service.resetConfig().mode.defaultMode).toBe(config.mode.defaultMode);
  });

  it('builds an overview', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([{ type: 'ui.interaction', sessionId: 's1' }]);
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
    });

    const overview = await service.buildOverview('s1');
    expect(overview.enabled).toBe(true);
    expect(overview.session?.eventCount).toBe(1);
  });

  it('computes real session scores from events instead of returning a stub', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 's2' },
      { type: 'element_drawn', sessionId: 's2' },
      { type: 'text_added', sessionId: 's2' },
    ]);
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
    });

    const session = (await service.buildOverview('s2')).session;

    expect(session?.interactionSummary.totalEvents).toBe(3);
    expect(session?.interactionSummary.eventCountsByType.element_drawn).toBe(2);
    expect(session?.mcpScoreResult.selectedModality).toBe('draw_first'); // 2 draws vs 1 text
    expect(session?.deterministicAxisScores.selectedModality).toBe('draw_first');
  });

  it('aggregates feedback records into a cohort overview', async () => {
    const storage = createMemoryStorage();
    await storage.saveFeedbackLoopRecord(makeFeedbackRecord('s1', 'draw_first', 'keep', 'helpful', 10));
    await storage.saveFeedbackLoopRecord(makeFeedbackRecord('s2', 'draw_first', 'revert', 'in_the_way', 4));
    await storage.saveFeedbackLoopRecord(makeFeedbackRecord('s3', 'text_first', 'keep', 'helpful', 6));
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
    });

    const cohort = await service.buildCohortOverview();

    expect(cohort.totalFeedbackRecords).toBe(3);
    expect(cohort.totalSessions).toBe(3);
    expect(cohort.overallRecommendations).toEqual({ keep: 2, revert: 1, observe: 0 });
    expect(cohort.overallSentiments).toEqual({ helpful: 2, in_the_way: 1 });
    expect(cohort.byVariant.draw_first.sessions).toBe(2);
    expect(cohort.byVariant.draw_first.recommendations).toEqual({ keep: 1, revert: 1, observe: 0 });
    expect(cohort.byVariant.draw_first.avgActivityScore).toBe(7); // (10 + 4) / 2
    expect(cohort.byVariant.text_first.sentiments.helpful).toBe(1);
  });

  it('includes a per-session feedback-loop overview when a provider is configured', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([
      { type: 'dionysys.decision_applied', sessionId: 's1', timestamp: 1, payload: { decision: { variant: 'draw_first' } } },
      { type: 'element_drawn', sessionId: 's1', timestamp: 2 },
    ]);
    const feedbackService = new FeedbackService(storage, createDefaultDionysysConfig());
    await feedbackService.submit({ sessionId: 's1', sentiment: 'helpful' });

    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
      feedbackOverview: (sessionId) => feedbackService.getOverview(sessionId),
    });

    const overview = await service.buildOverview('s1');

    expect(overview.feedbackLoop).toBeDefined();
    expect((overview.feedbackLoop as { summary: { totalRecords: number } }).summary.totalRecords).toBe(1);
  });

  it('omits feedbackLoop when no provider is configured', async () => {
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage: createMemoryStorage(),
      enabled: true,
    });

    const overview = await service.buildOverview('s1');
    expect(overview.feedbackLoop).toBeUndefined();
  });
});

describe('AdminConfigService.buildBanditOverview', () => {
  async function seeded() {
    const storage = createMemoryStorage();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'draw_first', alpha: 1, beta: 1, lastUpdated: 0 });
    const service = new AdminConfigService({
      config: createDefaultDionysysConfig(),
      storage,
      enabled: true,
      rng: createSeededRng(1),
    });
    return { storage, service };
  }

  it('groups arms by context with posterior stats, evidence weight, and P(best)', async () => {
    const { service } = await seeded();
    const overview = await service.buildBanditOverview();

    expect(overview.totalArms).toBe(2);
    const ctx = overview.contexts.find((c) => c.stateId === 'neutral:standard');
    expect(ctx?.arms).toHaveLength(2);

    const warm = ctx?.arms.find((a) => a.variant === 'text_first');
    expect(warm?.posteriorMean).toBeCloseTo(12 / 14, 5);
    expect(warm?.observations).toBe(12); // (12+2) - (priorAlpha+priorBeta = 2)
    expect(warm?.credibleInterval.level).toBe(0.9);
    expect(warm?.credibleInterval.lower).toBeLessThan(warm!.posteriorMean);
    expect(warm?.probabilityBest).toBeGreaterThan(0.7); // dominant vs a uniform Beta(1,1) arm
    expect(ctx?.wouldPick).toBe('text_first');
  });

  it('echoes the decay config (enabled, window, derived gamma)', async () => {
    const { service } = await seeded();
    const overview = await service.buildBanditOverview();
    expect(overview.decay).toEqual({ enabled: true, effectiveWindow: 200, gamma: effectiveWindowToGamma(200) });
  });

  it('reconstructs a decision trace from the latest MCP decision when given a sessionId', async () => {
    const { storage, service } = await seeded();
    await storage.saveDecision({
      id: 'd1',
      sessionId: 's1',
      mode: 'mcp',
      variant: 'text_first',
      selectedPersona: { id: 'text_first', confidence: 0.8 },
      scores: {},
      metadata: {
        signalStrength: 'weak',
        resolvedBy: 'blended',
        selectedModality: 'text_first',
        blend: { stateId: 'neutral:standard', llmModality: 'neutral', llmConfidence: 0.7, chosenModality: 'text_first', banditWeight: 0.8 },
      },
    });

    const overview = await service.buildBanditOverview('s1');
    expect(overview.trace?.chosenModality).toBe('text_first');
    expect(overview.trace?.resolvedBy).toBe('blended');
    expect(overview.trace?.signalStrength).toBe('weak');
  });
});

describe('AdminConfigService bandit maintenance', () => {
  it('resets a single arm to priors', async () => {
    const storage = createMemoryStorage();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });
    const service = new AdminConfigService({ config: createDefaultDionysysConfig(), storage, enabled: true });

    await service.resetBandit({ stateId: 'neutral:standard', variant: 'text_first' });

    const arm = await storage.getBanditParams('neutral:standard', 'text_first');
    expect(arm?.alpha).toBe(1);
    expect(arm?.beta).toBe(1);
  });

  it('resets a whole context but leaves other contexts intact', async () => {
    const storage = createMemoryStorage();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'draw_first', alpha: 5, beta: 3, lastUpdated: 0 });
    await storage.upsertBanditParams({ stateId: 'draw_first:novice', variant: 'draw_first', alpha: 9, beta: 1, lastUpdated: 0 });
    const service = new AdminConfigService({ config: createDefaultDionysysConfig(), storage, enabled: true });

    await service.resetBandit({ stateId: 'neutral:standard' });

    expect((await storage.getBanditParams('neutral:standard', 'text_first'))?.alpha).toBe(1);
    expect((await storage.getBanditParams('neutral:standard', 'draw_first'))?.alpha).toBe(1);
    expect((await storage.getBanditParams('draw_first:novice', 'draw_first'))?.alpha).toBe(9);
  });

  it('exports and re-imports learned arms', async () => {
    const storage = createMemoryStorage();
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'text_first', alpha: 12, beta: 2, lastUpdated: 0 });
    const service = new AdminConfigService({ config: createDefaultDionysysConfig(), storage, enabled: true });

    const snapshot = await service.exportBandit();
    expect(snapshot.arms).toHaveLength(1);

    await service.resetBandit();
    expect((await storage.getBanditParams('neutral:standard', 'text_first'))?.alpha).toBe(1);

    await service.importBandit(snapshot);
    expect((await storage.getBanditParams('neutral:standard', 'text_first'))?.alpha).toBe(12);
  });
});
