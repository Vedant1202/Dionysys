import type { DionysysDecisionInput } from '@dionysys/server';

export type GeminiPromptBuilder = (input: DionysysDecisionInput) => string;

export const defaultGeminiInstructions =
  'You are the Dionysys adaptive UI decision engine. Return only the JSON object requested by the schema.';

export const defaultGeminiPromptBuilder: GeminiPromptBuilder = (input) => {
  const personalities = input.personalities ?? [];
  const personalitiesByAxis = input.personalitiesByAxis ?? {};

  return [
    defaultGeminiInstructions,
    'Select the best personality and action for the session.',
    `Personalities: ${JSON.stringify(personalities)}`,
    `Personalities by axis: ${JSON.stringify(personalitiesByAxis)}`,
    `Interaction summary: ${JSON.stringify(input.interactionSummary ?? null)}`,
    `Persona scores: ${JSON.stringify(input.personaScores ?? {})}`,
    `Modality scores: ${JSON.stringify(input.modalityScores ?? {})}`,
    `Expertise scores: ${JSON.stringify(input.expertiseScores ?? {})}`,
    `Selected modality: ${JSON.stringify(input.selectedModality ?? null)}`,
    `Selected expertise: ${JSON.stringify(input.selectedExpertise ?? null)}`,
    `Composed UI variant: ${JSON.stringify(input.composedUiVariant ?? null)}`,
  ].join('\n');
};
