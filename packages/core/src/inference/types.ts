export interface GenericEvent {
  eventType: string;
  payload?: unknown;
  timestamp?: number;
  sessionId?: string;
  [key: string]: unknown;
}

export type EventWeightResolver =
  | Record<string, number>
  | ((payload: unknown) => Record<string, number>);

export interface InferenceConfig {
  personas: string[];
  initialCounts: Record<string, number>;
  eventWeights: Record<string, EventWeightResolver>;
  heuristics?: Array<(events: GenericEvent[]) => Record<string, number>>;
}
