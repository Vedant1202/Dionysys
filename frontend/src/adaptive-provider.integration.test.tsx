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
      .mockResolvedValueOnce('text_first')
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
      expect(latestState?.currentVariant).toBe('text_first');
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
      variant: 'text_first',
      personalityId: 'text_first',
      actionId: 'show_text_toolbar',
      confidence: 0.64,
      uiState: {
        variant: 'text_first',
        showWelcomeScreen: false,
        toolbar: { mode: 'allowlist', tools: ['selection', 'text'] },
        canvasActions: { toggleTheme: true },
        mainMenuItems: ['help', 'toggleTheme'],
        mainMenu: { allowedItems: ['help', 'toggleTheme'] },
      },
      rationale: 'Text events are dominant.',
      personaScores: { text_first: 0.64, draw_first: 0.12, neutral: 0.12, guided_novice: 0.06, power_user: 0.06 },
      rawScores: { text_first: 8, draw_first: 2, neutral: 1, guided_novice: 1, power_user: 1 },
      matchedSignals: { text_first: ['text_added_recent'], draw_first: [], neutral: [], guided_novice: [], power_user: [] },
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
      expect(latestState?.pendingPersonality).toBe('text_first');
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
      expect(latestState?.currentVariant).toBe('text_first');
      expect(latestState?.currentUIState?.variant).toBe('text_first');
      expect(latestState?.currentPersonality).toBe('text_first');
      expect(latestState?.hasPendingUIChange).toBe(false);
    });
  });
});
