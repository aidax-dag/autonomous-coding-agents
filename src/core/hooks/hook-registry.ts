/**
 * Hook Registry Implementation
 *
 * Manages hook registration, lookup, and execution order.
 *
 * @module core/hooks/hook-registry
 */

import {
  IHook,
  IHookRegistry,
  HookEvent,
} from '../interfaces/hook.interface';

/**
 * Hook Registry Implementation
 *
 * Provides centralized management of hooks with:
 * - Registration and unregistration
 * - Event-based lookup with priority sorting
 * - Enable/disable management
 */
export class HookRegistry implements IHookRegistry {
  private readonly hooks = new Map<string, IHook>();
  private readonly eventIndex = new Map<HookEvent, Set<string>>();

  /**
   * Register a hook
   *
   * @throws Error if hook with same name already exists
   */
  register(hook: IHook): void {
    if (this.hooks.has(hook.name)) {
      throw new Error(`Hook '${hook.name}' is already registered`);
    }

    this.hooks.set(hook.name, hook);
    this.addToIndex(hook);
  }

  /**
   * Unregister a hook by name
   *
   * @returns true if hook was unregistered, false if not found
   */
  unregister(name: string): boolean {
    const hook = this.hooks.get(name);
    if (!hook) {
      return false;
    }

    this.hooks.delete(name);
    this.removeFromIndex(hook);
    return true;
  }

  /**
   * Get a hook by name
   */
  get(name: string): IHook | undefined {
    return this.hooks.get(name);
  }

  /**
   * Get all hooks for an event (sorted by priority, descending)
   */
  getByEvent(event: HookEvent): IHook[] {
    const names = this.eventIndex.get(event);
    if (!names) {
      return [];
    }

    return Array.from(names)
      .map((name) => this.hooks.get(name))
      .filter((hook): hook is IHook => hook !== undefined)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all registered hooks
   */
  getAll(): IHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Check if a hook is registered
   */
  has(name: string): boolean {
    return this.hooks.has(name);
  }

  /**
   * Get count of registered hooks
   */
  count(): number {
    return this.hooks.size;
  }

  /**
   * Enable/disable a hook
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const hook = this.hooks.get(name);
    if (!hook) {
      return false;
    }

    if (enabled) {
      hook.enable();
    } else {
      hook.disable();
    }

    return true;
  }

  /**
   * Clear all registered hooks
   */
  clear(): void {
    this.hooks.clear();
    this.eventIndex.clear();
  }

  /**
   * Get enabled hooks for an event
   */
  getEnabledByEvent(event: HookEvent): IHook[] {
    return this.getByEvent(event).filter((hook) => hook.isEnabled());
  }

  /**
   * Get hooks by priority range
   */
  getByPriorityRange(minPriority: number, maxPriority: number): IHook[] {
    return this.getAll().filter(
      (hook) => hook.priority >= minPriority && hook.priority <= maxPriority
    );
  }

  /**
   * Get all registered event types
   */
  getRegisteredEvents(): HookEvent[] {
    return Array.from(this.eventIndex.keys());
  }

  /**
   * Add hook to event index
   */
  private addToIndex(hook: IHook): void {
    if (!this.eventIndex.has(hook.event)) {
      this.eventIndex.set(hook.event, new Set());
    }
    this.eventIndex.get(hook.event)!.add(hook.name);
  }

  /**
   * Remove hook from event index
   */
  private removeFromIndex(hook: IHook): void {
    const eventHooks = this.eventIndex.get(hook.event);
    if (eventHooks) {
      eventHooks.delete(hook.name);
      if (eventHooks.size === 0) {
        this.eventIndex.delete(hook.event);
      }
    }
  }
}
