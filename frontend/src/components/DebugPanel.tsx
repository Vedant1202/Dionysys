import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minimize2, Move } from 'lucide-react';
import { useAdaptiveUI } from '@dionysys/react';
import { buildAdaptiveUIDefinitionFromVariant, DEBUG_VARIANT_OPTIONS, type UiVariant } from '../config/variantConfig';
import { humanizeLabel } from '../utils/formatters';


type PanelPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: PanelPosition;
};

const PANEL_STORAGE_KEY = 'dionysys:prototype-debug-panel-position';
const PANEL_MARGIN = 16;
const DEFAULT_PANEL_WIDTH = 384;
const DEFAULT_PANEL_HEIGHT = 520;

function getDefaultPosition(): PanelPosition {
  if (typeof window === 'undefined') return { x: PANEL_MARGIN, y: PANEL_MARGIN };

  return {
    x: Math.max(PANEL_MARGIN, window.innerWidth - DEFAULT_PANEL_WIDTH - PANEL_MARGIN),
    y: PANEL_MARGIN,
  };
}

function readStoredPosition(): PanelPosition {
  if (typeof window === 'undefined') return getDefaultPosition();

  const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
  if (!raw) return getDefaultPosition();

  try {
    const parsed = JSON.parse(raw) as Partial<PanelPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return getDefaultPosition();
    }

    return parsed as PanelPosition;
  } catch {
    return getDefaultPosition();
  }
}

function clampPosition(position: PanelPosition, panel: HTMLElement | null): PanelPosition {
  if (typeof window === 'undefined') return position;

  const rect = panel?.getBoundingClientRect();
  const width = rect?.width ?? DEFAULT_PANEL_WIDTH;
  const height = rect?.height ?? DEFAULT_PANEL_HEIGHT;
  const maxX = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN);

  return {
    x: Math.min(Math.max(PANEL_MARGIN, position.x), maxX),
    y: Math.min(Math.max(PANEL_MARGIN, position.y), maxY),
  };
}

export function DebugPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<PanelPosition>(() => readStoredPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const {
    mode,
    currentVariant,
    currentPersonality,
    selectedModality,
    selectedExpertise,
    decisionConfidence,
    lastDecision,
    personaProbs,
    eventsSentCount,
    isPolicyLocked,
    setManualOverride,
  } = useAdaptiveUI();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(clampPosition(position, panelRef.current)));
  }, [position]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setPosition((current) => clampPosition(current, panelRef.current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleVariantChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextVariant = e.target.value as UiVariant;

    setManualOverride({
      variant: nextVariant,
      uiState: buildAdaptiveUIDefinitionFromVariant(nextVariant),
      personalityId: mode === 'mcp' ? nextVariant : currentPersonality,
    });
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, select, input, textarea')) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    setPosition(clampPosition({
      x: dragState.startPosition.x + event.clientX - dragState.startClientX,
      y: dragState.startPosition.y + event.clientY - dragState.startClientY,
    }, panelRef.current));
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={panelRef}
      className={`fixed z-[1000] pointer-events-auto transition-opacity duration-200 ${
        isDragging ? 'opacity-75' : 'opacity-20 hover:opacity-75 focus-within:opacity-75'
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={`card bg-base-100/95 backdrop-blur-md shadow-2xl border border-base-content/10 ${isMinimized ? 'w-64' : 'w-96 max-w-[calc(100vw-2rem)]'}`}>
        <div
          className={`flex items-center gap-3 border-b border-base-content/10 px-4 py-3 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <Move size={16} className="shrink-0 text-base-content/50" aria-hidden="true" />
          <h3 className="flex-1 text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/60">
            System Intelligence
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => setIsMinimized((current) => !current)}
            title={isMinimized ? 'Restore panel' : 'Minimize panel'}
            aria-label={isMinimized ? 'Restore panel' : 'Minimize panel'}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>

        {!isMinimized && (
        <div className="card-body p-6">
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
                    {isPolicyLocked ? 'ACTIVE' : 'MONITORING'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6 text-[10px] uppercase tracking-widest">
            <div className="rounded-lg bg-base-200/70 p-3">
              <div className="font-bold opacity-50">Mode</div>
              <div className="font-black text-primary">{mode}</div>
            </div>
            <div className="rounded-lg bg-base-200/70 p-3">
              <div className="font-bold opacity-50">Confidence</div>
              <div className="font-black text-primary">
                {decisionConfidence === undefined ? '--' : `${Math.round(decisionConfidence * 100)}%`}
              </div>
            </div>
            <div className="rounded-lg bg-base-200/70 p-3">
              <div className="font-bold opacity-50">Fallback</div>
              <div className={`font-black ${lastDecision?.isFallback ? 'text-warning' : 'text-primary'}`}>
                {lastDecision === undefined ? '--' : lastDecision.isFallback ? 'YES' : 'NO'}
              </div>
            </div>
          </div>

          {currentPersonality && (
            <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[10px] uppercase tracking-widest">
              <div className="font-bold opacity-50">Composed Variant</div>
              <div className="font-black text-primary">{humanizeLabel(currentPersonality)}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-6 text-[10px] uppercase tracking-widest">
            <div className="rounded-lg bg-base-200/70 p-3">
              <div className="font-bold opacity-50">Modality</div>
              <div className="font-black text-primary">{selectedModality ? humanizeLabel(selectedModality) : '--'}</div>
            </div>
            <div className="rounded-lg bg-base-200/70 p-3">
              <div className="font-bold opacity-50">Expertise</div>
              <div className="font-black text-primary">{selectedExpertise ? humanizeLabel(selectedExpertise) : '--'}</div>
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
              {DEBUG_VARIANT_OPTIONS.map((variant) => (
                <option key={variant} value={variant}>
                  {humanizeLabel(variant)}
                </option>
              ))}
            </select>
            {isPolicyLocked && (
              <label className="label py-1">
                <span className="label-text-alt text-[9px] text-primary italic font-medium">Adaptive monitoring is active for this session</span>
              </label>
            )}
          </div>

          {/* Persona Probabilities */}
          <div>
            <label className="label py-1">
              <span className="label-text text-[10px] uppercase font-bold opacity-50">Modality Prediction (%)</span>
            </label>
            <div className="space-y-4 mt-2">
              {Object.entries(personaProbs).map(([persona, prob]) => (
                <div key={persona} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black opacity-70 uppercase tracking-[0.1em]">
                    <span>{humanizeLabel(persona)}</span>
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
        )}
      </div>
    </div>
  );
}


