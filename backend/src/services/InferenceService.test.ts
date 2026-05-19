import { describe, it, expect } from 'vitest';
import { InferenceService, PERSONAS } from '../services/InferenceService.js';
import type { IEvent } from '../db/IDatabaseAdapter.js';

// Helper to create a minimal IEvent
const makeEvent = (eventType: string, payload: any = {}, timestamp?: Date): IEvent => ({
  sessionId: 'test-session',
  eventType,
  timestamp: timestamp ?? new Date(),
  payload,
});

describe('InferenceService.inferPersona', () => {
  it('returns a full probability distribution over all modality personas', () => {
    const result = InferenceService.inferPersona([]);
    expect(Object.keys(result).sort()).toEqual([...PERSONAS].sort());
  });

  it('returns uniform probs (normalized to 1.0) when there are no events', () => {
    const result = InferenceService.inferPersona([]);
    const total = Object.values(result).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('stays neutral when there is only one draw event', () => {
    const events = [makeEvent('element_drawn', { type: 'rectangle' })];
    const result = InferenceService.inferPersona(events);
    expect(result.neutral).toBeGreaterThan(result.draw_first);
    expect(result.neutral).toBeGreaterThan(result.text_first);
  });

  it('boosts draw_first after drawing rectangle shapes', () => {
    const events = [
      makeEvent('element_drawn', { type: 'rectangle' }),
      makeEvent('element_drawn', { type: 'ellipse' }),
      makeEvent('element_drawn', { type: 'rectangle' }),
      makeEvent('element_drawn', { type: 'line' }),
      makeEvent('element_drawn', { type: 'rectangle' }),
    ];
    const result = InferenceService.inferPersona(events);
    expect(result.draw_first).toBeGreaterThan(result.text_first);
    expect(result.draw_first).toBeGreaterThan(result.neutral);
  });

  it('boosts text_first after text_added events', () => {
    const events = [
      makeEvent('text_added', { textValue: 'hello' }),
      makeEvent('text_added', { textValue: 'world' }),
      makeEvent('text_added', { textValue: 'foo' }),
      makeEvent('text_added', { textValue: 'bar' }),
      makeEvent('text_added', { textValue: 'baz' }),
    ];
    const result = InferenceService.inferPersona(events);
    expect(result.text_first).toBeGreaterThan(result.draw_first);
    expect(result.text_first).toBeGreaterThan(result.neutral);
  });

  it('always returns probabilities that sum to 1.0', () => {
    const events = [
      makeEvent('element_drawn', { type: 'rectangle' }),
      makeEvent('text_added', { textValue: 'hello' }),
      makeEvent('element_drawn', { type: 'freedraw' }),
    ];
    const result = InferenceService.inferPersona(events);
    const total = Object.values(result).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('all probabilities are between 0 and 1', () => {
    const events = [makeEvent('element_drawn', { type: 'line' })];
    const result = InferenceService.inferPersona(events);
    for (const [, v] of Object.entries(result)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('stays neutral for mixed single draw and single text sessions', () => {
    const result = InferenceService.inferPersona([
      makeEvent('element_drawn', { type: 'rectangle' }),
      makeEvent('text_added', { textValue: 'note' }),
    ]);

    expect(result.neutral).toBeGreaterThan(result.draw_first);
    expect(result.neutral).toBeGreaterThan(result.text_first);
  });
});
