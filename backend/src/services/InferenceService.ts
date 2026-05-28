import type { IEvent } from '../db/IDatabaseAdapter.js';
import {
  buildLockedModalityScores,
  countModalityEvents,
  MODALITY_PERSONAS,
  type ModalityPersona,
} from '@dionysys/core';

export const PERSONAS = MODALITY_PERSONAS;
export type Persona = ModalityPersona;

export class InferenceService {
  static inferPersona(events: IEvent[]): Record<Persona, number> {
    const { drawCount, textCount } = countModalityEvents(events.map((event) => ({
      eventType: event.eventType,
    })));

    return buildLockedModalityScores(drawCount, textCount) as Record<ModalityPersona, number> as Record<Persona, number>;
  }
}
