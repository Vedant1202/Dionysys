import type { IEventPlugin, AppEvent } from '../core/IEventPlugin';

/**
 * Tracks when new drawn shapes (lines, freesheets, rectangles) are added to the canvas.
 */
export class DrawingPlugin implements IEventPlugin {
  id = 'drawing_plugin';
  emit!: (event: AppEvent) => void;
  private knownElements: Map<string, { type: string; version?: number; text?: string; isDeleted?: boolean }> = new Map();

  init(emitEvent: (event: AppEvent) => void) {
    this.emit = emitEvent;
  }

  onChange(elements: readonly any[], _appState: any, _files: any) {
    const visibleElementIds = new Set(elements.filter((element) => !element.isDeleted).map((element) => element.id));

    for (const [elementId, snapshot] of this.knownElements.entries()) {
      if (!snapshot.isDeleted && !visibleElementIds.has(elementId)) {
        this.knownElements.set(elementId, { ...snapshot, isDeleted: true });
        this.emit({
          eventType: 'element_deleted',
          payload: { type: snapshot.type, elementId },
          timestamp: Date.now(),
        });
      }
    }

    elements.forEach(element => {
      const previous = this.knownElements.get(element.id);

      if (!previous) {
        this.knownElements.set(element.id, snapshotElement(element));
        
        // Excalidraw doesn't mean it's truly "drawn" until it's finished, 
        // but for a POC, tracking instantiation is sufficient.
        if (element.type !== 'text') {
          this.emit({
            eventType: 'element_drawn',
            payload: { type: element.type, elementId: element.id },
            timestamp: Date.now()
          });
        } else {
          this.emit({
            eventType: 'text_added',
            payload: { textValue: element.text, elementId: element.id },
            timestamp: Date.now()
          });
        }
        return;
      }

      if (element.isDeleted && !previous.isDeleted) {
        this.knownElements.set(element.id, snapshotElement(element));
        this.emit({
          eventType: 'element_deleted',
          payload: { type: element.type, elementId: element.id },
          timestamp: Date.now()
        });
        return;
      }

      if (element.version !== previous.version) {
        this.knownElements.set(element.id, snapshotElement(element));

        if (element.type === 'text' && element.text !== previous.text) {
          this.emit({
            eventType: 'text_updated',
            payload: { elementId: element.id },
            timestamp: Date.now()
          });
          return;
        }

        if (!element.isDeleted) {
          this.emit({
            eventType: 'element_modified',
            payload: { type: element.type, elementId: element.id },
            timestamp: Date.now()
          });
        }
      }
    });
  }

  destroy() {
    this.knownElements.clear();
  }
}

function snapshotElement(element: any): { type: string; version?: number; text?: string; isDeleted?: boolean } {
  return {
    type: element.type,
    version: typeof element.version === 'number' ? element.version : undefined,
    text: typeof element.text === 'string' ? element.text : undefined,
    isDeleted: Boolean(element.isDeleted),
  };
}
