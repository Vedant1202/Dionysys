import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorShell } from './EditorShell';
import { loadStoredExcalidrawScene, saveStoredExcalidrawScene } from '../core/session';

const { mockExcalidraw, mockSerializeAsJSON } = vi.hoisted(() => ({
  mockExcalidraw: vi.fn(),
  mockSerializeAsJSON: vi.fn(),
}));

vi.mock('@dionysys/react', () => ({
  AdaptiveFeedback: () => <div data-testid="adaptive-feedback" />,
  useAdaptiveUI: () => ({
    presentationMode: 'prototype',
    currentVariant: 'neutral',
    currentUIState: undefined,
    hasPendingUIChange: false,
    pendingPersonality: undefined,
    incrementEventsSent: vi.fn(),
  }),
  useFeedback: () => ({
    submitFeedback: vi.fn(),
    triggerPassiveEval: vi.fn(),
    pendingRevert: false,
    showCalibrationNote: false,
    confirmRevert: vi.fn(),
    dismissRevert: vi.fn(),
  }),
  useFeedbackTrigger: () => ({
    promptVisible: false,
    dismissPrompt: vi.fn(),
  }),
  useAdaptiveComponent: () => ({
    isRelevant: true,
    relevance: 1,
  }),
}));

vi.mock('../hooks/useAdaptationEngine', () => ({
  useAdaptationEngine: () => ({
    presentationMode: 'prototype',
    currentVariant: 'neutral',
    currentUIState: undefined,
    hasPendingUIChange: false,
    pendingPersonality: undefined,
    incrementEventsSent: vi.fn(),
  }),
}));

vi.mock('./DebugPanel', () => ({
  DebugPanel: () => <div data-testid="debug-panel" />,
}));

vi.mock('./DynamicToolbar', () => ({
  DynamicToolbar: () => <div data-testid="dynamic-toolbar" />,
}));

vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      DefaultItems: {
        SaveAsImage: () => null,
        Export: () => null,
        ClearCanvas: () => null,
        Help: () => null,
        ToggleTheme: () => null,
      },
    },
  );

  const WelcomeScreenCenter = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Heading: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Menu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
  );

  const WelcomeScreen = Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Hints: {
        MenuHint: () => null,
        ToolbarHint: () => null,
        HelpHint: () => null,
      },
      Center: WelcomeScreenCenter,
    },
  );

  return {
    Excalidraw: (props: unknown) => {
      mockExcalidraw(props);
      return <div data-testid="excalidraw" />;
    },
    MainMenu,
    WelcomeScreen,
    serializeAsJSON: mockSerializeAsJSON,
  };
});

describe('EditorShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockExcalidraw.mockClear();
    mockSerializeAsJSON.mockReset();
  });

  it('hydrates Excalidraw with the persisted scene for the current browser session', () => {
    const sessionId = 'sess_editor_hydrate';
    const scene = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [{ id: 'shape-1', type: 'rectangle' }],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    saveStoredExcalidrawScene('browser', sessionId, JSON.stringify(scene));

    render(
      <EditorShell
        adaptiveMode="deterministic"
        persistenceMode="browser"
        sessionId={sessionId}
        onAdaptiveModeChange={vi.fn()}
        apiBaseUrl="http://localhost:3001"
      />,
    );

    const lastProps = mockExcalidraw.mock.calls.at(-1)?.[0] as { initialData?: unknown };

    expect(lastProps.initialData).toEqual(scene);
  });

  it('persists scene changes for the active browser session', () => {
    const sessionId = 'sess_editor_save';
    const savedSceneJson = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'serialized',
      elements: [{ id: 'shape-2', type: 'ellipse' }],
      appState: { viewBackgroundColor: '#f8fafc' },
      files: {},
    });

    mockSerializeAsJSON.mockReturnValue(savedSceneJson);

    render(
      <EditorShell
        adaptiveMode="deterministic"
        persistenceMode="browser"
        sessionId={sessionId}
        onAdaptiveModeChange={vi.fn()}
        apiBaseUrl="http://localhost:3001"
      />,
    );

    const lastProps = mockExcalidraw.mock.calls.at(-1)?.[0] as {
      onChange: (elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => void;
    };

    lastProps.onChange([{ id: 'shape-2' }], { viewBackgroundColor: '#f8fafc' }, {});

    expect(mockSerializeAsJSON).toHaveBeenCalledWith(
      [{ id: 'shape-2' }],
      { viewBackgroundColor: '#f8fafc' },
      {},
      'local',
    );
    expect(loadStoredExcalidrawScene('browser', sessionId)).toEqual(JSON.parse(savedSceneJson));
  });
});
