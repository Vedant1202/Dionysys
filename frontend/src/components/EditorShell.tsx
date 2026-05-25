import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen, serializeAsJSON } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import type { AdaptiveMode, AdaptivePersistenceMode } from '@dionysys/core';
import {
  AdaptiveFeedback,
  useAdaptiveUI,
  useFeedback,
  useFeedbackTrigger,
} from '@dionysys/react';
import { DebugPanel } from './DebugPanel';
import { eventCollector } from '../core/eventCollector';
import { DynamicToolbar } from './DynamicToolbar';
import { resolveVariantConfig } from '../config/variantConfig';
import { loadStoredExcalidrawScene, saveStoredExcalidrawScene } from '../core/session';
import { humanizeLabel } from '../utils/formatters';


const ADAPTIVE_FEEDBACK_BETA_ENABLED = import.meta.env.VITE_ADAPTIVE_FEEDBACK_BETA_ENABLED === 'true';

interface EditorShellProps {
  adaptiveMode: AdaptiveMode;
  persistenceMode: AdaptivePersistenceMode;
  sessionId: string;
  onAdaptiveModeChange: (mode: AdaptiveMode) => void;
  apiBaseUrl: string;
  browserId?: string;
  onOpenAdmin?: () => void;
}

interface AppliedDecisionPayload {
  mode: AdaptiveMode;
  variant: string;
  personalityId?: string;
  actionId?: string;
  confidence?: number;
  decisionKey: string;
  appliedAt: number;
}

