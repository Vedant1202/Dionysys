import type { PersonalityResource, PersonalityResourcesByAxis } from '@dionysys/core';

const DRAW_TOOLS = ['selection', 'rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'eraser'];
const TEXT_TOOLS = ['selection', 'text', 'eraser'];

export const EXCALIDRAW_MCP_RESOURCES_BY_AXIS: PersonalityResourcesByAxis = {
  modalityResources: [
    {
      id: 'neutral',
      name: 'Neutral Baseline',
      description: 'A balanced user profile that should receive the full default Excalidraw experience.',
      decisionHints: ['Use when behavior is sparse, mixed, or ambiguous.'],
      scoring: {
        baseWeight: 1,
        signals: [],
      },
      actions: [
        {
          id: 'show_neutral_workspace',
          description: 'Show the full baseline workspace.',
          isSafeFallback: true,
          uiState: {
            variant: 'neutral',
            showWelcomeScreen: false,
            toolbar: { mode: 'blocklist', tools: [] },
            canvasActions: {
              saveAsImage: true,
              clearCanvas: true,
              toggleTheme: true,
            },
            mainMenu: { allowedItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'] },
            mainMenuItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'],
          },
        },
      ],
    },
    {
      id: 'draw_first',
      name: 'Draw First',
      description: 'A user who primarily creates shapes and freehand drawing elements.',
      decisionHints: ['At least two drawing events', 'Drawing is not outnumbered by text'],
      scoring: {
        baseWeight: 1,
        signals: [
          {
            id: 'draw_lock_threshold',
            description: 'Drawing reached the two-signal threshold.',
            metric: 'eventCount',
            eventType: 'element_drawn',
            operator: '>=',
            value: 2,
            weight: 4,
          },
          {
            id: 'draw_dominant_ratio',
            description: 'Drawing is a majority of current activity.',
            metric: 'eventRatio',
            eventType: 'element_drawn',
            operator: '>=',
            value: 0.5,
            weight: 2,
          },
        ],
      },
      actions: [
        {
          id: 'show_draw_toolbar',
          description: 'Prioritize shape and drawing tools.',
          isSafeFallback: true,
          uiState: {
            variant: 'draw_first',
            showWelcomeScreen: false,
            toolbar: { mode: 'allowlist', tools: DRAW_TOOLS },
            canvasActions: {
              saveAsImage: true,
              clearCanvas: true,
            },
            mainMenu: { allowedItems: ['saveAsImage', 'export', 'clearCanvas'] },
            mainMenuItems: ['saveAsImage', 'export', 'clearCanvas'],
          },
        },
      ],
    },
    {
      id: 'text_first',
      name: 'Text First',
      description: 'A user who primarily creates text and annotation elements.',
      decisionHints: ['At least two text events', 'Text is not outnumbered by drawing'],
      scoring: {
        baseWeight: 1,
        signals: [
          {
            id: 'text_lock_threshold',
            description: 'Text reached the two-signal threshold.',
            metric: 'eventCount',
            eventType: 'text_added',
            operator: '>=',
            value: 2,
            weight: 4,
          },
          {
            id: 'text_dominant_ratio',
            description: 'Text is a majority of current activity.',
            metric: 'textToShapeRatio',
            operator: '>=',
            value: 1,
            weight: 2,
          },
        ],
      },
      actions: [
        {
          id: 'show_text_toolbar',
          description: 'Prioritize text and selection tools.',
          isSafeFallback: true,
          uiState: {
            variant: 'text_first',
            showWelcomeScreen: false,
            toolbar: { mode: 'allowlist', tools: TEXT_TOOLS },
            canvasActions: {
              toggleTheme: true,
            },
            mainMenu: { allowedItems: ['help', 'toggleTheme'] },
            mainMenuItems: ['help', 'toggleTheme'],
          },
        },
      ],
    },
  ],
  expertiseResources: [
    {
      id: 'novice',
      name: 'Novice Overlay',
      description: 'Applies guidance and reduces advanced surface area for early users.',
      decisionHints: ['Low event volume', 'Low tool diversity', 'No sustained activity yet'],
      scoring: {
        baseWeight: 1,
        signals: [
          {
            id: 'low_event_volume',
            description: 'User has not generated many events yet.',
            metric: 'totalEvents',
            operator: '<',
            value: 5,
            weight: 3,
          },
          {
            id: 'low_tool_diversity',
            description: 'User has used very few interaction types.',
            metric: 'toolDiversity',
            operator: '<=',
            value: 2,
            weight: 2,
          },
        ],
      },
      actions: [
        {
          id: 'apply_novice_overlay',
          description: 'Reduce UI complexity and show guidance.',
          isSafeFallback: true,
          uiState: {
            variant: 'novice',
            showWelcomeScreen: true,
            canvasActions: {
              saveAsImage: false,
              saveToActiveFile: false,
              clearCanvas: false,
              toggleTheme: false,
            },
            mainMenu: { allowedItems: ['help'] },
            mainMenuItems: ['help'],
          },
        },
      ],
    },
    {
      id: 'standard',
      name: 'Standard Overlay',
      description: 'Leaves the base modality experience unchanged.',
      decisionHints: ['Default expertise level when neither novice nor power-user signals dominate'],
      scoring: {
        baseWeight: 1,
        signals: [],
      },
      actions: [
        {
          id: 'apply_standard_overlay',
          description: 'Preserve the base modality interface.',
          isSafeFallback: true,
          uiState: {
            variant: 'standard',
          },
        },
      ],
    },
    {
      id: 'power_user',
      name: 'Power User Overlay',
      description: 'Applies advanced controls for high-throughput users.',
      decisionHints: ['High event volume', 'High tool diversity', 'Fast first action'],
      scoring: {
        baseWeight: 1,
        signals: [
          {
            id: 'high_event_volume',
            description: 'User has generated many events.',
            metric: 'totalEvents',
            operator: '>=',
            value: 8,
            weight: 3,
          },
          {
            id: 'high_tool_diversity',
            description: 'User has used many interaction types.',
            metric: 'toolDiversity',
            operator: '>=',
            value: 4,
            weight: 2,
          },
          {
            id: 'fast_first_action',
            description: 'User acted quickly after session start.',
            metric: 'timeToFirstEventMs',
            operator: '<',
            value: 10_000,
            weight: 1,
          },
        ],
      },
      actions: [
        {
          id: 'apply_power_overlay',
          description: 'Expose advanced workspace actions.',
          isSafeFallback: true,
          uiState: {
            variant: 'power_user',
            showWelcomeScreen: false,
            canvasActions: {
              saveAsImage: true,
              saveToActiveFile: true,
              clearCanvas: true,
              toggleTheme: true,
            },
            mainMenu: { allowedItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'] },
            mainMenuItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'],
          },
        },
      ],
    },
  ],
};

export const EXCALIDRAW_PERSONALITY_RESOURCES: PersonalityResource[] = EXCALIDRAW_MCP_RESOURCES_BY_AXIS.modalityResources;
