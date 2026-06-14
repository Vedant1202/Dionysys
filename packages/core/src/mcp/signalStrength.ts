import { countModalityEvents } from './personaAxes.js';

/**
 * Minimal structural shape of the gate thresholds. Kept local to `mcp` so this
 * module does not depend on `admin` (which already depends on `mcp`). The admin
 * `AdminMcpGateConfig` is structurally compatible and can be passed directly.
 */
export interface GateThresholds {
  lockMinEvents: number;
  lockMargin: number;
}

export type SignalStrength = 'strong' | 'weak';

/** Total draw + text events, the volume measure used by the gate. */
export function countModalityEventTotal(events: Array<{ eventType: string }>): number {
  const { drawCount, textCount } = countModalityEvents(events);
  return drawCount + textCount;
}

/**
 * Normalized gap between the top two scores (top1 - top2) / sum. Returns a value
 * in 0..1: 0 for a tie, empty, or non-positive totals; 1 for a single dominant score.
 */
export function scoreMargin(scores: Record<string, number>): number {
  const values = Object.values(scores).filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;

  const sorted = [...values].sort((left, right) => right - left);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  return (top - second) / total;
}

/**
 * The deterministic signal is STRONG when there are enough modality events and a
 * clear winner: `modalityEventCount >= lockMinEvents && scoreMargin >= lockMargin`.
 */
export function isStrongSignal(
  scores: Record<string, number>,
  modalityEventCount: number,
  gate: GateThresholds,
): boolean {
  return modalityEventCount >= gate.lockMinEvents && scoreMargin(scores) >= gate.lockMargin;
}

export function classifySignal(
  scores: Record<string, number>,
  modalityEventCount: number,
  gate: GateThresholds,
): SignalStrength {
  return isStrongSignal(scores, modalityEventCount, gate) ? 'strong' : 'weak';
}
