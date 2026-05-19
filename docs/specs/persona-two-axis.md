# Spec: Two-Axis Persona Rules With Minimal Overlap

## Summary

- Replace the current single competing persona pool with two independent axes:
  - `modality`: `neutral`, `draw_first`, `text_first`
  - `expertise`: `novice`, `standard`, `power_user`
- Keep the UI modality-first:
  - modality chooses the base workspace, toolbar, and primary variant
  - expertise applies a deterministic overlay for guidance or advanced controls
- Use a symmetric two-signal lock for modality in both deterministic and MCP scoring:
  - `draw_first` when drawing has at least 2 matching events and is not outnumbered by text
  - `text_first` when text has at least 2 matching events and is not outnumbered by drawing
  - otherwise stay `neutral`

## Important Interface Changes

- Add explicit axis fields to adaptive/admin/debug responses:
  - `modalityScores`
  - `expertiseScores`
  - `selectedModality`
  - `selectedExpertise`
  - `composedUiVariant`
- Keep current single-persona fields as compatibility aliases during this refactor:
  - `personaScores` maps to `modalityScores`
  - `personalityId` maps to `composedUiVariant`
- Change deterministic config from one flat persona list to axis-based config:
  - `deterministic.axes.modality`
  - `deterministic.axes.expertise`
- Change MCP config from one flat resource list to axis-based resource groups:
  - `mcp.axes.modalityResources`
  - `mcp.axes.expertiseResources`

## Implementation Changes

- Deterministic scoring:
  - remove `guided_novice` and `power_user` from the same pool as draw/text
  - score modality only from draw/text event evidence
  - score expertise only from volume, diversity, and speed heuristics
  - stop using low event volume as a rule that can beat a clear draw/text signal
- MCP scoring and resolution:
  - summarize once, then score modality resources and expertise resources separately
  - let modality determine the primary action/variant
  - apply expertise as a post-score overlay, not as a competing primary persona
- UI composition:
  - keep current `neutral`, `draw_first`, and `text_first` base configs
  - convert `guided_novice` into a novice overlay:
    - `showWelcomeScreen: true`
    - help-only menu
    - reduced starter toolbar aligned to the selected modality
    - advanced actions disabled
  - convert `power_user` into a power overlay:
    - no welcome screen
    - full modality toolbar preserved
    - advanced actions enabled, including `saveToActiveFile`
  - `standard` expertise leaves the modality UI unchanged
- Admin/debug UX:
  - show both axes separately
  - stop presenting `guided_novice` and `power_user` as peers to `draw_first` and `text_first`
  - show the composed result as “modality + expertise” rather than one ambiguous top persona

## Test Plan

- Unit tests:
  - 2 draw events, 0 text => `selectedModality = draw_first`
  - 2 text events, 0 draw => `selectedModality = text_first`
  - 1 draw event only => stays `neutral` modality, not forced to text/power
  - early draw-heavy session => draw modality + novice expertise
  - high-volume draw session => draw modality + power expertise
  - mixed draw/text session => neutral modality unless one side reaches the lock threshold
- Integration checks:
  - deterministic mode returns axis-specific scores plus compatibility aliases
  - MCP mode composes modality action with expertise overlay correctly
  - debug/admin views render both axes without breaking existing consumers
- Verification commands:
  - `npm run test --workspace=packages/core`
  - `npm run test --workspace=backend`
  - `npm run test --workspace=frontend`
  - `npm run build`

## Assumptions And Defaults

- `neutral` remains the base fallback for mixed or insufficient modality evidence.
- The two-signal lock is intentionally symmetric for drawing and text.
- No database migration is included in this pass; persisted legacy `personaProbs` can remain modality-only compatibility data unless implementation proves that a schema change is required.
- Legacy single-persona fields stay in place for one migration cycle and should not drive new logic.
