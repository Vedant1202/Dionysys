import React from 'react';
import { useSessionStore, type UiVariant } from '../state/sessionStore';

export function DebugPanel() {
  const { currentVariant, setVariant, personaProbs, eventsSentCount, isPolicyLocked } = useSessionStore();

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVariant(e.target.value as UiVariant);
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] max-w-sm pointer-events-none p-4">
      <div className="card bg-base-100/90 backdrop-blur-md shadow-2xl border border-base-content/10 pointer-events-auto">
        <div className="card-body p-6">
          <div className="flex justify-between items-center mb-4 text-center">
            <h3 className="card-title text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/50 w-full justify-center">
               🛠️ System Intelligence
            </h3>
          </div>

          {/* Metrics Row */}
          <div className="flex gap-4 mb-6">
            <div className="stats shadow bg-base-200/50 flex-grow rounded-xl">
              <div className="stat p-3 place-items-center">
                <div className="stat-title text-[10px] uppercase font-bold opacity-50 tracking-widest">Events</div>
                <div className="stat-value text-xl text-primary font-black">{eventsSentCount}</div>
              </div>
              <div className="stat p-3 place-items-center border-l border-base-content/10">
                <div className="stat-title text-[10px] uppercase font-bold opacity-50 tracking-widest">Status</div>
                <div className={`stat-value text-xs font-black p-1 rounded ${isPolicyLocked ? 'text-success' : 'text-info animate-pulse'}`}>
                    {isPolicyLocked ? 'LOCKED' : 'LEARNING'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Variant Selector */}
          <div className="form-control mb-6">
            <label className="label py-1">
              <span className="label-text text-[10px] uppercase font-bold opacity-50">Active Layout</span>
            </label>
            <select
              className={`select select-bordered select-sm w-full font-bold text-xs uppercase tracking-wider ${isPolicyLocked ? 'select-disabled cursor-not-allowed opacity-50' : 'select-primary'}`}
              value={currentVariant}
              onChange={handleVariantChange}
              disabled={isPolicyLocked}
            >
              <option value="neutral">Neutral Baseline</option>
              <option value="draw_first">Draw Focused</option>
              <option value="text_first">Text Focused</option>
              <option value="guided_novice">Guided Novice</option>
              <option value="power_user">Power User</option>
            </select>
            {isPolicyLocked && (
              <label className="label py-1">
                <span className="label-text-alt text-[9px] text-primary italic font-medium">Policy locked via behavioral bandit model</span>
              </label>
            )}
          </div>

          {/* Persona Probabilities */}
          <div>
            <label className="label py-1">
              <span className="label-text text-[10px] uppercase font-bold opacity-50">Persona Prediction (%)</span>
            </label>
            <div className="space-y-4 mt-2">
              {Object.entries(personaProbs).map(([persona, prob]) => (
                <div key={persona} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black opacity-70 uppercase tracking-[0.1em]">
                    <span>{persona.replace('_', ' ')}</span>
                    <span className="font-mono text-primary">{Math.round(prob * 100)}%</span>
                  </div>
                  <progress 
                    className={`progress ${prob > 0.3 ? 'progress-primary' : 'progress-neutral opacity-30'} w-full h-2 rounded-full transition-all duration-500`} 
                    value={prob} 
                    max="1"
                  ></progress>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
