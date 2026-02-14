/**
 * Tests for renderTUI entry point
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { TUIApp } from '@/ui/tui/ink/TUIApp';
import type { IACPMessageBus, ACPMessage, ACPMessageType, ACPHandler } from '@/core/protocols';

function createMockBus(): IACPMessageBus {
  const handlers = new Map<string, ACPHandler[]>();
  return {
    publish: jest.fn(async (msg: ACPMessage) => {
      const list = handlers.get(msg.type) || [];
      for (const h of list) await h(msg);
    }),
    on: jest.fn((type: ACPMessageType, handler: ACPHandler) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
      return {
        unsubscribe: () => {
          const list = handlers.get(type)!;
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        },
      };
    }),
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    request: jest.fn(),
    subscriptionCount: jest.fn(() => 0),
    clear: jest.fn(),
  };
}

describe('TUIApp integration', () => {
  it('should render all panels', () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TUIApp, { messageBus: bus }));
    const frame = lastFrame()!;

    expect(frame).toContain('=== Agent Status ===');
    expect(frame).toContain('=== Task Progress ===');
    expect(frame).toContain('=== Cost Summary ===');
    expect(frame).toContain('=== Logs ===');
  });

  it('should subscribe to all required message types', () => {
    const bus = createMockBus();
    render(React.createElement(TUIApp, { messageBus: bus }));

    const onCalls = (bus.on as jest.Mock).mock.calls;
    const subscribedTypes = onCalls.map((call: unknown[]) => call[0]);

    expect(subscribedTypes).toContain('agent:status');
    expect(subscribedTypes).toContain('task:status');
    // agent:event is used by both useCostSummary and useLogStream
    expect(subscribedTypes.filter((t: string) => t === 'agent:event')).toHaveLength(2);
  });

  it('should unmount cleanly', () => {
    const bus = createMockBus();
    const { unmount } = render(React.createElement(TUIApp, { messageBus: bus }));
    expect(() => unmount()).not.toThrow();
  });
});
