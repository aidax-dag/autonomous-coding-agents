/**
 * Jest mock for ink-testing-library
 * Uses React's built-in createElement with a lightweight renderer
 * that properly handles hooks (useState, useEffect).
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

interface RenderResult {
  lastFrame: () => string;
  frames: string[];
  unmount: () => void;
  rerender: (element: React.ReactElement) => void;
}

function extractTextFromTree(node: ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractTextFromTree).join('\n');

  const children = node.children;
  if (!children) return '';

  const parts: string[] = [];
  for (const child of children) {
    if (typeof child === 'string') {
      parts.push(child);
    } else {
      parts.push(extractTextFromTree(child));
    }
  }
  return parts.join('\n');
}

export function render(element: React.ReactElement): RenderResult {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });

  return {
    lastFrame: () => {
      const tree = renderer!.toJSON();
      return extractTextFromTree(tree);
    },
    frames: [],
    unmount: () => {
      ReactTestRenderer.act(() => {
        renderer!.unmount();
      });
    },
    rerender: (el: React.ReactElement) => {
      ReactTestRenderer.act(() => {
        renderer!.update(el);
      });
    },
  };
}

export async function act(fn: () => void | Promise<void>): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await fn();
  });
}
