import type { DionysysEvent } from '@dionysys/core';

export const DEFAULT_EVENT_BUFFER_LIMIT = 1000;
export const MAX_EVENT_FLUSH_BATCH_SIZE = 1000;

type BufferedEvent = {
  sessionId: string;
  tabId?: string;
  event: DionysysEvent;
};

type BufferedEventBatch = {
  sessionId: string;
  tabId?: string;
  events: DionysysEvent[];
};

export class EventBuffer {
  private queue: BufferedEvent[] = [];

  constructor(private readonly limit = DEFAULT_EVENT_BUFFER_LIMIT) {}

  enqueue(entries: BufferedEvent[]): number {
    for (const entry of entries) {
      this.queue.push(entry);
      if (this.queue.length > this.limit) {
        this.queue.shift();
      }
    }

    return entries.length;
  }

  drainNextBatch(): { batch: BufferedEventBatch; entries: BufferedEvent[] } | undefined {
    const first = this.queue[0];
    if (!first) return undefined;

    let count = 0;
    while (
      count < this.queue.length &&
      count < MAX_EVENT_FLUSH_BATCH_SIZE &&
      this.queue[count]?.sessionId === first.sessionId &&
      this.queue[count]?.tabId === first.tabId
    ) {
      count += 1;
    }

    const entries = this.queue.splice(0, count);
    return {
      entries,
      batch: {
        sessionId: first.sessionId,
        ...(first.tabId ? { tabId: first.tabId } : {}),
        events: entries.map((entry) => entry.event),
      },
    };
  }

  prepend(entries: BufferedEvent[]): void {
    this.queue = [...entries, ...this.queue].slice(0, this.limit);
  }
}

export function normalizeTrackedEvents(
  input:
    | {
        sessionId: string;
        tabId?: string;
        events: DionysysEvent[];
      }
    | {
        sessionId?: string;
        tabId?: string;
        event: DionysysEvent;
      },
  defaultTabId?: string,
): BufferedEvent[] {
  if ('events' in input) {
    return input.events.map((event) => ({
      sessionId: input.sessionId,
      ...(input.tabId ?? defaultTabId ? { tabId: input.tabId ?? defaultTabId } : {}),
      event,
    }));
  }

  const sessionId = input.sessionId ?? input.event.sessionId;
  if (!sessionId) {
    throw new Error('Dionysys event tracking requires a sessionId.');
  }

  return [{
    sessionId,
    ...(input.tabId ?? defaultTabId ? { tabId: input.tabId ?? defaultTabId } : {}),
    event: input.event,
  }];
}
