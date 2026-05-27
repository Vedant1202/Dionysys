import { useEffect, useEffectEvent, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useAdaptiveUI } from '@dionysys/react';
import { DEFAULT_EXCALIDRAW_TOOLS, resolveVariantConfig, type VariantUIConfig } from '../config/variantConfig';

// ─── Exact SVG icons scraped from Excalidraw's live native toolbar ────────────
// These are the exact same paths Excalidraw renders so the icons match perfectly.

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

// Actual Excalidraw number shortcut for each tool (matches native toolbar keybindings)
const TOOL_SHORTCUT: Record<string, string> = {
  selection: '1',
  rectangle: '2',
  diamond:   '3',
  ellipse:   '4',
  arrow:     '5',
  line:      '6',
  freedraw:  '7',
  text:      '8',
  image:     '9',
  eraser:    '0',
};

// Reverse map used by the keyboard handler
const SHORTCUT_TO_TOOL: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_SHORTCUT).map(([tool, key]) => [key, tool]),
);

// Tooltip labels matching native Excalidraw format exactly
const TOOL_LABEL: Record<string, string> = {
  selection: 'Selection — V or 1',
  rectangle: 'Rectangle — R or 2',
  diamond:   'Diamond — D or 3',
  ellipse:   'Ellipse — O or 4',
  arrow:     'Arrow — A or 5',
  line:      'Line — L or 6',
  freedraw:  'Draw — P or 7',
  text:      'Text — T or 8',
  image:     'Insert image — 9',
  eraser:    'Eraser — E or 0',
};

// Native Excalidraw island shadow (exact value extracted from DOM)
const ISLAND_SHADOW = 'rgba(0,0,0,0.17) 0 0 0.93px, rgba(0,0,0,0.08) 0 0 3.13px, rgba(0,0,0,0.05) 0 7px 14px';
const ISLAND_STYLE: React.CSSProperties = {
  display: 'flex',
  padding: 4,
  background: '#ffffff',
  borderRadius: 8,
  boxShadow: ISLAND_SHADOW,
  gap: 0,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
  config?: VariantUIConfig;
  onToolSelected?: (tool: string, wasHiddenByPersona: boolean) => void;
}

// ─── ToolButton ───────────────────────────────────────────────────────────────

interface ToolButtonProps {
  tool: string;
  isActive: boolean;
  onClick: (tool: string, wasHiddenByPersona: boolean) => void;
  isOverflow?: boolean;
}

function ToolButton({ tool, isActive, onClick, isOverflow = false }: ToolButtonProps) {
  const [hovered, setHovered] = useState(false);
  const svgHTML = TOOL_SVG[tool];
  const shortcut = TOOL_SHORTCUT[tool];
  const label = TOOL_LABEL[tool] ?? tool;
  if (!svgHTML) return null;

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
        width: 36,
        height: 36,
        padding: 0,
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        cursor: 'pointer',
        color: isOverflow && !hovered ? 'rgba(27,27,31,0.45)' : 'rgb(27,27,31)',
        flexShrink: 0,
      }}
      title={label}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={isActive}
    >
      {/* Icon container — receives the highlight background */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: iconBg,
          transition: 'background-color 0.08s',
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svgHTML }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} />
        {shortcut && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              fontSize: 10,
              lineHeight: 1,
              color: 'rgb(3, 0, 100)',
              fontWeight: 400,
              fontFamily: 'inherit',
              pointerEvents: 'none',
            }}
          >
            {shortcut}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Overflow split ───────────────────────────────────────────────────────────

function splitOverflowTools(overflowTools: string[]): { leftOverflow: string[]; rightOverflow: string[] } {
  return overflowTools.reduce<{ leftOverflow: string[]; rightOverflow: string[] }>(
    (groups, tool, index) => {
      if (index % 2 === 0) groups.leftOverflow.push(tool);
      else groups.rightOverflow.push(tool);
      return groups;
    },
    { leftOverflow: [], rightOverflow: [] },
  );
}

