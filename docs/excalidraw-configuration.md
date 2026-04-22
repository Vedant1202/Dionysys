# Editing the Excalidraw Demo Configuration

This guide explains how to change the current Excalidraw adaptive UI implementation. Use it when adding a variant, changing toolbar behavior, tuning MCP persona scoring, or swapping the mock LLM connector for a fetch-based connector.

## Configuration Map

| Concern | File |
| --- | --- |
| Deterministic variant UI definitions | `frontend/src/config/variantConfig.ts` |
| MCP personality resources, scoring rules, and action UI states | `backend/src/services/ExcalidrawMcpResources.ts` |
| Mode switch and provider wiring | `frontend/src/App.tsx` |
| Applying the selected UI state to Excalidraw | `frontend/src/components/EditorShell.tsx` |
| Custom allowlisted toolbar rendering | `frontend/src/components/DynamicToolbar.tsx` |
| Debug readout for mode, scores, confidence, and lock state | `frontend/src/components/DebugPanel.tsx` |
| Runtime admin console overlay | `frontend/src/App.tsx` and `@dionysys/react` `AdminConsole` |
| Shared session id for telemetry and decisions | `frontend/src/core/session.ts` |
| Telemetry collection and flushing | `frontend/src/core/eventCollector.ts` |

## Runtime Editing with the Admin Console

For fast experimentation, enable the admin console and edit runtime configuration from the browser:

```bash
ADMIN_CONSOLE_ENABLED=true npm run dev --workspace=backend
npm run dev --workspace=frontend
```

The demo shows an Admin button in development. The console is seeded from the current files on backend startup, then lets you edit:

- default mode, event threshold, and polling interval
- prototype vs production presentation mode
- immediate vs next-refresh decision application
- deterministic personas, initial counts, event rules, heuristics, and epsilon
- MCP resources, base weights, signal rules, actions, and UI states
- MCP confidence floor and fallback variant
- supported tools and menu items through the full JSON editor

Saving changes affects runtime decisions only. It does not rewrite `variantConfig.ts` or `ExcalidrawMcpResources.ts`. Use Export to download a JSON snapshot when you want to preserve a tuning session.

Production mode hides the top-bar mode switch, admin entry point, debug panel, active variant badge, personality labels, and persona scores. It shows only a front-facing feedback panel.

## Prototype Experience

Prototype mode is the demo's configuration and debugging view. It shows:

- deterministic/MCP mode switch
- Admin button for the runtime console overlay
- session id
- active variant badge
- debug panel with events, policy status, scores, confidence, and MCP personality
- pending refresh badge when a decision has been stored for the next load

Use prototype mode when tuning scoring rules, comparing deterministic and MCP decisions, validating personality resources, or checking whether the next-refresh behavior is storing the expected decision.

## Production Experience

Production mode is the front-facing user view. It hides the mode switch, Admin button, session id, variant badge, debug panel, personality labels, and persona probability charts. Users should not see which personality or variant they are in.

Instead, production mode renders a lightweight feedback panel through `AdaptiveFeedback`. The demo records feedback as a `feedback_submitted` event so it can be analyzed with the rest of the session telemetry.

## Adaptive Modes in the Demo

The top bar switch in `EditorShell` selects the mode:

- `Deterministic`: `AdaptiveProvider` polls `/api/inference/:sessionId`, then posts to `/api/adaptive/decision` with `mode: 'deterministic'`.
- `MCP`: `AdaptiveProvider` posts to `/api/adaptive/decision` with `mode: 'mcp'`, then renders `lastDecision.uiState`.

`App.tsx` remounts the provider when the mode or runtime admin config changes, so switching modes or saving admin config resets lock state, selected variant, and MCP decision fields.

When `decisionApplication` is `next-refresh`, policy/MCP decisions are stored as pending decisions. The active Excalidraw toolbar, menu, and welcome UI remain unchanged for the current workspace session. On the next browser refresh or provider mount, the pending decision is applied before the user starts working again.

## Editing Deterministic Variants

Edit `frontend/src/config/variantConfig.ts`.

Each entry in `VARIANT_CONFIGS` controls the UI for a variant:

```ts
export const VARIANT_CONFIGS = {
  draw_first: {
    showWelcomeScreen: false,
    toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'ellipse'] },
    canvasActions: {
      saveAsImage: true,
      clearCanvas: true,
    },
    mainMenuItems: ['saveAsImage', 'export', 'clearCanvas'],
  },
};
```

Supported fields:

| Field | Behavior |
| --- | --- |
| `showWelcomeScreen` | Shows the guided Excalidraw welcome content when true. |
| `toolbar.mode` | `allowlist` hides the native toolbar and renders the custom toolbar; `blocklist` leaves the native toolbar visible. |
| `toolbar.tools` | Tool ids rendered by `DynamicToolbar` when mode is `allowlist`. |
| `canvasActions` | Passed into Excalidraw `UIOptions.canvasActions`. |
| `mainMenuItems` | Controls which Excalidraw `MainMenu.DefaultItems` are rendered. |

