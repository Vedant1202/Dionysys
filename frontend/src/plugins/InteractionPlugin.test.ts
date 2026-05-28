import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionPlugin } from './InteractionPlugin';

describe('InteractionPlugin', () => {
  let plugin: InteractionPlugin;
  let emitEventMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = new InteractionPlugin();
    emitEventMock = vi.fn();
    plugin.init(emitEventMock);
  });

  afterEach(() => {
    plugin.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits hesitation event if hover duration exceeds 3000ms', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Rectangle tool');
    document.body.appendChild(button);

    // Simulate pointerenter
    const enterEvent = new Event('pointerenter') as any;
    Object.defineProperty(enterEvent, 'target', { value: button });
    document.dispatchEvent(enterEvent);

    vi.advanceTimersByTime(3001);

    expect(emitEventMock).toHaveBeenCalledTimes(1);
    const event = emitEventMock.mock.calls[0][0];
    expect(event.eventType).toBe('ui_interaction');
    expect(event.payload.interactionType).toBe('hesitation');
    expect(event.payload.elementName).toBe('Rectangle tool');

    document.body.removeChild(button);
  });

  it('does not emit event if pointer leaves before 3000ms', () => {
    const button = document.createElement('button');
    
    const enterEvent = new Event('pointerenter') as any;
    Object.defineProperty(enterEvent, 'target', { value: button });
    document.dispatchEvent(enterEvent);

    vi.advanceTimersByTime(1500);

    const leaveEvent = new Event('pointerleave') as any;
    Object.defineProperty(leaveEvent, 'target', { value: button });
    document.dispatchEvent(leaveEvent);

    vi.advanceTimersByTime(2000);

    expect(emitEventMock).not.toHaveBeenCalled();
  });

  it('does not emit event if element is clicked before 3000ms', () => {
    const button = document.createElement('button');
    
    const enterEvent = new Event('pointerenter') as any;
    Object.defineProperty(enterEvent, 'target', { value: button });
    document.dispatchEvent(enterEvent);

    vi.advanceTimersByTime(1500);

    const clickEvent = new Event('click') as any;
    Object.defineProperty(clickEvent, 'target', { value: button });
    document.dispatchEvent(clickEvent);

    vi.advanceTimersByTime(2000);

    expect(emitEventMock).not.toHaveBeenCalled();
  });
});
