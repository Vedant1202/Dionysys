import type { PersonalityResource } from '@dionysys/core';

const DRAW_TOOLS = ['selection', 'rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'eraser'];
const TEXT_TOOLS = ['selection', 'text', 'eraser'];

export const EXCALIDRAW_PERSONALITY_RESOURCES: PersonalityResource[] = [
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
    id: 'guided_novice',
    name: 'Guided Novice',
    description: 'A user who appears early in the workflow and benefits from fewer visible choices.',
    decisionHints: ['Low event volume', 'Low tool diversity', 'Slow start or recent inactivity'],
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
        {
          id: 'recent_inactivity',
          description: 'User paused after initial activity.',
          metric: 'timeSinceLastEventMs',
          operator: '>',
          value: 30_000,
          weight: 1,
        },
      ],
    },
    actions: [
      {
        id: 'show_guided_toolbar',
        description: 'Show a reduced toolbar and welcome guidance.',
        isSafeFallback: true,
        uiState: {
          variant: 'guided_novice',
          showWelcomeScreen: true,
          toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'text'] },
          canvasActions: {
            saveAsImage: false,
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
    id: 'draw_first',
    name: 'Draw First',
    description: 'A user who primarily creates shapes and freehand drawing elements.',
    decisionHints: ['Shape creation dominates', 'Recent element_drawn events', 'Low text-to-shape ratio'],
    scoring: {
      baseWeight: 1,
      signals: [
        {
          id: 'has_draw_events',
          description: 'User created at least one drawn element.',
          metric: 'eventCount',
          eventType: 'element_drawn',
          operator: '>=',
          value: 1,
          weight: 2,
        },
        {
          id: 'mostly_draw_events',
          description: 'Drawing events are most of the activity.',
          metric: 'eventRatio',
          eventType: 'element_drawn',
          operator: '>',
          value: 0.6,
          weight: 2,
        },
        {
          id: 'low_text_shape_ratio',
          description: 'User creates more shapes than text.',
          metric: 'textToShapeRatio',
          operator: '<',
          value: 0.5,
          weight: 1,
        },
      ],
    },
    actions: [
      {
        id: 'show_draw_toolbar',
        description: 'Prioritize shape and drawing tools.',
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
    decisionHints: ['Text events dominate', 'High text-to-shape ratio', 'Recent text_added events'],
    scoring: {
      baseWeight: 1,
      signals: [
        {
          id: 'has_text_events',
          description: 'User created at least one text element.',
          metric: 'eventCount',
          eventType: 'text_added',
          operator: '>=',
          value: 1,
          weight: 3,
        },
        {
          id: 'text_heavy_ratio',
          description: 'Text usage is high compared with shape usage.',
          metric: 'textToShapeRatio',
          operator: '>=',
          value: 1,
          weight: 2,
        },
        {
          id: 'recent_text_event',
          description: 'Text was used recently.',
          metric: 'recentEventType',
          operator: 'contains',
          value: 'text_added',
          weight: 1,
        },
      ],
    },
    actions: [
      {
        id: 'show_text_toolbar',
        description: 'Prioritize text and selection tools.',
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
  {
    id: 'power_user',
    name: 'Power User',
    description: 'A high-throughput user who benefits from the full advanced interface.',
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
        id: 'show_power_workspace',
        description: 'Expose the full advanced workspace.',
        uiState: {
          variant: 'power_user',
          showWelcomeScreen: false,
          toolbar: { mode: 'blocklist', tools: [] },
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
];
