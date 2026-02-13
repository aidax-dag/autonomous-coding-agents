/**
 * Keyboard Shortcut Registry
 *
 * Manages keyboard shortcuts with conflict detection and category organization.
 *
 * @module core/shortcuts
 */

import type {
  IShortcutRegistry,
  ShortcutDefinition,
  KeyBinding,
  KeyboardEventLike,
} from './interfaces/shortcut.interface';

function bindingKey(b: KeyBinding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push('ctrl');
  if (b.alt) parts.push('alt');
  if (b.shift) parts.push('shift');
  if (b.meta) parts.push('meta');
  parts.push(b.key.toLowerCase());
  return parts.join('+');
}

export class ShortcutRegistry implements IShortcutRegistry {
  private readonly shortcuts = new Map<string, ShortcutDefinition>();
  private readonly bindingIndex = new Map<string, string>();

  register(shortcut: ShortcutDefinition): void {
    const key = bindingKey(shortcut.binding);
    const existing = this.bindingIndex.get(key);
    if (existing && existing !== shortcut.id) {
      throw new Error(
        `Shortcut binding conflict: "${key}" already bound to "${existing}"`,
      );
    }
    this.shortcuts.set(shortcut.id, { enabled: true, ...shortcut });
    this.bindingIndex.set(key, shortcut.id);
  }

  unregister(id: string): boolean {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return false;
    this.bindingIndex.delete(bindingKey(shortcut.binding));
    return this.shortcuts.delete(id);
  }

  get(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  getAll(): ShortcutDefinition[] {
    return [...this.shortcuts.values()];
  }

  getByCategory(category: string): ShortcutDefinition[] {
    return [...this.shortcuts.values()].filter((s) => s.category === category);
  }

  findByBinding(binding: KeyBinding): ShortcutDefinition | undefined {
    const id = this.bindingIndex.get(bindingKey(binding));
    return id ? this.shortcuts.get(id) : undefined;
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return false;
    shortcut.enabled = enabled;
    return true;
  }

  handleKeyEvent(event: KeyboardEventLike): boolean {
    const binding: KeyBinding = {
      key: event.key.toLowerCase(),
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };

    const shortcut = this.findByBinding(binding);
    if (shortcut && shortcut.enabled !== false) {
      shortcut.action();
      return true;
    }
    return false;
  }
}

export function createShortcutRegistry(): ShortcutRegistry {
  return new ShortcutRegistry();
}
