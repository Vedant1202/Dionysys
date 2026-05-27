import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
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

const BROWSER_ID_KEY = 'dionysys_browser_id';

function getOrCreateBrowserId(): string {
  const existing = localStorage.getItem(BROWSER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(BROWSER_ID_KEY, id);
  return id;
}

function App() {
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('deterministic');
  const [presentationMode, setPresentationMode] = useState<AdaptivePresentationMode>('prototype');
  const [decisionApplication, setDecisionApplication] = useState<AdaptiveDecisionApplication>('next-refresh');
  const [persistenceMode, setPersistenceMode] = useState<AdaptivePersistenceMode>('browser');
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId('browser'));
  const [browserId] = useState(() => getOrCreateBrowserId());
  const priorRef = useRef<Record<string, number> | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
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

  // Fetch cross-session persona prior on mount and store for first pollInference call
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/inference/prior?browserId=${encodeURIComponent(browserId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: { success: boolean; personaPriors: Record<string, number> }) => {
        if (!cancelled && body.personaPriors) {
          priorRef.current = body.personaPriors;
        }
      })
      .catch(() => { /* 404 or beta off — no prior to seed */ });
    return () => { cancelled = true; };
  }, [browserId]);

  useEffect(() => {
    setSessionId(getOrCreateSessionId(persistenceMode));
  }, [persistenceMode]);

  const pollInferenceFn = useCallback(async () => {
    // On the first call, return the stored cross-session prior (if available) instead of fetching
    if (priorRef.current) {
      const prior = priorRef.current;
      priorRef.current = null; // consume once
      return prior;
    }
    const response = await fetch(`${API_BASE_URL}/api/inference/${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      return data.probabilities as Record<string, number>;
    }
    return {};
  }, [sessionId]);

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
      
      <Routes>
        <Route path="/admin" element={
          <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'var(--color-base-100)' }}>
            <AdminConsole
              apiBaseUrl={API_BASE_URL}
              sessionId={sessionId}
              persistenceMode={persistenceMode}
              canRandomizeSession={!import.meta.env.PROD}
              onRandomizeSession={handleRandomizeSession}
              onClose={() => { window.close(); }}
              onConfigSaved={applyAdminConfig}
            />
          </div>
        } />
        
        <Route path="/admin/explorer" element={
          <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'var(--color-base-100)' }}>
            <AdminConsole
              apiBaseUrl={API_BASE_URL}
              sessionId={sessionId}
              persistenceMode={persistenceMode}
              canRandomizeSession={!import.meta.env.PROD}
              onRandomizeSession={handleRandomizeSession}
              onClose={() => { window.close(); }}
              onConfigSaved={applyAdminConfig}
              defaultTab="explorer"
            />
          </div>
        } />
        
        <Route path="*" element={
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
         pollInference={adaptiveMode === 'deterministic' ? pollInferenceFn : undefined}
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
          browserId={browserId}
          onAdaptiveModeChange={setAdaptiveMode}
          apiBaseUrl={API_BASE_URL}
          onOpenAdmin={ADMIN_CONSOLE_VISIBLE && presentationMode === 'prototype' ? () => window.open('/admin', '_blank') : undefined}
        />
      </AdaptiveProvider>
        } />
      </Routes>
    </div>
  );
}

export default App;
