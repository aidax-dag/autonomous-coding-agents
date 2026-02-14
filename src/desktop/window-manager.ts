/**
 * Window Manager
 * Window lifecycle management for the desktop application.
 * Handles creation, focus, resize, move, minimize, and maximize.
 *
 * @module desktop
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '@/shared/logging/logger';
import type { WindowState, DesktopConfig } from './types';
import { DEFAULT_CONFIG } from './types';

const logger = createAgentLogger('Desktop', 'window-manager');

export class WindowManager extends EventEmitter {
  private windows: Map<string, WindowState> = new Map();
  private config: DesktopConfig;
  private focusedWindowId: string | null = null;
  private windowCounter = 0;
  private disposed = false;

  constructor(config: Partial<DesktopConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Create a new window with optional overrides. */
  createWindow(options: Partial<WindowState> = {}): WindowState {
    if (this.disposed) throw new Error('WindowManager is disposed');

    this.windowCounter++;
    const id = options.id || `window-${this.windowCounter}`;

    if (this.windows.has(id)) {
      throw new Error(`Window '${id}' already exists`);
    }

    const window: WindowState = {
      id,
      title: options.title || this.config.title,
      width: options.width || this.config.width,
      height: options.height || this.config.height,
      x: options.x ?? 100,
      y: options.y ?? 100,
      focused: false,
      visible: !this.config.startMinimized,
      minimized: this.config.startMinimized,
      maximized: false,
      fullscreen: this.config.fullscreen,
    };

    this.windows.set(id, window);
    this.emit('window:created', window);
    logger.info('Window created', { id, title: window.title });

    // Auto-focus first window
    if (this.windows.size === 1) {
      this.focusWindow(id);
    }

    return window;
  }

  /** Close a window by id. Returns true if the window was closed. */
  closeWindow(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    this.windows.delete(id);
    if (this.focusedWindowId === id) {
      this.focusedWindowId = null;
      // Focus next available window
      const nextWindow = this.windows.keys().next();
      if (!nextWindow.done) {
        this.focusWindow(nextWindow.value);
      }
    }

    this.emit('window:closed', { id });
    logger.info('Window closed', { id });
    return true;
  }

  /** Focus a window by id. Returns true on success. */
  focusWindow(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    // Unfocus previous
    if (this.focusedWindowId && this.focusedWindowId !== id) {
      const prev = this.windows.get(this.focusedWindowId);
      if (prev) prev.focused = false;
    }

    window.focused = true;
    window.visible = true;
    window.minimized = false;
    this.focusedWindowId = id;

    this.emit('window:focused', { id });
    return true;
  }

  /** Minimize a window by id. Returns true on success. */
  minimizeWindow(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    window.minimized = true;
    window.focused = false;
    if (this.focusedWindowId === id) this.focusedWindowId = null;

    this.emit('window:minimized', { id });
    return true;
  }

  /** Toggle maximize on a window by id. Returns true on success. */
  maximizeWindow(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    window.maximized = !window.maximized;
    this.emit('window:maximized', { id, maximized: window.maximized });
    return true;
  }

  /** Resize a window, enforcing minimum size constraints. */
  resizeWindow(id: string, width: number, height: number): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    window.width = Math.max(width, this.config.minWidth || 400);
    window.height = Math.max(height, this.config.minHeight || 300);

    this.emit('window:resized', {
      id,
      width: window.width,
      height: window.height,
    });
    return true;
  }

  /** Move a window to a new position. */
  moveWindow(id: string, x: number, y: number): boolean {
    const window = this.windows.get(id);
    if (!window) return false;

    window.x = x;
    window.y = y;

    this.emit('window:moved', { id, x, y });
    return true;
  }

  /** Get a window's state by id. */
  getWindow(id: string): WindowState | null {
    return this.windows.get(id) || null;
  }

  /** Get the currently focused window. */
  getFocusedWindow(): WindowState | null {
    if (!this.focusedWindowId) return null;
    return this.windows.get(this.focusedWindowId) || null;
  }

  /** List all window states. */
  listWindows(): WindowState[] {
    return Array.from(this.windows.values());
  }

  /** Get the total number of windows. */
  getWindowCount(): number {
    return this.windows.size;
  }

  /** Dispose the manager, clearing all windows. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.windows.clear();
    this.focusedWindowId = null;
    this.removeAllListeners();
  }
}

export function createWindowManager(
  config?: Partial<DesktopConfig>,
): WindowManager {
  return new WindowManager(config);
}
