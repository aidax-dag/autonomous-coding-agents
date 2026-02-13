/**
 * Keyboard Shortcuts Interface Definitions
 * @module core/shortcuts
 */

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  binding: KeyBinding;
  action: () => void;
  category?: string;
  enabled?: boolean;
}

export interface IShortcutRegistry {
  register(shortcut: ShortcutDefinition): void;
  unregister(id: string): boolean;
  get(id: string): ShortcutDefinition | undefined;
  getAll(): ShortcutDefinition[];
  getByCategory(category: string): ShortcutDefinition[];
  findByBinding(binding: KeyBinding): ShortcutDefinition | undefined;
  setEnabled(id: string, enabled: boolean): boolean;
  handleKeyEvent(event: KeyboardEventLike): boolean;
}

export interface KeyboardEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  if (binding.meta) parts.push('Cmd');
  parts.push(binding.key.toUpperCase());
  return parts.join('+');
}
