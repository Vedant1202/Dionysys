import { DionysysEventSchema, type DionysysEvent } from '@dionysys/core';
import type { DionysysStorage } from '../storage/types.js';

export const MAX_EVENT_BATCH_SIZE = 1000;

export type TrackEventsInput =
  | {
      sessionId: string;
      tabId?: string;
      events: DionysysEvent[];
    }
  | {
      sessionId?: string;
      event: DionysysEvent;
    };

export class EventValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = 'EventValidationError';
  }
}

export class EventService {
  constructor(private readonly storage: DionysysStorage) {}

  async track(input: TrackEventsInput): Promise<{ accepted: number }> {
    const events = normalizeInput(input);

    if (events.length > MAX_EVENT_BATCH_SIZE) {
      throw new EventValidationError(`Event batch exceeds ${MAX_EVENT_BATCH_SIZE} events`);
    }

    const validated = events.map((event) => {
      const parsed = DionysysEventSchema.safeParse(event);
      if (!parsed.success) {
        throw new EventValidationError('Invalid event envelope', parsed.error.issues);
      }
      return parsed.data;
    });

    await this.storage.saveEvents(validated);
    return { accepted: validated.length };
  }
}

function normalizeInput(input: TrackEventsInput): DionysysEvent[] {
  if ('events' in input) {
    return input.events.map((event, index) => withBatchMetadata(event, input.sessionId, input.tabId, index + 1));
  }

  return [withBatchMetadata(input.event, input.sessionId ?? input.event.sessionId, undefined, undefined)];
}

function withBatchMetadata(
  event: DionysysEvent,
  sessionId: string | undefined,
  tabId: string | undefined,
  sequenceId: number | undefined,
): DionysysEvent {
  return {
    ...event,
    sessionId: event.sessionId ?? sessionId,
    timestamp: event.timestamp ?? Date.now(),
    metadata: {
      ...(event.metadata ?? {}),
      ...(tabId ? { tabId } : {}),
      ...(sequenceId !== undefined ? { sequenceId } : {}),
    },
  };
}