Current toolbar icon ids are `selection`, `rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `freedraw`, `text`, `image`, and `eraser`. If you add a new tool id, add an icon and click handling support in `DynamicToolbar.tsx`.

Current main menu item ids are `saveAsImage`, `export`, `clearCanvas`, `help`, and `toggleTheme`. If you add a new menu item, add its render mapping in `EditorShell.tsx`.

## Editing MCP Personality Resources

Edit `backend/src/services/ExcalidrawMcpResources.ts`.

Each MCP resource has three important parts:

```ts
{
  id: 'guided_novice',
  name: 'Guided Novice',
  description: 'A user who appears early in the workflow and benefits from fewer visible choices.',
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
        canvasActions: { saveAsImage: false, clearCanvas: false, toggleTheme: false },
        mainMenu: { allowedItems: ['help'] },
        mainMenuItems: ['help'],
      },
    },
  ],
}
```

Scoring rules are deterministic. For each personality, the scorer starts from `baseWeight` or `1`, adds every matching signal's `weight`, clamps the result to `>= 0`, then normalizes all raw scores into probabilities.

Supported signal metrics:

| Metric | Requires | Meaning |
| --- | --- | --- |
| `totalEvents` | `value` | Compare against total event count. |
| `eventCount` | `eventType`, `value` | Compare against count of one event type. |
| `eventRatio` | `eventType`, `value` | Compare event type count divided by total events. |
| `elementCount` | `elementType`, `value` | Compare against count of one element type. |
| `toolDiversity` | `value` | Compare number of distinct tools or event types observed. |
| `textToShapeRatio` | `value` | Compare text events/elements against shape events/elements. |
| `timeToFirstEventMs` | `value` | Compare first event delay from session start. |
| `timeSinceLastEventMs` | `value` | Compare idle time since the latest event. |
| `recentEventType` | string `value` | Check whether recent event types contain a value. |

Supported operators are `<`, `<=`, `>`, `>=`, `==`, `!=`, `contains`, and `notContains`. Use `contains` or `notContains` for `recentEventType`.

## Adding a New Variant and Persona

1. Add the variant key to `UiVariant` in `frontend/src/config/variantConfig.ts`.
2. Add a matching `VARIANT_CONFIGS[variant]` entry for deterministic mode.
3. Add a matching `PersonalityResource` in `backend/src/services/ExcalidrawMcpResources.ts`.
4. Set every action `uiState.variant` to the variant key you want the frontend badge and config resolver to use.
5. Add `mainMenu` and `mainMenuItems` to MCP action UI states. `mainMenu` is part of the package UI schema; `mainMenuItems` is the current Excalidraw demo's render helper.
6. Mark at least one conservative action with `isSafeFallback: true` when it should be eligible for fallback.
7. Add toolbar icons or menu render mappings if your config references ids that are not currently supported.

Keep deterministic config and MCP action UI states aligned when they represent the same experience. That makes mode switching easier to reason about and avoids a variant looking different only because of the decision path.

## LLM Connector Configuration

The backend defaults to `MockLLMDecisionConnector`, which selects the highest normalized persona score and the first safe/default action. No API key is needed for the mock connector.

To call an external decision service, set environment variables before starting the backend:

```bash
ADAPTIVE_LLM_ENDPOINT=https://example.com/decision \
ADAPTIVE_LLM_API_KEY=replace-me \
ADAPTIVE_LLM_MODEL=optional-model-name \
npm run dev --workspace=backend
```

The fetch connector sends:

- personality ids, names, descriptions, hints, and available action ids/descriptions
- `interactionSummary`
- `rawScores`
- normalized `personaScores`

It does not need to send raw unbounded event payloads. Keep API keys server-side and do not add provider SDKs to `@dionysys/core` or `@dionysys/react`.

## Resource Debugging

Use the read-only resource endpoint to inspect the active backend resource set:

```http
GET http://localhost:3001/api/adaptive/resources
```

Use the decision endpoint to inspect the active decision for the current frontend session:

```http
POST http://localhost:3001/api/adaptive/decision
Content-Type: application/json

{
  "sessionId": "session_...",
  "mode": "mcp"
}
```

The frontend displays the current session id in the top bar. `frontend/src/core/session.ts` is shared by telemetry and adaptive decision calls, so changing it affects event collection, inference polling, policy evaluation, and MCP decisions together.

## Verification

Run targeted checks after configuration edits:

```bash
npm run test --workspace=frontend
npm run test --workspace=backend
npm run build --workspace=frontend
npm run build --workspace=backend
```

Run the demo manually:

```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

Then open the frontend, switch between `Deterministic` and `MCP`, draw shapes or add text, and confirm the debug panel shows the expected mode, persona scores, selected personality, confidence, and variant.

## Common Gotchas

- If MCP mode always returns `neutral`, confirm the frontend and backend are using the same `SESSION_ID`.
- If a custom toolbar does not show, confirm `toolbar.mode` is `allowlist` and every tool id exists in `DynamicToolbar.tsx`.
- If a menu item does not show, confirm it is included in `mainMenuItems` and rendered in `EditorShell.tsx`.
- If a connector decision is ignored, check that `personalityId`, `actionId`, and `confidence` are valid and meet the resolver's `minConfidence`.
- If deterministic mode changes but MCP mode does not, update both `VARIANT_CONFIGS` and `EXCALIDRAW_PERSONALITY_RESOURCES`.
