import type { AdminConsoleOverview, PersonalityResource } from '@dionysys/core';
import { EndpointTable, JsonBlock, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';

export function ApisPanel({
  overview,
  resources,
}: {
  overview?: AdminConsoleOverview;
  resources: PersonalityResource[];
}) {
  return (
    <div style={styles.stack}>
      <SectionCard title="Runtime API Surface">
        <EndpointTable endpoints={overview?.endpoints ?? []} />
      </SectionCard>
      <SectionCard title="MCP Resource Catalog">
        <JsonBlock value={resources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          actions: resource.actions.map((action) => action.id),
          signals: resource.scoring.signals.map((signal) => signal.id),
        }))} />
      </SectionCard>
    </div>
  );
}
