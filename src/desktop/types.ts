/**
 * Desktop App Types
 *
 * Type definitions for the Tauri-based desktop application module
 * including window management, IPC communication, and system tray.
 *
 * @module desktop
 */

export interface DesktopConfig {
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable: boolean;
  fullscreen: boolean;
  alwaysOnTop: boolean;
  decorations: boolean;
  transparent: boolean;
  trayEnabled: boolean;
  trayIcon?: string;
  trayTooltip?: string;
  startMinimized: boolean;
  singleInstance: boolean;
  devTools: boolean;
}

export interface WindowState {
  id: string;
  title: string;
  width: number;
  height: number;
  x: number;
  y: number;
  focused: boolean;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
  fullscreen: boolean;
}

export interface IPCMessage {
  id: string;
  channel: string;
  payload: unknown;
  timestamp: string;
  source: 'renderer' | 'main';
}

export interface IPCHandler {
  channel: string;
  handler: (payload: unknown) => Promise<unknown> | unknown;
}

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled: boolean;
  checked?: boolean;
  separator?: boolean;
  action?: string;
}

export interface TrayConfig {
  icon: string;
  tooltip: string;
  menuItems: TrayMenuItem[];
}

export interface DesktopEvent {
  type:
    | 'window:created'
    | 'window:closed'
    | 'window:focused'
    | 'window:moved'
    | 'window:resized'
    | 'tray:click'
    | 'tray:menu-click'
    | 'ipc:message'
    | 'app:ready'
    | 'app:quit';
  data: unknown;
  timestamp: string;
}

export const DEFAULT_CONFIG: DesktopConfig = {
  title: 'ACA - Autonomous Coding Agents',
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  resizable: true,
  fullscreen: false,
  alwaysOnTop: false,
  decorations: true,
  transparent: false,
  trayEnabled: true,
  trayTooltip: 'ACA Desktop',
  startMinimized: false,
  singleInstance: true,
  devTools: false,
};
