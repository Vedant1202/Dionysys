export const MODALITY_PERSONAS = ['neutral', 'draw_first', 'text_first'] as const;
export const EXPERTISE_PERSONAS = ['novice', 'standard', 'power_user'] as const;

export type ModalityPersona = typeof MODALITY_PERSONAS[number];
export type ExpertisePersona = typeof EXPERTISE_PERSONAS[number];

const TEXT_EVENT_TYPES = new Set(['text_added', 'text_created', 'text_updated']);

export function composeUiVariant(
  modality: ModalityPersona,
  expertise: ExpertisePersona,
): string {
  return expertise === 'standard' ? modality : `${modality}__${expertise}`;
}

export function getTopScoredKey<T extends string>(
  scores: Record<string, number>,
  fallback: T,
): T {
  return (
    Object.entries(scores)
      .sort((left, right) => right[1] - left[1])[0]?.[0] as T | undefined
  ) ?? fallback;
}

export function emptyScoreMap<T extends readonly string[]>(
  personas: T,
): Record<T[number], number> {
  return Object.fromEntries(personas.map((persona) => [persona, 0])) as Record<T[number], number>;
}

export function splitComposedUiVariant(variant: string): {
  modality: ModalityPersona;
  expertise: ExpertisePersona;
} {
  const [modalityPart, expertisePart] = variant.split('__');
  const modality = isModalityPersona(modalityPart) ? modalityPart : 'neutral';
  const expertise = isExpertisePersona(expertisePart) ? expertisePart : 'standard';
  return { modality, expertise };
}

export function isModalityPersona(value: string | undefined): value is ModalityPersona {
  return Boolean(value && MODALITY_PERSONAS.includes(value as ModalityPersona));
}

export function isExpertisePersona(value: string | undefined): value is ExpertisePersona {
  return Boolean(value && EXPERTISE_PERSONAS.includes(value as ExpertisePersona));
}

export function resolveLockedModality(drawCount: number, textCount: number): ModalityPersona {
  if (drawCount >= 2 && drawCount >= textCount) return 'draw_first';
  if (textCount >= 2 && textCount >= drawCount) return 'text_first';
  return 'neutral';
}

export function buildLockedModalityScores(drawCount: number, textCount: number): Record<ModalityPersona, number> {
  const locked = resolveLockedModality(drawCount, textCount);

  switch (locked) {
    case 'draw_first':
      return { neutral: 0.1, draw_first: 0.8, text_first: 0.1 };
    case 'text_first':
      return { neutral: 0.1, draw_first: 0.1, text_first: 0.8 };
    default:
      return { neutral: 0.7, draw_first: 0.15, text_first: 0.15 };
  }
}

export function countModalityEvents(events: Array<{ eventType: string }>): {
  drawCount: number;
  textCount: number;
} {
  return events.reduce((counts, event) => {
    if (event.eventType === 'element_drawn') {
      counts.drawCount += 1;
    } else if (TEXT_EVENT_TYPES.has(event.eventType)) {
      counts.textCount += 1;
    }
    return counts;
  }, { drawCount: 0, textCount: 0 });
}
