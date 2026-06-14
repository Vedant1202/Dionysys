export {
  clearStoredAppliedDecision,
  clearStoredExcalidrawScene,
  clearStoredPendingDecision,
  loadStoredExcalidrawScene,
  saveStoredExcalidrawScene,
} from '../core/session';

const BROWSER_ID_KEY = 'dionysys_browser_id';

export function getOrCreateBrowserId(): string {
  const existing = localStorage.getItem(BROWSER_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(BROWSER_ID_KEY, id);
  return id;
}
