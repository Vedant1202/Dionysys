import type { IEventPlugin, AppEvent } from '../core/IEventPlugin';

/**
 * Tracks when new drawn shapes (lines, freesheets, rectangles) are added to the canvas.
 */
export class DrawingPlugin implements IEventPlugin {
  id = 'drawing_plugin';
  emit!: (event: AppEvent) => void;
  private knownElementIds: Set<string> = new Set();

  init(emitEvent: (event: AppEvent) => void) {
    this.emit = emitEvent;
  }

  onChange(elements: readonly any[], _appState: any, _files: any) {
    // Basic heuristic: check if there are any new elements we haven't seen before.
    elements.forEach(element => {
      if (!this.knownElementIds.has(element.id)) {
        this.knownElementIds.add(element.id);
        
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
      }
    });
  }

  destroy() {
    this.knownElementIds.clear();
  }
}
