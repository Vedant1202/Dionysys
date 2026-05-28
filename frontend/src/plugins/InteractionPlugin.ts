import type { AppEvent, IEventPlugin } from '../core/IEventPlugin';

export class InteractionPlugin implements IEventPlugin {
  public id = 'interaction-telemetry';
  
  private hoverTimers: Map<HTMLElement, number> = new Map();
  private emitEvent?: (event: AppEvent) => void;

  public init(emitEvent: (event: AppEvent) => void) {
    this.emitEvent = emitEvent;
    
    // Use event delegation on the document body to catch toolbar hovers
    document.addEventListener('pointerenter', this.handlePointerEnter, { capture: true });
    document.addEventListener('pointerleave', this.handlePointerLeave, { capture: true });
    document.addEventListener('click', this.handleClick, { capture: true });
  }

  private isToolbarElement(el: HTMLElement): boolean {
    return el.tagName === 'BUTTON' || el.closest('button') !== null;
  }

  private handlePointerEnter = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!this.isToolbarElement(target)) return;

    // Start hesitation timer
    const timerId = window.setTimeout(() => {
      this.emitHesitation(target);
    }, 3000);

    this.hoverTimers.set(target, timerId);
  };

  private handlePointerLeave = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    this.clearTimer(target);
  };

  private handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    this.clearTimer(target);
  };

  private clearTimer(target: HTMLElement) {
    const timerId = this.hoverTimers.get(target);
    if (timerId) {
      clearTimeout(timerId);
      this.hoverTimers.delete(target);
    }
    
    const parentButton = target.closest('button');
    if (parentButton) {
      const parentTimerId = this.hoverTimers.get(parentButton);
      if (parentTimerId) {
        clearTimeout(parentTimerId);
        this.hoverTimers.delete(parentButton);
      }
    }
  }

  private emitHesitation(target: HTMLElement) {
    if (!this.emitEvent) return;

    // Use ARIA label, title, or text content for identifiable name
    let name = target.getAttribute('aria-label') || target.title;
    if (!name) {
      const parent = target.closest('button');
      if (parent) {
        name = parent.getAttribute('aria-label') || parent.title;
      }
    }

    this.emitEvent({
      eventType: 'ui_interaction',
      timestamp: Date.now(),
      payload: {
        interactionType: 'hesitation',
        elementName: name || 'unknown'
      }
    });
  }

  public destroy() {
    document.removeEventListener('pointerenter', this.handlePointerEnter, { capture: true });
    document.removeEventListener('pointerleave', this.handlePointerLeave, { capture: true });
    document.removeEventListener('click', this.handleClick, { capture: true });
    
    this.hoverTimers.forEach(timerId => clearTimeout(timerId));
    this.hoverTimers.clear();
  }
}
