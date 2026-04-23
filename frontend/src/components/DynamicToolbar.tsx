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
    <div className="group absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 rounded-xl border border-base-300 bg-base-100/90 p-1.5 shadow-xl backdrop-blur-md transition-all duration-300">
      <div className="flex items-center gap-1">
        {allowedTools.map((tool: string) => (
          <ToolButton
            key={tool}
            tool={tool}
            isActive={activeToolType === tool}
            onClick={handleToolClick}
          />
        ))}
      </div>

      {overflowTools.length > 0 && (
        <>
          <div className="mx-1 h-8 w-px shrink-0 bg-base-content/10" aria-hidden="true" />
          <div className="flex items-center overflow-hidden">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-base-content/20 text-base-content/50 transition-opacity duration-200 group-hover:opacity-0 group-hover:w-0 group-hover:border-0" title="More default tools" aria-label="More default tools">
              <MoreHorizontal size={18} />
            </div>
            <div className="flex max-w-0 items-center gap-1 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-w-[36rem] group-hover:opacity-100">
              {overflowTools.map((tool) => (
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
        </>
      )}
    </div>
  );
}
