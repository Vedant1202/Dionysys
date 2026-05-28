import { useEffect, useEffectEvent, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useAdaptiveComponent } from '@dionysys/react';
import type { Vector } from '@dionysys/react';

// ─── Exact SVG icons scraped from Excalidraw's live native toolbar ────────────
const TOOL_SVG: Record<string, string> = {
  selection: `<svg viewBox="0 0 22 22" fill="none" stroke-width="1.25" style="width:20px;height:20px"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 6l4.153 11.793a0.365 .365 0 0 0 .331 .207a0.366 .366 0 0 0 .332 -.207l2.184 -4.793l4.787 -1.994a0.355 .355 0 0 0 .213 -.323a0.355 .355 0 0 0 -.213 -.323l-11.787 -4.36z"/><path d="M13.5 13.5l4.5 4.5"/></g></svg>`,
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  diamond:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M10.5 20.4l-6.9 -6.9c-.781 -.781 -.781 -2.219 0 -3l6.9 -6.9c.781 -.781 2.219 -.781 3 0l6.9 6.9c.781 .781 .781 2.219 0 3l-6.9 6.9c-.781 .781 -2.219 .781 -3 0z"/></svg>`,
  ellipse:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="9"/></svg>`,
  arrow:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="5" y1="12" x2="19" y2="12"/><line x1="15" y1="16" x2="19" y2="12"/><line x1="15" y1="8" x2="19" y2="12"/></svg>`,
  line:      `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M4.167 10h11.666" stroke-width="1.5"/></svg>`,
  freedraw:  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><g stroke-width="1.25"><path clip-rule="evenodd" d="m7.643 15.69 7.774-7.773a2.357 2.357 0 1 0-3.334-3.334L4.31 12.357a3.333 3.333 0 0 0-.977 2.357v1.953h1.953c.884 0 1.732-.352 2.357-.977Z"/><path d="m11.25 5.417 3.333 3.333"/></g></svg>`,
  text:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="4" y1="20" x2="7" y2="20"/><line x1="14" y1="20" x2="21" y2="20"/><line x1="6.9" y1="15" x2="13.8" y2="15"/><line x1="10.2" y1="6.3" x2="16" y2="20"/><polyline points="5 20 11 4 13 4 20 20"/></svg>`,
  image:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><g stroke-width="1.25"><path d="M12.5 6.667h.01"/><path d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z"/><path d="m3.333 12.5 3.334-3.333c.773-.745 1.726-.745 2.5 0l4.166 4.166"/><path d="m11.667 11.667.833-.834c.774-.744 1.726-.744 2.5 0l1.667 1.667"/></g></svg>`,
  eraser:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3"/><path d="M18 13.3l-6.3 -6.3"/></svg>`,
};

const TOOL_SHORTCUT: Record<string, string> = {
  selection: '1', rectangle: '2', diamond: '3', ellipse: '4', arrow: '5',
  line: '6', freedraw: '7', text: '8', image: '9', eraser: '0',
};

const SHORTCUT_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUT).map(([tool, key]) => [key, tool]),
);

const TOOL_LABEL: Record<string, string> = {
  selection: 'Selection — V or 1', rectangle: 'Rectangle — R or 2', diamond: 'Diamond — D or 3',
  ellipse: 'Ellipse — O or 4', arrow: 'Arrow — A or 5', line: 'Line — L or 6',
  freedraw: 'Draw — P or 7', text: 'Text — T or 8', image: 'Insert image — 9', eraser: 'Eraser — E or 0',
};

// Phase 5 Vector Coordinates for Tools
const TOOL_COORDINATES: Record<string, Vector> = {
  selection: {}, // Empty means ALWAYS globally relevant (1.0)
  eraser: {},
  rectangle: { draw_first: 1.0 },
  diamond: { draw_first: 1.0 },
  ellipse: { draw_first: 1.0 },
  freedraw: { draw_first: 1.0 },
  text: { text_first: 1.0 },
  image: { text_first: 1.0, power_user: 1.0 },
  arrow: { draw_first: 0.5, power_user: 1.0 },
  line: { draw_first: 0.5, power_user: 1.0 },
};

const ISLAND_SHADOW = 'rgba(0,0,0,0.17) 0 0 0.93px, rgba(0,0,0,0.08) 0 0 3.13px, rgba(0,0,0,0.05) 0 7px 14px';
const ISLAND_STYLE: React.CSSProperties = {
  display: 'flex',
  padding: 4,
  background: '#ffffff',
  borderRadius: 8,
  boxShadow: ISLAND_SHADOW,
  gap: 0,
};

// ─── Component ──────────────────────────────────────────────────────────────

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
  onToolSelected?: (tool: string, wasHiddenByPersona: boolean) => void;
}

