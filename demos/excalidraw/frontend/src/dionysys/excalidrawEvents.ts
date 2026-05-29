import type { DionysysEvent } from '@dionysys/core';
import type { AppEvent } from '../core/IEventPlugin';

export function toDionysysEvent(event: AppEvent): DionysysEvent {
  return {
    type: event.eventType,
    timestamp: event.timestamp,
    payload: event.payload,
  };
}