// ─── DynamicToolbar ───────────────────────────────────────────────────────────

export function DynamicToolbar({ excalidrawAPI, config: providedConfig, onToolSelected }: DynamicToolbarProps) {
  const { currentVariant, currentUIState, mode } = useAdaptiveUI();
  const [activeToolType, setActiveToolType] = useState<string>('selection');

  const config = providedConfig ?? resolveVariantConfig(
    currentVariant,
    mode === 'mcp' ? currentUIState : undefined,
  );
  const allowedTools = config?.toolbar?.mode === 'allowlist'
    ? (config.toolbar.tools ?? []).filter((t) => Boolean(TOOL_SVG[t]))
    : [];

  const allowedToolsKey = allowedTools.join('|');
  const primaryToolSet = new Set(allowedTools);
  const overflowTools = DEFAULT_EXCALIDRAW_TOOLS.filter((t) => TOOL_SVG[t] && !primaryToolSet.has(t));
  const overflowSet = new Set(overflowTools);
  const { leftOverflow, rightOverflow } = splitOverflowTools(overflowTools);

  const handleToolClick = (toolType: string, wasHiddenByPersona: boolean) => {
    setActiveToolType(toolType);
    onToolSelected?.(toolType, wasHiddenByPersona);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ appState: { activeTool: { type: toolType, customType: null } } });
    }
  };

  const applyToolSelection = useEffectEvent((toolType: string, wasHiddenByPersona = false) => {
    handleToolClick(toolType, wasHiddenByPersona);
  });

  // Reset active tool when allowlist changes and the active tool is no longer allowed
  useEffect(() => {
    if (!allowedTools.length || allowedTools.includes(activeToolType)) return;
    applyToolSelection(allowedTools[0]);
  }, [activeToolType, allowedTools, applyToolSelection]);

  // Keyboard handler: maps Excalidraw's actual number shortcuts (1–9, 0) to tools
  useEffect(() => {
    if (!allowedTools.length) return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;

      const tool = SHORTCUT_TO_TOOL[event.key];
      if (!tool) return;
      // Handle if the tool is in either primary or overflow set
      if (!primaryToolSet.has(tool) && !overflowSet.has(tool)) return;

      event.preventDefault();
      applyToolSelection(tool, !primaryToolSet.has(tool));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allowedToolsKey, primaryToolSet, overflowSet, applyToolSelection]);

  if (!config || config.toolbar?.mode !== 'allowlist' || allowedTools.length === 0) return null;

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
          className="absolute inset-x-8 -top-1 h-10 rounded-full blur-xl"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.14) 0%, transparent 70%)' }}
        />

        {/* Left overflow */}
        {leftOverflow.length > 0 && (
          <div className="absolute right-full top-0 mr-1 flex items-center">
            <div
              className="pointer-events-none opacity-0 translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
              style={ISLAND_STYLE}
            >
              {[...leftOverflow].reverse().map((tool) => (
                <ToolButton key={tool} tool={tool} isActive={activeToolType === tool} onClick={applyToolSelection} isOverflow />
              ))}
            </div>
            <OverflowDots />
          </div>
        )}

        {/* Primary tools */}
        <div style={ISLAND_STYLE}>
          {allowedTools.map((tool) => (
            <ToolButton
              key={tool}
              tool={tool}
              isActive={activeToolType === tool}
              onClick={applyToolSelection}
            />
          ))}
        </div>

        {/* Right overflow */}
        {rightOverflow.length > 0 && (
          <div className="absolute left-full top-0 ml-1 flex items-center">
            <OverflowDots />
            <div
              className="pointer-events-none opacity-0 -translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100"
              style={ISLAND_STYLE}
            >
              {rightOverflow.map((tool) => (
                <ToolButton key={tool} tool={tool} isActive={activeToolType === tool} onClick={applyToolSelection} isOverflow />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