function AdaptiveToolButton({ 
  tool, 
  isActive, 
  onClick, 
  isOverflow = false 
}: { tool: string; isActive: boolean; onClick: (tool: string, wasHiddenByPersona: boolean) => void; isOverflow?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const svgHTML = TOOL_SVG[tool];
  const shortcut = TOOL_SHORTCUT[tool];
  const label = TOOL_LABEL[tool] ?? tool;

  // Evaluate the tool's vector coordinate against the user's current behavioral embedding
  const { relevance, isRelevant } = useAdaptiveComponent({ 
    id: `tool_${tool}`,
    defaultCoordinate: TOOL_COORDINATES[tool], 
    defaultThreshold: 0.3 
  });

  if (!svgHTML) return null;

  // Handle baseline tools (empty coordinates = 1.0 relevance)
  const actualRelevance = Object.keys(TOOL_COORDINATES[tool]).length === 0 ? 1.0 : relevance;
  const actuallyRelevant = Object.keys(TOOL_COORDINATES[tool]).length === 0 ? true : isRelevant;

  // Logic: 
  // Primary Island Button: Takes up width based on relevance math, goes to 0 if under threshold.
  // Overflow Menu Button: Takes up 36px if UNDER threshold, 0 if OVER threshold.
  
  let targetWidth = 0;
  let targetOpacity = 0;
  let targetPointerEvents: any = 'none';

  if (isOverflow) {
    if (!actuallyRelevant) {
      targetWidth = 36;
      targetOpacity = 1;
      targetPointerEvents = 'auto';
    }
  } else {
    if (actuallyRelevant) {
      targetWidth = actualRelevance * 36;
      targetOpacity = actualRelevance;
      targetPointerEvents = actualRelevance > 0.1 ? 'auto' : 'none';
    }
  }

  const iconBg = isActive
    ? 'rgb(224, 223, 255)'
    : hovered
      ? 'rgb(241, 243, 245)'
      : 'transparent';

  return (
    <button
      type="button"
      onClick={() => onClick(tool, isOverflow)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: targetWidth,
        opacity: targetOpacity,
        pointerEvents: targetPointerEvents,
        height: 36,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        cursor: 'pointer',
        color: isOverflow && !hovered ? 'rgba(27,27,31,0.45)' : 'rgb(27,27,31)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      title={label}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={isActive}
    >
      <div
        style={{
          width: 36, // Inner icon stays stable
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: iconBg,
          transition: 'background-color 0.08s',
          flexShrink: 0,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svgHTML }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', minWidth: 20 }} />
      </div>
    </button>
  );
}

export function DynamicToolbar({ excalidrawAPI, onToolSelected }: DynamicToolbarProps) {
  const [activeToolType, setActiveToolType] = useState<string>('selection');

  const allTools = Object.keys(TOOL_COORDINATES);
  const leftOverflow = allTools.filter((_, i) => i % 2 === 0).reverse();
  const rightOverflow = allTools.filter((_, i) => i % 2 !== 0);

  const applyToolSelection = useEffectEvent((toolType: string, wasHiddenByPersona = false) => {
    setActiveToolType(toolType);
    onToolSelected?.(toolType, wasHiddenByPersona);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ appState: { activeTool: { type: toolType, customType: null } } });
    }
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;

      const tool = SHORTCUT_TO_TOOL[event.key];
      if (!tool) return;

      event.preventDefault();
      applyToolSelection(tool, false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyToolSelection]);

  const OverflowDots = () => (
    <div
      aria-hidden="true"
      style={{
        width: 28,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(27,27,31,0.3)',
        flexShrink: 0,
        transition: 'opacity 0.2s, transform 0.2s',
      }}
      title="More tools"
      className="group-hover:opacity-0 group-hover:scale-95 group-focus-within:opacity-0 group-focus-within:scale-95"
    >
      <MoreHorizontal size={13} />
    </div>
  );

  return (
    <div className="absolute left-1/2 top-4 z-[110] -translate-x-1/2">
      <div className="group relative flex items-center justify-center">

        {/* Soft ambient glow */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 -top-1 h-10 rounded-full blur-xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.14) 0%, transparent 70%)' }}
        />

        {/* Left overflow */}
        <div className="absolute right-full top-0 mr-1 flex items-center h-full">
          <div
            className="pointer-events-none opacity-0 translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
            style={ISLAND_STYLE}
          >
            {leftOverflow.map((tool) => (
              <AdaptiveToolButton key={tool} tool={tool} isActive={activeToolType === tool} onClick={applyToolSelection} isOverflow />
            ))}
          </div>
          <OverflowDots />
        </div>

        {/* Primary tools */}
        <div style={ISLAND_STYLE} className="relative z-10">
          {allTools.map((tool) => (
            <AdaptiveToolButton
              key={tool}
              tool={tool}
              isActive={activeToolType === tool}
              onClick={applyToolSelection}
            />
          ))}
        </div>

        {/* Right overflow */}
        <div className="absolute left-full top-0 ml-1 flex items-center h-full">
          <OverflowDots />
          <div
            className="pointer-events-none opacity-0 -translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
            style={ISLAND_STYLE}
          >
            {rightOverflow.map((tool) => (
              <AdaptiveToolButton key={tool} tool={tool} isActive={activeToolType === tool} onClick={applyToolSelection} isOverflow />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
