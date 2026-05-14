import { InferenceEngine, type EventWeightResolver, type GenericEvent } from '../inference/index.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';
import {
  EXPERTISE_PERSONAS,
  MODALITY_PERSONAS,
  buildLockedModalityScores,
  countModalityEvents,
  composeUiVariant,
  getTopScoredKey,
  type AxisSelectionSummary,
  type ExpertisePersona,
  type ModalityPersona,
} from '../mcp/index.js';
import type {
  AdminConsoleConfig,
  AdminDeterministicAxisConfig,
  AdminDeterministicConfig,
  AdminHeuristicRule,
  AdminNumericOperator,
  AdminPayloadCondition,
} from './types.js';

export function inferPersonaFromAdminConfig(
  config: AdminDeterministicConfig,
  events: GenericEvent[],
): Record<string, number> {
  return inferDeterministicAxesFromAdminConfig(config, events).personaScores;
}

export function inferDeterministicAxesFromAdminConfig(
  config: AdminDeterministicConfig,
  events: GenericEvent[],
): AxisSelectionSummary {
  const { drawCount, textCount } = countModalityEvents(events);
  const modalityScores = buildLockedModalityScores(drawCount, textCount);
  const expertiseScores = normalizeAxisScores(
    inferAxisScores(config.axes.expertise, events),
    EXPERTISE_PERSONAS,
  );

  const selectedModality = getTopScoredKey<ModalityPersona>(modalityScores, 'neutral');
  const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertiseScores, 'standard');

  return {
    modalityScores,
    expertiseScores,
    selectedModality,
    selectedExpertise,
    composedUiVariant: composeUiVariant(selectedModality, selectedExpertise),
    personaScores: modalityScores,
  };
}

export function selectVariantFromAdminConfig(
  config: AdminConsoleConfig,
  modalityScores: Record<string, number>,
  expertiseScores?: Record<string, number>,
): { chosenVariant: string; propensity: number; selectedModality: ModalityPersona; selectedExpertise: ExpertisePersona } {
  const modalityPolicy = new PolicyEngine({
    personas: config.deterministic.axes.modality.personas,
    epsilon: config.deterministic.policy.epsilon,
    variantMapping: config.deterministic.policy.variantMapping,
  }).selectVariant(modalityScores);

  const selectedModality = getTopScoredKey<ModalityPersona>(
    { ...modalityScores, [modalityPolicy.chosenVariant]: Number.MAX_SAFE_INTEGER },
    'neutral',
  );
  const selectedExpertise = getTopScoredKey<ExpertisePersona>(expertiseScores ?? {}, 'standard');

  return {
    chosenVariant: composeUiVariant(selectedModality, selectedExpertise),
    propensity: modalityPolicy.propensity,
    selectedModality,
    selectedExpertise,
  };
}

function inferAxisScores(
  config: AdminDeterministicAxisConfig,
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

function normalizeAxisScores<T extends readonly string[]>(
  scores: Record<string, number>,
  personas: T,
): Record<T[number], number> {
  return Object.fromEntries(personas.map((persona) => [persona, scores[persona] ?? 0])) as Record<T[number], number>;
}

function buildEventWeights(config: AdminDeterministicAxisConfig): Record<string, EventWeightResolver> {
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

function buildHeuristics(config: AdminDeterministicAxisConfig) {
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
