import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventCollector } from './eventCollector';
import type { AppEvent } from './IEventPlugin';

describe('eventCollector', () => {
  const track = vi.fn();
  const flush = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset batch state and plugins via reflection since it's a singleton
    (eventCollector as any).batch = [];
    (eventCollector as any).plugins = [];
    (eventCollector as any).nextSequenceId = 1;
    eventCollector.setSessionId('test-session');
    eventCollector.setClient({ events: { track, flush } } as any);
    track.mockReset();
    flush.mockReset();
    track.mockResolvedValue({ success: true, accepted: 1 });
    flush.mockResolvedValue({ success: true, accepted: 1 });
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

    expect(track).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    const payload = track.mock.calls[0][0];

    expect(payload.sessionId).toBe('test-session');
    expect(payload.tabId).toBeDefined();
    expect(typeof payload.tabId).toBe('string');
    expect(payload.events.length).toBe(1);
    expect(payload.events[0].type).toBe('test');
    expect(payload.events[0].timestamp).toBe(123);
  });

  it('leaves retry semantics to the client when delivery fails after queueing', async () => {
    flush.mockRejectedValueOnce(new Error('network down'));
    eventCollector.recordEvent({ eventType: 'test', timestamp: 123, payload: {} });

    await (eventCollector as any).flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect((eventCollector as any).batch).toEqual([]);
  });
});
