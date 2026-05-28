import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventCollector } from './eventCollector';
import type { AppEvent } from './IEventPlugin';

describe('eventCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset batch state and plugins via reflection since it's a singleton
    (eventCollector as any).batch = [];
    (eventCollector as any).plugins = [];
    (eventCollector as any).nextSequenceId = 1;
    eventCollector.setSessionId('test-session');
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('assigns a unique monotonic sequenceId to every event', () => {
    eventCollector.recordEvent({ eventType: 'test', timestamp: 123, payload: {} });
    eventCollector.recordEvent({ eventType: 'test', timestamp: 124, payload: {} });

    const batch = (eventCollector as any).batch as AppEvent[];
    expect(batch[0].sequenceId).toBe(1);
    expect(batch[1].sequenceId).toBe(2);
  });

  it('drops the oldest events when queue exceeds 1000 items', () => {
    for (let i = 0; i < 1005; i++) {
      eventCollector.recordEvent({
        eventType: 'spam',
        timestamp: i,
        payload: { i }
      });
    }

    const batch = (eventCollector as any).batch as AppEvent[];
    expect(batch.length).toBe(1000);
    expect(batch[0].sequenceId).toBe(6); // First 5 were dropped
    expect(batch[999].sequenceId).toBe(1005);
  });

  it('attaches tabId and sequenceId to flushed payloads', async () => {
    eventCollector.recordEvent({ eventType: 'test', timestamp: 123, payload: {} });
    
    // Trigger flush
    await (eventCollector as any).flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    expect(body.sessionId).toBe('test-session');
    expect(body.tabId).toBeDefined();
    expect(typeof body.tabId).toBe('string');
    expect(body.events.length).toBe(1);
    expect(body.events[0].sequenceId).toBe(1);
  });
});
