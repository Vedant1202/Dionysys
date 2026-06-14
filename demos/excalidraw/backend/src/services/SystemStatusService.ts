export interface SystemStatusFlags {
  adminConsoleEnabled: boolean;
  adaptiveFeedbackBetaEnabled: boolean;
}

export interface SystemStatusInput {
  dbReadyState: number;
  uptimeSeconds: number;
  flags: SystemStatusFlags;
  now?: Date;
}

export function buildSystemStatus(input: SystemStatusInput) {
  const timestamp = (input.now ?? new Date()).toISOString();
  const dbConnected = input.dbReadyState === 1;

  return {
    service: 'dionysys-backend',
    status: 'live',
    timestamp,
    uptimeSeconds: Math.floor(input.uptimeSeconds),
    db: {
      connected: dbConnected,
      readyState: input.dbReadyState,
      label: getMongooseReadyStateLabel(input.dbReadyState),
    },
    beta: {
      adaptiveFeedback: input.flags.adaptiveFeedbackBetaEnabled,
      adminConsole: input.flags.adminConsoleEnabled,
      live: input.flags.adaptiveFeedbackBetaEnabled || input.flags.adminConsoleEnabled,
    },
  };
}

export function buildPulseStatus(input: Pick<SystemStatusInput, 'flags' | 'now'>) {
  const timestamp = (input.now ?? new Date()).toISOString();

  return {
    signal: input.flags.adaptiveFeedbackBetaEnabled ? 'beta-spark' : 'steady',
    mood: 'operational',
    timestamp,
    betaLive: input.flags.adaptiveFeedbackBetaEnabled,
  };
}

function getMongooseReadyStateLabel(readyState: number): string {
  switch (readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}
