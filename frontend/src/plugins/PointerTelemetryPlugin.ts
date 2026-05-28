import type { AppEvent, IEventPlugin } from '../core/IEventPlugin';

export class PointerTelemetryPlugin implements IEventPlugin {
  public id = 'pointer-telemetry';
  
  private erraticScore = 0;
  private lastMoveTime = Date.now();
  private idleTime = 0;
  private lastX: number | null = null;
  private lastY: number | null = null;
  
  private intervalId: number | null = null;
  private emitEvent?: (event: AppEvent) => void;

  public init(emitEvent: (event: AppEvent) => void) {
    this.emitEvent = emitEvent;
    
    window.addEventListener('pointermove', this.handlePointerMove, { capture: true, passive: true });
    
    // Emit cognitive state every 5 seconds
    this.intervalId = window.setInterval(() => {
      this.flushState();
    }, 5000);
  }

  private handlePointerMove = (e: PointerEvent) => {
    const now = Date.now();
    
    // Update idle time on movement
    this.idleTime = 0;
    
    // Calculate simple erraticism (speed / distance jitter)
    if (this.lastX !== null && this.lastY !== null) {
      const dx = Math.abs(e.clientX - this.lastX);
      const dy = Math.abs(e.clientY - this.lastY);
      const dt = Math.max(now - this.lastMoveTime, 1);
      
      const speed = (dx + dy) / dt;
      
      // Simple heuristic: if speed is wildly high or changing direction, bump score
      if (speed > 5) {
        this.erraticScore = Math.min(this.erraticScore + speed, 100);
      }
    }

    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastMoveTime = now;
  };

  private flushState() {
    if (!this.emitEvent) return;

    // Update idleTime if we haven't moved recently
    const now = Date.now();
    this.idleTime = now - this.lastMoveTime;

    this.emitEvent({
      eventType: 'cognitive_state',
      timestamp: now,
      payload: {
        erraticScore: this.erraticScore,
        idleMs: this.idleTime
      }
    });

    // Decay the erratic score (return towards 0 over time)
    this.erraticScore = Math.max(0, this.erraticScore - 20);
  }

  // Expose current state for the Adaptation Engine
  public getCurrentState() {
    // Recalculate idle time on demand
    const now = Date.now();
    this.idleTime = now - this.lastMoveTime;
    return {
      erraticScore: this.erraticScore,
      idleMs: this.idleTime
    };
  }

  public destroy() {
    window.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
