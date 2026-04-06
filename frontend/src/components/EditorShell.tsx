import { useState, useEffect } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import { useSessionStore, type UiVariant } from '../state/sessionStore';
import { DebugPanel } from './DebugPanel';
import { eventCollector, MOCK_SESSION_ID } from '../core/eventCollector';
import { VARIANT_CONFIGS } from '../config/variantConfig';

const VALID_VARIANTS: UiVariant[] = ['neutral', 'draw_first', 'text_first', 'guided_novice', 'power_user'];

export function EditorShell() {
  const [, setExcalidrawAPI] = useState<any>(null);
  const {
    currentVariant,
    setPersonaProbs,
    eventsSentCount,
    isPolicyLocked,
    lockPolicy,
  } = useSessionStore();

  const config = VARIANT_CONFIGS[currentVariant];

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/inference/${MOCK_SESSION_ID}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.probabilities) {
            setPersonaProbs(data.probabilities);
          }
        }
      } catch (err) {
        console.error('Failed to poll inference', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [setPersonaProbs]);

  useEffect(() => {
    const MIN_EVENTS = 5;
    if (eventsSentCount >= MIN_EVENTS && !isPolicyLocked) {
      fetch('http://localhost:3001/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: MOCK_SESSION_ID })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.chosenVariant) {
          const variant = VALID_VARIANTS.find(v => v === data.chosenVariant);
          if (variant) {
            lockPolicy(variant);
          }
        }
      })
      .catch(console.error);
    }
  }, [eventsSentCount, isPolicyLocked, lockPolicy]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        'http://localhost:3001/api/reward/complete',
        new Blob([JSON.stringify({ sessionId: MOCK_SESSION_ID })], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const getUIOptions = (): any => {
    if (!config || currentVariant === 'neutral') return undefined;
    return {
      canvasActions: config.canvasActions
    };
  };

  if (!config) return null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-base-200">
      <div className="navbar bg-base-100 shadow-md z-50">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold tracking-tight">Antigravity <span className="text-primary">Adaptive UI</span></a>
        </div>
        <div className="flex-none gap-2 px-4 italic text-sm opacity-60">
           Session: {MOCK_SESSION_ID}
        </div>
        <div className="flex-none">
          <div className="badge badge-outline badge-md mr-2 uppercase tracking-widest text-[10px] py-1">Experiment Active</div>
          <div className={`badge badge-primary badge-md uppercase tracking-widest text-[10px] py-1 font-bold`}>
            {currentVariant.replace('_', ' ')}
          </div>
        </div>
      </div>

      <div className="flex-grow relative border-t border-base-300">
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
        
        <DebugPanel />
      </div>
    </div>
  );
}
