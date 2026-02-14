/**
 * Desktop App
 * Main desktop application orchestrator combining IPC bridge,
 * window manager, and system tray into a unified lifecycle.
 *
 * @module desktop
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '@/shared/logging/logger';
import { IPCBridge } from './ipc-bridge';
import { WindowManager } from './window-manager';
import { SystemTray } from './system-tray';
import type { DesktopConfig, DesktopEvent } from './types';
import { DEFAULT_CONFIG } from './types';

const logger = createAgentLogger('Desktop', 'desktop-app');

export type AppState =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'quitting'
  | 'disposed';

export class DesktopApp extends EventEmitter {
  private config: DesktopConfig;
  private state: AppState = 'created';
  private ipcBridge: IPCBridge;
  private windowManager: WindowManager;
  private systemTray: SystemTray;

  constructor(config: Partial<DesktopConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ipcBridge = new IPCBridge();
    this.windowManager = new WindowManager(this.config);
    this.systemTray = new SystemTray({
      tooltip: this.config.trayTooltip,
      icon: this.config.trayIcon,
    });
  }

  /** Initialize the app, registering IPC handlers and wiring events. */
  async initialize(): Promise<void> {
    if (this.state !== 'created') {
      throw new Error(`Cannot initialize from state '${this.state}'`);
    }
    this.state = 'initializing';
    this.emit('state:changed', this.state);

    this.registerBuiltInHandlers();
    this.setupEventForwarding();

    this.state = 'ready';
    this.emit('state:changed', this.state);
    this.emit('app:ready');
    logger.info('Desktop app initialized');
  }

  /** Start the app: create main window and show tray. */
  async start(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start from state '${this.state}'`);
    }

    this.state = 'running';
    this.emit('state:changed', this.state);

    this.windowManager.createWindow({
      id: 'main',
      title: this.config.title,
    });

    if (this.config.trayEnabled) {
      this.systemTray.show();
    }

    this.emit('app:started');
    logger.info('Desktop app started');
  }

  /** Quit the app: close all windows and hide tray. */
  async quit(): Promise<void> {
    if (this.state === 'disposed' || this.state === 'quitting') return;

    this.state = 'quitting';
    this.emit('state:changed', this.state);
    this.emit('app:quit');

    for (const window of this.windowManager.listWindows()) {
      this.windowManager.closeWindow(window.id);
    }

    this.systemTray.hide();

    logger.info('Desktop app quit');
  }

  /** Get the current application state. */
  getState(): AppState {
    return this.state;
  }

  /** Get the IPC bridge instance. */
  getIPCBridge(): IPCBridge {
    return this.ipcBridge;
  }

  /** Get the window manager instance. */
  getWindowManager(): WindowManager {
    return this.windowManager;
  }

  /** Get the system tray instance. */
  getSystemTray(): SystemTray {
    return this.systemTray;
  }

  /** Get a copy of the desktop configuration. */
  getConfig(): DesktopConfig {
    return { ...this.config };
  }

  private registerBuiltInHandlers(): void {
    this.ipcBridge.registerHandler('app:getState', () => this.state);
    this.ipcBridge.registerHandler('app:getConfig', () => this.config);
    this.ipcBridge.registerHandler('window:list', () =>
      this.windowManager.listWindows(),
    );
    this.ipcBridge.registerHandler(
      'window:focus',
      (payload: unknown) => {
        const data = payload as { id?: string };
        return this.windowManager.focusWindow(data?.id || '');
      },
    );
    this.ipcBridge.registerHandler('tray:getMenu', () =>
      this.systemTray.getMenuItems(),
    );
  }

  private setupEventForwarding(): void {
    // Forward window events
    this.windowManager.on('window:created', (data) =>
      this.emitDesktopEvent('window:created', data),
    );
    this.windowManager.on('window:closed', (data) =>
      this.emitDesktopEvent('window:closed', data),
    );
    this.windowManager.on('window:focused', (data) =>
      this.emitDesktopEvent('window:focused', data),
    );

    // Forward tray events
    this.systemTray.on('tray:click', () =>
      this.emitDesktopEvent('tray:click', {}),
    );
    this.systemTray.on('tray:menu-click', (data) =>
      this.emitDesktopEvent('tray:menu-click', data),
    );

    // Forward IPC events
    this.ipcBridge.on('message:received', (data) =>
      this.emitDesktopEvent('ipc:message', data),
    );
  }

  private emitDesktopEvent(
    type: DesktopEvent['type'],
    data: unknown,
  ): void {
    const event: DesktopEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emit('desktop:event', event);
  }

  /** Dispose the app and all sub-components. */
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    this.ipcBridge.dispose();
    this.windowManager.dispose();
    this.systemTray.dispose();
    this.removeAllListeners();
  }
}

export function createDesktopApp(
  config?: Partial<DesktopConfig>,
): DesktopApp {
  return new DesktopApp(config);
}
