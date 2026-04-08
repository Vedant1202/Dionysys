export type UiVariant = 'neutral' | 'draw_first' | 'text_first' | 'guided_novice' | 'power_user';
import { type AdaptiveUIDefinition } from '@antigravity/core';

export interface VariantUIConfig extends Omit<AdaptiveUIDefinition, 'variant' | 'mainMenu'> {
  showWelcomeScreen: boolean;
  canvasActions: {
    saveAsImage?: boolean;
    saveToActiveFile?: boolean;
    clearCanvas?: boolean;
    toggleTheme?: boolean;
  };
  mainMenuItems: ('saveAsImage' | 'export' | 'clearCanvas' | 'help' | 'toggleTheme')[];
}

const DRAW_TOOLS = ['selection', 'rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'eraser'];
const TEXT_TOOLS = ['selection', 'text', 'eraser'];

export const VARIANT_CONFIGS: Record<UiVariant, VariantUIConfig> = {
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
  guided_novice: {
    showWelcomeScreen: true,
    toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'text'] },
    canvasActions: {
      saveAsImage: false,
      clearCanvas: false,
      toggleTheme: false,
    },
    mainMenuItems: ['help'],
  },
  power_user: {
    showWelcomeScreen: false,
    toolbar: { mode: 'blocklist', tools: [] },
    canvasActions: {
      saveAsImage: true,
      saveToActiveFile: true,
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
