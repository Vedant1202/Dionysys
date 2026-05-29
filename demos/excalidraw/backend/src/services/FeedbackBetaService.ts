export const BETA_FEEDBACK_EVENT_TYPES = new Set([
  'adaptive_decision_applied',
  'element_modified',
  'text_updated',
  'element_deleted',
  'tool_selected',
]);

export function isAdaptiveFeedbackBetaEnabled(): boolean {
  return process.env.ADAPTIVE_FEEDBACK_BETA_ENABLED === 'true';
}

export function isBetaFeedbackEventType(eventType: string): boolean {
  return BETA_FEEDBACK_EVENT_TYPES.has(eventType);
}
