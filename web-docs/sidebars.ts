import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'index',
    'usage',
    'configuration',
    'excalidraw-configuration',
    'architecture',
    {
      type: 'category',
      label: 'Specs',
      items: ['specs/mcp-mode'],
    },
  ],
};

export default sidebars;
