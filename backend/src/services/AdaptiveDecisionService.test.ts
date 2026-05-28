import { describe, expect, it } from 'vitest';
import type { LLMDecisionConnector, LLMDecisionInput } from '@dionysys/core';
import type { IEvent } from '../db/IDatabaseAdapter.js';
import { resolveAdaptiveDecisionForEvents } from './AdaptiveDecisionService.js';
import * as FeedbackBetaService from './FeedbackBetaService.js';
import { BanditService } from './BanditService.js';
import { vi } from 'vitest';

const makeEvent = (eventType: string, payload: unknown, timestampMs: number): IEvent => ({
  sessionId: 'test-session',
  eventType,
  payload,
  timestamp: new Date(timestampMs),
});

describe('resolveAdaptiveDecisionForEvents', () => {
  it('returns an existing policy-style decision for deterministic mode', async () => {
    const decision = await resolveAdaptiveDecisionForEvents('deterministic', [
      makeEvent('element_drawn', { type: 'rectangle' }, 1_000),
    ]);

    expect(decision.mode).toBe('deterministic');
    expect(decision.variant).toBeTruthy();
    expect(decision.personaScores).toHaveProperty('draw_first');
  });

  it('blends persona scores with bandit parameters when beta feedback is enabled', async () => {
    const betaSpy = vi.spyOn(FeedbackBetaService, 'isAdaptiveFeedbackBetaEnabled').mockReturnValue(true);
    const banditSpy = vi.spyOn(BanditService, 'blendPersonaScores').mockResolvedValue({
      draw_first: 0.9,
      text_first: 0.1,
    });

    const decision = await resolveAdaptiveDecisionForEvents('deterministic', [
      makeEvent('element_drawn', { type: 'rectangle' }, 1_000),
    ]);

    expect(decision.mode).toBe('deterministic');
    expect(decision.variant).toBeTruthy();
    expect(banditSpy).toHaveBeenCalled();
    
    betaSpy.mockRestore();
    banditSpy.mockRestore();
  });

  it('passes summarized interactions and persona scores to the MCP connector', async () => {
    let capturedInput: LLMDecisionInput | null = null;
    const connector: LLMDecisionConnector = {
      decide: async (input) => {
        capturedInput = input;
        return {
          personalityId: 'text_first',
          actionId: 'show_text_toolbar',
          confidence: 0.86,
          rationale: 'Text event is the clearest signal.',
        };
      },
    };

    const decision = await resolveAdaptiveDecisionForEvents('mcp', [
      makeEvent('text_added', { type: 'text', textValue: 'do not send raw text' }, 1_000),
      makeEvent('text_added', { type: 'text', textValue: 'second signal' }, 1_010),
    ], connector);

    if (decision.mode !== 'mcp') {
      throw new Error('Expected MCP decision');
    }

    const connectorInput = capturedInput as unknown as LLMDecisionInput;

    expect(decision.mode).toBe('mcp');
    expect(decision.variant).toBe('text_first__novice');
    expect(decision.confidence).toBe(0.86);
    expect(connectorInput.personaScores).toHaveProperty('text_first');
    expect(connectorInput.interactionSummary.recentEvents[0]?.payload).not.toHaveProperty('textValue');
  });

  it('falls back to a resource UI state when the connector returns an invalid action', async () => {
    const connector: LLMDecisionConnector = {
      decide: async () => ({
        personalityId: 'guided_novice',
        actionId: 'missing',
        confidence: 0.9,
      }),
    };

    const decision = await resolveAdaptiveDecisionForEvents('mcp', [
      makeEvent('element_drawn', { type: 'rectangle' }, 1_000),
      makeEvent('element_drawn', { type: 'ellipse' }, 1_010),
    ], connector);

    if (decision.mode !== 'mcp') {
      throw new Error('Expected MCP decision');
    }

    expect(decision.mode).toBe('mcp');
    expect(decision.isFallback).toBe(true);
    expect(decision.selectedModality).toBe('draw_first');
    expect(decision.selectedExpertise).toBe('novice');
    expect(decision.uiState.variant).toBe(decision.variant);
  });

  it('accepts the default mock MCP decision with a non-zero confidence', async () => {
    const decision = await resolveAdaptiveDecisionForEvents('mcp', [
      makeEvent('text_added', { type: 'text', textValue: 'session note' }, 1_000),
    ]);

    if (decision.mode !== 'mcp') {
      throw new Error('Expected MCP decision');
    }

    expect(decision.isFallback).toBe(false);
    expect(decision.confidence).toBeGreaterThan(0.3);
  });
});
