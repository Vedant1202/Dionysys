import { type UiVariant } from '../state/sessionStore';

export interface VariantUIConfig {
  showWelcomeScreen: boolean;
  canvasActions: {
    saveAsImage?: boolean;
    saveToActiveFile?: boolean;
    clearCanvas?: boolean;
    toggleTheme?: boolean;
  };
  mainMenuItems: ('saveAsImage' | 'export' | 'clearCanvas' | 'help' | 'toggleTheme')[];
}

export const VARIANT_CONFIGS: Record<UiVariant, VariantUIConfig> = {
  neutral: {
    showWelcomeScreen: false,
    canvasActions: {
      saveAsImage: true,
      clearCanvas: true,
      toggleTheme: true,
    },
    mainMenuItems: ['saveAsImage', 'export', 'clearCanvas', 'help', 'toggleTheme'],
  },
  guided_novice: {
    showWelcomeScreen: true,
    canvasActions: {
      saveAsImage: false,
      clearCanvas: false,
      toggleTheme: false,
    },
    mainMenuItems: ['help'],
  },
  power_user: {
    showWelcomeScreen: false,
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
    canvasActions: {
      saveAsImage: true,
      clearCanvas: true,
    },
    mainMenuItems: ['saveAsImage', 'export', 'clearCanvas'],
  },
  text_first: {
    showWelcomeScreen: false,
    canvasActions: {
      toggleTheme: true,
    },
    mainMenuItems: ['help', 'toggleTheme'],
  },
};
