import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'index',
    'usage',
    'configuration',
    'admin-console',
    'excalidraw-configuration',
    'architecture',
    {
      type: 'category',
      label: 'Specs',
      items: ['specs/mcp-mode', 'specs/admin-console'],
    },
  ],
};

export default sidebars;
