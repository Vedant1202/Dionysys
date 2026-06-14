import { AdminConsole } from '@dionysys/react';
import type { DionysysClient } from '@dionysys/client';
import type { AdaptivePersistenceMode, AdminConsoleConfig } from '@dionysys/core';

type AdminConsoleRouteProps = {
  client: DionysysClient;
  sessionId: string;
  persistenceMode: AdaptivePersistenceMode;
  canRandomizeSession: boolean;
  onRandomizeSession: () => void | Promise<void>;
  onClose: () => void;
  onConfigSaved: (config: AdminConsoleConfig) => void;
  defaultTab?: 'overview' | 'explorer';
};

export default function AdminConsoleRoute(props: AdminConsoleRouteProps) {
  return <AdminConsole {...props} />;
}
