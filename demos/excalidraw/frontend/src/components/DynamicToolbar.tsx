import { useEffect, useEffectEvent, useState, useRef } from 'react';
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

// ─── Native Excalidraw 0.18.0 design tokens (light theme) ──────────────────────
// Pulled verbatim from @excalidraw/excalidraw/dist/prod/index.css so the toolbar
// is visually indistinguishable from the one Excalidraw renders itself.
const EXCALIDRAW_TOKENS = {
  islandBg: '#ffffff',                  // --island-bg-color
  islandShadow:                          // --shadow-island
    '0px 0px 0.9310142993927002px 0px rgba(0, 0, 0, 0.17), ' +
    '0px 0px 3.1270833015441895px 0px rgba(0, 0, 0, 0.08), ' +
    '0px 7px 14px 0px rgba(0, 0, 0, 0.05)',
  radius: 8,                             // --border-radius-lg (0.5rem)
  buttonSize: 36,                        // --default-button-size (2.25rem)
  contentPadding: 8,                     // .App-toolbar-content padding
  hoverBg: '#f1f0ff',                    // --color-surface-high
  activeBg: '#e0dfff',                   // --color-surface-primary-container
  activeColor: '#030064',                // --color-on-primary-container
  iconColor: '#1b1b1f',                  // default icon color
  keybindingColor: '#b8b8b8',            // --color-gray-40
};

// Smooth, slightly bouncy but mature. ~10% overshoot, no jitter.
const SPRING_EASE = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
const WIDTH_DURATION = '380ms';
const OPACITY_DURATION = '260ms';
const COLOR_DURATION = '120ms';

const ISLAND_STYLE: React.CSSProperties = {
  display: 'flex',
  padding: EXCALIDRAW_TOKENS.contentPadding,
  background: EXCALIDRAW_TOKENS.islandBg,
  borderRadius: EXCALIDRAW_TOKENS.radius,
  boxShadow: EXCALIDRAW_TOKENS.islandShadow,
  gap: 0,
  // ensure the island uses Excalidraw's UI font stack so the keybinding
  // subscript looks identical
  fontFamily:
    'Assistant, "Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif',
};

// ─── Component ──────────────────────────────────────────────────────────────

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
  onToolSelected?: (tool: string, wasHiddenByPersona: boolean) => void;
  productiveActionCount?: number;
}

function AdaptiveToolButton({
  tool,
  isActive,
  isPromoted = false,
  onClick,
  isOverflow = false,
}: {
  tool: string;
  isActive: boolean;
  isPromoted: boolean;
  onClick: (tool: string, wasHiddenByPersona: boolean) => void;
  isOverflow?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const svgHTML = TOOL_SVG[tool];
  const shortcut = TOOL_SHORTCUT[tool];
  const label = TOOL_LABEL[tool] ?? tool;

  // Evaluate the tool's vector coordinate against the user's current behavioral embedding
  const { isRelevant } = useAdaptiveComponent({
    id: `tool_${tool}`,
    defaultCoordinate: TOOL_COORDINATES[tool],
    defaultThreshold: 0.3,
  });

  if (!svgHTML) return null;

  // Baseline tools (empty coordinates) or promoted tools are always relevant.
  const actuallyRelevant =
    Object.keys(TOOL_COORDINATES[tool]).length === 0 || isPromoted ? true : isRelevant;

  // Each tool exists in BOTH the main island AND its overflow island.
  // The two render in opposite phase so the tool always lives somewhere.
  //   - main island:  full 36px when relevant, collapses to 0 when hidden
  //   - overflow:     full 36px when hidden, collapses to 0 when shown
  // Binary (not fractional) width matches Excalidraw's native toolbar.
  const showInThisIsland = isOverflow ? !actuallyRelevant : actuallyRelevant;
  const targetWidth = showInThisIsland ? EXCALIDRAW_TOKENS.buttonSize : 0;
  const targetOpacity = showInThisIsland ? 1 : 0;
  const targetPointerEvents: React.CSSProperties['pointerEvents'] = showInThisIsland
    ? 'auto'
    : 'none';

  const iconBg = isActive
    ? EXCALIDRAW_TOKENS.activeBg
    : hovered
      ? EXCALIDRAW_TOKENS.hoverBg
      : 'transparent';

  const iconColor = isActive ? EXCALIDRAW_TOKENS.activeColor : EXCALIDRAW_TOKENS.iconColor;
  const keybindingColor = isActive
    ? EXCALIDRAW_TOKENS.activeColor
    : EXCALIDRAW_TOKENS.keybindingColor;

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
        height: EXCALIDRAW_TOKENS.buttonSize,
        padding: 0,
        border: 'none',
        borderRadius: EXCALIDRAW_TOKENS.radius,
        background: 'transparent',
        cursor: 'pointer',
        color: iconColor,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: `width ${WIDTH_DURATION} ${SPRING_EASE}, opacity ${OPACITY_DURATION} ${SPRING_EASE}`,
        // strip ambient browser button look
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      title={label}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={isActive}
    >
      {/* Inner pill — fixed 36×36 so the icon never squishes while the
          outer button width animates. Mirrors Excalidraw's `.ToolIcon__icon`. */}
      <div
        style={{
          position: 'relative',
          width: EXCALIDRAW_TOKENS.buttonSize,
          height: EXCALIDRAW_TOKENS.buttonSize,
          borderRadius: EXCALIDRAW_TOKENS.radius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: iconBg,
          transition: `background-color ${COLOR_DURATION} ease, color ${COLOR_DURATION} ease`,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svgHTML }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            minWidth: 20,
            color: iconColor,
            transition: `color ${COLOR_DURATION} ease`,
          }}
        />

        {/* Shortcut subscript — exact replica of Excalidraw's `.ToolIcon__keybinding`:
            position absolute; bottom 2px; right 3px; font-size 0.625rem; gray-40. */}
        {shortcut && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 2,
              right: 3,
              fontSize: '0.625rem',         // 10px, matches Excalidraw exactly
              lineHeight: 1,
              color: keybindingColor,
              userSelect: 'none',
              pointerEvents: 'none',
              fontFamily: 'inherit',
              fontWeight: 400,
              transition: `color ${COLOR_DURATION} ease`,
            }}
          >
            {shortcut}
          </span>
        )}
      </div>
    </button>
  );
}

