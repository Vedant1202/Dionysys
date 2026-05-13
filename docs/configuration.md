# Configuration Guide

The true power of the modular framework is that you do not need to rewrite A/B testing backend code. You inject your logic structures immediately into the engines.

## Configuration Boundaries

The refactored packages intentionally separate where different kinds of configuration live:

- `@dionysys/core`: deterministic inference config, policy config, reward formulas, MCP personality resources, interaction summaries, admin/runtime config contracts, and UI schemas.
- `@dionysys/react`: provider wiring, pending-decision persistence hooks, runtime presentation/application settings, and reusable UI like the admin console and feedback panel.
- App or demo code: concrete UI rendering details, telemetry transport, session ids, toolbar/menu render mappings, and any app-specific filtering or adapters.

That split is useful when deciding where to add new behavior. If it changes scoring, schemas, decisions, or validated contracts, it likely belongs in `@dionysys/core`. If it changes React orchestration or package-owned UI, it likely belongs in `@dionysys/react`. If it is specific to Excalidraw or one product surface, keep it in the app.

## InferenceEngine Configuration
The `InferenceEngine` relies on a declarative configuration to score behaviors.

```typescript
import { InferenceEngine, InferenceConfig } from '@dionysys/core';

const myConfig: InferenceConfig = {
  // 1. Define your valid personas
  personas: ['neutral', 'draw_first', 'text_first'],
  
  // 2. Define your Baseline priors
  initialCounts: {
    neutral: 1,
    draw_first: 1,
    text_first: 1 
  },

  // 3. Define event impacts
  eventWeights: {
    // Static mapping
    'scrolled_fast': { draw_first: 2, text_first: -1 },

    // Dynamic payload-based evaluation mapping
    'element_created': (payload) => {
       if (payload.type === 'text') return { text_first: 3 };
       return { draw_first: 2 };
    }
  },

  // 4. (Optional) Run heuristics against the full array of events in bulk
  heuristics: [
    (events) => {
       if (events.length < 5) return { guided_novice: 2 };
       return {};
    }
  ]
};

const engine = new InferenceEngine(myConfig);
```

## PolicyEngine Configuration
The `PolicyEngine` transforms the mapped probabilities into definitive decisions using contextual bandit algorithms.

```typescript
import { PolicyEngine, PolicyConfig } from '@dionysys/core';

const policyConfig: PolicyConfig = {
  personas: ['neutral', 'draw_first', 'text_first'],
  epsilon: 0.1, // 10% of the time, the engine explores a random UI variant instead of exploiting
  
  // Optional: If your inferred personas don't 1:1 match your UI variant names
  variantMapping: {
    'draw_first': 'creative_layout_v2'
  }
};

const policy = new PolicyEngine(policyConfig);
```

## MCP Mode Configuration

MCP mode uses personality resources instead of hard-coded persona mappings. Each resource defines scoring rules and the UI actions the LLM is allowed to choose from.

```typescript
import type { PersonalityResource } from '@dionysys/core';

export const resources: PersonalityResource[] = [
  {
    id: 'guided_novice',
    name: 'Guided Novice',
    description: 'A user who appears early in the workflow and benefits from fewer visible choices.',
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
      ],
    },
    actions: [
      {
        id: 'show_guided_toolbar',
        description: 'Show a reduced toolbar and welcome guidance.',
        isSafeFallback: true,
        uiState: {
          variant: 'guided_novice',
          toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'text'] },
          mainMenu: { allowedItems: ['help'] },
          showWelcomeScreen: true,
        },
      },
    ],
  },
];
```

The backend summarizes raw interactions before LLM calls. The LLM connector receives resource metadata, `InteractionSummary`, `rawScores`, and normalized `personaScores`; it must return one exposed `{ personalityId, actionId, confidence }`.

## Adaptive UI Schema

`AdaptiveUIDefinition` is now a formal package contract rather than an informal extension bag. In addition to `variant`, `toolbar`, and `mainMenu`, the schema explicitly supports:

- `showWelcomeScreen`
- `canvasActions`
- `mainMenuItems`

Apps may still extend the shape for local UI needs, but those fields are now part of the documented baseline and can be used directly by deterministic configs, MCP action payloads, and runtime admin editing.

## Runtime Admin Configuration

For local tuning and demos, enable the admin console instead of editing files for every iteration:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
```

The backend seeds runtime configuration from the existing deterministic and MCP files, then exposes:

```http
GET  /api/admin/config
PUT  /api/admin/config
POST /api/admin/config/reset
GET  /api/admin/config/export
GET  /api/admin/overview
```

`@dionysys/react` provides `<AdminConsole />` to edit that runtime config. Saves update in-memory backend state and affect subsequent deterministic/MCP decisions. They do not write to source files. Use the Export tab or `/api/admin/config/export` to capture a JSON snapshot.

The mode config also controls presentation and application timing:

```json
{
  "mode": {
    "defaultMode": "mcp",
    "presentationMode": "prototype",
    "decisionApplication": "next-refresh",
    "persistenceMode": "browser",
    "minEventsBeforeLock": 5,
    "pollingIntervalMs": 3000
  }
}
```

Use `presentationMode: "production"` for front-facing users so personalities, scores, variants, and admin controls are hidden. Use `decisionApplication: "next-refresh"` to store the inferred personality/decision without changing the active workspace UI until refresh.

Use `persistenceMode` to keep the session id and built-in pending-decision storage aligned:

- `memory`: keep session state only for the current page lifetime
- `tab`: persist within the current browser tab via `sessionStorage`
- `browser`: persist across refreshes via `localStorage`

The file-seeded Excalidraw demo default is `presentationMode: "prototype"` plus `decisionApplication: "next-refresh"` and `persistenceMode: "browser"` so builders can see diagnostics while the active canvas UI still stays stable until refresh. `decisionApplication: "immediate"` remains useful for tests, demos, and backward-compatible integrations where mid-session UI changes are acceptable; prefer `next-refresh` for real active workspaces.

In non-production builds, the admin console includes a session tool to randomize the current session id. It clears the active mode-scoped session id and queued pending decision, then reloads the app so you can verify persistence behavior cleanly.

For the current Excalidraw demo, see `docs/excalidraw-configuration.md` for the exact files to edit when changing deterministic variants, MCP personality resources, scoring rules, toolbar tools, menu items, or connector environment variables.
