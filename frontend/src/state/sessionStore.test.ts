import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSessionStore } from '../state/sessionStore';

// Reset Zustand store between tests
beforeEach(() => {
  act(() => {
    useSessionStore.setState({
      currentVariant: 'neutral',
      personaProbs: {
        neutral: 0.2,
        draw_first: 0.2,
        text_first: 0.2,
        guided_novice: 0.2,
        power_user: 0.2,
      },
      eventsSentCount: 0,
      isPolicyLocked: false,
    });
  });
});

describe('sessionStore', () => {
  it('initializes with neutral variant', () => {
    const { currentVariant } = useSessionStore.getState();
    expect(currentVariant).toBe('neutral');
  });

  it('setVariant updates currentVariant', () => {
    act(() => useSessionStore.getState().setVariant('draw_first'));
    expect(useSessionStore.getState().currentVariant).toBe('draw_first');
  });

  it('incrementEvents increases eventsSentCount', () => {
    act(() => useSessionStore.getState().incrementEvents(5));
    expect(useSessionStore.getState().eventsSentCount).toBe(5);
  });

  it('incrementEvents is additive over multiple calls', () => {
    act(() => {
      useSessionStore.getState().incrementEvents(3);
      useSessionStore.getState().incrementEvents(4);
    });
    expect(useSessionStore.getState().eventsSentCount).toBe(7);
  });

  it('lockPolicy sets isPolicyLocked to true and updates variant', () => {
    act(() => useSessionStore.getState().lockPolicy('power_user'));
    const state = useSessionStore.getState();
    expect(state.isPolicyLocked).toBe(true);
    expect(state.currentVariant).toBe('power_user');
  });

  it('setPersonaProbs updates personaProbs', () => {
    const newProbs = { neutral: 0.1, draw_first: 0.6, text_first: 0.1, guided_novice: 0.1, power_user: 0.1 };
    act(() => useSessionStore.getState().setPersonaProbs(newProbs));
    expect(useSessionStore.getState().personaProbs).toEqual(newProbs);
  });
});
