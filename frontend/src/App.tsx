import { useEffect, useState } from 'react';
import { AdaptiveProvider, AdminConsole } from '@dionysys/react';
import type { AdaptiveDecision, AdaptiveMode, AdminConsoleConfig } from '@dionysys/core';
import { EditorShell } from './components/EditorShell';
import { SESSION_ID } from './core/session';
import { VARIANT_CONFIGS } from './config/variantConfig';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
const ADMIN_CONSOLE_VISIBLE = import.meta.env.DEV || import.meta.env.VITE_ADMIN_CONSOLE_ENABLED === 'true';

function App() {
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('deterministic');
  const [providerVersion, setProviderVersion] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
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
        applyAdminConfig(payload.config);
      })
      .catch(() => {
        // The admin backend is intentionally env-gated. The console itself will show the detailed state when opened.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applyAdminConfig = (config: AdminConsoleConfig) => {
    setAdaptiveMode(config.mode.defaultMode);
    setProviderSettings({
      minEventsBeforeLock: config.mode.minEventsBeforeLock,
      pollingIntervalMs: config.mode.pollingIntervalMs,
    });
    setProviderVersion((version) => version + 1);
  };

  return (
    <div className="App" data-theme="winter">
      <AdaptiveProvider
         key={`${adaptiveMode}-${providerVersion}`}
         mode={adaptiveMode}
         defaultVariant="neutral"
         defaultUIState={{ variant: 'neutral', ...VARIANT_CONFIGS.neutral }}
         minEventsBeforeLock={providerSettings.minEventsBeforeLock}
         pollingIntervalMs={providerSettings.pollingIntervalMs}
         pollInference={adaptiveMode === 'deterministic' ? async () => {
           const response = await fetch(`${API_BASE_URL}/api/inference/${SESSION_ID}`);
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
             body: JSON.stringify({ sessionId: SESSION_ID, mode: 'deterministic' })
           });
           const data = await response.json();
           return data.variant ?? data.chosenVariant;
         } : undefined}
         resolveDecision={adaptiveMode === 'mcp' ? async () => {
           const response = await fetch(`${API_BASE_URL}/api/adaptive/decision`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId: SESSION_ID, mode: 'mcp' })
           });
           const data = await response.json();
           return data as AdaptiveDecision;
         } : undefined}
      >
        <EditorShell
          adaptiveMode={adaptiveMode}
          onAdaptiveModeChange={setAdaptiveMode}
          onOpenAdmin={ADMIN_CONSOLE_VISIBLE ? () => setIsAdminOpen(true) : undefined}
        />
      </AdaptiveProvider>

      {isAdminOpen && (
        <div className="admin-console-overlay" role="dialog" aria-modal="true" aria-label="Dionysys admin console">
          <AdminConsole
            apiBaseUrl={API_BASE_URL}
            sessionId={SESSION_ID}
            onClose={() => setIsAdminOpen(false)}
            onConfigSaved={applyAdminConfig}
          />
        </div>
      )}
    </div>
  );
}

export default App;
