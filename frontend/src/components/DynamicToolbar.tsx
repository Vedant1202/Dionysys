import { useEffect, useEffectEvent, useState } from 'react';
import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Image as ImageIcon,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { useAdaptiveUI } from '@dionysys/react';
import { DEFAULT_EXCALIDRAW_TOOLS, resolveVariantConfig, type VariantUIConfig } from '../config/variantConfig';

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
  config?: VariantUIConfig;
}

type ToolMetadata = {
  Icon: LucideIcon;
  label: string;
};

const TOOL_METADATA: Record<string, ToolMetadata> = {
  selection: { Icon: MousePointer2, label: 'Selection' },
  rectangle: { Icon: Square, label: 'Rectangle' },
  ellipse: { Icon: Circle, label: 'Ellipse' },
  diamond: { Icon: Diamond, label: 'Rhombus' },
  arrow: { Icon: ArrowRight, label: 'Arrow' },
  line: { Icon: Minus, label: 'Line' },
  freedraw: { Icon: Pencil, label: 'Draw' },
  text: { Icon: Type, label: 'Text' },
  image: { Icon: ImageIcon, label: 'Image' },
  eraser: { Icon: Eraser, label: 'Eraser' },
};

interface ToolButtonProps {
  tool: string;
  isActive: boolean;
  onClick: (tool: string) => void;
  hotkey?: string;
  isOverflow?: boolean;
}

