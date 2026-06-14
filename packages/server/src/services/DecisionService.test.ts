import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@dionysys/core';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { mockConnector } from '../connectors/mockConnector.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import type { DionysysDecisionConnector } from '../connectors/types.js';
import { DecisionService, DecisionValidationError } from './DecisionService.js';

function createService() {
  const storage = createMemoryStorage();
  const service = new DecisionService({
    config: createDefaultDionysysConfig(),
    storage,
    llmConnector: mockConnector(),
  });
  return { storage, service };
}

function fixedConnector(personaId: string, actionId: string, confidence: number): DionysysDecisionConnector {
  return { async decide() { return { personaId, actionId, confidence }; } };
}

// Wrap getBanditParams to record the (stateId, variant) keys the service reads.
function trackBanditReads(storage: ReturnType<typeof createMemoryStorage>): string[] {
  const reads: string[] = [];
  const original = storage.getBanditParams.bind(storage);
  storage.getBanditParams = async (stateId: string, variant: string) => {
    reads.push(`${stateId}::${variant}`);
    return original(stateId, variant);
  };
  return reads;
}

describe('DecisionService', () => {
  it('resolves deterministic decisions from stored events', async () => {
    const { storage, service } = createService();
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 's1' },
      { type: 'element_drawn', sessionId: 's1' },
    ]);

    const decision = await service.resolve({ sessionId: 's1', mode: 'deterministic' });

    expect(decision.mode).toBe('deterministic');
    expect(decision.sessionId).toBe('s1');
    expect(decision.variant).toContain('draw_first');
    expect(await storage.getDecisionsBySession('s1')).toHaveLength(1);
  });

  it('resolves MCP decisions and validates connector output through core resolver', async () => {
    const { storage, service } = createService();
    await storage.saveEvents([
      { type: 'text_added', sessionId: 's2' },
      { type: 'text_added', sessionId: 's2' },
    ]);

    const decision = await service.resolve({ sessionId: 's2', mode: 'mcp' });

    expect(decision.mode).toBe('mcp');
    expect(decision.sessionId).toBe('s2');
    expect(decision.uiState?.variant).toBe(decision.variant);
    expect(decision.selectedPersona.confidence).toBeGreaterThanOrEqual(0);
  });

  it('falls back when connector output is invalid', async () => {
    const storage = createMemoryStorage();
    const service = new DecisionService({
      config: createDefaultDionysysConfig(),
      storage,
      llmConnector: {
        async decide() {
          return {
            personaId: 'unknown',
            actionId: 'unknown',
            confidence: 2,
          };
        },
      },
    });

    const decision = await service.resolve({ sessionId: 's3', mode: 'mcp' });
    expect(decision.mode).toBe('mcp');
    expect(decision.metadata?.isFallback).toBe(true);
  });

  it('rejects invalid requests', async () => {
    const { service } = createService();
    await expect(service.resolve({ sessionId: '' })).rejects.toBeInstanceOf(DecisionValidationError);
  });

  it('maps connector personaId onto MCP selectedPersona', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([{ type: 'text_added', sessionId: 's4' }]);
    const service = new DecisionService({
      config: createDefaultDionysysConfig(),
      storage,
      llmConnector: {
        async decide() {
          return {
            personaId: 'neutral',
            actionId: 'show_neutral_workspace',
            confidence: 0.75,
          };
        },
      },
    });

    const decision = await service.resolve({ sessionId: 's4', mode: 'mcp' });

    expect(decision.selectedPersona.id).toBe('neutral');
    expect(decision.selectedPersona.confidence).toBe(0.75);
  });

  it('reads bandit params by stateId and blends to the LLM choice when arms are cold', async () => {
    const storage = createMemoryStorage();
    const reads = trackBanditReads(storage);
    await storage.saveEvents([{ type: 'element_drawn', sessionId: 'w1' }]); // 1 event -> weak, locked=neutral

    const service = new DecisionService({
      config: createDefaultDionysysConfig(),
      storage,
      llmConnector: fixedConnector('text_first', 'show_text_workspace', 0.9),
      rng: createSeededRng(1),
    });

    const decision = await service.resolve({ sessionId: 'w1', mode: 'mcp' });

    expect(decision.metadata?.signalStrength).toBe('weak');
    expect(decision.metadata?.resolvedBy).toBe('blended');
    expect(decision.variant).toBe('text_first'); // free LLM choice, not the locked neutral
    expect((decision.metadata?.blend as { stateId?: string } | undefined)?.stateId).toBe('neutral:standard');
    expect(reads).toContain('neutral:standard::text_first');
  });

  it('lets a warm bandit arm override the LLM on weak signal', async () => {
    const storage = createMemoryStorage();
    await storage.saveEvents([{ type: 'element_drawn', sessionId: 'w2' }]);
    await storage.upsertBanditParams({ stateId: 'neutral:standard', variant: 'draw_first', alpha: 50, beta: 1, lastUpdated: 0 });

    const service = new DecisionService({
      config: createDefaultDionysysConfig(),
      storage,
      llmConnector: fixedConnector('text_first', 'show_text_workspace', 0.6),
      rng: createSeededRng(7),
    });

    const decision = await service.resolve({ sessionId: 'w2', mode: 'mcp' });

    expect(decision.metadata?.resolvedBy).toBe('blended');
    expect(decision.variant).toBe('draw_first'); // bandit-favored arm overrides the LLM
    expect((decision.metadata?.blend as { banditWeight?: number } | undefined)?.banditWeight).toBeGreaterThan(0.9);
  });

  it('skips bandit reads when the bandit is disabled', async () => {
    const storage = createMemoryStorage();
    const reads = trackBanditReads(storage);
    await storage.saveEvents([{ type: 'element_drawn', sessionId: 'w3' }]);
    const config = createDefaultDionysysConfig();
    config.mcp.bandit = { ...config.mcp.bandit!, enabled: false };

    const service = new DecisionService({
      config,
      storage,
      llmConnector: fixedConnector('text_first', 'show_text_workspace', 0.9),
      rng: createSeededRng(1),
    });

    const decision = await service.resolve({ sessionId: 'w3', mode: 'mcp' });

    expect(reads).toHaveLength(0);
    expect(decision.variant).toBe('text_first'); // pure LLM, no bandit influence
  });

  it('deterministic decisions carry no blend metadata', async () => {
    const { storage, service } = createService();
    await storage.saveEvents([
      { type: 'element_drawn', sessionId: 'd1' },
      { type: 'element_drawn', sessionId: 'd1' },
    ]);

    const decision = await service.resolve({ sessionId: 'd1', mode: 'deterministic' });

    expect(decision.metadata?.blend).toBeUndefined();
    expect(decision.metadata?.resolvedBy).toBeUndefined();
  });
});
