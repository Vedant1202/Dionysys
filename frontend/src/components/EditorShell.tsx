import { useState, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import type { AdaptiveMode, AdaptivePersistenceMode } from '@dionysys/core';
import { AdaptiveFeedback, type AdaptiveFeedbackSubmission, useAdaptiveUI } from '@dionysys/react';
import { DebugPanel } from './DebugPanel';
import { eventCollector } from '../core/eventCollector';
import { DynamicToolbar } from './DynamicToolbar';
import { resolveVariantConfig } from '../config/variantConfig';

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

  if (!config) return null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-base-200">
      <div className="navbar bg-base-100 shadow-md z-50">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold tracking-tight">Dionysys <span className="text-primary">Adaptive UI</span></a>
        </div>
        {isPrototype && (
        <div className="flex-none">
          <div className="join" aria-label="Adaptive mode">
            <button
              type="button"
              className={`join-item btn btn-sm ${adaptiveMode === 'deterministic' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onAdaptiveModeChange('deterministic')}
            >
              Deterministic
            </button>
            <button
              type="button"
              className={`join-item btn btn-sm ${adaptiveMode === 'mcp' ? 'btn-primary' : 'btn-ghost'}`}
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
              className="btn btn-sm btn-outline"
              onClick={onOpenAdmin}
            >
              Admin
            </button>
          </div>
        )}
        {isPrototype && (
        <div className="flex-none gap-2 px-4 italic text-sm opacity-60">
           Session: {sessionId} ({persistenceMode})
        </div>
        )}
        {isPrototype && hasPendingUIChange && (
          <div className="flex-none">
            <div className="badge badge-warning badge-md uppercase tracking-widest text-[10px] py-1">
              Pending refresh: {pendingPersonality?.replace('_', ' ') ?? 'decision ready'}
            </div>
          </div>
        )}
        {isPrototype && (
        <div className="flex-none">
          <div className="badge badge-outline badge-md mr-2 uppercase tracking-widest text-[10px] py-1">Experiment Active</div>
          <div className={`badge badge-primary badge-md uppercase tracking-widest text-[10px] py-1 font-bold`}>
            {currentVariant.replace('_', ' ')}
          </div>
        </div>
        )}
      </div>

      <div className="flex-grow relative border-t border-base-300">
        {usesPrioritizedToolbar && (
          <DynamicToolbar excalidrawAPI={excalidrawAPI} config={config} />
        )}
        {usesPrioritizedToolbar && (
          <style>{`
            .excalidraw .App-toolbar { 
              opacity: 0 !important; 
              pointer-events: none !important; 
            }
          `}</style>
        )}
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={getUIOptions()}
          onChange={(elements, appState, files) => {
            eventCollector.handleExcalidrawChange(elements, appState, files);
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
                  <div className="bg-base-100 p-8 rounded-xl shadow-lg leading-relaxed max-w-md mx-auto border border-primary/20">
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
