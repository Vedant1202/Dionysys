export const PERSONAS = ['neutral', 'draw_first', 'text_first', 'guided_novice', 'power_user'];
export class InferenceService {
    /**
     * Evaluates the list of events and returns a probability distribution
     * over the defined personas.
     */
    static inferPersona(events) {
        // Initial uniform distribution (prior)
        let counts = {
            neutral: 1,
            draw_first: 1,
            text_first: 1,
            guided_novice: 1,
            power_user: 1,
        };
        // Very simple heuristics for POC
        if (events.length === 0) {
            return this.normalize(counts);
        }
        if (events.length < 5) {
            counts.guided_novice += 2; // slow starter
        }
        // Process events
        for (const evt of events) {
            if (evt.eventType === 'element_drawn') {
                const type = evt.payload?.type;
                // text elements are handled via text_added events from DrawingPlugin
                if (['rectangle', 'ellipse', 'diamond', 'line', 'freedraw'].includes(type)) {
                    counts.draw_first += 2;
                }
            }
            if (evt.eventType === 'text_added') {
                counts.text_first += 3;
            }
        }
        return this.normalize(counts);
    }
    static normalize(counts) {
        const total = PERSONAS.reduce((sum, p) => sum + counts[p], 0);
        const probs = {};
        for (const p of PERSONAS) {
            probs[p] = counts[p] / total;
        }
        return probs;
    }
}
//# sourceMappingURL=InferenceService.js.map