import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'index',
    'usage',
    'configuration',
    'architecture',
    'openapi',
    'admin-console',
    'excalidraw-configuration',
    'feedback-loop',
    {
      type: 'category',
      label: 'Specs',
      items: [
        'sdk-upgrade-spec',
        'sdk-upgrade-plan',
        'phase-2-server-sdk-spec',
        'phase-2-server-sdk-plan',
        'phase-3-storage-connectors-spec',
        'phase-3-storage-connectors-plan',
        'phase-4-client-demo-plan',
        'phase-5-release-hardening-plan',
        'phase-6-monorepo-cleanup-demo-extraction-spec',
        'phase-6-monorepo-cleanup-demo-extraction-plan',
        'phase-7-spec',
        'phase-7-plan',
      ],
    },
  ],
};

export default sidebars;
