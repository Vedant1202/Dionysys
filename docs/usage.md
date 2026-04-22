# Package Usage Guide

This guide shows how to use the Dionysys packages outside the Excalidraw demo. Use `@dionysys/core` on the server or in framework-neutral logic, and use `@dionysys/react` to expose adaptive state to a React UI.

## What the Packages Provide

- `@dionysys/core`: inference, policy selection, rewards, MCP-style personality resources, interaction summarization, persona scoring, and MCP decision resolution.
- `@dionysys/react`: `<AdaptiveProvider />`, `useAdaptiveUI()`, and `<AdminConsole />` for storing adaptive state and optionally editing runtime experiment configuration from a package-owned UI.

The package supports two modes:

- `deterministic`: events are scored by `InferenceEngine`, then `PolicyEngine` selects a variant.
- `mcp`: validated personality resources define scoring rules and UI actions; the resolver summarizes events, computes persona scores, calls a configurable LLM connector, and returns an action-backed UI state.

## Install or Link

Inside this monorepo, the packages are npm workspaces:

```bash
npm install
npm run build --workspace=packages/core
npm run build --workspace=packages/react
```

In another app, install the package names once they are published, or link/build them from this workspace during local development.

## Deterministic Mode

Use deterministic mode when you want repeatable inference and policy selection with no LLM decision step.

```ts
import { InferenceEngine, PolicyEngine } from '@dionysys/core';

const inference = new InferenceEngine({
  personas: ['neutral', 'draw_first', 'text_first'],
  initialCounts: {
    neutral: 1,
    draw_first: 1,
    text_first: 1,
  },
  eventWeights: {
    element_drawn: { draw_first: 2 },
    text_added: { text_first: 3 },
  },
});

const policy = new PolicyEngine({
  personas: ['neutral', 'draw_first', 'text_first'],
  epsilon: 0.1,
});

const personaProbs = inference.inferPersona(events);
const { chosenVariant, propensity } = policy.selectVariant(personaProbs);
```

Expose those backend decisions to React through `pollInference` and `evaluatePolicy`:

```tsx
import { AdaptiveProvider } from '@dionysys/react';

export function App() {
  return (
    <AdaptiveProvider
      mode="deterministic"
      defaultVariant="neutral"
      pollingIntervalMs={3000}
      minEventsBeforeLock={5}
      pollInference={async () => {
        const response = await fetch('/api/inference/session_123');
        const data = await response.json();
        return data.probabilities;
      }}
      evaluatePolicy={async () => {
        const response = await fetch('/api/adaptive/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'session_123', mode: 'deterministic' }),
        });
        const data = await response.json();
        return data.variant;
      }}
    >
      <AdaptiveCanvas />
    </AdaptiveProvider>
  );
}
```

## MCP Mode

Use MCP mode when a backend-hosted resource set should define the persona candidates, deterministic score rules, and available UI actions. The LLM connector does not invent personas or actions; it chooses from the resource set after receiving the summarized interaction data and computed scores.

### Define Resources

```ts
import type { PersonalityResource } from '@dionysys/core';

export const resources: PersonalityResource[] = [
  {
    id: 'guided_novice',
    name: 'Guided Novice',
    description: 'A user who appears early in the workflow and benefits from fewer choices.',
    decisionHints: ['Low event volume', 'Low tool diversity'],
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
          description: 'User has used very few tools.',
          metric: 'toolDiversity',
          operator: '<=',
          value: 2,
          weight: 2,
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
          canvasActions: { saveAsImage: false, clearCanvas: false },
          mainMenu: { allowedItems: ['help'] },
          mainMenuItems: ['help'],
        },
      },
    ],
  },
];
```

### Resolve a Decision

```ts
import {
  McpModeResolver,
  type LLMDecisionConnector,
  type LLMDecisionInput,
  type LLMDecisionResult,
} from '@dionysys/core';
import { resources } from './resources';

const connector: LLMDecisionConnector = {
  async decide(input: LLMDecisionInput): Promise<LLMDecisionResult> {
    const [personalityId] = Object.entries(input.personaScores)
      .sort((a, b) => b[1] - a[1])[0];
    const personality = input.personalities.find((item) => item.id === personalityId)!;
    return {
      personalityId: personality.id,
      actionId: personality.actions[0].id,
      confidence: input.personaScores[personality.id],
      rationale: 'Selected the highest deterministic persona score.',
    };
  },
};

const resolver = new McpModeResolver({
  resources,
  llmConnector: connector,
  minConfidence: 0.5,
  fallbackVariant: 'neutral',
});

const decision = await resolver.resolve({
  events,
  summaryOptions: {
    sessionStartMs,
    recentEventLimit: 10,
    maxStringLength: 120,
  },
});
```

`McpModeResolver` validates resources, summarizes raw events, computes `rawScores` and normalized `personaScores`, validates the connector response, and falls back to a safe/default action if the response is invalid, unknown, or below `minConfidence`.

### React Integration

