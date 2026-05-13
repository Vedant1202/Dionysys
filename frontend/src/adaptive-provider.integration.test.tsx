import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdaptiveDecision, AdaptiveUIDefinition } from '@dionysys/core';
import { AdaptiveProvider } from '../../packages/react/src/AdaptiveProvider.tsx';
import { useAdaptiveUI, type UseAdaptiveUIResult } from '../../packages/react/src/useAdaptiveUI.ts';

const defaultUIState: AdaptiveUIDefinition = {
  variant: 'neutral',
  showWelcomeScreen: false,
  toolbar: { mode: 'blocklist', tools: [] },
  canvasActions: {},
  mainMenuItems: [],
  mainMenu: { allowedItems: [] },
};

let latestState: UseAdaptiveUIResult | null = null;

function Harness() {
  latestState = useAdaptiveUI();
  return <div data-testid="variant">{latestState.currentVariant}</div>;
}

describe('AdaptiveProvider', () => {
  beforeEach(() => {
    latestState = null;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('re-evaluates deterministic decisions after later event flushes', async () => {
    const evaluatePolicy = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('text_first__novice')
      .mockResolvedValueOnce('draw_first');

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="immediate"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        evaluatePolicy={evaluatePolicy}
        minEventsBeforeLock={1}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('text_first__novice');
    });

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first');
    });

    expect(evaluatePolicy).toHaveBeenCalledTimes(2);
  });

  it('applies a pending MCP decision on the next mount for the same session', async () => {
    const sessionId = 'sess_provider_test';
    const decision: AdaptiveDecision = {
      mode: 'mcp',
      variant: 'text_first__novice',
      personalityId: 'text_first__novice',
      actionId: 'show_text_toolbar',
      confidence: 0.64,
      uiState: {
        variant: 'text_first__novice',
        showWelcomeScreen: true,
        toolbar: { mode: 'allowlist', tools: ['selection', 'text'] },
        canvasActions: {
          saveAsImage: false,
          saveToActiveFile: false,
          clearCanvas: false,
          toggleTheme: false,
        },
        mainMenuItems: ['help'],
        mainMenu: { allowedItems: ['help'] },
      },
      rationale: 'Text events are dominant.',
      modalityScores: { text_first: 0.8, draw_first: 0.1, neutral: 0.1 },
      expertiseScores: { novice: 0.64, standard: 0.24, power_user: 0.12 },
      selectedModality: 'text_first',
      selectedExpertise: 'novice',
      composedUiVariant: 'text_first__novice',
      personaScores: { text_first: 0.8, draw_first: 0.1, neutral: 0.1 },
      rawScores: { text_first: 8, draw_first: 2, neutral: 1 },
      matchedSignals: { text_first: ['text_added_recent'], draw_first: [], neutral: [] },
      axisRawScores: {
        modality: { text_first: 8, draw_first: 2, neutral: 1 },
        expertise: { novice: 4, standard: 1, power_user: 1 },
      },
      axisMatchedSignals: {
        modality: { text_first: ['text_added_recent'], draw_first: [], neutral: [] },
        expertise: { novice: ['low_event_volume'], standard: [], power_user: [] },
      },
      interactionSummary: {
        totalEvents: 4,
        eventCountsByType: { text_added: 3, element_drawn: 1 },
        elementCountsByType: { text: 3, rectangle: 1 },
        toolDiversity: 2,
        textToShapeRatio: 3,
        timeToFirstEventMs: 25,
        timeSinceLastEventMs: 150,
        recentEventTypes: ['text_added', 'text_added'],
        recentEvents: [],
        derivedSignals: ['Text activity is dominant'],
      },
      isFallback: false,
    };

    const firstRender = render(
      <AdaptiveProvider
        mode="mcp"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        resolveDecision={vi.fn().mockResolvedValue(decision)}
        minEventsBeforeLock={1}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.hasPendingUIChange).toBe(true);
      expect(latestState?.pendingPersonality).toBe('text_first__novice');
      expect(latestState?.decisionConfidence).toBeCloseTo(0.64, 5);
    });

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="mcp"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('text_first__novice');
      expect(latestState?.currentUIState?.variant).toBe('text_first__novice');
      expect(latestState?.currentPersonality).toBe('text_first__novice');
      expect(latestState?.selectedModality).toBe('text_first');
      expect(latestState?.selectedExpertise).toBe('novice');
      expect(latestState?.hasPendingUIChange).toBe(false);
    });
  });
});
