import { Suspense, lazy, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AdaptiveProvider } from '@dionysys/react';
import type {
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
  getOrCreateBrowserId,
} from './dionysys/session';
import { createDemoDionysysClient, DEFAULT_DIONYSYS_API_BASE_URL } from './dionysys/client';
import { VARIANT_CONFIGS } from './config/variantConfig';
import { AnalyticsTracker } from './analytics';
import './App.css';

const LazyAdminConsoleRoute = lazy(() => import('./routes/AdminConsoleRoute'));

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_DIONYSYS_API_BASE_URL;
const ADMIN_CONSOLE_VISIBLE = import.meta.env.DEV || import.meta.env.VITE_ADMIN_CONSOLE_ENABLED === 'true';

type ApplyAdminConfigOptions = {
  remountProvider?: boolean;
};

function App() {
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('deterministic');
  const [presentationMode, setPresentationMode] = useState<AdaptivePresentationMode>('prototype');
  const [decisionApplication, setDecisionApplication] = useState<AdaptiveDecisionApplication>('next-refresh');
  const [persistenceMode, setPersistenceMode] = useState<AdaptivePersistenceMode>('browser');
  const [sessionId, setSessionId] = useState<string>('');
  const [browserId] = useState(() => getOrCreateBrowserId());
  const [providerVersion, setProviderVersion] = useState(0);
  const [isConfigBootstrapped, setIsConfigBootstrapped] = useState(!ADMIN_CONSOLE_VISIBLE);
  const [providerSettings, setProviderSettings] = useState({
    minEventsBeforeLock: 5,
    pollingIntervalMs: 3000,
  });
  const [componentEmbeddings, setComponentEmbeddings] = useState<Record<string, import('@dionysys/core').ComponentEmbedding>>({});
  const dionysysClient = useMemo(() => createDemoDionysysClient({
    apiBaseUrl: API_BASE_URL,
    persistenceMode,
  }), [persistenceMode]);

  const applyAdminConfig = useCallback((config: AdminConsoleConfig, options: ApplyAdminConfigOptions = {}) => {
    const { remountProvider = true } = options;

    setAdaptiveMode(config.mode.defaultMode);
    setPresentationMode(config.mode.presentationMode);
    setDecisionApplication(config.mode.decisionApplication);
    setPersistenceMode(config.mode.persistenceMode);
    setProviderSettings({
      minEventsBeforeLock: config.mode.minEventsBeforeLock,
      pollingIntervalMs: config.mode.pollingIntervalMs,
    });
    setComponentEmbeddings(config.componentEmbeddings ?? {});

    if (remountProvider) {
      setProviderVersion((version) => version + 1);
    }
  }, []);

  useEffect(() => {
    if (!ADMIN_CONSOLE_VISIBLE) return;

    let isMounted = true;

    dionysysClient.admin.getConfig()
      .then((config: AdminConsoleConfig) => {
        if (!isMounted) return;
        applyAdminConfig(config, { remountProvider: false });
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
  }, [applyAdminConfig, dionysysClient]);

  useEffect(() => {
    let cancelled = false;

    const ensureSession = async () => {
      const current = await dionysysClient.sessions.getCurrent();

      if (current) {
        try {
          await dionysysClient.sessions.get(current);
          if (!cancelled) setSessionId(current);
          return;
        } catch {
          const recreated = await dionysysClient.sessions.create({ id: current });
          if (!cancelled) setSessionId(recreated.id);
          return;
        }
      }

      const created = await dionysysClient.sessions.create();
      if (!cancelled) setSessionId(created.id);
    };

    void ensureSession();

    return () => {
      cancelled = true;
    };
  }, [dionysysClient]);

  const handleRandomizeSession = useCallback(async () => {
    if (import.meta.env.PROD) return;
    if (!sessionId) return;

    clearStoredExcalidrawScene(persistenceMode, sessionId);
    clearStoredPendingDecision(persistenceMode, sessionId);
    clearStoredAppliedDecision(persistenceMode, sessionId);
    await dionysysClient.sessions.clearCurrent();
    window.location.reload();
  }, [dionysysClient, persistenceMode, sessionId]);

  if (!isConfigBootstrapped || !sessionId) {
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
          <AdminRouteFrame>
            <LazyAdminConsoleRoute
              client={dionysysClient}
              sessionId={sessionId}
              persistenceMode={persistenceMode}
              canRandomizeSession={!import.meta.env.PROD}
              onRandomizeSession={handleRandomizeSession}
              onClose={() => { window.close(); }}
              onConfigSaved={applyAdminConfig}
            />
          </AdminRouteFrame>
        } />
        
        <Route path="/admin/explorer" element={
          <AdminRouteFrame>
            <LazyAdminConsoleRoute
              client={dionysysClient}
              sessionId={sessionId}
              persistenceMode={persistenceMode}
              canRandomizeSession={!import.meta.env.PROD}
              onRandomizeSession={handleRandomizeSession}
              onClose={() => { window.close(); }}
              onConfigSaved={applyAdminConfig}
              defaultTab="explorer"
            />
          </AdminRouteFrame>
        } />
        
        <Route path="*" element={
          <AdaptiveProvider
            client={dionysysClient}
            key={`${adaptiveMode}-${presentationMode}-${decisionApplication}-${persistenceMode}-${sessionId}-${providerVersion}`}
            mode={adaptiveMode}
            presentationMode={presentationMode}
            decisionApplication={decisionApplication}
            persistenceMode={persistenceMode}
            sessionId={sessionId}
            defaultVariant="neutral"
            defaultUIState={{ variant: 'neutral', ...VARIANT_CONFIGS.neutral }}
            componentEmbeddings={componentEmbeddings}
            minEventsBeforeLock={providerSettings.minEventsBeforeLock}
            pollingIntervalMs={providerSettings.pollingIntervalMs}
          >
            <EditorShell
              client={dionysysClient}
              adaptiveMode={adaptiveMode}
              persistenceMode={persistenceMode}
              sessionId={sessionId}
              browserId={browserId}
              onAdaptiveModeChange={setAdaptiveMode}
              onOpenAdmin={ADMIN_CONSOLE_VISIBLE && presentationMode === 'prototype' ? () => window.open('/admin', '_blank') : undefined}
            />
          </AdaptiveProvider>
        } />
      </Routes>
    </div>
  );
}

export default App;

function AdminRouteFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'var(--color-base-100)' }}>
      <Suspense
        fallback={(
          <div className="adaptive-bootstrap" role="status" style={{ margin: 'auto' }}>
            Loading admin console...
          </div>
        )}
      >
        {children}
      </Suspense>
    </div>
  );
}
