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
  Diamond
} from 'lucide-react';
import { useAdaptiveUI } from '@antigravity/react';
import { VARIANT_CONFIGS } from '../config/variantConfig';

interface DynamicToolbarProps {
  excalidrawAPI: any | null;
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

export function DynamicToolbar({ excalidrawAPI }: DynamicToolbarProps) {
  const { currentVariant } = useAdaptiveUI();
  const [activeToolType, setActiveToolType] = useState<string>('selection');

  const config = VARIANT_CONFIGS[currentVariant as keyof typeof VARIANT_CONFIGS];
  if (!config || !config.toolbar) return null;

  // Only render custom toolbar if mode is allowlist
  if (config.toolbar.mode !== 'allowlist') return null;

  const allowedTools = config.toolbar.tools || [];
  if (allowedTools.length === 0) return null;

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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-base-100/90 backdrop-blur-md shadow-xl border border-base-300 rounded-xl p-1.5 flex items-center gap-1 transition-all duration-300">
      {allowedTools.map((tool: string) => {
        if (!TOOL_ICONS[tool]) return null;
        
        const isActive = activeToolType === tool;
        
        return (
          <button
            key={tool}
            onClick={() => handleToolClick(tool)}
            className={`p-3 rounded-lg transition-all duration-200 ${
              isActive 
                ? 'bg-primary text-primary-content shadow-sm scale-110' 
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content hover:scale-105'
            }`}
            title={`Select ${tool}`}
          >
            {TOOL_ICONS[tool]}
          </button>
        );
      })}
    </div>
  );
}
