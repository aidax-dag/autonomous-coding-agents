/**
 * Ink render entry point.
 * Provides renderTUI() to mount the Ink-based TUI dashboard.
 * @module ui/tui/ink
 */

import React from 'react';
import { render } from 'ink';
import type { IACPMessageBus } from '@/core/protocols';
import { TUIApp } from './TUIApp';

export interface RenderTUIOptions {
  messageBus: IACPMessageBus;
}

export interface TUIInstance {
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
}

export function renderTUI(options: RenderTUIOptions): TUIInstance {
  const instance = render(
    React.createElement(TUIApp, { messageBus: options.messageBus }),
  );
  return {
    unmount: () => instance.unmount(),
    waitUntilExit: () => instance.waitUntilExit(),
  };
}