function ToolButton({ tool, isActive, onClick, hotkey, isOverflow = false }: ToolButtonProps) {
  const metadata = TOOL_METADATA[tool];
  if (!metadata) return null;

  const { Icon, label } = metadata;
  const tooltip = hotkey ? `${label} (${hotkey})` : label;

  return (
    <button
      type="button"
      onClick={() => onClick(tool)}
      className={[
        'group/tool relative z-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 hover:z-20 focus-visible:z-30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        isActive
          ? 'z-10 border-violet-300 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] text-violet-700 shadow-[0_14px_28px_rgba(99,102,241,0.2)]'
          : 'border-white/80 bg-white/92 text-slate-600 shadow-[0_8px_20px_rgba(148,163,184,0.16)] hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:text-violet-700',
        isOverflow ? 'text-slate-500 hover:text-violet-700' : '',
      ].join(' ')}
      title={tooltip}
      aria-label={`${label} tool`}
      aria-keyshortcuts={hotkey}
    >
      <Icon size={16} strokeWidth={2.15} />
      {hotkey && (
        <span
          data-hotkey-badge={hotkey}
          aria-hidden="true"
          className={[
            'absolute bottom-1 right-1 rounded-md border px-1 text-[9px] font-semibold leading-3.5 shadow-sm',
            isActive
              ? 'border-violet-200/80 bg-violet-50 text-violet-700'
              : 'border-slate-200 bg-slate-50 text-slate-500',
          ].join(' ')}
        >
          {hotkey}
        </span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-0 z-[120] flex -translate-x-1/2 -translate-y-2 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover/tool:-translate-y-3 group-hover/tool:opacity-100 group-focus-visible/tool:-translate-y-3 group-focus-visible/tool:opacity-100"
      >
        <span>{label}</span>
        {hotkey && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] text-slate-200">{hotkey}</span>}
      </span>
    </button>
  );
}

function splitOverflowTools(overflowTools: string[]): { leftOverflow: string[]; rightOverflow: string[] } {
  return overflowTools.reduce<{ leftOverflow: string[]; rightOverflow: string[] }>(
    (groups, tool, index) => {
      if (index % 2 === 0) {
        groups.leftOverflow.push(tool);
      } else {
        groups.rightOverflow.push(tool);
      }

      return groups;
    },
    { leftOverflow: [], rightOverflow: [] },
  );
}

export function DynamicToolbar({ excalidrawAPI, config: providedConfig }: DynamicToolbarProps) {
  const { currentVariant, currentUIState, mode } = useAdaptiveUI();
  const [activeToolType, setActiveToolType] = useState<string>('selection');

  const config = providedConfig ?? resolveVariantConfig(
    currentVariant,
    mode === 'mcp' ? currentUIState : undefined,
  );
  const allowedTools = config?.toolbar?.mode === 'allowlist'
    ? (config.toolbar.tools ?? []).filter((tool) => Boolean(TOOL_METADATA[tool]))
    : [];

  const allowedToolsKey = allowedTools.join('|');
  const primaryToolSet = new Set(allowedTools);
  const overflowTools = DEFAULT_EXCALIDRAW_TOOLS.filter((tool) => TOOL_METADATA[tool] && !primaryToolSet.has(tool));
  const { leftOverflow, rightOverflow } = splitOverflowTools(overflowTools);

  const applyToolSelection = useEffectEvent((toolType: string) => {
    setActiveToolType(toolType);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          activeTool: { type: toolType, customType: null },
        },
      });
    }
  });

  useEffect(() => {
    if (!allowedTools.length || allowedTools.includes(activeToolType)) return;
    applyToolSelection(allowedTools[0]);
  }, [activeToolType, allowedTools, applyToolSelection]);

  useEffect(() => {
    if (!allowedTools.length) return;

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }

      const toolIndex = Number(event.key) - 1;
      if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= allowedTools.length || toolIndex > 8) {
        return;
      }

      event.preventDefault();
      applyToolSelection(allowedTools[toolIndex]);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allowedToolsKey, allowedTools, applyToolSelection]);

  if (!config || config.toolbar?.mode !== 'allowlist' || allowedTools.length === 0) return null;

  return (
    <div className="absolute left-1/2 top-4 z-[110] -translate-x-1/2">
      <div className="group relative flex items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-x-16 -top-2 h-12 rounded-full bg-[radial-gradient(circle,_rgba(129,140,248,0.24)_0%,_rgba(129,140,248,0)_72%)] blur-2xl"
        />

        {leftOverflow.length > 0 && (
          <div className="absolute right-full top-0 mr-3 flex items-center">
            <div className="pointer-events-none flex items-center gap-1 rounded-[1.1rem] border border-white/75 bg-white/76 p-1 opacity-0 shadow-[0_18px_42px_rgba(99,102,241,0.14)] backdrop-blur-xl translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100">
              {[...leftOverflow].reverse().map((tool) => (
                <ToolButton
                  key={tool}
                  tool={tool}
                  isActive={activeToolType === tool}
                  onClick={applyToolSelection}
                  isOverflow
                />
              ))}
            </div>
            <div className="grid h-10 w-8 shrink-0 place-items-center rounded-xl border border-dashed border-violet-200 bg-white/70 text-violet-300 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-focus-within:scale-95 group-focus-within:opacity-0" title="More tools" aria-hidden="true">
              <MoreHorizontal size={14} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 rounded-[1.2rem] border border-white/80 bg-white/74 p-1.5 shadow-[0_18px_42px_rgba(99,102,241,0.14)] backdrop-blur-xl">
          {allowedTools.map((tool, index) => (
            <ToolButton
              key={tool}
              tool={tool}
              isActive={activeToolType === tool}
              onClick={applyToolSelection}
              hotkey={index < 9 ? String(index + 1) : undefined}
            />
          ))}
        </div>

        {rightOverflow.length > 0 && (
          <div className="absolute left-full top-0 ml-3 flex items-center">
            <div className="grid h-10 w-8 shrink-0 place-items-center rounded-xl border border-dashed border-violet-200 bg-white/70 text-violet-300 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-focus-within:scale-95 group-focus-within:opacity-0" title="More tools" aria-hidden="true">
              <MoreHorizontal size={14} />
            </div>
            <div className="pointer-events-none flex items-center gap-1 rounded-[1.1rem] border border-white/75 bg-white/76 p-1 opacity-0 shadow-[0_18px_42px_rgba(99,102,241,0.14)] backdrop-blur-xl -translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100">
              {rightOverflow.map((tool) => (
                <ToolButton
                  key={tool}
                  tool={tool}
                  isActive={activeToolType === tool}
                  onClick={applyToolSelection}
                  isOverflow
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
