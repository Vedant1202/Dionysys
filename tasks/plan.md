# Implementation Plan: Modular UI Engine (Adaptive Toolbars)

## Overview
We are expanding the proof-of-concept Adaptive UI framework into a robust, configurable engine. We will introduce an Integration Language schema (using Zod) to explicitly configure which toolbar items are visible for each user persona. We will implement these dynamic configurations by overlaying a custom `DynamicToolbar` component on Excalidraw to control the active drawing tool via the `excalidrawAPI` (Option A from spec).

## Architecture Decisions
- **Option A (Custom Toolbar)**: We will build a custom floating React component for the toolbar instead of modifying the DOM with CSS injection. This ensures the solution remains modular, robust to Excalidraw updates, and acts as a generic UI adaptation framework.
- **Integration Language using Zod**: We will use Zod for runtime schema validation on the `variantConfig.ts` and `uiSchema.ts`, providing type-safety.

## Task List

### Phase 1: Foundation (Schema & Config)
- [ ] Task 1: Define Zod schemas and TypeScript interfaces for the Integration Language (`UIModuleState` and `AdaptiveUIDefinition`) in `frontend/src/config/uiSchema.ts`.
- [ ] Task 2: Refactor `frontend/src/config/variantConfig.ts` to implement the new `AdaptiveUIDefinition` matching the new Schema, defining allowed tools for variants (e.g., `text_first`, `draw_first`, etc).

### Checkpoint: Foundation
- [ ] TypeScript compiles cleanly: `npm run build`
- [ ] Zod schema is correctly mapping the configurations.

### Phase 2: DynamicToolbar Component
- [ ] Task 3: Build the `DynamicToolbar` component in `frontend/src/components/DynamicToolbar.tsx`. It needs to consume the current variant's `AdaptiveUIDefinition` and render a list of buttons that trigger `excalidrawAPI.updateScene({ appState: { activeTool: { type: '...' } } })`.

### Checkpoint: DynamicToolbar
- [ ] `DynamicToolbar` successfully renders the filtered set of tools according to the current UI configuration.

### Phase 3: Editor Shell Integration
- [ ] Task 4: Integrate `DynamicToolbar` into `EditorShell.tsx`.
- [ ] Task 5: Suppress or hide the native Excalidraw toolbar. *Note: Needs clarification on whether to use Excalidraw `UIOptions` or CSS `display:none` class injection if no native prop exists for hiding the entire toolbar securely.*

### Checkpoint: Complete
- [ ] The full app renders correctly and changing personas dynamically alters the `DynamicToolbar`.
- [ ] Ready for review.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Excalidraw native toolbar cannot be fully hidden via props | Medium | We will need to inject a localized CSS override to hide `.App-toolbar` solely within our active variants. We will ask for approval before doing this. |

## Open Questions
- To hide the native Excalidraw toolbar entirely, should we apply a CSS override like `.excalidraw .App-toolbar { display: none }` when the `DynamicToolbar` is active, or is there a preferred `UIOptions` method you would like to test?
- Is dropping in `zod` acceptable, or do we need to install it first?
