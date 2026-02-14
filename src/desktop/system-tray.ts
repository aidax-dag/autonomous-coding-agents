/**
 * System Tray
 * System tray integration with icon, tooltip, and context menu management.
 *
 * @module desktop
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '@/shared/logging/logger';
import type { TrayConfig, TrayMenuItem } from './types';

const logger = createAgentLogger('Desktop', 'system-tray');

export class SystemTray extends EventEmitter {
  private config: TrayConfig;
  private visible = false;
  private disposed = false;

  constructor(config: Partial<TrayConfig> = {}) {
    super();
    this.config = {
      icon: config.icon || 'default-icon',
      tooltip: config.tooltip || 'ACA Desktop',
      menuItems: config.menuItems || this.getDefaultMenuItems(),
    };
  }

  /** Show the tray icon. */
  show(): void {
    if (this.disposed) throw new Error('SystemTray is disposed');
    this.visible = true;
    this.emit('tray:show');
    logger.info('System tray shown');
  }

  /** Hide the tray icon. */
  hide(): void {
    this.visible = false;
    this.emit('tray:hide');
  }

  /** Check if the tray icon is visible. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Update the tooltip text. */
  setTooltip(tooltip: string): void {
    this.config.tooltip = tooltip;
    this.emit('tray:tooltip-changed', tooltip);
  }

  /** Get the current tooltip text. */
  getTooltip(): string {
    return this.config.tooltip;
  }

  /** Update the tray icon. */
  setIcon(icon: string): void {
    this.config.icon = icon;
    this.emit('tray:icon-changed', icon);
  }

  /** Replace all menu items. */
  setMenuItems(items: TrayMenuItem[]): void {
    this.config.menuItems = items;
    this.emit('tray:menu-updated', items);
  }

  /** Get a copy of the current menu items. */
  getMenuItems(): TrayMenuItem[] {
    return [...this.config.menuItems];
  }

  /** Add a menu item to the end of the list. */
  addMenuItem(item: TrayMenuItem): void {
    this.config.menuItems.push(item);
    this.emit('tray:menu-updated', this.config.menuItems);
  }

  /** Remove a menu item by id. Returns true if found and removed. */
  removeMenuItem(id: string): boolean {
    const index = this.config.menuItems.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.config.menuItems.splice(index, 1);
    this.emit('tray:menu-updated', this.config.menuItems);
    return true;
  }

  /** Simulate a tray icon click (for testing). */
  simulateClick(): void {
    this.emit('tray:click');
  }

  /** Simulate a menu item click (for testing). */
  simulateMenuClick(itemId: string): void {
    const item = this.config.menuItems.find((i) => i.id === itemId);
    if (item && item.enabled) {
      this.emit('tray:menu-click', { id: itemId, action: item.action });
    }
  }

  /** Get a copy of the tray configuration. */
  getConfig(): TrayConfig {
    return { ...this.config, menuItems: [...this.config.menuItems] };
  }

  private getDefaultMenuItems(): TrayMenuItem[] {
    return [
      {
        id: 'show',
        label: 'Show Window',
        enabled: true,
        action: 'show-window',
      },
      { id: 'separator-1', label: '', enabled: true, separator: true },
      { id: 'status', label: 'Status: Idle', enabled: false },
      { id: 'separator-2', label: '', enabled: true, separator: true },
      {
        id: 'settings',
        label: 'Settings',
        enabled: true,
        action: 'open-settings',
      },
      { id: 'quit', label: 'Quit', enabled: true, action: 'quit' },
    ];
  }

  /** Dispose the tray, hiding it and clearing state. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.visible = false;
    this.config.menuItems = [];
    this.removeAllListeners();
  }
}

export function createSystemTray(config?: Partial<TrayConfig>): SystemTray {
  return new SystemTray(config);
}
