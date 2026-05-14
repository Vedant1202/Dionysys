import type { IEventPlugin, AppEvent } from './IEventPlugin';
import { DrawingPlugin } from '../plugins/DrawingPlugin';

// Throttle limit
const THROTTLE_MS = 2000;

class EventCollector {
  private plugins: IEventPlugin[] = [];
  private backendUrl = 'http://localhost:3001/api/events';
  private batch: AppEvent[] = [];
  private intervalId: number | null = null;
  private sessionId: string | undefined;
  public onFlush?: (count: number) => void;

  constructor() {
    // Register plugins
    this.registerPlugin(new DrawingPlugin());

    this.intervalId = window.setInterval(() => {
      this.flush();
    }, THROTTLE_MS);
  }

  registerPlugin(plugin: IEventPlugin) {
    plugin.init((event) => {
      this.batch.push(event);
    });
    this.plugins.push(plugin);
  }

  handleExcalidrawChange(elements: readonly any[], appState: any, files: any) {
    this.plugins.forEach(plugin => {
      if (plugin.onChange) {
        plugin.onChange(elements, appState, files);
      }
    });
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  setApiBaseUrl(apiBaseUrl: string) {
    this.backendUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/events`;
  }

  private async flush() {
    if (this.batch.length === 0) return;
    if (!this.sessionId) return;

    const itemsToSend = [...this.batch];
    this.batch = [];

    try {
      await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: itemsToSend
        }),
      });
      // Fire callback if set
      if (this.onFlush) {
        this.onFlush(itemsToSend.length);
      }
    } catch (e) {
      console.error('Failed to flush events', e);
      // Restore items so they're retried on the next flush cycle
      this.batch = [...itemsToSend, ...this.batch];
    }
  }

  shutdown() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.plugins.forEach(p => p.destroy());
    this.flush(); // Fire remaining
  }
}

// Singleton pattern for the collector
export const eventCollector = new EventCollector();
