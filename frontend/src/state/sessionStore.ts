import { create } from 'zustand';

export type UiVariant =
  | 'neutral'
  | 'neutral__novice'
  | 'neutral__power_user'
  | 'draw_first'
  | 'draw_first__novice'
  | 'draw_first__power_user'
  | 'text_first'
  | 'text_first__novice'
  | 'text_first__power_user';

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
    neutral: 0.34,
    draw_first: 0.33,
    text_first: 0.33,
  },
  setPersonaProbs: (probs) => set({ personaProbs: probs }),

  eventsSentCount: 0,
  incrementEvents: (count) => set((state) => ({ eventsSentCount: state.eventsSentCount + count })),
  isPolicyLocked: false,
  lockPolicy: (variant) => set({ isPolicyLocked: true, currentVariant: variant }),
}));
