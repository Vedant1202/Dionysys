import { useState, useEffect, useRef } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen, serializeAsJSON } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import type { AdaptiveMode, AdaptivePersistenceMode } from '@dionysys/core';
import {
  AdaptiveFeedback,
  useFeedback,
  useFeedbackTrigger,
  useAdaptiveComponent,
} from '@dionysys/react';
import { useAdaptationEngine as useAdaptiveUI } from '../hooks/useAdaptationEngine';
import { DebugPanel } from './DebugPanel';
import { DynamicToolbar } from './DynamicToolbar';
import { eventCollector } from '../core/eventCollector';
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
  const [productiveActionsSinceDecision, setProductiveActionsSinceDecision] = useState(0);
  const [globalProductiveActions, setGlobalProductiveActions] = useState(0);
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

  const { promptVisible, dismissPrompt } = useFeedbackTrigger({
    triggerPassiveEval,
    lastDecision: ADAPTIVE_FEEDBACK_BETA_ENABLED ? lastDecision : undefined,
    hiddenToolClickCount: ADAPTIVE_FEEDBACK_BETA_ENABLED ? hiddenToolClickCount : 0,
    productiveActionCount: ADAPTIVE_FEEDBACK_BETA_ENABLED ? productiveActionsSinceDecision : 0,
  });
  const isPrototype = presentationMode === 'prototype';

  const config = resolveVariantConfig(
    currentVariant,
    adaptiveMode === 'mcp' ? currentUIState : undefined,
  );
  
  const { isRelevant: showWelcomeScreen } = useAdaptiveComponent({ id: 'action_welcomeScreen', defaultCoordinate: { novice: 1.0 } });
  const { isRelevant: showHelp } = useAdaptiveComponent({ id: 'action_help', defaultCoordinate: { novice: 1.0, standard: 0.5 } });
  const { isRelevant: showSaveAsImage } = useAdaptiveComponent({ id: 'action_saveAsImage', defaultCoordinate: { standard: 1.0, power_user: 1.0 } });
  const { isRelevant: showExport } = useAdaptiveComponent({ id: 'action_export', defaultCoordinate: { power_user: 1.0 } });
  const { isRelevant: showClearCanvas } = useAdaptiveComponent({ id: 'action_clearCanvas', defaultCoordinate: { draw_first: 1.0, power_user: 1.0 } });
  const { isRelevant: showToggleTheme } = useAdaptiveComponent({ id: 'action_toggleTheme', defaultCoordinate: { standard: 1.0, power_user: 1.0 } });

  const initialSceneData = loadStoredExcalidrawScene(persistenceMode, sessionId);
  const usesPrioritizedToolbar = config?.toolbar?.mode === 'allowlist';

  useEffect(() => {
    eventCollector.setSessionId(sessionId);
    eventCollector.setApiBaseUrl(apiBaseUrl);
  }, [sessionId, apiBaseUrl]);

  useEffect(() => {
    const PRODUCTIVE_EVENT_TYPES = new Set([
      'element_drawn',
      'text_added',
      'element_modified',
      'text_updated',
    ]);

    eventCollector.onFlush = (count, events) => {
      incrementEventsSent(count);
      if (!ADAPTIVE_FEEDBACK_BETA_ENABLED) return;
      const productive = events.filter((e) => PRODUCTIVE_EVENT_TYPES.has(e.eventType)).length;
      if (productive > 0) {
        setProductiveActionsSinceDecision((n) => n + productive);
        setGlobalProductiveActions((n) => n + productive);
      }
    };
    return () => {
      eventCollector.onFlush = undefined;
    };
  }, [incrementEventsSent]);

  useEffect(() => {
    appliedDecisionRef.current = appliedDecision;
  }, [appliedDecision]);

  useEffect(() => {
    if (!ADAPTIVE_FEEDBACK_BETA_ENABLED) return;
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
    setHiddenToolClickCount(0);
    setProductiveActionsSinceDecision(0);
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
    eventCollector.recordEvent({
      eventType: 'tool_selected',
      timestamp: Date.now(),
      payload: { tool, wasHiddenByPersona, variant: currentVariant, personalityId: currentPersonality },
    });
  };
  void handleToolSelected; // retained for feedback logging if re-enabled

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

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="flex flex-none items-center gap-3 border-b border-indigo-50 bg-white/96 px-5 py-0 min-h-[52px] shadow-[0_1px_0_rgba(99,102,241,0.07)] backdrop-blur-sm z-50">
        <div className="flex-1 flex items-center">
          <span className="text-[17px] font-bold tracking-tight text-slate-900 select-none">
            Dionysys <span className="text-indigo-600">Adaptive UI</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPrototype && (
            <div
              className="flex gap-0.5 rounded-xl bg-slate-100/80 p-0.5 border border-slate-200/50"
              aria-label="Adaptive mode"
            >
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
          )}

          {onOpenAdmin && (
            <button
              type="button"
              className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-none transition-colors hover:border-indigo-200 hover:text-indigo-600"
              onClick={onOpenAdmin}
            >
              Admin
            </button>
          )}

          {isPrototype && (
            <span className="hidden sm:block font-mono text-[11px] text-slate-400 tracking-tight max-w-[200px] truncate">
              {sessionId.slice(0, 16)}… · {persistenceMode}
            </span>
          )}

          {isPrototype && hasPendingUIChange && (
            <span className="rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-amber-700">
              ⏳ {humanizeLabel(pendingPersonality ?? 'pending')}
            </span>
          )}

          {isPrototype && (
            <>
              <span className="rounded-full border border-slate-200/50 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Live
              </span>
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-sm">
                {humanizeLabel(currentVariant)}
              </span>
            </>
          )}
        </div>
      </header>

      {/* ── Canvas area ───────────────────────────────────────────────────── */}
      <div className="relative flex-grow border-t border-white/50">
        {/* Excalidraw theme overrides; hide native toolbar when DynamicToolbar is active */}
        <style>{`
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
          ${usesPrioritizedToolbar ? '.excalidraw .App-toolbar { opacity: 0 !important; pointer-events: none !important; }' : ''}
        `}</style>

        {usesPrioritizedToolbar && (
          <DynamicToolbar
            excalidrawAPI={excalidrawAPI}
            onToolSelected={handleToolSelected}
            productiveActionCount={globalProductiveActions}
          />
        )}

        <Excalidraw
          key={`${persistenceMode}-${sessionId}`}
          theme="light"
          initialData={initialSceneData}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={{
            canvasActions: {
              saveAsImage: showSaveAsImage,
              saveToActiveFile: showSaveAsImage,
              export: { saveFileToDisk: showExport },
              clearCanvas: showClearCanvas,
              toggleTheme: showToggleTheme,
            }
          }}
          onChange={(elements, appState, files) => {
            eventCollector.handleExcalidrawChange(elements, appState, files);
            saveStoredExcalidrawScene(
              persistenceMode,
              sessionId,
              serializeAsJSON(elements, appState, files, 'local'),
            );
          }}
        >
          {showWelcomeScreen && (
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
            {showSaveAsImage && <MainMenu.DefaultItems.SaveAsImage key="saveAsImage" />}
            {showExport && <MainMenu.DefaultItems.Export key="export" />}
            {showClearCanvas && <MainMenu.DefaultItems.ClearCanvas key="clearCanvas" />}
            {showHelp && <MainMenu.DefaultItems.Help key="help" />}
            {showToggleTheme && <MainMenu.DefaultItems.ToggleTheme key="toggleTheme" />}
          </MainMenu>
        </Excalidraw>

        {isPrototype && <DebugPanel />}

        {ADAPTIVE_FEEDBACK_BETA_ENABLED && (pendingRevert || (promptVisible && showFeedbackPrompt) || showCalibrationNote) && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1000]">
            <div className="pointer-events-auto w-full h-full relative">
              <AdaptiveFeedback 
                onSubmit={handleFeedback} 
                onDismiss={dismissPrompt} 
                pendingRevert={pendingRevert}
                onKeep={() => {
                  dismissRevert();
                  void handleFeedback({ sentiment: 'helpful' });
                }}
                onRevertClick={confirmRevert}
                showCalibrationNote={showCalibrationNote}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mode button class helper ─────────────────────────────────────────────────

function modeButtonClass(isActive: boolean) {
  return [
    'rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-all duration-150',
    isActive
      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100/60'
      : 'text-slate-500 hover:text-slate-700',
  ].join(' ');
}

// Custom revert prompt removed in favor of AdaptiveFeedback

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDecisionKey(mode: AdaptiveMode, variant: string, personalityId: string | undefined, actionId: string | undefined): string {
  return [mode, variant, personalityId ?? '', actionId ?? ''].join('::');
}

function getFeedbackStorageKey(sessionId: string, decisionKey: string): string {
  return `dionysys:adaptive-feedback:${sessionId}:${decisionKey}`;
}

function compactDecision(decision: AppliedDecisionPayload): AppliedDecisionPayload {
  return Object.fromEntries(Object.entries(decision).filter(([, value]) => value !== undefined)) as AppliedDecisionPayload;
}
