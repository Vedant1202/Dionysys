import type {
  InteractionSummary,
  SanitizedInteractionEvent,
  SummarizableInteractionEvent,
} from './types.js';

export interface InteractionSummarizerOptions {
  recentEventLimit?: number;
  nowMs?: number;
  sessionStartMs?: number;
  maxStringLength?: number;
}

const TEXT_EVENT_TYPES = new Set(['text_added', 'text_created', 'text_updated']);
const TEXT_ELEMENT_TYPES = new Set(['text']);
const REDACTED_KEY_PATTERN = /(text|content|password|token|secret|api.?key|authorization)/i;

export class InteractionSummarizer {
  summarize(
    events: SummarizableInteractionEvent[],
    options: InteractionSummarizerOptions = {},
  ): InteractionSummary {
    const recentEventLimit = options.recentEventLimit ?? 10;
    const nowMs = options.nowMs ?? Date.now();
    const eventCountsByType: Record<string, number> = {};
    const elementCountsByType: Record<string, number> = {};
    const toolNames = new Set<string>();
    const timestampedEvents = events
      .map((event) => ({ event, timestamp: toTimestamp(event.timestamp) }))
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    for (const event of events) {
      eventCountsByType[event.eventType] = (eventCountsByType[event.eventType] ?? 0) + 1;

      const payload = getRecordPayload(event.payload);
      const elementType = readString(payload, 'type') ?? readString(payload, 'elementType');
      const toolName = elementType ?? readString(payload, 'tool') ?? readString(payload, 'activeTool');

      if (elementType) {
        elementCountsByType[elementType] = (elementCountsByType[elementType] ?? 0) + 1;
      }

      if (toolName) {
        toolNames.add(toolName);
      } else {
        toolNames.add(event.eventType);
      }
    }

    const textEvents = countTextEvents(eventCountsByType, elementCountsByType);
    const shapeEvents = countShapeEvents(eventCountsByType, elementCountsByType);
    const textToShapeRatio = shapeEvents > 0 ? textEvents / shapeEvents : textEvents > 0 ? 1 : 0;
    const firstTimestamp = timestampedEvents.find((item) => item.timestamp !== undefined)?.timestamp;
    const lastTimestamp = [...timestampedEvents].reverse().find((item) => item.timestamp !== undefined)?.timestamp;
    const recentEvents = timestampedEvents.slice(-recentEventLimit).map(({ event, timestamp }) => (
      sanitizeEvent(event, timestamp, options.maxStringLength ?? 120)
    ));

    return {
      totalEvents: events.length,
      eventCountsByType,
      elementCountsByType,
      toolDiversity: toolNames.size,
      textToShapeRatio,
      timeToFirstEventMs: firstTimestamp !== undefined && options.sessionStartMs !== undefined
        ? Math.max(0, firstTimestamp - options.sessionStartMs)
        : undefined,
      timeSinceLastEventMs: lastTimestamp !== undefined ? Math.max(0, nowMs - lastTimestamp) : undefined,
      recentEventTypes: recentEvents.map((event) => event.eventType),
      recentEvents,
      derivedSignals: deriveSignals({
        totalEvents: events.length,
        toolDiversity: toolNames.size,
        textEvents,
        shapeEvents,
        timeSinceLastEventMs: lastTimestamp !== undefined ? Math.max(0, nowMs - lastTimestamp) : undefined,
      }),
    };
  }
}

function toTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getRecordPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function countTextEvents(
  eventCountsByType: Record<string, number>,
  elementCountsByType: Record<string, number>,
): number {
  let eventTotal = 0;
  for (const eventType of TEXT_EVENT_TYPES) {
    eventTotal += eventCountsByType[eventType] ?? 0;
  }
  if (eventTotal > 0) return eventTotal;

  let elementTotal = 0;
  for (const elementType of TEXT_ELEMENT_TYPES) {
    elementTotal += elementCountsByType[elementType] ?? 0;
  }
  return elementTotal;
}

function countShapeEvents(
  eventCountsByType: Record<string, number>,
  elementCountsByType: Record<string, number>,
): number {
  const elementTotal = Object.entries(elementCountsByType).reduce((sum, [type, count]) => (
    TEXT_ELEMENT_TYPES.has(type) ? sum : sum + count
  ), 0);

  return elementTotal > 0 ? elementTotal : eventCountsByType['element_drawn'] ?? 0;
}

function sanitizeEvent(
  event: SummarizableInteractionEvent,
  timestamp: number | undefined,
  maxStringLength: number,
): SanitizedInteractionEvent {
  const payload = getRecordPayload(event.payload);
  const sanitizedPayload: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (REDACTED_KEY_PATTERN.test(key)) continue;
    if (typeof value === 'string') {
      sanitizedPayload[key] = value.slice(0, maxStringLength);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitizedPayload[key] = value;
    }
  }

  return {
    eventType: event.eventType,
    timestamp,
    payload: Object.keys(sanitizedPayload).length > 0 ? sanitizedPayload : undefined,
  };
}

function deriveSignals(input: {
  totalEvents: number;
  toolDiversity: number;
  textEvents: number;
  shapeEvents: number;
  timeSinceLastEventMs?: number;
}): string[] {
  const signals: string[] = [];

  if (input.totalEvents < 5) signals.push('Low event volume');
  if (input.toolDiversity <= 2) signals.push('Low tool diversity');
  if (input.shapeEvents > input.textEvents) signals.push('Mostly shape creation');
  if (input.textEvents > input.shapeEvents) signals.push('Mostly text usage');
  if (input.textEvents === 0) signals.push('No text usage yet');
  if (input.timeSinceLastEventMs !== undefined && input.timeSinceLastEventMs > 30_000) {
    signals.push('Recent inactivity');
  }

  return signals;
}
