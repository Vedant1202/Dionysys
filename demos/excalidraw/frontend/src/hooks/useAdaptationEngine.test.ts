import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAdaptationEngine } from './useAdaptationEngine';

const mockUseAdaptiveUI = vi.fn();
vi.mock('@dionysys/react', () => ({
  useAdaptiveUI: (...args: any[]) => mockUseAdaptiveUI(...args),
}));

const mockGetPlugin = vi.fn();
vi.mock('../core/eventCollector', () => ({
  eventCollector: {
    getPlugin: (...args: any[]) => mockGetPlugin(...args)
  }
}));

describe('useAdaptationEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseAdaptiveUI.mockReturnValue({
      currentVariant: 'neutral',
      currentUIState: null
    });
    
    mockGetPlugin.mockReturnValue({
      getCurrentState: () => ({ idleMs: 2000 })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initially exposes the pending state', () => {
    const { result } = renderHook(() => useAdaptationEngine());
    expect(result.current.currentVariant).toBe('neutral');
  });

  it('delays exposing new state if idleTime is low', () => {
    const { result, rerender } = renderHook(() => useAdaptationEngine());
    
    mockGetPlugin.mockReturnValue({
      getCurrentState: () => ({ idleMs: 500 })
    });

    mockUseAdaptiveUI.mockReturnValue({
      currentVariant: 'power_user',
      currentUIState: null
    });
    
    rerender();

    expect(result.current.currentVariant).toBe('neutral');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.currentVariant).toBe('neutral');

    mockGetPlugin.mockReturnValue({
      getCurrentState: () => ({ idleMs: 2000 })
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.currentVariant).toBe('power_user');
  });
});