export function EditorShell({ adaptiveMode, persistenceMode, sessionId, onAdaptiveModeChange, apiBaseUrl, browserId, onOpenAdmin }: EditorShellProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [appliedDecision, setAppliedDecision] = useState<AppliedDecisionPayload | undefined>();
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hiddenToolClickCount, setHiddenToolClickCount] = useState(0);
  const appliedDecisionRef = useRef<AppliedDecisionPayload | undefined>(undefined);
  const lastAppliedDecisionKeyRef = useRef<string | undefined>(undefined);
  const {
    presentationMode,
    currentVariant,
    currentUIState,
    currentPersonality,
    decisionConfidence,
    lastDecision,
    hasPendingUIChange,
    pendingPersonality,
    incrementEventsSent,
    setManualOverride,
  } = useAdaptiveUI();

  // ── Feedback loop hooks ────────────────────────────────────────────────────
  const {
    submitFeedback,
    triggerPassiveEval,
    pendingRevert,
    showCalibrationNote,
    confirmRevert,
    dismissRevert,
  } = useFeedback({
    sessionId,
    baseUrl: apiBaseUrl,
    onRevert: () => setManualOverride({ variant: 'neutral' }),
  });

  useFeedbackTrigger({
    triggerPassiveEval,
    // Only activate the trigger when the beta flag is on — gates all passive evals
    lastDecision: ADAPTIVE_FEEDBACK_BETA_ENABLED ? lastDecision : undefined,
    hiddenToolClickCount: ADAPTIVE_FEEDBACK_BETA_ENABLED ? hiddenToolClickCount : 0,
  });
  const isPrototype = presentationMode === 'prototype';

  const config = resolveVariantConfig(
    currentVariant,
    adaptiveMode === 'mcp' ? currentUIState : undefined,
  );
  const initialSceneData = loadStoredExcalidrawScene(persistenceMode, sessionId);
  const keepsNativeToolbar = config?.toolbar?.mode === 'blocklist';
  const usesPrioritizedToolbar = Boolean(config?.toolbar?.mode === 'allowlist' && !keepsNativeToolbar);

  // Wire the event collector to the current session and backend URL.
  // Must run before the first flush (which starts immediately on mount).
  useEffect(() => {
    eventCollector.setSessionId(sessionId);
    eventCollector.setApiBaseUrl(apiBaseUrl);
  }, [sessionId, apiBaseUrl]);

  useEffect(() => {
    // Passive evaluation is now handled by useFeedbackTrigger (threshold-based).
    // onFlush only needs to keep the event count in sync for policy decisions.
    eventCollector.onFlush = (count) => {
      incrementEventsSent(count);
    };
    return () => {
      eventCollector.onFlush = undefined;
    };
  }, [incrementEventsSent]);

  useEffect(() => {
    appliedDecisionRef.current = appliedDecision;
  }, [appliedDecision]);

  useEffect(() => {
    if (!ADAPTIVE_FEEDBACK_BETA_ENABLED) {
      return;
    }

    if (currentVariant === 'neutral') return;

    const decisionKey = buildDecisionKey(adaptiveMode, currentVariant, currentPersonality, lastDecision?.actionId);
    if (lastAppliedDecisionKeyRef.current === decisionKey) return;
    lastAppliedDecisionKeyRef.current = decisionKey;

    const decision = compactDecision({
      mode: adaptiveMode,
      variant: currentVariant,
      personalityId: currentPersonality,
      actionId: lastDecision?.actionId,
      confidence: decisionConfidence,
      decisionKey,
      appliedAt: Date.now(),
    });

    setAppliedDecision(decision);
    // Reset friction counter for the new decision window
    setHiddenToolClickCount(0);
    eventCollector.recordEvent({
      eventType: 'adaptive_decision_applied',
      timestamp: Date.now(),
      payload: { decision },
    });
    setShowFeedbackPrompt(window.sessionStorage.getItem(getFeedbackStorageKey(sessionId, decisionKey)) !== 'true');
  }, [adaptiveMode, currentVariant, currentPersonality, decisionConfidence, lastDecision?.actionId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const body: Record<string, string> = { sessionId };
      if (browserId) body['browserId'] = browserId;
      navigator.sendBeacon(
        `${apiBaseUrl}/api/reward/complete`,
        new Blob([JSON.stringify(body)], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [apiBaseUrl, sessionId, browserId]);

  const handleFeedback = async (feedback: { sentiment: 'helpful' | 'in_the_way'; comment?: string }) => {
    if (!ADAPTIVE_FEEDBACK_BETA_ENABLED || !appliedDecision) return;
    await submitFeedback(feedback);
    window.sessionStorage.setItem(getFeedbackStorageKey(sessionId, appliedDecision.decisionKey), 'true');
    setShowFeedbackPrompt(false);
  };

  const handleToolSelected = (tool: string, wasHiddenByPersona: boolean) => {
    if (!ADAPTIVE_FEEDBACK_BETA_ENABLED) return;

    if (wasHiddenByPersona) {
      setHiddenToolClickCount((n) => n + 1);
    }

    eventCollector.recordEvent({
      eventType: 'tool_selected',
      timestamp: Date.now(),
      payload: {
        tool,
        wasHiddenByPersona,
        variant: currentVariant,
        personalityId: currentPersonality,
      },
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
            <div className="badge badge-md border-amber-200/50 bg-amber-50/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800 backdrop-blur-sm">
              <span className="opacity-60 mr-1.5">Pending:</span>
              {humanizeLabel(pendingPersonality ?? 'decision ready')}
            </div>

          </div>
        )}
        {isPrototype && (
        <div className="flex-none">
          <div className="badge badge-md mr-2 border border-slate-200/60 bg-white/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 backdrop-blur-sm">
            Live Monitoring
          </div>
          <div className="badge badge-md border-0 bg-[linear-gradient(135deg,#635bff_0%,#7c3aed_100%)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-sm">
            {humanizeLabel(currentVariant)}
          </div>

        </div>
        )}
      </div>

      <div className="relative flex-grow border-t border-white/50">
        {usesPrioritizedToolbar && (
          <DynamicToolbar
            excalidrawAPI={excalidrawAPI}
            config={config}
            onToolSelected={handleToolSelected}
          />
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
        
        {isPrototype && (
          <DebugPanel />
        )}
        {ADAPTIVE_FEEDBACK_BETA_ENABLED && (showFeedbackPrompt || pendingRevert) && (
          <div className="absolute bottom-4 right-4 z-[1000]">
            {pendingRevert ? (
              <RevertPrompt onConfirm={confirmRevert} onDismiss={dismissRevert} />
            ) : (
              <>
                <AdaptiveFeedback onSubmit={handleFeedback} />
                {showCalibrationNote && (
                  <p style={calibrationNoteStyle}>✓ Workspace calibrated to your style</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Revert prompt ────────────────────────────────────────────────────────────

function RevertPrompt({ onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void }) {
  return (
    <section style={revertPanelStyle} aria-label="Workspace revert prompt">
      <p style={revertPromptTextStyle}>
        This layout doesn't seem to be working for you. Reset to default?
      </p>
      <div style={revertActionsStyle}>
        <button type="button" style={revertConfirmStyle} onClick={onConfirm}>
          Reset layout
        </button>
        <button type="button" style={revertDismissStyle} onClick={onDismiss}>
          Keep it
        </button>
      </div>
    </section>
  );
}

const revertPanelStyle: CSSProperties = {
  width: 280,
  borderRadius: 8,
  border: '1px solid rgba(190, 18, 60, 0.2)',
  background: 'rgba(255, 241, 242, 0.97)',
  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
  padding: 14,
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const revertPromptTextStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 13,
  lineHeight: 1.5,
  color: '#1f2933',
};

const revertActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const revertConfirmStyle: CSSProperties = {
  minHeight: 38,
  border: '1px solid rgba(190, 18, 60, 0.3)',
  borderRadius: 6,
  background: 'rgba(255, 241, 242, 0.94)',
  color: '#be123c',
  fontWeight: 900,
  cursor: 'pointer',
};

const revertDismissStyle: CSSProperties = {
  minHeight: 38,
  border: '1px solid #c8c0b2',
  borderRadius: 6,
  background: '#ffffff',
  color: '#273444',
  fontWeight: 800,
  cursor: 'pointer',
};

const calibrationNoteStyle: CSSProperties = {
  margin: '6px 0 0',
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(209, 250, 229, 0.94)',
  color: '#065f46',
  fontSize: 12,
  fontWeight: 800,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDecisionKey(
  mode: AdaptiveMode,
  variant: string,
  personalityId: string | undefined,
  actionId: string | undefined,
): string {
  return [mode, variant, personalityId ?? '', actionId ?? ''].join('::');
}

function getFeedbackStorageKey(sessionId: string, decisionKey: string): string {
  return `dionysys:adaptive-feedback:${sessionId}:${decisionKey}`;
}

function compactDecision(decision: AppliedDecisionPayload): AppliedDecisionPayload {
  return Object.fromEntries(Object.entries(decision).filter(([, value]) => value !== undefined)) as AppliedDecisionPayload;
}
