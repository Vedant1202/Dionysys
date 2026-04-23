# Spec: Prototype UI Controls and Collapsible Toolbars

## Objective

Improve the Excalidraw demo's prototype UI so diagnostics and adaptive controls are useful without blocking the workspace.

Users in prototype mode should be able to:

- Minimize the right-side diagnostics window.
- Drag the diagnostics window to another screen location.
- Keep the diagnostics window mostly transparent until hovered.
- Switch personas/layouts without losing access to the rest of the toolbar controls.
- See non-selected toolbar controls in a collapsed form that expands on hover to the right.

Success means prototype mode stays inspectable for configuration/debugging, while persona-specific layouts demonstrate prioritization without making hidden controls feel broken or inaccessible.

## Assumptions

1. "Right side window" means the existing `DebugPanel` rendered at the right side of the Excalidraw canvas.
2. "Controls bar" means the tool controls rendered by `DynamicToolbar` plus the Excalidraw native toolbar currently hidden when `toolbar.mode === 'allowlist'`.
3. This change targets prototype/demo UI only; production mode should keep hiding debug/personality details.
4. Collapsed controls should remain available visually and interactively, but de-emphasized compared with the active persona's primary controls.
5. No new drag/drop dependency should be added unless native pointer events become too brittle.
6. The diagnostics panel position should persist in localStorage.
7. Collapsed overflow controls should use the default Excalidraw tools from the neutral state.
8. Neutral and power-user layouts should keep the native Excalidraw toolbar.

## Tech Stack

- React + TypeScript in `frontend`
- `@excalidraw/excalidraw` for the drawing surface
- Tailwind/DaisyUI utility classes already used by demo components
- `lucide-react` icons already used by the toolbar

## Commands

Build frontend:

```bash
PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run build --workspace=frontend
```

Run frontend dev server:

```bash
PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run dev --workspace=frontend
```

Run backend dev server with admin APIs:

```bash
ADMIN_CONSOLE_ENABLED=true PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run dev --workspace=backend
```

Check formatting whitespace:

```bash
git diff --check
```

## Project Structure

```text
frontend/src/components/DebugPanel.tsx
  Movable/minimizable prototype diagnostics panel.

frontend/src/components/DynamicToolbar.tsx
  Persona-aware toolbar with primary controls and collapsed overflow controls.

frontend/src/components/EditorShell.tsx
  Decides when prototype UI is visible and whether Excalidraw native toolbar should be hidden/collapsed.

frontend/src/config/variantConfig.ts
  Source for persona toolbar allowlists/blocklists and current UI state mapping.

docs/specs/prototype-ui-controls.md
  This specification.
```

## Code Style

Keep behavior in small React helpers and avoid introducing large abstractions for one-off UI state.

```tsx
const primaryTools = config.toolbar.mode === 'allowlist'
  ? config.toolbar.tools
  : allTools;

const overflowTools = allTools.filter((tool) => !primaryTools.includes(tool));

return (
  <div className="prototype-toolbar" onMouseEnter={() => setExpanded(true)}>
    <ToolButton tool={primaryTools[0]} />
    {expanded && overflowTools.map((tool) => <ToolButton key={tool} tool={tool} />)}
  </div>
);
```

Conventions:

- Keep component state local unless the value is part of adaptive package state.
- Use pointer events for dragging so mouse and touch work consistently.
- Use explicit labels/titles for icon-only buttons.
- Preserve production mode gating for personality/debug information.

## Testing Strategy

- Build verification with `npm run build --workspace=frontend`.
- Manual browser checks in the Excalidraw demo:
  - Diagnostics panel can be minimized and restored.
  - Diagnostics panel can be dragged, remains within the viewport, and restores its position after refresh.
  - Diagnostics panel opacity is low by default and about 75% on hover.
  - Persona toolbar shows prioritized controls first.
  - Non-prioritized default Excalidraw tools remain collapsed and expand to the right on hover.
  - Switching between `guided_novice`, `draw_first`, `text_first`, `power_user`, and `neutral` never removes access to controls.
  - Neutral and power-user layouts keep the native Excalidraw toolbar.
  - Production mode still hides diagnostics/personality details.

