import type { IEvent } from '../db/IDatabaseAdapter.js';
import { InferenceEngine } from '@dionysys/core';

export const PERSONAS = ['neutral', 'draw_first', 'text_first', 'guided_novice', 'power_user'] as const;
export type Persona = typeof PERSONAS[number];

// Instantiate the modular engine using the specific logic for the Excalidraw POC
export const drawingAppInferenceEngine = new InferenceEngine({
  personas: [...PERSONAS],
  initialCounts: {
    neutral: 1,
    draw_first: 1,
    text_first: 1,
    guided_novice: 1,
    power_user: 1
  },
  eventWeights: {
    element_drawn: (payload: any) => {
      const type = payload?.type;
      if (['rectangle', 'ellipse', 'diamond', 'line', 'freedraw'].includes(type)) {
        return { draw_first: 2 };
      }
      return {};
    },
    text_added: { text_first: 3 }
  },
  heuristics: [
    (events) => {
      if (events.length < 5) return { guided_novice: 2 }; // slow starter
      return {};
    }
  ]
});

export class InferenceService {
  static inferPersona(events: IEvent[]): Record<Persona, number> {
    const rawEvents = events.map(e => ({
      eventType: e.eventType,
      payload: e.payload,
      timestamp: e.timestamp?.getTime() || Date.now()
    }));
    return drawingAppInferenceEngine.inferPersona(rawEvents) as Record<Persona, number>;
  }
}

