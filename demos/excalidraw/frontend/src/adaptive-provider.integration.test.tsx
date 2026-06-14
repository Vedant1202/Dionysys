import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdaptiveUIDefinition, PendingAdaptiveDecision } from '@dionysys/core';
import { AdaptiveProvider } from '../../../../packages/react/src/AdaptiveProvider.tsx';
import { useAdaptiveUI, type UseAdaptiveUIResult } from '../../../../packages/react/src/useAdaptiveUI.ts';

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

function makeDeterministicResolve(variant: string, sessionId: string) {
  return {
    id: `decision_${variant}`,
    sessionId,
    mode: 'deterministic' as const,
    variant,
    selectedPersona: { id: variant, confidence: 0.75 },
    scores: { [variant]: 0.75, neutral: 0.25 },
    metadata: {},
  };
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
    const sessionId = 'sess_re_eval';
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(makeDeterministicResolve('text_first__novice', sessionId))
      .mockResolvedValueOnce(makeDeterministicResolve('draw_first', sessionId));

    render(
      <AdaptiveProvider
        client={{ decisions: { resolve } } as any}
        mode="deterministic"
        decisionApplication="immediate"
        sessionId={sessionId}
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
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

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('resolves deterministic decisions through a Dionysys client when provided', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'decision_1',
        sessionId: 'sess_client_det',
        mode: 'deterministic',
        variant: 'draw_first__novice',
        selectedPersona: { id: 'draw_first__novice', confidence: 0.72 },
        scores: { draw_first: 0.72, text_first: 0.14, neutral: 0.14 },
        metadata: {
          modalityScores: { draw_first: 0.72, text_first: 0.14, neutral: 0.14 },
          expertiseScores: { novice: 0.7, standard: 0.2, power_user: 0.1 },
          selectedModality: 'draw_first',
          selectedExpertise: 'novice',
          composedUiVariant: 'draw_first__novice',
        },
      })
      .mockResolvedValueOnce({
        id: 'decision_2',
        sessionId: 'sess_client_det',
        mode: 'deterministic',
        variant: 'text_first__novice',
        selectedPersona: { id: 'text_first__novice', confidence: 0.81 },
        scores: { draw_first: 0.1, text_first: 0.81, neutral: 0.09 },
        metadata: {
          modalityScores: { draw_first: 0.1, text_first: 0.81, neutral: 0.09 },
          expertiseScores: { novice: 0.8, standard: 0.15, power_user: 0.05 },
          selectedModality: 'text_first',
          selectedExpertise: 'novice',
          composedUiVariant: 'text_first__novice',
        },
      });

    render(
      <AdaptiveProvider
        client={{ decisions: { resolve } } as any}
        mode="deterministic"
        decisionApplication="immediate"
        sessionId="sess_client_det"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        minEventsBeforeLock={1}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first__novice');
    });

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('text_first__novice');
    });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenNthCalledWith(1, { sessionId: 'sess_client_det', mode: 'deterministic' });
  });

  it('resolves MCP decisions through a Dionysys client when provided', async () => {
    const resolve = vi.fn().mockResolvedValue({
      id: 'decision_mcp_1',
      sessionId: 'sess_client_mcp',
      mode: 'mcp',
      variant: 'text_first__novice',
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
      selectedPersona: { id: 'text_first__novice', confidence: 0.64 },
      scores: { text_first: 0.8, draw_first: 0.1, neutral: 0.1 },
      rationale: 'Text events dominate.',
      metadata: {
        actionId: 'show_text_toolbar',
        modalityScores: { text_first: 0.8, draw_first: 0.1, neutral: 0.1 },
        expertiseScores: { novice: 0.64, standard: 0.24, power_user: 0.12 },
        selectedModality: 'text_first',
        selectedExpertise: 'novice',
        composedUiVariant: 'text_first__novice',
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
      },
    });

    render(
      <AdaptiveProvider
        client={{ decisions: { resolve } } as any}
        mode="mcp"
        decisionApplication="immediate"
        sessionId="sess_client_mcp"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
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
      expect(latestState?.currentUIState?.variant).toBe('text_first__novice');
      expect(latestState?.currentPersonality).toBe('text_first__novice');
      expect(latestState?.selectedModality).toBe('text_first');
      expect(latestState?.selectedExpertise).toBe('novice');
    });

    expect(resolve).toHaveBeenCalledWith({ sessionId: 'sess_client_mcp', mode: 'mcp' });
  });

  it('applies a pending MCP decision on the next mount for the same session', async () => {
    const sessionId = 'sess_provider_test';
    const mcpDecision = {
      id: 'decision_mcp_pending',
      sessionId,
      mode: 'mcp' as const,
      variant: 'text_first__novice',
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
      selectedPersona: { id: 'text_first__novice', confidence: 0.64 },
      scores: { text_first: 0.8, draw_first: 0.1, neutral: 0.1 },
      rationale: 'Text events are dominant.',
      metadata: {
        actionId: 'show_text_toolbar',
        selectedModality: 'text_first',
        selectedExpertise: 'novice',
      },
    };

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(mcpDecision) } } as any}
        mode="mcp"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
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
    expect(window.localStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeTruthy();

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
    await vi.waitFor(() => {
      expect(window.localStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeNull();
    });
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeTruthy();

    cleanup();
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
      expect(latestState?.hasPendingUIChange).toBe(false);
    });
  });

  it('persists the applied deterministic state across repeated remounts in immediate mode', async () => {
    const sessionId = 'sess_immediate_persist';

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(makeDeterministicResolve('draw_first__novice', sessionId)) } } as any}
        mode="deterministic"
        decisionApplication="immediate"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        minEventsBeforeLock={1}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first__novice');
    });
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeTruthy();

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="immediate"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first__novice');
    });
  });

  it('uses built-in applied persistence when only custom pending hooks are provided', async () => {
    const sessionId = 'sess_custom_pending_only';
    let customPendingDecision: PendingAdaptiveDecision | undefined;
    const savePendingDecision = vi.fn((decision: PendingAdaptiveDecision) => {
      customPendingDecision = decision;
    });
    const loadPendingDecision = vi.fn(() => customPendingDecision);
    const clearPendingDecision = vi.fn(() => {
      customPendingDecision = undefined;
    });

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(makeDeterministicResolve('text_first__novice', sessionId)) } } as any}
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        savePendingDecision={savePendingDecision}
        loadPendingDecision={loadPendingDecision}
        clearPendingDecision={clearPendingDecision}
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
    });
    expect(customPendingDecision?.variant).toBe('text_first__novice');
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeNull();

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        loadPendingDecision={loadPendingDecision}
        clearPendingDecision={clearPendingDecision}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('text_first__novice');
    });
    await vi.waitFor(() => {
      expect(customPendingDecision).toBeUndefined();
    });
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeTruthy();

    cleanup();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        loadPendingDecision={vi.fn(() => undefined)}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('text_first__novice');
    });
  });

  it('uses sessionStorage for pending and applied state in tab mode', async () => {
    const sessionId = 'sess_tab_mode';

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(makeDeterministicResolve('draw_first', sessionId)) } } as any}
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="tab"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
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
    });
    expect(window.sessionStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeTruthy();
    expect(window.localStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeNull();

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="tab"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first');
    });
    await vi.waitFor(() => {
      expect(window.sessionStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeNull();
    });
    expect(window.sessionStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeTruthy();
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeNull();
  });

  it('prefers custom applied hooks over built-in applied storage', async () => {
    const sessionId = 'sess_custom_applied';
    let customAppliedDecision: PendingAdaptiveDecision | undefined;
    const saveAppliedDecision = vi.fn((decision: PendingAdaptiveDecision) => {
      customAppliedDecision = decision;
    });
    const loadAppliedDecision = vi.fn(() => customAppliedDecision);

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(makeDeterministicResolve('draw_first__novice', sessionId)) } } as any}
        mode="deterministic"
        decisionApplication="immediate"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        saveAppliedDecision={saveAppliedDecision}
        loadAppliedDecision={loadAppliedDecision}
        minEventsBeforeLock={1}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    act(() => {
      latestState!.incrementEventsSent(1);
    });

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first__novice');
    });
    expect(customAppliedDecision?.variant).toBe('draw_first__novice');
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeNull();

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="immediate"
        sessionId={sessionId}
        persistenceMode="browser"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
        loadAppliedDecision={loadAppliedDecision}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('draw_first__novice');
    });
  });

  it('does not persist queued or applied state in memory mode', async () => {
    const sessionId = 'sess_memory_mode';

    const firstRender = render(
      <AdaptiveProvider
        client={{ decisions: { resolve: vi.fn().mockResolvedValue(makeDeterministicResolve('draw_first', sessionId)) } } as any}
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="memory"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
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
    });
    expect(window.localStorage.getItem(`dionysys:pending-decision:${sessionId}`)).toBeNull();
    expect(window.localStorage.getItem(`dionysys:applied-decision:${sessionId}`)).toBeNull();

    firstRender.unmount();
    latestState = null;

    render(
      <AdaptiveProvider
        mode="deterministic"
        decisionApplication="next-refresh"
        sessionId={sessionId}
        persistenceMode="memory"
        defaultVariant="neutral"
        defaultUIState={defaultUIState}
      >
        <Harness />
      </AdaptiveProvider>,
    );

    await vi.waitFor(() => {
      expect(latestState?.currentVariant).toBe('neutral');
    });
  });
});
