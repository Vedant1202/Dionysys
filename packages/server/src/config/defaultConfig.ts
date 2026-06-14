import type { AdminConsoleConfig } from '@dionysys/core';

export function createDefaultDionysysConfig(): AdminConsoleConfig {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    mode: {
      defaultMode: 'deterministic',
      presentationMode: 'prototype',
      decisionApplication: 'immediate',
      persistenceMode: 'browser',
      minEventsBeforeLock: 5,
      pollingIntervalMs: 3000,
    },
    deterministic: {
      axes: {
        modality: {
          personas: ['neutral', 'draw_first', 'text_first'],
          initialCounts: {
            neutral: 1,
            draw_first: 1,
            text_first: 1,
          },
          eventRules: [
            {
              id: 'draw_event_rule',
              description: 'Drawing activity implies draw-first modality.',
              eventType: 'element_drawn',
              weights: { draw_first: 2 },
              enabled: true,
            },
            {
              id: 'text_event_rule',
              description: 'Text activity implies text-first modality.',
              eventType: 'text_added',
              weights: { text_first: 2 },
              enabled: true,
            },
          ],
          heuristics: [],
        },
        expertise: {
          personas: ['novice', 'standard', 'power_user'],
          initialCounts: {
            novice: 1,
            standard: 1,
            power_user: 1,
          },
          eventRules: [],
          heuristics: [],
        },
      },
      policy: {
        epsilon: 0,
      },
    },
    mcp: {
      axes: {
        modalityResources: [
          {
            id: 'neutral',
            name: 'Neutral',
            description: 'Default balanced UI state.',
            scoring: {
              baseWeight: 1,
              signals: [],
            },
            actions: [
              {
                id: 'show_neutral_workspace',
                description: 'Show the default UI.',
                isSafeFallback: true,
                uiState: {
                  variant: 'neutral',
                },
              },
            ],
          },
          {
            id: 'draw_first',
            name: 'Draw First',
            description: 'A user showing drawing-oriented behavior.',
            scoring: {
              baseWeight: 1,
              signals: [
                {
                  id: 'draw_event_count',
                  description: 'Drawing events occurred.',
                  metric: 'eventCount',
                  eventType: 'element_drawn',
                  operator: '>=',
                  value: 1,
                  weight: 2,
                },
              ],
            },
            actions: [
              {
                id: 'show_draw_workspace',
                description: 'Prioritize drawing affordances.',
                isSafeFallback: true,
                uiState: {
                  variant: 'draw_first',
                },
              },
            ],
          },
          {
            id: 'text_first',
            name: 'Text First',
            description: 'A user showing text-oriented behavior.',
            scoring: {
              baseWeight: 1,
              signals: [
                {
                  id: 'text_event_count',
                  description: 'Text events occurred.',
                  metric: 'eventCount',
                  eventType: 'text_added',
                  operator: '>=',
                  value: 1,
                  weight: 2,
                },
              ],
            },
            actions: [
              {
                id: 'show_text_workspace',
                description: 'Prioritize text affordances.',
                isSafeFallback: true,
                uiState: {
                  variant: 'text_first',
                },
              },
            ],
          },
        ],
        expertiseResources: [
          {
            id: 'standard',
            name: 'Standard',
            description: 'Default expertise overlay.',
            scoring: {
              baseWeight: 1,
              signals: [],
            },
            actions: [
              {
                id: 'apply_standard_overlay',
                description: 'Keep the base UI unchanged.',
                isSafeFallback: true,
                uiState: {
                  variant: 'standard',
                },
              },
            ],
          },
        ],
      },
      minConfidence: 0.3,
      fallbackVariant: 'neutral',
      gate: {
        lockMinEvents: 2,
        lockMargin: 0.15,
      },
      bandit: {
        enabled: true,
        banditEvidenceK: 3,
        priorAlpha: 1,
        priorBeta: 1,
        keepReward: 1,
        revertReward: 0,
        passiveRewardWeight: 0.25,
        decay: {
          enabled: true,
          effectiveWindow: 200,
        },
      },
    },
    ui: {
      supportedTools: [],
      supportedMenuItems: [],
    },
    feedbackWeights: {
      creationWeight: 3,
      textAdditionWeight: 3,
      modificationWeight: 1,
      deletionPenalty: 2,
      hiddenToolPenalty: 3,
    },
    componentEmbeddings: {},
  };
}
