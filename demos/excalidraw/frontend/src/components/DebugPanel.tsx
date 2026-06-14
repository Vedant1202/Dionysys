import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minimize2, Move } from 'lucide-react';
import { useAdaptiveUI } from '@dionysys/react';
import { buildAdaptiveUIDefinitionFromVariant, DEBUG_VARIANT_OPTIONS, type UiVariant } from '../config/variantConfig';
import { humanizeLabel } from '../utils/formatters';


type PanelPosition = { x: number; y: number };
type DragState = { pointerId: number; startClientX: number; startClientY: number; startPosition: PanelPosition };

const PANEL_STORAGE_KEY = 'dionysys:prototype-debug-panel-position';
const PANEL_MARGIN = 16;
const DEFAULT_PANEL_WIDTH = 272;
const DEFAULT_PANEL_HEIGHT = 460;

function getDefaultPosition(): PanelPosition {
  if (typeof window === 'undefined') return { x: PANEL_MARGIN, y: PANEL_MARGIN };
  return { x: Math.max(PANEL_MARGIN, window.innerWidth - DEFAULT_PANEL_WIDTH - PANEL_MARGIN), y: PANEL_MARGIN };
}

function readStoredPosition(): PanelPosition {
  if (typeof window === 'undefined') return getDefaultPosition();
  const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
  if (!raw) return getDefaultPosition();
  try {
    const parsed = JSON.parse(raw) as Partial<PanelPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return getDefaultPosition();
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
    const handleResize = () => setPosition((current) => clampPosition(current, panelRef.current));
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
        isDragging ? 'opacity-90' : 'opacity-20 hover:opacity-95 focus-within:opacity-95'
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={`rounded-xl border border-indigo-200/40 bg-white/96 shadow-[0_8px_24px_rgba(99,102,241,0.12)] backdrop-blur-sm ${
          isMinimized ? 'w-56' : 'w-68 max-w-[calc(100vw-2rem)]'
        }`}
        style={{ width: isMinimized ? 224 : 272 }}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 border-b border-indigo-50 px-3 py-2.5 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <Move size={12} className="shrink-0 text-slate-300" aria-hidden="true" />
          <h3 className="flex-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            System Intelligence
          </h3>
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            onClick={() => setIsMinimized((v) => !v)}
            title={isMinimized ? 'Restore panel' : 'Minimize panel'}
            aria-label={isMinimized ? 'Restore panel' : 'Minimize panel'}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>

        {!isMinimized && (
          <div className="p-3 space-y-2.5">

            {/* Events + Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-indigo-50/60 px-2.5 py-2">
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Events</div>
                <div className="text-[18px] font-black text-indigo-600 leading-tight mt-0.5">{eventsSentCount}</div>
              </div>
              <div className="rounded-lg bg-indigo-50/60 px-2.5 py-2">
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Status</div>
                <div className={`text-[11px] font-black leading-tight mt-1 ${isPolicyLocked ? 'text-emerald-600' : 'text-indigo-500'}`}>
                  {isPolicyLocked ? 'Active' : 'Monitoring'}
                </div>
              </div>
            </div>

            {/* Mode / Confidence / Fallback */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Mode', value: mode },
                { label: 'Conf.', value: decisionConfidence === undefined ? '--' : `${Math.round(decisionConfidence * 100)}%` },
                { label: 'Fallback', value: lastDecision === undefined ? '--' : lastDecision.isFallback ? 'Yes' : 'No', warn: lastDecision?.isFallback },
              ].map(({ label, value, warn }) => (
                <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
                  <div className={`truncate text-[10px] font-black capitalize leading-tight mt-0.5 ${warn ? 'text-amber-600' : 'text-indigo-600'}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Composed variant */}
            {currentPersonality && (
              <div className="rounded-lg border border-indigo-100/70 bg-indigo-50/40 px-2.5 py-2">
                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Composed Variant</div>
                <div className="text-[12px] font-black text-indigo-600 mt-0.5">{humanizeLabel(currentPersonality)}</div>
              </div>
            )}

            {/* Modality / Expertise */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Modality', value: selectedModality ? humanizeLabel(selectedModality) : '--' },
                { label: 'Expertise', value: selectedExpertise ? humanizeLabel(selectedExpertise) : '--' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
                  <div className="text-[11px] font-black text-indigo-600 leading-tight mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            {/* Active layout selector */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1.5">Active Layout</div>
              <select
                className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 ${
                  isPolicyLocked
                    ? 'border-slate-200/60 text-slate-400 cursor-not-allowed opacity-60'
                    : 'border-indigo-100/70 text-indigo-600 cursor-pointer'
                }`}
                value={currentVariant ?? DEBUG_VARIANT_OPTIONS[0]}
                onChange={handleVariantChange}
                disabled={isPolicyLocked}
              >
                {DEBUG_VARIANT_OPTIONS.map((variant) => (
                  <option key={variant} value={variant}>{humanizeLabel(variant)}</option>
                ))}
              </select>
              {isPolicyLocked && (
                <p className="mt-1 text-[9px] italic text-indigo-400">Adaptive monitoring active</p>
              )}
            </div>

            {/* Modality prediction bars */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">Modality Prediction</div>
              <div className="space-y-2">
                {Object.entries(personaProbs).map(([persona, prob]) => (
                  <div key={persona}>
                    <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-[0.07em] mb-0.5">
                      <span>{humanizeLabel(persona)}</span>
                      <span className="font-mono text-indigo-500">{Math.round(prob * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${prob > 0.3 ? 'bg-indigo-400' : 'bg-slate-200'}`}
                        style={{ width: `${Math.round(prob * 100)}%` }}
                      />
                    </div>
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
