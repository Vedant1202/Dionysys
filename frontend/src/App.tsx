import { AdaptiveProvider } from '@antigravity/react';
import { EditorShell } from './components/EditorShell';
import './App.css';

const MOCK_SESSION_ID = 'sess_' + Math.random().toString(36).substr(2, 9); // Quick local mock

function App() {
  return (
    <div className="App" data-theme="winter">
      <AdaptiveProvider
         defaultVariant="neutral"
         minEventsBeforeLock={5}
         pollingIntervalMs={3000}
         pollInference={async () => {
           const response = await fetch(`http://localhost:3001/api/inference/${MOCK_SESSION_ID}`);
           if (response.ok) {
             const data = await response.json();
             return data.probabilities;
           }
           return {};
         }}
         evaluatePolicy={async () => {
           const response = await fetch('http://localhost:3001/api/policy', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sessionId: MOCK_SESSION_ID })
           });
           const data = await response.json();
           return data.chosenVariant;
         }}
      >
        <EditorShell />
      </AdaptiveProvider>
    </div>
  );
}

export default App;
