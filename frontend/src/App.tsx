import { useState } from 'react';
import { AdaptiveProvider } from '@dionysys/react';
import type { AdaptiveDecision, AdaptiveMode } from '@dionysys/core';
import { EditorShell } from './components/EditorShell';
import { SESSION_ID } from './core/session';
import { VARIANT_CONFIGS } from './config/variantConfig';
import './App.css';

function App() {
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('deterministic');

  return (
    <div className="App" data-theme="winter">
      <AdaptiveProvider
         key={adaptiveMode}
         mode={adaptiveMode}
         defaultVariant="neutral"
         defaultUIState={{ variant: 'neutral', ...VARIANT_CONFIGS.neutral }}
         minEventsBeforeLock={5}
         pollingIntervalMs={3000}
         pollInference={adaptiveMode === 'deterministic' ? async () => {
           const response = await fetch(`http://localhost:3001/api/inference/${SESSION_ID}`);
           if (response.ok) {
             const data = await response.json();
             return data.probabilities;
           }
           return {};
         } : undefined}
         evaluatePolicy={adaptiveMode === 'deterministic' ? async () => {
           const response = await fetch('http://localhost:3001/api/adaptive/decision', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId: SESSION_ID, mode: 'deterministic' })
           });
           const data = await response.json();
           return data.variant ?? data.chosenVariant;
         } : undefined}
         resolveDecision={adaptiveMode === 'mcp' ? async () => {
           const response = await fetch('http://localhost:3001/api/adaptive/decision', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId: SESSION_ID, mode: 'mcp' })
           });
           const data = await response.json();
           return data as AdaptiveDecision;
         } : undefined}
      >
        <EditorShell adaptiveMode={adaptiveMode} onAdaptiveModeChange={setAdaptiveMode} />
      </AdaptiveProvider>
    </div>
  );
}

export default App;
