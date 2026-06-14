import {
  splitComposedUiVariant,
  type AdaptiveUIDefinition,
  type ExpertisePersona,
  type ModalityPersona,
} from '@dionysys/core';

export type UiVariant = string;

type CanvasActionName = 'saveAsImage' | 'export' | 'clearCanvas' | 'help' | 'toggleTheme';
const SUPPORTED_MENU_ITEMS: CanvasActionName[] = ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'];

function isCanvasActionName(value: string): value is CanvasActionName {
  return SUPPORTED_MENU_ITEMS.includes(value as CanvasActionName);
}

export interface VariantUIConfig {
  toolbar?: AdaptiveUIDefinition['toolbar'];
  showWelcomeScreen: boolean;
  canvasActions: {
    saveAsImage?: boolean;
    saveToActiveFile?: boolean;
    clearCanvas?: boolean;
    toggleTheme?: boolean;
  };
  mainMenuItems: CanvasActionName[];
}

const DRAW_TOOLS = ['selection', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'eraser'];
const TEXT_TOOLS = ['selection', 'text', 'eraser'];
export const DEFAULT_EXCALIDRAW_TOOLS = ['selection', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'image', 'eraser'];
export const DEBUG_VARIANT_OPTIONS = [
  'neutral',
  'neutral__novice',
  'neutral__power_user',
  'draw_first',
  'draw_first__novice',
  'draw_first__power_user',
  'text_first',
  'text_first__novice',
  'text_first__power_user',
] as const;

const BASE_VARIANT_CONFIGS: Record<ModalityPersona, VariantUIConfig> = {
  neutral: {
    showWelcomeScreen: false,
    toolbar: { mode: 'blocklist', tools: [] },
    canvasActions: {
      saveAsImage: true,
      clearCanvas: true,
      toggleTheme: true,
    },
    mainMenuItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'],
  },
  draw_first: {
    showWelcomeScreen: false,
    toolbar: { mode: 'allowlist', tools: DRAW_TOOLS },
    canvasActions: {
      saveAsImage: true,
      clearCanvas: true,
    },
    mainMenuItems: ['saveAsImage', 'export', 'clearCanvas'],
  },
  text_first: {
    showWelcomeScreen: false,
    toolbar: { mode: 'allowlist', tools: TEXT_TOOLS },
    canvasActions: {
      toggleTheme: true,
    },
    mainMenuItems: ['help', 'toggleTheme'],
  },
};

export const VARIANT_CONFIGS = BASE_VARIANT_CONFIGS;

export function resolveVariantConfig(
  variant: string,
  uiState?: AdaptiveUIDefinition,
): VariantUIConfig | undefined {
  if (uiState) {
    return {
      showWelcomeScreen: Boolean(uiState.showWelcomeScreen),
      toolbar: uiState.toolbar ?? { mode: 'blocklist', tools: [] },
      canvasActions: uiState.canvasActions ?? {},
      mainMenuItems: (uiState.mainMenuItems ?? uiState.mainMenu?.allowedItems ?? []).filter(isCanvasActionName),
    };
  }

  const { modality, expertise } = splitComposedUiVariant(variant);
  const baseConfig = BASE_VARIANT_CONFIGS[modality];
  if (!baseConfig) return undefined;

  return applyExpertiseOverlay(baseConfig, modality, expertise);
}

export function buildAdaptiveUIDefinitionFromVariant(variant: UiVariant): AdaptiveUIDefinition {
  const config = resolveVariantConfig(variant);
  if (!config) {
    return {
      variant,
      showWelcomeScreen: false,
      toolbar: { mode: 'blocklist', tools: [] },
      canvasActions: {},
      mainMenuItems: [],
      mainMenu: { allowedItems: [] },
    };
  }

  return {
    variant,
    showWelcomeScreen: config.showWelcomeScreen,
    toolbar: config.toolbar,
    canvasActions: config.canvasActions,
    mainMenuItems: config.mainMenuItems,
    mainMenu: {
      allowedItems: config.mainMenuItems,
    },
  };
}

function applyExpertiseOverlay(
  baseConfig: VariantUIConfig,
  modality: ModalityPersona,
  expertise: ExpertisePersona,
): VariantUIConfig {
  if (expertise === 'novice') {
    if (modality === 'neutral') {
      return {
        ...baseConfig,
        showWelcomeScreen: true,
      };
    }

    return {
      showWelcomeScreen: true,
      toolbar: { mode: 'allowlist', tools: getNoviceToolbar(modality) },
      canvasActions: {
        saveAsImage: false,
        saveToActiveFile: false,
        clearCanvas: false,
        toggleTheme: false,
      },
      mainMenuItems: ['help'],
    };
  }

  if (expertise === 'power_user') {
    return {
      toolbar: baseConfig.toolbar,
      showWelcomeScreen: false,
      canvasActions: {
        ...baseConfig.canvasActions,
        saveAsImage: true,
        saveToActiveFile: true,
        clearCanvas: true,
        toggleTheme: true,
      },
      mainMenuItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'],
    };
  }

  return baseConfig;
}

function getNoviceToolbar(modality: ModalityPersona): string[] {
  switch (modality) {
    case 'draw_first':
      return ['selection', 'rectangle'];
    case 'text_first':
      return ['selection', 'text'];
    default:
      return ['selection', 'rectangle', 'text'];
  }
}