export function DynamicToolbar({ excalidrawAPI, onToolSelected, productiveActionCount }: DynamicToolbarProps) {
  const [activeToolType, setActiveToolType] = useState<string>('selection');
  const [promotedTools, setPromotedTools] = useState<Record<string, number>>({});

  const lastActionCountRef = useRef(productiveActionCount ?? 0);

  useEffect(() => {
    if (productiveActionCount === undefined) return;
    const delta = productiveActionCount - lastActionCountRef.current;
    if (delta > 0) {
      lastActionCountRef.current = productiveActionCount;
      setPromotedTools((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const tool of Object.keys(next)) {
          next[tool] -= delta;
          if (next[tool] <= 0) {
            delete next[tool];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [productiveActionCount]);

  const allTools = Object.keys(TOOL_COORDINATES);
  const leftOverflow = allTools.filter((_, i) => i % 2 === 0).reverse();
  const rightOverflow = allTools.filter((_, i) => i % 2 !== 0);

  const applyToolSelection = useEffectEvent((toolType: string, wasHiddenByPersona = false) => {
    setActiveToolType(toolType);
    
    if (wasHiddenByPersona || promotedTools[toolType] !== undefined) {
      setPromotedTools((prev) => ({ ...prev, [toolType]: 10 }));
    }

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

  // ── "More tools" trigger — mirrors Excalidraw's `.App-toolbar__extra-tools-trigger`
  //    (transparent ghost button with the three-dots glyph). It's a discovery
  //    affordance only; the actual click target is the whole toolbar group.
  const OverflowDots = ({ side }: { side: 'left' | 'right' }) => (
    <div
      aria-hidden="true"
      style={{
        width: EXCALIDRAW_TOKENS.buttonSize,
        height: EXCALIDRAW_TOKENS.buttonSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: EXCALIDRAW_TOKENS.keybindingColor,
        flexShrink: 0,
        borderRadius: EXCALIDRAW_TOKENS.radius,
        background: 'transparent',
        transition: `opacity 220ms ${SPRING_EASE}, transform 220ms ${SPRING_EASE}`,
        // gently fade & nudge towards the overflow island when it opens
        transform: side === 'left'
          ? 'translateX(0)'
          : 'translateX(0)',
      }}
      title="More tools"
      className="group-hover:opacity-0 group-focus-within:opacity-0"
    >
      <MoreHorizontal size={16} strokeWidth={2} />
    </div>
  );

  // Overflow islands fly out with the same spring as the buttons themselves,
  // so the motion reads as one continuous gesture rather than two stacked
  // animations.
  const overflowIslandTransition =
    `opacity 260ms ${SPRING_EASE}, transform ${WIDTH_DURATION} ${SPRING_EASE}`;

  return (
    <div className="absolute left-1/2 top-4 z-[110] -translate-x-1/2">
      <div className="group relative flex items-center justify-center">

        {/* Soft ambient glow — kept subtle so it reads as an Excalidraw island,
            not a glassmorphism widget */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 -top-1 h-10 rounded-full blur-xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.10) 0%, transparent 70%)' }}
        />

        {/* ── Left overflow ─────────────────────────────────────────── */}
        <div className="absolute right-full top-0 mr-1 flex items-center h-full">
          <div
            className="pointer-events-none opacity-0 -translate-x-1 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
            style={{ ...ISLAND_STYLE, transition: overflowIslandTransition }}
          >
            {leftOverflow.map((tool) => (
              <AdaptiveToolButton
                key={tool}
                tool={tool}
                isActive={activeToolType === tool}
                isPromoted={promotedTools[tool] !== undefined}
                onClick={applyToolSelection}
                isOverflow
              />
            ))}
          </div>
          <OverflowDots side="left" />
        </div>

        {/* ── Primary tools ─────────────────────────────────────────── */}
        <div style={ISLAND_STYLE} className="relative z-10">
          {allTools.map((tool) => (
            <AdaptiveToolButton
              key={tool}
              tool={tool}
              isActive={activeToolType === tool}
              isPromoted={promotedTools[tool] !== undefined}
              onClick={applyToolSelection}
            />
          ))}
        </div>

        {/* ── Right overflow ────────────────────────────────────────── */}
        <div className="absolute left-full top-0 ml-1 flex items-center h-full">
          <OverflowDots side="right" />
          <div
            className="pointer-events-none opacity-0 translate-x-1 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
            style={{ ...ISLAND_STYLE, transition: overflowIslandTransition }}
          >
            {rightOverflow.map((tool) => (
              <AdaptiveToolButton
                key={tool}
                tool={tool}
                isActive={activeToolType === tool}
                isPromoted={promotedTools[tool] !== undefined}
                onClick={applyToolSelection}
                isOverflow
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
