import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DionysysClient } from '@dionysys/client';
import { createLegacyAdminApi } from '../../internal/legacyApi.js';
import { ComparisonRows, EmptyState, MetricCard, SectionCard } from '../primitives.js';
import { adminConsoleStyles as styles } from '../styles.js';
import { downloadJson } from '../utils.js';

// ─── Types (mirrors the server's AdminConfigService BanditOverview) ───────────

export interface BanditArmView {
  stateId: string;
  variant: string;
  alpha: number;
  beta: number;
  observations: number;
  posteriorMean: number;
  credibleInterval: { lower: number; upper: number; level: number };
  evidenceWeight: number;
  probabilityBest: number;
  lastUpdated: number | string;
}

export interface BanditContextView {
  stateId: string;
  arms: BanditArmView[];
  wouldPick: string;
}

export interface BanditDecisionTrace {
  variant: string;
  stateId?: string;
  signalStrength?: string;
  resolvedBy?: string;
  llmModality?: string;
  llmConfidence?: number;
  chosenModality?: string;
  banditWeight?: number;
}

export interface BanditOverview {
  contexts: BanditContextView[];
  totalArms: number;
  decay: { enabled: boolean; effectiveWindow: number; gamma: number };
  trace?: BanditDecisionTrace;
}

export interface BanditSnapshot {
  exportedAt: string;
  arms: Array<{ stateId: string; variant: string; alpha: number; beta: number; lastUpdated: number | string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (value: number) => `${Math.round(value * 100)}%`;
const fixed = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '—';

// ─── Arm row ──────────────────────────────────────────────────────────────────

function ArmRow({ arm, isPick }: { arm: BanditArmView; isPick: boolean }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        marginBottom: 6,
        borderRadius: 8,
        border: isPick ? '1px solid rgba(16,185,129,0.7)' : '1px solid rgba(148,163,184,0.35)',
        background: isPick ? 'rgba(209,250,229,0.35)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong style={{ fontSize: 12 }}>
          {arm.variant}
          {isPick && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#065f46' }}>● would pick</span>}
        </strong>
        <span style={{ fontSize: 11, color: '#475569' }}>P(best) {pct(arm.probabilityBest)}</span>
      </div>
      <ComparisonRows
        rows={[
          ['Posterior mean', fixed(arm.posteriorMean)],
          [`${Math.round(arm.credibleInterval.level * 100)}% credible interval`, `[${fixed(arm.credibleInterval.lower)}, ${fixed(arm.credibleInterval.upper)}]`],
          ['Observations (n)', String(arm.observations)],
          ['Evidence weight', fixed(arm.evidenceWeight, 2)],
          ['α / β', `${fixed(arm.alpha, 1)} / ${fixed(arm.beta, 1)}`],
        ]}
      />
    </div>
  );
}

// ─── Decision trace ─────────────────────────────────────────────────────────────

function TraceCard({ trace }: { trace: BanditDecisionTrace }) {
  return (
    <SectionCard title="Latest decision trace">
      <ComparisonRows
        rows={[
          ['Context (stateId)', trace.stateId ?? '—'],
          ['Signal strength', trace.signalStrength ?? '—'],
          ['Resolved by', trace.resolvedBy ?? '—'],
          ['LLM pick', trace.llmModality ? `${trace.llmModality}${trace.llmConfidence !== undefined ? ` (${pct(trace.llmConfidence)})` : ''}` : '—'],
          ['Bandit-chosen modality', trace.chosenModality ?? '—'],
          ['Bandit weight', trace.banditWeight !== undefined ? fixed(trace.banditWeight, 2) : '—'],
          ['Applied variant', trace.variant],
        ]}
      />
    </SectionCard>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────────

export function BanditPanel({
  client,
  apiBaseUrl,
  sessionId,
}: {
  client?: Pick<DionysysClient, 'admin'>;
  apiBaseUrl?: string;
  sessionId?: string;
}) {
  const legacyAdminApi = useMemo(() => createLegacyAdminApi(apiBaseUrl), [apiBaseUrl]);
  const [overview, setOverview] = useState<BanditOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      const data = client
        ? await client.admin.getBandit(sessionId)
        : await legacyAdminApi.getBandit(sessionId);
      setOverview(data as unknown as BanditOverview);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load bandit state.');
    }
  }, [client, legacyAdminApi, sessionId]);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (action: () => Promise<string>) => {
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      setNotice(await action());
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }, [load]);

