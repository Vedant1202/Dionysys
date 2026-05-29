import type { AdaptiveMode } from '@dionysys/core';

export interface AppliedDecisionPayload {
  mode: AdaptiveMode;
  variant: string;
  personalityId?: string;
  actionId?: string;
  confidence?: number;
  decisionKey: string;
  appliedAt: number;
}

export function createAppliedDecision(input: {
  mode: AdaptiveMode;
  variant: string;
  personalityId?: string | undefined;
  actionId?: string | undefined;
  confidence?: number | undefined;
  appliedAt?: number | undefined;
}): AppliedDecisionPayload {
  return compactDecision({
    mode: input.mode,
    variant: input.variant,
    personalityId: input.personalityId,
    actionId: input.actionId,
    confidence: input.confidence,
    decisionKey: buildDecisionKey(input.mode, input.variant, input.personalityId, input.actionId),
    appliedAt: input.appliedAt ?? Date.now(),
  });
}

export function getFeedbackStorageKey(sessionId: string, decisionKey: string): string {
  return `dionysys:adaptive-feedback:${sessionId}:${decisionKey}`;
}

function buildDecisionKey(
  mode: AdaptiveMode,
  variant: string,
  personalityId: string | undefined,
  actionId: string | undefined,
): string {
  return [mode, variant, personalityId ?? '', actionId ?? ''].join('::');
}

function compactDecision(decision: AppliedDecisionPayload): AppliedDecisionPayload {
  return Object.fromEntries(Object.entries(decision).filter(([, value]) => value !== undefined)) as AppliedDecisionPayload;
}
