import type { DionysysClient } from '@dionysys/client';
import type { IEventPlugin, AppEvent } from './IEventPlugin';
import { DrawingPlugin } from '../plugins/DrawingPlugin';
import { PointerTelemetryPlugin } from '../plugins/PointerTelemetryPlugin';
import { InteractionPlugin } from '../plugins/InteractionPlugin';
import { toDionysysEvent } from '../dionysys/excalidrawEvents';

// Throttle limit
const THROTTLE_MS = 5000;
const MAX_BUFFER_SIZE = 1000;

class EventCollector {
  private plugins: IEventPlugin[] = [];
  private client?: Pick<DionysysClient, 'events'>;
  private batch: AppEvent[] = [];
  private intervalId: number | null = null;
  private sessionId?: string;
  private tabId: string = crypto.randomUUID();
  private nextSequenceId: number = 1;
  public onFlush?: (count: number, events: AppEvent[]) => void | Promise<void>;

  constructor() {
    // Register plugins
    this.registerPlugin(new DrawingPlugin());
    this.registerPlugin(new PointerTelemetryPlugin());
    this.registerPlugin(new InteractionPlugin());

    this.intervalId = window.setInterval(() => {
      this.flush();
    }, THROTTLE_MS);
  }

  registerPlugin(plugin: IEventPlugin) {
    plugin.init((event) => {
      this.pushToBuffer(event);
    });
    this.plugins.push(plugin);
  }

  getPlugin<T extends IEventPlugin>(id: string): T | undefined {
    return this.plugins.find(p => p.id === id) as T | undefined;
  }

  recordEvent(event: AppEvent) {
    this.pushToBuffer(event);
  }

  private pushToBuffer(event: AppEvent) {
    event.sequenceId = this.nextSequenceId++;
    this.batch.push(event);
    if (this.batch.length > MAX_BUFFER_SIZE) {
      this.batch.shift(); // Drop the oldest item
    }
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

  setClient(client: Pick<DionysysClient, 'events'>) {
    this.client = client;
  }

  private async flush() {
    if (this.batch.length === 0) return;
    if (!this.sessionId) return;
    if (!this.client) return;

    const itemsToSend = [...this.batch];
    this.batch = [];

    try {
      await this.client.events.track({
        sessionId: this.sessionId,
        tabId: this.tabId,
        events: itemsToSend.map(toDionysysEvent),
      });
    } catch (e) {
      console.error('Failed to queue events for flush', e);
      this.batch = [...itemsToSend, ...this.batch].slice(-MAX_BUFFER_SIZE);
      return;
    }

    try {
      await this.client.events.flush();
      // Fire callback if set
      if (this.onFlush) {
        void this.onFlush(itemsToSend.length, itemsToSend);
      }
    } catch (e) {
      console.error('Failed to flush events', e);
    }
  }

  shutdown() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.plugins.forEach(p => p.destroy());
    void this.flush();
  }
}

// Singleton pattern for the collector
export const eventCollector = new EventCollector();
