import { useState, useEffect } from 'react';
import { useAdaptiveUI } from '@dionysys/react';
import { eventCollector } from '../core/eventCollector';
import type { PointerTelemetryPlugin } from '../plugins/PointerTelemetryPlugin';

export function useAdaptationEngine() {
  const adaptiveUI = useAdaptiveUI();
  
  const [activeVariant, setActiveVariant] = useState(adaptiveUI.currentVariant);
  const [activeUIState, setActiveUIState] = useState(adaptiveUI.currentUIState);

  useEffect(() => {
    const isVariantSame = adaptiveUI.currentVariant === activeVariant;
    const isUIStateSame = JSON.stringify(adaptiveUI.currentUIState) === JSON.stringify(activeUIState);
    
    if (isVariantSame && isUIStateSame) return;

    let timeoutId: number;

    const checkAndApply = () => {
      const pointerPlugin = eventCollector.getPlugin<PointerTelemetryPlugin>('pointer-telemetry');
      const idleMs = pointerPlugin ? pointerPlugin.getCurrentState().idleMs : 2000;

      if (idleMs > 1500) {
        setActiveVariant(adaptiveUI.currentVariant);
        setActiveUIState(adaptiveUI.currentUIState);
      } else {
        timeoutId = window.setTimeout(checkAndApply, 500);
      }
    };

    checkAndApply();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [adaptiveUI.currentVariant, adaptiveUI.currentUIState, activeVariant, activeUIState]);

  return {
    ...adaptiveUI,
    currentVariant: activeVariant,
    currentUIState: activeUIState,
    pendingVariant: adaptiveUI.currentVariant,
  };
}
