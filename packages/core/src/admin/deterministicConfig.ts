import { InferenceEngine, type EventWeightResolver, type GenericEvent } from '../inference/index.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';
import type {
  AdminConsoleConfig,
  AdminDeterministicConfig,
  AdminHeuristicRule,
  AdminNumericOperator,
  AdminPayloadCondition,
} from './types.js';

export function inferPersonaFromAdminConfig(
  config: AdminDeterministicConfig,
  events: GenericEvent[],
): Record<string, number> {
  const engine = new InferenceEngine({
    personas: config.personas,
    initialCounts: config.initialCounts,
    eventWeights: buildEventWeights(config),
    heuristics: buildHeuristics(config),
  });

  return engine.inferPersona(events);
}

export function selectVariantFromAdminConfig(
  config: AdminConsoleConfig,
  personaScores: Record<string, number>,
): { chosenVariant: string; propensity: number } {
  return new PolicyEngine({
    personas: config.deterministic.personas,
    epsilon: config.deterministic.policy.epsilon,
    variantMapping: config.deterministic.policy.variantMapping,
  }).selectVariant(personaScores);
}

function buildEventWeights(config: AdminDeterministicConfig): Record<string, EventWeightResolver> {
  const grouped = new Map<string, typeof config.eventRules>();
  for (const rule of config.eventRules.filter((item) => item.enabled !== false)) {
    grouped.set(rule.eventType, [...(grouped.get(rule.eventType) ?? []), rule]);
  }

  return Object.fromEntries([...grouped.entries()].map(([eventType, rules]) => [
    eventType,
    (payload: unknown) => rules.reduce<Record<string, number>>((weights, rule) => {
      if (!matchesConditions(payload, rule.conditions ?? [])) return weights;
      return addWeights(weights, rule.weights);
    }, {}),
  ]));
}

function buildHeuristics(config: AdminDeterministicConfig) {
  return config.heuristics
    .filter((rule) => rule.enabled !== false)
    .map((rule) => (events: GenericEvent[]) => (
      matchesHeuristic(rule, events) ? rule.weights : {}
    ));
}

function matchesConditions(payload: unknown, conditions: AdminPayloadCondition[]): boolean {
  if (conditions.length === 0) return true;
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};

  return conditions.every((condition) => {
    const actual = readPath(record, condition.field);
    switch (condition.operator) {
      case 'exists':
        return actual !== undefined;
      case 'notExists':
        return actual === undefined;
      case '==':
        return actual === condition.value;
      case '!=':
        return actual !== condition.value;
      case 'contains':
        return typeof actual === 'string' && typeof condition.value === 'string'
          ? actual.includes(condition.value)
          : Array.isArray(actual) && actual.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actual as never);
      default:
        return false;
    }
  });
}

function matchesHeuristic(rule: AdminHeuristicRule, events: GenericEvent[]): boolean {
  const actual = rule.metric === 'totalEvents'
    ? events.length
    : events.filter((event) => event.eventType === rule.eventType).length;

  return compare(actual, rule.operator, rule.value);
}

function compare(actual: number, operator: AdminNumericOperator, expected: number): boolean {
  switch (operator) {
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    default:
      return false;
  }
}

function addWeights(target: Record<string, number>, weights: Record<string, number>): Record<string, number> {
  for (const [persona, weight] of Object.entries(weights)) {
    target[persona] = (target[persona] ?? 0) + weight;
  }
  return target;
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[segment]
      : undefined
  ), record);
}
