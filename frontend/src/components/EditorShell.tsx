import { useState, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen, serializeAsJSON } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import type { AdaptiveMode, AdaptivePersistenceMode } from '@dionysys/core';
import { AdaptiveFeedback, type AdaptiveFeedbackSubmission, useAdaptiveUI } from '@dionysys/react';
import { DebugPanel } from './DebugPanel';
import { eventCollector } from '../core/eventCollector';
import { DynamicToolbar } from './DynamicToolbar';
import { resolveVariantConfig } from '../config/variantConfig';
import { loadStoredExcalidrawScene, saveStoredExcalidrawScene } from '../core/session';

interface EditorShellProps {
  adaptiveMode: AdaptiveMode;
  persistenceMode: AdaptivePersistenceMode;
  sessionId: string;
  onAdaptiveModeChange: (mode: AdaptiveMode) => void;
  apiBaseUrl: string;
  onOpenAdmin?: () => void;
}

export function EditorShell({
  adaptiveMode,
  persistenceMode,
  sessionId,
  onAdaptiveModeChange,
  apiBaseUrl,
  onOpenAdmin,
}: EditorShellProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const {
    presentationMode,
    currentVariant,
    currentUIState,
    hasPendingUIChange,
    pendingPersonality,
    incrementEventsSent,
  } = useAdaptiveUI();
  const isPrototype = presentationMode === 'prototype';

  const config = resolveVariantConfig(
    currentVariant,
    adaptiveMode === 'mcp' ? currentUIState : undefined,
  );
  const initialSceneData = loadStoredExcalidrawScene(persistenceMode, sessionId);
  const keepsNativeToolbar = config?.toolbar?.mode === 'blocklist';
  const usesPrioritizedToolbar = Boolean(config?.toolbar?.mode === 'allowlist' && !keepsNativeToolbar);

  useEffect(() => {
    eventCollector.setApiBaseUrl(apiBaseUrl);
    eventCollector.setSessionId(sessionId);
    eventCollector.onFlush = incrementEventsSent;
    return () => {
      eventCollector.onFlush = undefined;
    };
  }, [apiBaseUrl, incrementEventsSent, sessionId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${apiBaseUrl}/api/reward/complete`,
        new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [apiBaseUrl, sessionId]);

  const handleFeedback = async (feedback: AdaptiveFeedbackSubmission) => {
    await fetch(`${apiBaseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: [
          {
            eventType: 'feedback_submitted',
            timestamp: Date.now(),
            payload: feedback,
          },
        ],
      }),
    });
  };

  const getUIOptions = (): any => {
    if (!config || keepsNativeToolbar) return undefined;
    return {
      canvasActions: config.canvasActions
    };
  };

  const modeButtonClass = (isActive: boolean) => [
    'join-item btn btn-sm min-w-[108px] rounded-[1.05rem] border-0 text-base font-semibold tracking-[-0.01em] transition-all duration-200',
    isActive
      ? 'bg-[linear-gradient(135deg,rgba(99,91,255,0.96)_0%,rgba(124,58,237,0.92)_100%)] text-white shadow-[0_12px_28px_rgba(99,91,255,0.22)] hover:translate-y-0 hover:text-white'
      : 'bg-white/38 text-slate-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.42)] hover:bg-white/52 hover:text-slate-900',
  ].join(' ');

  useEffect(() => {
    if (!excalidrawAPI) return;

    excalidrawAPI.updateScene({
      appState: {
        theme: 'light',
        currentItemStrokeColor: '#312e81',
        currentItemBackgroundColor: '#c7d2fe',
        currentItemFillStyle: 'solid',
      },
    });
  }, [excalidrawAPI]);

  if (!config) return null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eef2ff_36%,_#f8fbff_100%)]">
      <div className="navbar z-50 border-b border-white/70 bg-white/78 shadow-[0_18px_60px_rgba(99,102,241,0.10)] backdrop-blur-xl">
        <div className="flex-1">
          <a className="btn btn-ghost rounded-2xl border-0 text-xl font-bold tracking-tight text-slate-900 shadow-none hover:bg-white/34 hover:text-slate-950">Dionysys <span className="text-indigo-600">Adaptive UI</span></a>
        </div>
        {isPrototype && (
        <div className="flex-none">
          <div className="join gap-1 rounded-[1.35rem] bg-white/16 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.34)] backdrop-blur-sm" aria-label="Adaptive mode">
            <button
              type="button"
              className={modeButtonClass(adaptiveMode === 'deterministic')}
              onClick={() => onAdaptiveModeChange('deterministic')}
            >
              Deterministic
            </button>
            <button
              type="button"
              className={modeButtonClass(adaptiveMode === 'mcp')}
              onClick={() => onAdaptiveModeChange('mcp')}
            >
              MCP
            </button>
          </div>
        </div>
        )}
        {onOpenAdmin && (
          <div className="flex-none ml-2">
            <button
              type="button"
              className="btn btn-sm rounded-[1.05rem] border-0 bg-white/34 px-4 text-slate-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] transition-all duration-200 hover:bg-white/48 hover:text-slate-900"
              onClick={onOpenAdmin}
            >
              Admin
            </button>
          </div>
        )}
        {isPrototype && (
        <div className="flex-none gap-2 px-4 text-sm text-slate-700">
           Session: {sessionId} ({persistenceMode})
        </div>
        )}
        {isPrototype && hasPendingUIChange && (
          <div className="flex-none">
            <div className="badge badge-md border-amber-200 bg-amber-50 uppercase tracking-widest text-[10px] py-1 text-amber-800">
              Pending refresh: {pendingPersonality?.replace('_', ' ') ?? 'decision ready'}
            </div>
          </div>
        )}
        {isPrototype && (
        <div className="flex-none">
          <div className="badge badge-md mr-2 border border-slate-200 bg-white/70 uppercase tracking-widest text-[10px] py-1 text-slate-700">Experiment Active</div>
          <div className="badge badge-md border-0 bg-[linear-gradient(135deg,#635bff_0%,#7c3aed_100%)] uppercase tracking-widest text-[10px] py-1 font-bold text-white">
            {currentVariant.replace('_', ' ')}
          </div>
        </div>
        )}
      </div>

      <div className="relative flex-grow border-t border-white/50">
        {usesPrioritizedToolbar && (
          <DynamicToolbar excalidrawAPI={excalidrawAPI} config={config} />
        )}
        {usesPrioritizedToolbar && (
          <style>{`
            .excalidraw .App-toolbar { 
              opacity: 0 !important; 
              pointer-events: none !important; 
            }

            .excalidraw.theme--light {
              --color-primary: #5b5bd6;
              --color-surface-high: #ffffff;
              --default-bg-color: #ffffff;
              --default-text-color: #1f2a44;
              --default-sidebar-bg-color: rgba(255, 255, 255, 0.92);
              --default-sidebar-border-color: rgba(129, 140, 248, 0.18);
              --color-selection: rgba(99, 102, 241, 0.18);
              --color-selection-bg: rgba(99, 102, 241, 0.12);
              --color-selection-stroke: #6366f1;
              --color-highlight: rgba(199, 210, 254, 0.95);
            }

            .excalidraw.theme--light .TextEditorContainer > textarea,
            .excalidraw.theme--light .excalidraw-textEditorContainer > textarea,
            .excalidraw.theme--light textarea {
              color: #1f2a44 !important;
              caret-color: #1f2a44 !important;
            }

            .excalidraw.theme--light .color-picker-content,
            .excalidraw.theme--light .dropdown-menu {
              color: #1f2a44;
            }
          `}</style>
        )}
        <Excalidraw
          key={`${persistenceMode}-${sessionId}`}
          theme="light"
          initialData={initialSceneData}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={getUIOptions()}
          onChange={(elements, appState, files) => {
            eventCollector.handleExcalidrawChange(elements, appState, files);
            saveStoredExcalidrawScene(
              persistenceMode,
              sessionId,
              serializeAsJSON(elements, appState, files, 'local'),
            );
          }}
        >
          {config.showWelcomeScreen && (
            <WelcomeScreen>
              <WelcomeScreen.Hints.MenuHint />
              <WelcomeScreen.Hints.ToolbarHint />
              <WelcomeScreen.Hints.HelpHint />
              <WelcomeScreen.Center>
                <WelcomeScreen.Center.Heading>
                  Welcome to Guided Mode
                </WelcomeScreen.Center.Heading>
                <WelcomeScreen.Center.Menu>
                  <div className="mx-auto max-w-md rounded-[1.75rem] border border-white/80 bg-white/86 p-8 leading-relaxed shadow-[0_24px_70px_rgba(99,102,241,0.12)] backdrop-blur-xl">
                    <p className="text-lg font-medium mb-2">Need a hand?</p>
                    Please select a tool from the top toolbar to begin. 
                    Don't worry, we've hidden advanced features to help you focus on your first drawing!
                  </div>
                </WelcomeScreen.Center.Menu>
              </WelcomeScreen.Center>
            </WelcomeScreen>
          )}

          <MainMenu>
            {config.mainMenuItems.map(item => {
              if (item === 'saveAsImage') return <MainMenu.DefaultItems.SaveAsImage key={item} />;
              if (item === 'export') return <MainMenu.DefaultItems.Export key={item} />;
              if (item === 'clearCanvas') return <MainMenu.DefaultItems.ClearCanvas key={item} />;
              if (item === 'help') return <MainMenu.DefaultItems.Help key={item} />;
              if (item === 'toggleTheme') return <MainMenu.DefaultItems.ToggleTheme key={item} />;
              return null;
            })}
          </MainMenu>
        </Excalidraw>
        
        {isPrototype ? (
          <DebugPanel />
        ) : (
          <div className="absolute bottom-4 right-4 z-[1000]">
            <AdaptiveFeedback onSubmit={handleFeedback} />
          </div>
        )}
      </div>
    </div>
  );
}
