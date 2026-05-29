import type { DionysysDecisionInput } from '@dionysys/server';

export type AnthropicPromptBuilder = (input: DionysysDecisionInput) => string;

export const defaultAnthropicInstructions =
  'You are the Dionysys adaptive UI decision engine. Select exactly one valid personality and action.';

export const defaultAnthropicPromptBuilder: AnthropicPromptBuilder = (input) => {
  const personalities = input.personalities ?? [];
  const personalitiesByAxis = input.personalitiesByAxis ?? {};

  return [
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
