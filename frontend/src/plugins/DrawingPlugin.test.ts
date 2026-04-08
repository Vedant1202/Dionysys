import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingPlugin } from '../plugins/DrawingPlugin';

describe('DrawingPlugin', () => {
  let plugin: DrawingPlugin;
  let emitted: any[];

  beforeEach(() => {
    emitted = [];
    plugin = new DrawingPlugin();
    plugin.init((event) => emitted.push(event));
  });

  it('has the correct id', () => {
    expect(plugin.id).toBe('drawing_plugin');
  });

  it('emits element_drawn when a new non-text element appears', () => {
    const elements = [{ id: 'el-1', type: 'rectangle', text: undefined }];
    plugin.onChange(elements, {}, {});
    expect(emitted).toHaveLength(1);
    expect(emitted[0].eventType).toBe('element_drawn');
    expect(emitted[0].payload.type).toBe('rectangle');
  });

  it('emits text_added when a text element appears', () => {
    const elements = [{ id: 'el-2', type: 'text', text: 'hello' }];
    plugin.onChange(elements, {}, {});
    expect(emitted).toHaveLength(1);
    expect(emitted[0].eventType).toBe('text_added');
  });

  it('does NOT re-emit an already-seen element on subsequent onChange calls', () => {
    const elements = [{ id: 'el-3', type: 'ellipse' }];
    plugin.onChange(elements, {}, {}); // First call — new
    plugin.onChange(elements, {}, {}); // Second call — already seen
    expect(emitted).toHaveLength(1);
  });

  it('emits separate events for multiple new elements in one onChange', () => {
    const elements = [
      { id: 'el-4', type: 'rectangle' },
      { id: 'el-5', type: 'line' },
    ];
    plugin.onChange(elements, {}, {});
    expect(emitted).toHaveLength(2);
  });

  it('destroy clears known element IDs so elements are treated as new again', () => {
    const elements = [{ id: 'el-6', type: 'diamond' }];
    plugin.onChange(elements, {}, {});    // Seen once
    plugin.destroy();                      // Reset state
    plugin.init((event) => emitted.push(event));
    plugin.onChange(elements, {}, {});    // Should emit again
    expect(emitted).toHaveLength(2);
  });

  it('includes a timestamp on every emitted event', () => {
    const elements = [{ id: 'el-7', type: 'freedraw' }];
    plugin.onChange(elements, {}, {});
    expect(typeof emitted[0].timestamp).toBe('number');
  });
});
