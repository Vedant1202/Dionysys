import type { IEventPlugin, AppEvent } from './IEventPlugin';
import { DrawingPlugin } from '../plugins/DrawingPlugin';

// Hardcoded explicit session ID for POC purposes initially
export const MOCK_SESSION_ID = 'sess_' + Math.random().toString(36).substr(2, 9);
// Throttle limit
const THROTTLE_MS = 2000;

class EventCollector {
  private plugins: IEventPlugin[] = [];
  private backendUrl = 'http://localhost:3001/api/events';
  private batch: AppEvent[] = [];
  private intervalId: number | null = null;
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

  private async flush() {
    if (this.batch.length === 0) return;

    const itemsToSend = [...this.batch];
    this.batch = [];

    try {
      await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: MOCK_SESSION_ID,
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