  const resetAll = () => run(async () => {
    const n = client ? await client.admin.resetBandit({}) : await legacyAdminApi.resetBandit({});
    return `Reset ${n} arm(s) to their priors.`;
  });

  const decayNow = () => run(async () => {
    const n = client ? await client.admin.decayBandit() : await legacyAdminApi.decayBandit();
    return `Decayed ${n} arm(s) toward their priors.`;
  });

  const exportSnapshot = () => run(async () => {
    const snap = client ? await client.admin.exportBandit() : await legacyAdminApi.exportBandit();
    downloadJson(`dionysys-bandit-${Date.now()}.json`, snap);
    return `Exported ${snap.arms.length} arm(s) as JSON.`;
  });

  const importSnapshot = (file: File) => run(async () => {
    const text = await file.text();
    const parsed = JSON.parse(text) as BanditSnapshot;
    const arms = Array.isArray(parsed.arms) ? parsed.arms : [];
    const n = client ? await client.admin.importBandit({ arms }) : await legacyAdminApi.importBandit({ arms });
    return `Imported ${n} arm(s) from snapshot.`;
  });

  if (!overview) {
    return (
      <SectionCard title="Bandit Inspector">
        {error
          ? <div className={styles.inlineError}>{error}</div>
          : <EmptyState title="Loading bandit state" description="Reading learned arms from the backend." />}
      </SectionCard>
    );
  }

  const { decay } = overview;

  return (
    <div className={styles.stack}>
      {(notice || error) && (
        <div className={error ? styles.errorBanner : styles.noticeBanner}>{error ?? notice}</div>
      )}

      <div className={styles.panelGrid}>
        <MetricCard label="Learned arms" value={String(overview.totalArms)} detail="across all contexts" />
        <MetricCard label="Contexts" value={String(overview.contexts.length)} detail="modality × expertise states" />
        <MetricCard
          label="Decay"
          value={decay.enabled ? 'On' : 'Off'}
          detail={decay.enabled ? `eff. window ${decay.effectiveWindow} · γ ${fixed(decay.gamma)}` : 'arms never forget'}
        />
      </div>

      <SectionCard title="Maintenance">
        <p className={styles.helpText}>
          Discounted Thompson sampling pulls quiet arms back toward their priors so the bandit keeps exploring.
          Decay runs automatically on every reward; trigger it manually for a hard periodic pass.
        </p>
        <div className={styles.rowActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={busy}>Refresh</button>
          <button type="button" className={styles.secondaryButton} onClick={decayNow} disabled={busy}>Decay now</button>
          <button type="button" className={styles.secondaryButton} onClick={exportSnapshot} disabled={busy}>Export snapshot</button>
          <label className={styles.secondaryButton} style={{ cursor: 'pointer' }}>
            Import snapshot
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSnapshot(file);
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" className={styles.dangerButton} onClick={resetAll} disabled={busy}>Reset all to priors</button>
        </div>
      </SectionCard>

      {overview.trace && <TraceCard trace={overview.trace} />}

      {overview.contexts.length === 0 ? (
        <SectionCard title="Arms by context">
          <EmptyState
            title="No arms learned yet"
            description="As weak-signal sessions get rewarded, Thompson-sampling arms appear here grouped by context."
          />
        </SectionCard>
      ) : (
        overview.contexts.map((context) => (
          <SectionCard key={context.stateId} title={`Context · ${context.stateId}`}>
            <p className={styles.helpText}>
              P(best) is a Monte-Carlo estimate over each arm&apos;s Beta posterior — it replaces argmax-of-means as the “would pick” signal.
            </p>
            {context.arms.map((arm) => (
              <ArmRow key={arm.variant} arm={arm} isPick={arm.variant === context.wouldPick} />
            ))}
          </SectionCard>
        ))
      )}
    </div>
  );
}
