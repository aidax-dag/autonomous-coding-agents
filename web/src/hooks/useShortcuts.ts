import { useEffect, useRef } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      for (const s of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = !!s.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!s.shift === e.shiftKey;
        const altMatch = !!s.alt === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

export function useNavigationShortcuts(navigate: (path: string) => void) {
  useShortcuts([
    { key: '1', alt: true, action: () => navigate('/'), description: 'Go to Dashboard' },
    { key: '2', alt: true, action: () => navigate('/agents'), description: 'Go to Agents' },
    { key: '3', alt: true, action: () => navigate('/workflows'), description: 'Go to Workflows' },
    { key: '4', alt: true, action: () => navigate('/logs'), description: 'Go to Logs' },
    { key: '5', alt: true, action: () => navigate('/settings'), description: 'Go to Settings' },
  ]);
}
