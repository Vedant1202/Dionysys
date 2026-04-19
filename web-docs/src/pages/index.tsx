import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const flowSteps = [
  {
    label: 'Interaction events',
    value: 'shape.drawn + text.added',
    tone: 'event',
  },
  {
    label: 'Persona evidence',
    value: 'draw_first 0.62',
    tone: 'score',
  },
  {
    label: 'Decision path',
    value: 'Policy or MCP action',
    tone: 'decision',
  },
  {
    label: 'UI state',
    value: 'toolbar.allowlist',
    tone: 'state',
  },
];

const docsLinks = [
  {
    title: 'Package Usage',
    description: 'Wire core inference, policy selection, MCP decisions, and React adaptive state.',
    to: '/docs/usage',
  },
  {
    title: 'Configuration',
    description: 'Tune deterministic inference, contextual bandits, and resource-driven MCP mode.',
    to: '/docs/configuration',
  },
  {
    title: 'Excalidraw Demo',
    description: 'Edit variants, MCP personalities, toolbar controls, menu items, and connector settings.',
    to: '/docs/excalidraw-configuration',
  },
];

function AdaptiveFlowScene() {
  const logoSrc = useBaseUrl('/img/logo.svg');

  return (
    <div className={styles.flowScene} aria-label="Adaptive UI decision flow">
      <img className={styles.flowLogo} src={logoSrc} alt="Dionysys" />
      <div className={styles.flowRail} aria-hidden="true" />
      {flowSteps.map((step, index) => (
        <div
          className={clsx(styles.flowStep, styles[step.tone])}
          key={step.label}
        >
          <span className={styles.flowIndex}>{String(index + 1).padStart(2, '0')}</span>
          <span className={styles.flowLabel}>{step.label}</span>
          <strong>{step.value}</strong>
        </div>
      ))}
      <div className={styles.scorePanel}>
        <span>personaScores</span>
        <code>{'{ guided_novice: 0.18, draw_first: 0.62 }'}</code>
      </div>
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={clsx('container', styles.heroContent)}>
        <p className={styles.eyebrow}>Dionysys documentation</p>
        <Heading as="h1" className={styles.heroTitle}>
          Adaptive UI docs for deterministic and MCP-driven experiments
        </Heading>
        <p className={styles.heroSubtitle}>
          Learn how the packages score behavior, lock variants, expose React state, and let MCP resources
          choose UI actions for the Excalidraw demo.
        </p>
        <div className={styles.actions}>
          <Link className={clsx('button button--lg', styles.primaryButton)} to="/docs/">
            Open Docs
          </Link>
          <Link className={clsx('button button--lg', styles.secondaryButton)} to="/docs/usage">
            Package Usage
          </Link>
        </div>
        <AdaptiveFlowScene />
      </div>
    </header>
  );
}

function ModeComparison() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Two decision modes</p>
          <Heading as="h2">Pick the adaptation path that fits the experiment.</Heading>
        </div>
        <div className={styles.modeGrid}>
          <article className={styles.modeItem}>
            <span className={styles.modeBadge}>Deterministic</span>
            <Heading as="h3">Inference and policy</Heading>
            <p>
              Convert telemetry into persona probabilities, then let the contextual bandit policy select
              the UI variant.
            </p>
          </article>
          <article className={styles.modeItem}>
            <span className={styles.modeBadge}>MCP</span>
            <Heading as="h3">Resources and actions</Heading>
            <p>
              Summarize interactions, calculate resource-driven persona scores, and resolve one exposed
              UI action through a provider-neutral connector.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function DocsPreview() {
  return (
    <section className={clsx(styles.section, styles.docsSection)}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Documentation map</p>
          <Heading as="h2">Everything needed to use and tune Dionysys.</Heading>
        </div>
        <div className={styles.docsGrid}>
          {docsLinks.map((item) => (
            <Link className={styles.docLink} to={item.to} key={item.title}>
              <Heading as="h3">{item.title}</Heading>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Docs | ${siteConfig.title}`}
      description="Documentation for Dionysys adaptive UI experimentation">
      <main>
        <HomepageHeader />
        <ModeComparison />
        <DocsPreview />
      </main>
    </Layout>
  );
}
