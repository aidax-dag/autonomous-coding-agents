/**
 * Desktop App Module
 *
 * Tauri-based native desktop application with IPC bridge,
 * window management, and system tray integration.
 *
 * @module desktop
 */

export type {
  DesktopConfig,
  WindowState,
  IPCMessage,
  IPCHandler,
  TrayMenuItem,
  TrayConfig,
  DesktopEvent,
} from './types';
export { DEFAULT_CONFIG } from './types';

export { IPCBridge, createIPCBridge } from './ipc-bridge';
export { WindowManager, createWindowManager } from './window-manager';
export { SystemTray, createSystemTray } from './system-tray';
export {
  DesktopApp,
  createDesktopApp,
  type AppState,
} from './desktop-app';
