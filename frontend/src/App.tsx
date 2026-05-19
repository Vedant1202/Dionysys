import { useEffect, useState } from 'react';
import { AdaptiveProvider, AdminConsole } from '@dionysys/react';
import type {
  AdaptiveDecision,
  AdaptiveDecisionApplication,
  AdaptiveMode,
  AdaptivePersistenceMode,
  AdaptivePresentationMode,
  AdminConsoleConfig,
} from '@dionysys/core';
import { EditorShell } from './components/EditorShell';
import {
  clearStoredExcalidrawScene,
  clearStoredAppliedDecision,
  clearStoredPendingDecision,
  getOrCreateSessionId,
  randomizeSessionId,
} from './core/session';
import { VARIANT_CONFIGS } from './config/variantConfig';
import { AnalyticsTracker } from './analytics';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const ADMIN_CONSOLE_VISIBLE = import.meta.env.DEV || import.meta.env.VITE_ADMIN_CONSOLE_ENABLED === 'true';

type ApplyAdminConfigOptions = {
  remountProvider?: boolean;
};

function App() {
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('deterministic');
  const [presentationMode, setPresentationMode] = useState<AdaptivePresentationMode>('prototype');
  const [decisionApplication, setDecisionApplication] = useState<AdaptiveDecisionApplication>('next-refresh');
  const [persistenceMode, setPersistenceMode] = useState<AdaptivePersistenceMode>('browser');
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId('browser'));
  const [providerVersion, setProviderVersion] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isConfigBootstrapped, setIsConfigBootstrapped] = useState(!ADMIN_CONSOLE_VISIBLE);
  const [providerSettings, setProviderSettings] = useState({
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  });

  useEffect(() => {
    if (!ADMIN_CONSOLE_VISIBLE) return;

    let isMounted = true;

    fetch(`${API_BASE_URL}/api/admin/config`)
      .then((response) => response.ok ? response.json() : undefined)
      .then((payload: { config?: AdminConsoleConfig } | undefined) => {
        if (!isMounted || !payload?.config) return;
        applyAdminConfig(payload.config, { remountProvider: false });
      })
      .catch(() => {
        // The admin backend is intentionally env-gated. The console itself will show the detailed state when opened.
      })
      .finally(() => {
        if (isMounted) setIsConfigBootstrapped(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applyAdminConfig = (config: AdminConsoleConfig, options: ApplyAdminConfigOptions = {}) => {
    const { remountProvider = true } = options;

    setAdaptiveMode(config.mode.defaultMode);
    setPresentationMode(config.mode.presentationMode);
    setDecisionApplication(config.mode.decisionApplication);
    setPersistenceMode(config.mode.persistenceMode);
    setProviderSettings({
      minEventsBeforeLock: config.mode.minEventsBeforeLock,
      pollingIntervalMs: config.mode.pollingIntervalMs,
    });

    if (remountProvider) {
      setProviderVersion((version) => version + 1);
    }
  };

  useEffect(() => {
    setSessionId(getOrCreateSessionId(persistenceMode));
  }, [persistenceMode]);

  const handleRandomizeSession = () => {
    if (import.meta.env.PROD) return;

    clearStoredExcalidrawScene(persistenceMode, sessionId);
    clearStoredPendingDecision(persistenceMode, sessionId);
    clearStoredAppliedDecision(persistenceMode, sessionId);
    randomizeSessionId(persistenceMode);
    window.location.reload();
  };

  if (!isConfigBootstrapped) {
    return (
      <div className="App" data-theme="winter">
        <div className="adaptive-bootstrap" role="status">
          Loading adaptive configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="App" data-theme="winter">
      <AnalyticsTracker />
      <AdaptiveProvider
         key={`${adaptiveMode}-${presentationMode}-${decisionApplication}-${persistenceMode}-${sessionId}-${providerVersion}`}
         mode={adaptiveMode}
         presentationMode={presentationMode}
         decisionApplication={decisionApplication}
         persistenceMode={persistenceMode}
         sessionId={sessionId}
         defaultVariant="neutral"
         defaultUIState={{ variant: 'neutral', ...VARIANT_CONFIGS.neutral }}
         minEventsBeforeLock={providerSettings.minEventsBeforeLock}
         pollingIntervalMs={providerSettings.pollingIntervalMs}
         pollInference={adaptiveMode === 'deterministic' ? async () => {
           const response = await fetch(`${API_BASE_URL}/api/inference/${sessionId}`);
           if (response.ok) {
             const data = await response.json();
             return data.probabilities;
           }
           return {};
         } : undefined}
         evaluatePolicy={adaptiveMode === 'deterministic' ? async () => {
           const response = await fetch(`${API_BASE_URL}/api/adaptive/decision`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId, mode: 'deterministic' })
           });
           const data = await response.json();
           return data;
         } : undefined}
         resolveDecision={adaptiveMode === 'mcp' ? async () => {
           const response = await fetch(`${API_BASE_URL}/api/adaptive/decision`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId, mode: 'mcp' })
           });
           const data = await response.json();
           return data as AdaptiveDecision;
         } : undefined}
      >
        <EditorShell
          adaptiveMode={adaptiveMode}
          persistenceMode={persistenceMode}
          sessionId={sessionId}
          onAdaptiveModeChange={setAdaptiveMode}
          apiBaseUrl={API_BASE_URL}
          onOpenAdmin={ADMIN_CONSOLE_VISIBLE && presentationMode === 'prototype' ? () => setIsAdminOpen(true) : undefined}
        />
      </AdaptiveProvider>

      {isAdminOpen && (
        <div className="admin-console-overlay" role="dialog" aria-modal="true" aria-label="Dionysys admin console">
          <AdminConsole
            apiBaseUrl={API_BASE_URL}
            sessionId={sessionId}
            persistenceMode={persistenceMode}
            canRandomizeSession={!import.meta.env.PROD}
            onRandomizeSession={handleRandomizeSession}
            onClose={() => setIsAdminOpen(false)}
            onConfigSaved={applyAdminConfig}
          />
        </div>
      )}
    </div>
  );
}

export default App;
