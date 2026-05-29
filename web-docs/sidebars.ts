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
      ],
    },
  ],
};

export default sidebars;
