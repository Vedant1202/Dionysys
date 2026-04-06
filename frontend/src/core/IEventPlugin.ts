export interface AppEvent {
  eventType: string;
  payload: any;
  timestamp: number;
}

export interface IEventPlugin {
  id: string;
  // Called once when the tracking is initialized
  init: (emitEvent: (event: AppEvent) => void) => void;
  // Hook directly into Excalidraw's onChange
  onChange?: (elements: readonly any[], appState: any, files: any) => void;
  // Cleanup hook
  destroy: () => void;
}
