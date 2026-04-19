import type {
  InteractionSummary,
  PersonalityResource,
  PersonalityScoreResult,
  PersonalitySignalRule,
} from './types.js';

export class PersonalityScorer {
  score(resources: PersonalityResource[], summary: InteractionSummary): PersonalityScoreResult {
    if (resources.length === 0) {
      return { rawScores: {}, personaScores: {}, matchedSignals: {} };
    }

    const rawScores: Record<string, number> = {};
    const matchedSignals: Record<string, string[]> = {};

    for (const resource of resources) {
      let rawScore = resource.scoring.baseWeight ?? 1;
      matchedSignals[resource.id] = [];

      for (const signal of resource.scoring.signals) {
        if (matchesSignal(signal, summary)) {
          rawScore += signal.weight;
          matchedSignals[resource.id]!.push(signal.id);
        }
      }

      rawScores[resource.id] = Math.max(0, rawScore);
    }

    return {
      rawScores,
      personaScores: normalize(rawScores),
      matchedSignals,
    };
  }
}

function matchesSignal(signal: PersonalitySignalRule, summary: InteractionSummary): boolean {
  if (signal.metric === 'recentEventType') {
    const contains = summary.recentEventTypes.includes(String(signal.value));
    return signal.operator === 'contains' || signal.operator === '=='
      ? contains
      : signal.operator === 'notContains' || signal.operator === '!='
        ? !contains
        : false;
  }

  const actual = readMetric(signal, summary);
  if (actual === undefined || typeof signal.value !== 'number') {
    return false;
  }

  switch (signal.operator) {
    case '<':
      return actual < signal.value;
    case '<=':
      return actual <= signal.value;
    case '>':
      return actual > signal.value;
    case '>=':
      return actual >= signal.value;
    case '==':
      return actual === signal.value;
    case '!=':
      return actual !== signal.value;
    default:
      return false;
  }
}

function readMetric(signal: PersonalitySignalRule, summary: InteractionSummary): number | undefined {
  switch (signal.metric) {
    case 'totalEvents':
      return summary.totalEvents;
    case 'eventCount':
      return summary.eventCountsByType[signal.eventType ?? String(signal.value)] ?? 0;
    case 'eventRatio': {
      const eventCount = summary.eventCountsByType[signal.eventType ?? String(signal.value)] ?? 0;
      return summary.totalEvents > 0 ? eventCount / summary.totalEvents : 0;
    }
    case 'elementCount':
      return summary.elementCountsByType[signal.elementType ?? String(signal.value)] ?? 0;
    case 'toolDiversity':
      return summary.toolDiversity;
    case 'textToShapeRatio':
      return summary.textToShapeRatio;
    case 'timeToFirstEventMs':
      return summary.timeToFirstEventMs;
    case 'timeSinceLastEventMs':
      return summary.timeSinceLastEventMs;
    default:
      return undefined;
  }
}

function normalize(rawScores: Record<string, number>): Record<string, number> {
  const entries = Object.entries(rawScores);
  const total = entries.reduce((sum, [, score]) => sum + score, 0);

  if (entries.length === 0) return {};
  if (total <= 0) {
    const uniform = 1 / entries.length;
    return Object.fromEntries(entries.map(([id]) => [id, uniform]));
  }

  return Object.fromEntries(entries.map(([id, score]) => [id, score / total]));
}
