import type { IEvent } from '../db/IDatabaseAdapter.js';
export declare const PERSONAS: readonly ["neutral", "draw_first", "text_first", "guided_novice", "power_user"];
export type Persona = typeof PERSONAS[number];
export declare class InferenceService {
    /**
     * Evaluates the list of events and returns a probability distribution
     * over the defined personas.
     */
    static inferPersona(events: IEvent[]): Record<Persona, number>;
    private static normalize;
}
//# sourceMappingURL=InferenceService.d.ts.map