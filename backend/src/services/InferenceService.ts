import type { IEvent } from '../db/IDatabaseAdapter.js';
import {
  buildLockedModalityScores,
  countModalityEvents,
  type ModalityPersona,
} from '@dionysys/core';

export const PERSONAS = ['neutral', 'draw_first', 'text_first'] as const;
export type Persona = typeof PERSONAS[number];

export class InferenceService {
  static inferPersona(events: IEvent[]): Record<Persona, number> {
    const { drawCount, textCount } = countModalityEvents(events.map((event) => ({
      eventType: event.eventType,
    })));

    return buildLockedModalityScores(drawCount, textCount) as Record<ModalityPersona, number> as Record<Persona, number>;
  }
}
