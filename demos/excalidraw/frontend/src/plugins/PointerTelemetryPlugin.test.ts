import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PointerTelemetryPlugin } from './PointerTelemetryPlugin';

describe('PointerTelemetryPlugin', () => {
  let plugin: PointerTelemetryPlugin;
  let emitEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = new PointerTelemetryPlugin();
    emitEventMock = vi.fn();
    plugin.init(emitEventMock);
  });

  afterEach(() => {
    plugin.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calculates erraticScore on rapid pointer movements', () => {
    // Simulate pointer movement
    const moveEvent1 = new Event('pointermove') as any;
    moveEvent1.clientX = 0;
    moveEvent1.clientY = 0;
    window.dispatchEvent(moveEvent1);

    vi.advanceTimersByTime(10);
    const moveEvent2 = new Event('pointermove') as any;
    moveEvent2.clientX = 100;
    moveEvent2.clientY = 100;
    window.dispatchEvent(moveEvent2);

    const state = plugin.getCurrentState();
    expect(state.erraticScore).toBeGreaterThan(0);
    expect(state.idleMs).toBe(0);
  });

  it('updates idleTime accurately', () => {
    const moveEvent = new Event('pointermove') as any;
    moveEvent.clientX = 10;
    moveEvent.clientY = 10;
    window.dispatchEvent(moveEvent);

    vi.advanceTimersByTime(1500);

    const state = plugin.getCurrentState();
    expect(state.idleMs).toBe(1500);
  });

  it('emits cognitive_state event every 5 seconds', () => {
    const moveEvent = new Event('pointermove') as any;
    moveEvent.clientX = 10;
    moveEvent.clientY = 10;
    window.dispatchEvent(moveEvent);

    vi.advanceTimersByTime(5000);

    expect(emitEventMock).toHaveBeenCalledTimes(1);
    const event = emitEventMock.mock.calls[0][0];
    expect(event.eventType).toBe('cognitive_state');
    expect(event.payload.idleMs).toBe(5000);
    expect(event.payload.erraticScore).toBeDefined();
  });
});
