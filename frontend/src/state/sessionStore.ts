import { create } from 'zustand';

export type UiVariant = 'neutral' | 'draw_first' | 'text_first' | 'guided_novice' | 'power_user';

interface SessionState {
  currentVariant: UiVariant;
  setVariant: (variant: UiVariant) => void;
  personaProbs: Record<string, number>;
  setPersonaProbs: (probs: Record<string, number>) => void;

  eventsSentCount: number;
  incrementEvents: (count: number) => void;
  isPolicyLocked: boolean;
  lockPolicy: (variant: UiVariant) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentVariant: 'neutral',
  setVariant: (variant) => set({ currentVariant: variant }),
  personaProbs: {
    draw_heavy: 0.2,
    text_heavy: 0.2,
    shortcut_heavy: 0.2,
    menu_explorer: 0.2,
    novice_guided: 0.2,
  },
  setPersonaProbs: (probs) => set({ personaProbs: probs }),

  eventsSentCount: 0,
  incrementEvents: (count) => set((state) => ({ eventsSentCount: state.eventsSentCount + count })),
  isPolicyLocked: false,
  lockPolicy: (variant) => set({ isPolicyLocked: true, currentVariant: variant }),
}));
