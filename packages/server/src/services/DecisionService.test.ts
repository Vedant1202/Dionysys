import { describe, expect, it } from 'vitest';
import { createDefaultDionysysConfig } from '../config/defaultConfig.js';
import { mockConnector } from '../connectors/mockConnector.js';
import { createMemoryStorage } from '../storage/memoryStorage.js';
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
            personalityId: 'unknown',
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
});
