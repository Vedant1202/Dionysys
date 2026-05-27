import type { AdminSessionOverview } from '@dionysys/core';
import { DashboardCard, EmptyDashboardState, ScoreBar, humanizeMetricId } from './DashboardPrimitives.js';

export function PersonaConfidencePanel({ session }: { session?: AdminSessionOverview | undefined }) {
  const modalityScores = session?.mcpScoreResult.modalityScores ?? session?.deterministicPersonaScores;
  const expertiseScores = session?.mcpScoreResult.expertiseScores;
  const matchedSignals = session?.mcpScoreResult.axisMatchedSignals;

  return (
    <DashboardCard
      title="Persona Confidence"
      help={{
        label: 'Persona confidence',
        description: 'Normalized scores that show which persona currently has the strongest evidence.',
        example: 'A text_first score of 72% means text-first has the strongest current modality evidence.',
      }}
    >
      {!modalityScores && !expertiseScores ? (
        <EmptyDashboardState>No persona scores available yet.</EmptyDashboardState>
      ) : (
        <div className="dionysys-scoreBarList">
          {modalityScores && (
            <ScoreGroup
              title="Modality"
              scores={modalityScores}
              matchedSignals={matchedSignals?.modality}
            />
          )}
          {expertiseScores && (
            <ScoreGroup
              title="Expertise"
              scores={expertiseScores}
              matchedSignals={matchedSignals?.expertise}
            />
          )}
        </div>
      )}
    </DashboardCard>
  );
}

function ScoreGroup({
  title,
  scores,
  matchedSignals,
}: {
  title: string;
  scores: Record<string, number>;
  matchedSignals?: Record<string, string[]> | undefined;
}) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="dionysys-scoreGroup">
      <h3>{title}</h3>
      {entries.map(([persona, score]) => {
        const signals = matchedSignals?.[persona] ?? [];
        return (
          <ScoreBar
            key={`${title}-${persona}`}
            label={humanizeMetricId(persona)}
            value={score}
            help={{
              label: `${humanizeMetricId(persona)} score`,
              description: signals.length > 0
                ? `Matched signals: ${signals.join(', ')}.`
                : 'This score comes from the active scoring rules and current interaction summary.',
              example: persona.includes('text')
                ? 'Repeated text_added events increase the text-first score.'
                : 'More matching events or heuristics increase this score.',
            }}
          />
        );
      })}
    </div>
  );
}