```tsx
import { AdaptiveProvider } from '@dionysys/react';

export function App() {
  return (
    <AdaptiveProvider
      key="mcp"
      mode="mcp"
      defaultVariant="neutral"
      minEventsBeforeLock={5}
      resolveDecision={async () => {
        const response = await fetch('/api/adaptive/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'session_123', mode: 'mcp' }),
        });
        return response.json();
      }}
    >
      <AdaptiveCanvas />
    </AdaptiveProvider>
  );
}
```

## Reading Adaptive State

Use `useAdaptiveUI()` anywhere under the provider:

```tsx
import { useAdaptiveUI } from '@dionysys/react';

export function AdaptiveCanvas() {
  const {
    mode,
    currentVariant,
    currentUIState,
    currentPersonality,
    decisionConfidence,
    lastDecision,
    personaProbs,
    eventsSentCount,
    isPolicyLocked,
    incrementEventsSent,
  } = useAdaptiveUI();

  const toolbar = mode === 'mcp'
    ? currentUIState?.toolbar
    : variantConfigs[currentVariant].toolbar;

  return <Toolbar config={toolbar} />;
}
```

State fields:

| Field | Meaning |
| --- | --- |
| `mode` | Current adaptive mode: `deterministic` or `mcp`. |
| `currentVariant` | Active variant name. Deterministic mode gets this from policy; MCP mode gets it from the selected action UI state. |
| `currentUIState` | MCP action UI state, or the optional default UI state. |
| `currentPersonality` | Selected MCP personality id. |
| `decisionConfidence` | LLM connector confidence from the latest MCP decision. |
| `lastDecision` | Full `AdaptiveDecision`, including summary, raw scores, normalized scores, matched signals, and fallback status. |
| `personaProbs` | Live deterministic probabilities or MCP resource-driven persona scores. |
| `eventsSentCount` | Count of events flushed by the application telemetry layer. |
| `isPolicyLocked` | Whether the provider has locked the adaptive decision after the event threshold. |

Call `incrementEventsSent(count)` after your telemetry layer successfully sends events. The provider uses this count to decide when to evaluate deterministic policy or resolve MCP mode.

## Runtime Admin Console

Use `AdminConsole` when you want an in-app information and control center for modes, personality resources, scoring calculations, session summaries, MCP APIs, and exportable configuration.

```tsx
import { AdminConsole } from '@dionysys/react';

export function AdminOverlay({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  return (
    <AdminConsole
      apiBaseUrl="http://localhost:3001"
      sessionId={sessionId}
      onClose={onClose}
      onConfigSaved={(config) => {
        console.log('Runtime mode changed to', config.mode.defaultMode);
      }}
    />
  );
}
```

The console expects the backend admin API to be enabled with `ADMIN_CONSOLE_ENABLED=true`. It edits in-memory runtime config only; source files are not rewritten. Use the Export tab to download the active config JSON for future use.

## Event Summaries and Scoring

MCP mode uses `InteractionSummarizer` before any connector call. The summary includes:

- `totalEvents`
- `eventCountsByType`
- `elementCountsByType`
- `toolDiversity`
- `textToShapeRatio`
- `timeToFirstEventMs`
- `timeSinceLastEventMs`
- `recentEventTypes`
- capped, sanitized `recentEvents`
- `derivedSignals`

`PersonalityScorer` evaluates each `PersonalityResource` independently:

1. Start with `baseWeight` or `1`.
2. Add each matching signal weight.
3. Clamp each raw score to `>= 0`.
4. Normalize by total score.
5. Return a uniform distribution if all raw scores are `0`.

Supported signal metrics are `totalEvents`, `eventCount`, `eventRatio`, `elementCount`, `toolDiversity`, `textToShapeRatio`, `timeToFirstEventMs`, `timeSinceLastEventMs`, and `recentEventType`.

## Backend Contract

A typical backend endpoint accepts a session and mode:

```http
POST /api/adaptive/decision
Content-Type: application/json

{
  "sessionId": "session_123",
  "mode": "mcp"
}
```

Deterministic responses should include a variant:

```json
{
  "mode": "deterministic",
  "variant": "draw_first",
  "personaScores": {
    "neutral": 0.2,
    "draw_first": 0.7,
    "text_first": 0.1
  }
}
```

MCP responses should return an `AdaptiveDecision`:

```json
{
  "mode": "mcp",
  "variant": "guided_novice",
  "personalityId": "guided_novice",
  "actionId": "show_guided_toolbar",
  "confidence": 0.74,
  "isFallback": false,
  "uiState": {
    "variant": "guided_novice",
    "toolbar": { "mode": "allowlist", "tools": ["selection", "rectangle", "text"] }
  },
  "personaScores": {
    "guided_novice": 0.55,
    "draw_first": 0.27,
    "text_first": 0.09,
    "neutral": 0.09
  }
}
```

Keep provider API keys on the backend. Send summaries and scores to external connectors, not raw uncapped event payloads.

## Verification

Useful package-level checks:

```bash
npm run build --workspace=packages/core
npm run build --workspace=packages/react
npm run test --workspace=packages/core
npm run build
```

The demo-specific configuration workflow is documented in `docs/excalidraw-configuration.md`.
