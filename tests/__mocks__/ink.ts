/**
 * Jest mock for ink
 * Provides lightweight Box and Text components for testing.
 */

import React from 'react';

export function Box(props: { children?: React.ReactNode; [key: string]: unknown }) {
  return React.createElement('ink-box', null, props.children);
}

export function Text(props: {
  children?: React.ReactNode;
  bold?: boolean;
  dimColor?: boolean;
  color?: string;
  [key: string]: unknown;
}) {
  return React.createElement('ink-text', null, props.children);
}

export function render(element: React.ReactElement) {
  return {
    unmount: () => {},
    waitUntilExit: () => Promise.resolve(),
    rerender: () => {},
  };
}
