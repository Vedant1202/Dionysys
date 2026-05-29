import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memoryStorage.js';
import { EventService, EventValidationError, MAX_EVENT_BATCH_SIZE } from './EventService.js';

describe('EventService', () => {
  it('stores batch events with session and batch metadata', async () => {
    const storage = createMemoryStorage();
    const service = new EventService(storage);

    const result = await service.track({
      sessionId: 's1',
      tabId: 'tab-1',
      events: [
        { type: 'element_drawn', payload: { shape: 'rectangle' } },
        { type: 'text_added', metadata: { source: 'test' } },
      ],
    });

    const events = await storage.getEventsBySession('s1');
    expect(result.accepted).toBe(2);
    expect(events[0]?.metadata?.tabId).toBe('tab-1');
    expect(events[0]?.metadata?.sequenceId).toBe(1);
    expect(events[1]?.metadata?.source).toBe('test');
  });

  it('stores a single event', async () => {
    const storage = createMemoryStorage();
    const service = new EventService(storage);

    await service.track({
      sessionId: 's2',
      event: { type: 'ui.interaction', subject: 'toolbar.text', action: 'selected' },
    });

    const events = await storage.getEventsBySession('s2');
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('ui.interaction');
  });

  it('rejects invalid events', async () => {
    const storage = createMemoryStorage();
    const service = new EventService(storage);

    await expect(service.track({
      sessionId: 's3',
      events: [{ type: '' }],
    })).rejects.toBeInstanceOf(EventValidationError);
  });

  it('rejects oversized batches', async () => {
    const storage = createMemoryStorage();
    const service = new EventService(storage);

    await expect(service.track({
      sessionId: 's4',
      events: Array.from({ length: MAX_EVENT_BATCH_SIZE + 1 }, () => ({ type: 'ui.interaction' })),
    })).rejects.toBeInstanceOf(EventValidationError);
  });
});