## Boundaries

- Always:
  - Preserve existing adaptive mode and presentation mode semantics.
  - Keep debug/personality information visible only in prototype mode.
  - Keep all relevant Excalidraw controls reachable after persona/layout changes.
  - Run the frontend build and `git diff --check`.

- Ask first:
  - Adding a new drag/drop or floating UI dependency.
  - Changing the adaptive config schema.
  - Changing production mode behavior beyond feedback visibility.
  - Persisting the dragged panel position across sessions.

- Never:
  - Hide controls in a way that makes them unreachable.
  - Send debug/personality data to production users.
  - Edit generated directories such as `frontend/dist`, `.docusaurus`, or `node_modules`.

## Success Criteria

- The right-side prototype diagnostics panel has a minimize/restore control.
- The diagnostics panel can be moved by dragging its header.
- The diagnostics panel renders nearly transparent by default and transitions to approximately 75% opacity on hover.
- Persona-specific toolbar controls remain emphasized.
- Controls outside the active persona's primary set are collapsed, still visible as a compact affordance, and expand to the right on hover.
- Collapsed overflow controls are based on the neutral default Excalidraw tool set.
- Neutral and power-user layouts keep the native Excalidraw toolbar.
- Switching personas/layouts does not remove access to other drawing controls.
- Dragged diagnostics panel position persists in localStorage.
- Frontend build passes.

## Decisions

1. Dragged diagnostics panel position persists in localStorage.
2. Collapsed overflow controls use the default Excalidraw tools from the neutral state.
3. Neutral and power-user layouts keep the native Excalidraw toolbar.

## Implementation Plan

1. Update `DebugPanel` into a floating prototype console:
   - Add local minimized state.
   - Add pointer-driven dragging from the panel header.
   - Clamp the panel position to the viewport.
   - Persist position in localStorage and restore it on mount.
   - Use opacity transitions so the panel is almost transparent by default and about 75% opaque on hover.

2. Update `DynamicToolbar` to preserve access to default tools:
   - Treat neutral's default tools as the overflow source.
   - For allowlist personas, render primary persona tools first.
   - Render all non-primary default tools in a collapsed rail that expands to the right on hover.
   - Keep click behavior through `excalidrawAPI.updateScene`.

3. Update `EditorShell` toolbar hiding rules:
   - Hide the native Excalidraw toolbar only when the active layout is an allowlist persona that needs the custom prioritized toolbar.
   - Keep the native toolbar visible for neutral and power-user layouts.

4. Verify:
   - Build the frontend.
   - Run whitespace diff checks.
   - Manually confirm draggable/minimized/debug opacity and toolbar expansion behavior in the demo.

## Tasks

- [x] Task: Make `DebugPanel` draggable, minimizable, translucent, and position-persistent.
  - Acceptance: The panel can be minimized/restored, dragged within viewport bounds, fades to low opacity when idle, becomes about 75% opaque on hover, and restores its last position after refresh.
  - Verify: `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run build --workspace=frontend`
  - Files: `frontend/src/components/DebugPanel.tsx`

- [x] Task: Add collapsed overflow controls to `DynamicToolbar`.
  - Acceptance: Allowlist personas show primary tools and a collapsed overflow rail containing non-primary neutral/default tools; hovering the toolbar expands overflow controls to the right.
  - Verify: Manual demo check for `guided_novice`, `draw_first`, and `text_first`.
  - Files: `frontend/src/components/DynamicToolbar.tsx`, `frontend/src/config/variantConfig.ts`

- [x] Task: Preserve native toolbar for neutral and power-user layouts.
  - Acceptance: Neutral and power-user layouts keep the native Excalidraw toolbar; allowlist persona layouts use the custom prioritized toolbar with overflow access.
  - Verify: Manual demo check after switching layouts.
  - Files: `frontend/src/components/EditorShell.tsx`

- [x] Task: Final verification.
  - Acceptance: Frontend build passes and no whitespace errors are introduced.
  - Verify: `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run build --workspace=frontend` and `git diff --check`.
  - Files: affected frontend files and this spec.
