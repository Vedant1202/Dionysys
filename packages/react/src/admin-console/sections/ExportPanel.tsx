import { SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';

export function ExportPanel({
  jsonDraft,
  setJsonDraft,
  applyJsonDraft,
  exportConfig,
}: {
  jsonDraft: string;
  setJsonDraft: (draft: string) => void;
  applyJsonDraft: () => void;
  exportConfig: () => void;
}) {
  return (
    <SectionCard title="Full Configuration JSON">
      <p style={styles.helpText}>
        This editor exposes every runtime field. Apply updates locally, save runtime config to activate, or export JSON for future use.
      </p>
      <textarea
        style={styles.jsonTextarea}
        value={jsonDraft}
        onChange={(event) => setJsonDraft(event.target.value)}
        spellCheck={false}
      />
      <div style={styles.rowActions}>
        <button type="button" style={styles.secondaryButton} onClick={applyJsonDraft}>
          Apply JSON locally
        </button>
        <button type="button" style={styles.primaryButton} onClick={exportConfig}>
          Export JSON
        </button>
      </div>
    </SectionCard>
  );
}
