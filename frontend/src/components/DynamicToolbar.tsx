import React, { useState } from 'react';
import { 
  Type, 
  MousePointer2, 
  Square, 
  Circle, 
  Minus, 
  ArrowRight,
  Pencil,
  Image as ImageIcon,
  Eraser,
  Diamond,
  MoreHorizontal
} from 'lucide-react';
import { useAdaptiveUI } from '@dionysys/react';
import { DEFAULT_EXCALIDRAW_TOOLS, resolveVariantConfig, type VariantUIConfig } from '../config/variantConfig';

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
  config?: VariantUIConfig;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  selection: <MousePointer2 size={18} />,
  rectangle: <Square size={18} />,
  ellipse: <Circle size={18} />,
  diamond: <Diamond size={18} />,
  arrow: <ArrowRight size={18} />,
  line: <Minus size={18} />,
  freedraw: <Pencil size={18} />,
  text: <Type size={18} />,
  image: <ImageIcon size={18} />,
  eraser: <Eraser size={18} />
};

interface ToolButtonProps {
  tool: string;
  isActive: boolean;
  onClick: (tool: string) => void;
  isOverflow?: boolean;
}

function ToolButton({ tool, isActive, onClick, isOverflow = false }: ToolButtonProps) {
  const icon = TOOL_ICONS[tool];
  if (!icon) return null;

  return (
    <button
      type="button"
      onClick={() => onClick(tool)}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-primary text-primary-content shadow-sm scale-105'
          : `${isOverflow ? 'text-base-content/55' : 'text-base-content/70'} hover:bg-base-200 hover:text-base-content hover:scale-105`
      }`}
      title={`Select ${tool}`}
      aria-label={`Select ${tool}`}
    >
      {icon}
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
  if (!config || !config.toolbar) return null;

  // Only render custom toolbar if mode is allowlist
  if (config.toolbar.mode !== 'allowlist') return null;

  const allowedTools = config.toolbar.tools || [];
  if (allowedTools.length === 0) return null;
  const primaryToolSet = new Set(allowedTools);
  const overflowTools = DEFAULT_EXCALIDRAW_TOOLS.filter((tool) => !primaryToolSet.has(tool));
  const { leftOverflow, rightOverflow } = splitOverflowTools(overflowTools);

  const handleToolClick = (toolType: string) => {
    setActiveToolType(toolType);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          activeTool: { type: toolType, customType: null }
        }
      });
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100]">
      <div className="group relative flex items-center justify-center">
        {leftOverflow.length > 0 && (
          <div className="absolute top-0 right-full mr-2 flex items-center">
            <div className="pointer-events-none flex items-center gap-1 rounded-xl border border-base-300 bg-base-100/90 p-1.5 opacity-0 shadow-xl backdrop-blur-md translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100">
              {[...leftOverflow].reverse().map((tool) => (
                <ToolButton
                  key={tool}
                  tool={tool}
                  isActive={activeToolType === tool}
                  onClick={handleToolClick}
                  isOverflow
                />
              ))}
            </div>
            <div className="grid h-11 w-8 shrink-0 place-items-center rounded-lg border border-dashed border-base-content/20 bg-base-100/70 text-base-content/50 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-focus-within:scale-95 group-focus-within:opacity-0" title="More default tools on the left" aria-hidden="true">
              <MoreHorizontal size={16} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-base-300 bg-base-100/90 p-1.5 shadow-xl backdrop-blur-md transition-all duration-300">
          {allowedTools.map((tool: string) => (
            <ToolButton
              key={tool}
              tool={tool}
              isActive={activeToolType === tool}
              onClick={handleToolClick}
            />
          ))}
        </div>

        {rightOverflow.length > 0 && (
          <div className="absolute top-0 left-full ml-2 flex items-center">
            <div className="grid h-11 w-8 shrink-0 place-items-center rounded-lg border border-dashed border-base-content/20 bg-base-100/70 text-base-content/50 transition-all duration-200 group-hover:scale-95 group-hover:opacity-0 group-focus-within:scale-95 group-focus-within:opacity-0" title="More default tools on the right" aria-hidden="true">
              <MoreHorizontal size={16} />
            </div>
            <div className="pointer-events-none flex items-center gap-1 rounded-xl border border-base-300 bg-base-100/90 p-1.5 opacity-0 shadow-xl backdrop-blur-md -translate-x-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100">
              {rightOverflow.map((tool) => (
                <ToolButton
                  key={tool}
                  tool={tool}
                  isActive={activeToolType === tool}
                  onClick={handleToolClick}
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
