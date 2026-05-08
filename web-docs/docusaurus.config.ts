import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const docsSiteUrl = process.env.DOCS_SITE_URL?.trim() || 'https://vedant1202.github.io';
const docsBaseUrl = process.env.DOCS_BASE_URL?.trim() || '/Dionysys/';

const config: Config = {
  title: 'Dionysys',
  tagline: 'Adaptive UI experimentation for deterministic and MCP-driven modes',
  favicon: 'img/logo.svg',

  url: docsSiteUrl,
  baseUrl: docsBaseUrl,

  organizationName: 'Vedant1202',
  projectName: 'Dionysys',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: ({docPath}) =>
            `https://github.com/Vedant1202/Dionysys/edit/main/docs/${docPath}`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Dionysys',
      logo: {
        alt: 'Dionysys logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/usage',
          label: 'Package Usage',
          position: 'left',
        },
        {
          to: '/docs/excalidraw-configuration',
          label: 'Excalidraw Config',
          position: 'left',
        },
        {
          to: '/docs/specs/mcp-mode',
          label: 'MCP Mode',
          position: 'left',
        },
        {
          href: 'https://github.com/Vedant1202/Dionysys',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Start Here',
              to: '/docs/',
            },
            {
              label: 'Package Usage',
              to: '/docs/usage',
            },
            {
              label: 'Configuration',
              to: '/docs/configuration',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture',
            },
          ],
        },
        {
          title: 'Demo',
          items: [
            {
              label: 'Excalidraw Configuration',
              to: '/docs/excalidraw-configuration',
            },
            {
              label: 'MCP Mode Spec',
              to: '/docs/specs/mcp-mode',
            },
            {
              label: 'Repository',
              href: 'https://github.com/Vedant1202/Dionysys',
            },
          ],
        },
        {
          title: 'Links',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/Vedant1202/Dionysys',
            },
            {
              label: 'Issues',
              href: 'https://github.com/Vedant1202/Dionysys/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Dionysys. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
