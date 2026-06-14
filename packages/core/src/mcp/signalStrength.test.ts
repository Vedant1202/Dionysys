import { describe, expect, it } from 'vitest';
import {
  classifySignal,
  countModalityEventTotal,
  isStrongSignal,
  scoreMargin,
  type GateThresholds,
} from './signalStrength.js';

const gate: GateThresholds = { lockMinEvents: 2, lockMargin: 0.15 };

describe('scoreMargin', () => {
  it('returns the normalized gap between the top two scores', () => {
    expect(scoreMargin({ neutral: 0.7, draw_first: 0.15, text_first: 0.15 })).toBeCloseTo(0.55, 5);
  });

  it('normalizes unnormalized scores by their sum', () => {
    expect(scoreMargin({ a: 3, b: 1 })).toBeCloseTo(0.5, 5);
  });

  it('is 0 for an exact tie', () => {
    expect(scoreMargin({ a: 0.5, b: 0.5 })).toBe(0);
  });

  it('is 1 for a single dominant score', () => {
    expect(scoreMargin({ a: 1 })).toBeCloseTo(1, 5);
  });

  it('is 0 for empty or all-zero scores', () => {
    expect(scoreMargin({})).toBe(0);
    expect(scoreMargin({ a: 0, b: 0 })).toBe(0);
  });
});

describe('countModalityEventTotal', () => {
  it('counts draw and text events, ignoring others', () => {
    const events = [
      { eventType: 'element_drawn' },
      { eventType: 'element_drawn' },
      { eventType: 'text_added' },
      { eventType: 'tool_selected' },
    ];
    expect(countModalityEventTotal(events)).toBe(3);
  });

  it('is 0 for no modality events', () => {
    expect(countModalityEventTotal([{ eventType: 'tool_selected' }])).toBe(0);
    expect(countModalityEventTotal([])).toBe(0);
  });
});

describe('isStrongSignal', () => {
  const confident = { neutral: 0.1, draw_first: 0.8, text_first: 0.1 };

  it('is STRONG at the event-count and margin thresholds', () => {
    expect(isStrongSignal(confident, 2, gate)).toBe(true);
  });

  it('is WEAK below the event-count threshold even with a clear winner', () => {
    expect(isStrongSignal(confident, 1, gate)).toBe(false);
  });

  it('is WEAK when the margin is below the threshold', () => {
    expect(isStrongSignal({ a: 0.55, b: 0.45 }, 10, gate)).toBe(false); // margin 0.10 < 0.15
  });

  it('is STRONG when the margin is at or above the threshold', () => {
    expect(isStrongSignal({ a: 0.6, b: 0.4 }, 10, gate)).toBe(true); // margin 0.20 >= 0.15
  });

  it('is WEAK for tied scores regardless of event volume', () => {
    expect(isStrongSignal({ a: 0.5, b: 0.5 }, 50, gate)).toBe(false);
  });

  it('is WEAK with zero events', () => {
    expect(isStrongSignal(confident, 0, gate)).toBe(false);
  });
});

describe('classifySignal', () => {
  it('maps to the strong/weak label', () => {
    expect(classifySignal({ neutral: 0.1, draw_first: 0.8, text_first: 0.1 }, 2, gate)).toBe('strong');
    expect(classifySignal({ a: 0.5, b: 0.5 }, 2, gate)).toBe('weak');
  });
});
