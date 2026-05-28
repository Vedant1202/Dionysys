import { describe, it, expect } from 'vitest';
import type { DionysysEvent, DionysysSession, DionysysDecision, DionysysConnectorDecision, DionysysDecisionConnector, DionysysApiError } from './types.js';

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
