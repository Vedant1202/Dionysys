import { describe, it, expect } from 'vitest';
import type { DionysysEvent, DionysysSession, DionysysDecision, DionysysConnectorDecision, DionysysDecisionConnector, DionysysApiError } from './types.js';
import { DionysysConnectorDecisionSchema } from './schemas.js';

describe('contracts types', () => {
  it('should compile valid types', () => {
    const event: DionysysEvent = {
      type: 'ui.interaction',
      subject: 'button',
      action: 'click',
      payload: { id: 'btn-1' },
    };
    
    expect(event.type).toBe('ui.interaction');

    const session: DionysysSession = {
      id: 'session-1',
    };
    
    expect(session.id).toBe('session-1');
  });
});

describe('contracts schemas', () => {
  describe('DionysysConnectorDecisionSchema', () => {
    it('accepts valid connector output', () => {
      const result = DionysysConnectorDecisionSchema.safeParse({
        personaId: 'expert',
        actionId: 'advanced_ui',
        confidence: 0.8,
      });
      expect(result.success).toBe(true);
    });

    it('rejects confidence > 1', () => {
      const result = DionysysConnectorDecisionSchema.safeParse({
        personaId: 'expert',
        actionId: 'advanced_ui',
        confidence: 1.1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects confidence < 0', () => {
      const result = DionysysConnectorDecisionSchema.safeParse({
        personaId: 'expert',
        actionId: 'advanced_ui',
        confidence: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing fields', () => {
      const result = DionysysConnectorDecisionSchema.safeParse({
        personaId: 'expert',
        confidence: 0.5,
      });
      expect(result.success).toBe(false);
    });
  });
});
