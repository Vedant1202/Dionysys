export function getTopScore(scores?: Record<string, number>) {
  const entries = Object.entries(scores ?? {});
  if (entries.length === 0) return undefined;
  const [id, score] = entries.sort((left, right) => right[1] - left[1])[0];
  return { id, score };
}

export function toPositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function toBoundedNumber(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatMs(value?: number): string {
  return value === undefined ? 'n/a' : `${Math.round(value)} ms`;
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([formatJson(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
