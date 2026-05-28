import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicToolbar } from './DynamicToolbar';

vi.mock('@dionysys/react', () => ({
  useAdaptiveUI: () => ({
    currentVariant: 'draw_first',
    currentUIState: undefined,
    mode: 'deterministic',
  }),
}));

describe('DynamicToolbar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows numbered hotkey badges for the visible personalized tools', () => {
    const view = render(
      <DynamicToolbar
        excalidrawAPI={null}
        config={{
          showWelcomeScreen: false,
          toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'diamond'] },
          canvasActions: {},
          mainMenuItems: [],
        }}
      />,
    );

    expect(view.getByRole('button', { name: 'Selection — V or 1' })).toHaveAttribute('aria-keyshortcuts', '1');
    expect(view.getByRole('button', { name: 'Rectangle — R or 2' })).toHaveAttribute('aria-keyshortcuts', '2');
    expect(view.getByRole('button', { name: 'Diamond — D or 3' })).toHaveAttribute('aria-keyshortcuts', '3');
    expect(document.querySelector('[data-hotkey-badge="1"]')).toBeTruthy();
    expect(document.querySelector('[data-hotkey-badge="2"]')).toBeTruthy();
    expect(document.querySelector('[data-hotkey-badge="3"]')).toBeTruthy();
  });

  it('switches tools with number shortcuts and updates the Excalidraw app state', () => {
    const updateScene = vi.fn();

    render(
      <DynamicToolbar
        excalidrawAPI={{ updateScene }}
        config={{
          showWelcomeScreen: false,
          toolbar: { mode: 'allowlist', tools: ['selection', 'rectangle', 'diamond'] },
          canvasActions: {},
          mainMenuItems: [],
        }}
      />,
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));

    expect(updateScene).toHaveBeenCalledWith({
      appState: {
        activeTool: { type: 'rectangle', customType: null },
      },
    });
  });
});
