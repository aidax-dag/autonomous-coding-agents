/**
 * Tests for Desktop App Module
 *
 * Comprehensive tests covering IPCBridge, WindowManager,
 * SystemTray, DesktopApp orchestrator, and factory functions.
 *
 * Feature: F-12 - Desktop App (Tauri)
 */

// Mock the logger before any imports
jest.mock('@/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { IPCBridge, createIPCBridge } from '@/desktop/ipc-bridge';
import { WindowManager, createWindowManager } from '@/desktop/window-manager';
import { SystemTray, createSystemTray } from '@/desktop/system-tray';
import { DesktopApp, createDesktopApp } from '@/desktop/desktop-app';
import { DEFAULT_CONFIG } from '@/desktop/types';
import type { IPCMessage, TrayMenuItem } from '@/desktop/types';

// ---------------------------------------------------------------------------
// IPCBridge
// ---------------------------------------------------------------------------
describe('IPCBridge', () => {
  let bridge: IPCBridge;

  beforeEach(() => {
    bridge = new IPCBridge(100); // short timeout for tests
  });

  afterEach(() => {
    bridge.dispose();
  });

  describe('registerHandler', () => {
    it('should register a handler for a channel', () => {
      bridge.registerHandler('test', () => 'ok');
      expect(bridge.hasHandler('test')).toBe(true);
      expect(bridge.getRegisteredChannels()).toEqual(['test']);
    });

    it('should throw when registering a duplicate channel', () => {
      bridge.registerHandler('test', () => 'ok');
      expect(() => bridge.registerHandler('test', () => 'dup')).toThrow(
        "Handler already registered for channel 'test'",
      );
    });

    it('should throw when bridge is disposed', () => {
      bridge.dispose();
      expect(() => bridge.registerHandler('x', () => 'y')).toThrow(
        'IPCBridge is disposed',
      );
    });

    it('should emit handler:registered event', () => {
      const spy = jest.fn();
      bridge.on('handler:registered', spy);
      bridge.registerHandler('ch1', () => {});
      expect(spy).toHaveBeenCalledWith('ch1');
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister an existing handler', () => {
      bridge.registerHandler('test', () => 'ok');
      expect(bridge.unregisterHandler('test')).toBe(true);
      expect(bridge.hasHandler('test')).toBe(false);
    });

    it('should return false for non-existent handler', () => {
      expect(bridge.unregisterHandler('nope')).toBe(false);
    });

    it('should emit handler:unregistered event', () => {
      const spy = jest.fn();
      bridge.on('handler:unregistered', spy);
      bridge.registerHandler('ch1', () => {});
      bridge.unregisterHandler('ch1');
      expect(spy).toHaveBeenCalledWith('ch1');
    });
  });

  describe('send', () => {
    it('should invoke a local handler and return its result', async () => {
      bridge.registerHandler('echo', (payload) => payload);
      const result = await bridge.send('echo', 'hello');
      expect(result).toBe('hello');
    });

    it('should emit message:sent and message:handled on success', async () => {
      const sentSpy = jest.fn();
      const handledSpy = jest.fn();
      bridge.on('message:sent', sentSpy);
      bridge.on('message:handled', handledSpy);

      bridge.registerHandler('greet', () => 'hi');
      await bridge.send('greet', {});

      expect(sentSpy).toHaveBeenCalledTimes(1);
      expect(handledSpy).toHaveBeenCalledTimes(1);
      expect(handledSpy).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'greet', result: 'hi' }),
      );
    });

    it('should propagate handler errors and emit message:error', async () => {
      const errorSpy = jest.fn();
      bridge.on('message:error', errorSpy);

      bridge.registerHandler('fail', () => {
        throw new Error('boom');
      });

      await expect(bridge.send('fail', {})).rejects.toThrow('boom');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'fail', error: 'boom' }),
      );
    });

    it('should timeout when no handler and no incoming response', async () => {
      await expect(bridge.send('nowhere', {})).rejects.toThrow(
        "IPC request timeout on channel 'nowhere' after 100ms",
      );
    });

    it('should increment message count on each send', async () => {
      bridge.registerHandler('c', () => null);
      await bridge.send('c', 1);
      await bridge.send('c', 2);
      expect(bridge.getMessageCount()).toBe(2);
    });

    it('should throw when bridge is disposed', async () => {
      bridge.dispose();
      await expect(bridge.send('x', {})).rejects.toThrow(
        'IPCBridge is disposed',
      );
    });
  });

  describe('handleIncoming', () => {
    it('should resolve a pending request by message id', async () => {
      // Start fresh with longer timeout
      bridge.dispose();
      bridge = new IPCBridge(5000);

      let sentId = '';
      bridge.on('message:sent', (msg: IPCMessage) => {
        sentId = msg.id;
      });

      const p = bridge.send('remote-channel', 'data');
      expect(sentId).toBeTruthy();
      expect(bridge.getPendingCount()).toBe(1);

      bridge.handleIncoming({
        id: sentId,
        channel: 'remote-channel',
        payload: 'response-data',
        timestamp: new Date().toISOString(),
        source: 'renderer',
      });

      const result = await p;
      expect(result).toBe('response-data');
      expect(bridge.getPendingCount()).toBe(0);
    });

    it('should invoke a registered handler for an incoming message', (done) => {
      bridge.registerHandler('incoming-ch', (payload) => {
        expect(payload).toBe('test-data');
        done();
        return 'ack';
      });

      bridge.handleIncoming({
        id: 'msg-1',
        channel: 'incoming-ch',
        payload: 'test-data',
        timestamp: new Date().toISOString(),
        source: 'renderer',
      });
    });

    it('should emit message:unhandled for unknown channels', () => {
      const spy = jest.fn();
      bridge.on('message:unhandled', spy);

      const msg: IPCMessage = {
        id: 'unknown-1',
        channel: 'unknown-channel',
        payload: null,
        timestamp: new Date().toISOString(),
        source: 'renderer',
      };

      bridge.handleIncoming(msg);
      expect(spy).toHaveBeenCalledWith(msg);
    });

    it('should emit message:error when handler throws on incoming', (done) => {
      bridge.on('message:error', (data) => {
        expect(data.error).toBe('handler-error');
        done();
      });

      bridge.registerHandler('err-ch', () => {
        throw new Error('handler-error');
      });

      bridge.handleIncoming({
        id: 'err-1',
        channel: 'err-ch',
        payload: null,
        timestamp: new Date().toISOString(),
        source: 'renderer',
      });
    });

    it('should not process when disposed', () => {
      const spy = jest.fn();
      bridge.on('message:received', spy);
      bridge.dispose();

      bridge.handleIncoming({
        id: 'x',
        channel: 'x',
        payload: null,
        timestamp: new Date().toISOString(),
        source: 'renderer',
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should reject all pending requests', async () => {
      const p = bridge.send('ch', 'data');
      bridge.dispose();
      await expect(p).rejects.toThrow('IPCBridge disposed');
    });

    it('should clear handlers and reset count', () => {
      bridge.registerHandler('a', () => {});
      bridge.dispose();
      expect(bridge.getRegisteredChannels()).toEqual([]);
      expect(bridge.getMessageCount()).toBe(0);
      expect(bridge.getPendingCount()).toBe(0);
    });

    it('should be idempotent', () => {
      bridge.dispose();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// WindowManager
// ---------------------------------------------------------------------------
describe('WindowManager', () => {
  let manager: WindowManager;

  beforeEach(() => {
    manager = new WindowManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('createWindow', () => {
    it('should create a window with default config values', () => {
      const win = manager.createWindow();
      expect(win.id).toBe('window-1');
      expect(win.title).toBe(DEFAULT_CONFIG.title);
      expect(win.width).toBe(DEFAULT_CONFIG.width);
      expect(win.height).toBe(DEFAULT_CONFIG.height);
      expect(win.visible).toBe(true);
      expect(win.minimized).toBe(false);
    });

    it('should create a window with custom options', () => {
      const win = manager.createWindow({
        id: 'custom',
        title: 'Custom',
        width: 500,
        height: 400,
        x: 50,
        y: 60,
      });
      expect(win.id).toBe('custom');
      expect(win.title).toBe('Custom');
      expect(win.width).toBe(500);
      expect(win.height).toBe(400);
      expect(win.x).toBe(50);
      expect(win.y).toBe(60);
    });

    it('should throw when creating a duplicate window id', () => {
      manager.createWindow({ id: 'dup' });
      expect(() => manager.createWindow({ id: 'dup' })).toThrow(
        "Window 'dup' already exists",
      );
    });

    it('should auto-focus the first window', () => {
      const win = manager.createWindow({ id: 'first' });
      expect(win.focused).toBe(true);
      expect(manager.getFocusedWindow()?.id).toBe('first');
    });

    it('should not auto-focus subsequent windows', () => {
      manager.createWindow({ id: 'first' });
      const second = manager.createWindow({ id: 'second' });
      expect(second.focused).toBe(false);
      expect(manager.getFocusedWindow()?.id).toBe('first');
    });

    it('should emit window:created event', () => {
      const spy = jest.fn();
      manager.on('window:created', spy);
      manager.createWindow({ id: 'w1' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w1' }),
      );
    });

    it('should throw when manager is disposed', () => {
      manager.dispose();
      expect(() => manager.createWindow()).toThrow(
        'WindowManager is disposed',
      );
    });

    it('should respect startMinimized config', () => {
      const mgr = new WindowManager({ startMinimized: true });
      mgr.createWindow({ id: 'min' });
      // First window gets auto-focused which sets minimized=false
      // Create a second window to test startMinimized
      const second = mgr.createWindow({ id: 'min2' });
      expect(second.minimized).toBe(true);
      expect(second.visible).toBe(false);
      mgr.dispose();
    });
  });

  describe('closeWindow', () => {
    it('should close an existing window', () => {
      manager.createWindow({ id: 'w1' });
      expect(manager.closeWindow('w1')).toBe(true);
      expect(manager.getWindowCount()).toBe(0);
    });

    it('should return false for non-existent window', () => {
      expect(manager.closeWindow('nope')).toBe(false);
    });

    it('should transfer focus when closing the focused window', () => {
      manager.createWindow({ id: 'w1' });
      manager.createWindow({ id: 'w2' });
      manager.focusWindow('w1');

      manager.closeWindow('w1');
      expect(manager.getFocusedWindow()?.id).toBe('w2');
    });

    it('should emit window:closed event', () => {
      const spy = jest.fn();
      manager.on('window:closed', spy);
      manager.createWindow({ id: 'w1' });
      manager.closeWindow('w1');
      expect(spy).toHaveBeenCalledWith({ id: 'w1' });
    });
  });

  describe('focusWindow', () => {
    it('should focus a window and unfocus the previous one', () => {
      manager.createWindow({ id: 'w1' });
      manager.createWindow({ id: 'w2' });

      manager.focusWindow('w2');
      expect(manager.getWindow('w1')?.focused).toBe(false);
      expect(manager.getWindow('w2')?.focused).toBe(true);
      expect(manager.getFocusedWindow()?.id).toBe('w2');
    });

    it('should return false for non-existent window', () => {
      expect(manager.focusWindow('nope')).toBe(false);
    });

    it('should restore a minimized window when focused', () => {
      manager.createWindow({ id: 'w1' });
      manager.minimizeWindow('w1');
      manager.focusWindow('w1');
      expect(manager.getWindow('w1')?.minimized).toBe(false);
      expect(manager.getWindow('w1')?.visible).toBe(true);
    });

    it('should emit window:focused event', () => {
      const spy = jest.fn();
      manager.on('window:focused', spy);
      manager.createWindow({ id: 'w1' });
      // First focus from auto-focus triggers it
      expect(spy).toHaveBeenCalledWith({ id: 'w1' });
    });
  });

  describe('minimizeWindow', () => {
    it('should minimize a window and clear focus', () => {
      manager.createWindow({ id: 'w1' });
      manager.minimizeWindow('w1');
      expect(manager.getWindow('w1')?.minimized).toBe(true);
      expect(manager.getWindow('w1')?.focused).toBe(false);
      expect(manager.getFocusedWindow()).toBeNull();
    });

    it('should return false for non-existent window', () => {
      expect(manager.minimizeWindow('nope')).toBe(false);
    });
  });

  describe('maximizeWindow', () => {
    it('should toggle maximize on a window', () => {
      manager.createWindow({ id: 'w1' });
      expect(manager.getWindow('w1')?.maximized).toBe(false);
      manager.maximizeWindow('w1');
      expect(manager.getWindow('w1')?.maximized).toBe(true);
      manager.maximizeWindow('w1');
      expect(manager.getWindow('w1')?.maximized).toBe(false);
    });

    it('should return false for non-existent window', () => {
      expect(manager.maximizeWindow('nope')).toBe(false);
    });
  });

  describe('resizeWindow', () => {
    it('should resize a window', () => {
      manager.createWindow({ id: 'w1' });
      manager.resizeWindow('w1', 1024, 768);
      const win = manager.getWindow('w1');
      expect(win?.width).toBe(1024);
      expect(win?.height).toBe(768);
    });

    it('should enforce minimum size from config', () => {
      manager.createWindow({ id: 'w1' });
      manager.resizeWindow('w1', 100, 100); // below minimum
      const win = manager.getWindow('w1');
      expect(win?.width).toBe(DEFAULT_CONFIG.minWidth);
      expect(win?.height).toBe(DEFAULT_CONFIG.minHeight);
    });

    it('should return false for non-existent window', () => {
      expect(manager.resizeWindow('nope', 100, 100)).toBe(false);
    });

    it('should emit window:resized event', () => {
      const spy = jest.fn();
      manager.on('window:resized', spy);
      manager.createWindow({ id: 'w1' });
      manager.resizeWindow('w1', 1024, 768);
      expect(spy).toHaveBeenCalledWith({
        id: 'w1',
        width: 1024,
        height: 768,
      });
    });
  });

  describe('moveWindow', () => {
    it('should move a window to a new position', () => {
      manager.createWindow({ id: 'w1' });
      manager.moveWindow('w1', 200, 300);
      const win = manager.getWindow('w1');
      expect(win?.x).toBe(200);
      expect(win?.y).toBe(300);
    });

    it('should return false for non-existent window', () => {
      expect(manager.moveWindow('nope', 0, 0)).toBe(false);
    });

    it('should emit window:moved event', () => {
      const spy = jest.fn();
      manager.on('window:moved', spy);
      manager.createWindow({ id: 'w1' });
      manager.moveWindow('w1', 200, 300);
      expect(spy).toHaveBeenCalledWith({ id: 'w1', x: 200, y: 300 });
    });
  });

  describe('getWindow / listWindows / getWindowCount', () => {
    it('should return null for non-existent window', () => {
      expect(manager.getWindow('nope')).toBeNull();
    });

    it('should list all windows', () => {
      manager.createWindow({ id: 'w1' });
      manager.createWindow({ id: 'w2' });
      const list = manager.listWindows();
      expect(list).toHaveLength(2);
      expect(list.map((w) => w.id)).toEqual(['w1', 'w2']);
    });

    it('should return correct window count', () => {
      expect(manager.getWindowCount()).toBe(0);
      manager.createWindow({ id: 'w1' });
      expect(manager.getWindowCount()).toBe(1);
    });
  });

  describe('dispose', () => {
    it('should clear all windows and listeners', () => {
      manager.createWindow({ id: 'w1' });
      manager.dispose();
      expect(manager.getWindowCount()).toBe(0);
      expect(manager.getFocusedWindow()).toBeNull();
    });

    it('should be idempotent', () => {
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// SystemTray
// ---------------------------------------------------------------------------
describe('SystemTray', () => {
  let tray: SystemTray;

  beforeEach(() => {
    tray = new SystemTray();
  });

  afterEach(() => {
    tray.dispose();
  });

  describe('show / hide / isVisible', () => {
    it('should start hidden', () => {
      expect(tray.isVisible()).toBe(false);
    });

    it('should show and hide the tray', () => {
      tray.show();
      expect(tray.isVisible()).toBe(true);
      tray.hide();
      expect(tray.isVisible()).toBe(false);
    });

    it('should throw show when disposed', () => {
      tray.dispose();
      expect(() => tray.show()).toThrow('SystemTray is disposed');
    });

    it('should emit tray:show and tray:hide events', () => {
      const showSpy = jest.fn();
      const hideSpy = jest.fn();
      tray.on('tray:show', showSpy);
      tray.on('tray:hide', hideSpy);

      tray.show();
      tray.hide();
      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('tooltip', () => {
    it('should set and get tooltip', () => {
      tray.setTooltip('New Tooltip');
      expect(tray.getTooltip()).toBe('New Tooltip');
    });

    it('should emit tray:tooltip-changed event', () => {
      const spy = jest.fn();
      tray.on('tray:tooltip-changed', spy);
      tray.setTooltip('Test');
      expect(spy).toHaveBeenCalledWith('Test');
    });
  });

  describe('icon', () => {
    it('should emit tray:icon-changed event', () => {
      const spy = jest.fn();
      tray.on('tray:icon-changed', spy);
      tray.setIcon('new-icon.png');
      expect(spy).toHaveBeenCalledWith('new-icon.png');
    });
  });

  describe('menu items', () => {
    it('should provide default menu items', () => {
      const items = tray.getMenuItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items.find((i) => i.id === 'quit')).toBeDefined();
      expect(items.find((i) => i.id === 'show')).toBeDefined();
    });

    it('should set menu items', () => {
      const items: TrayMenuItem[] = [
        { id: 'custom', label: 'Custom', enabled: true },
      ];
      tray.setMenuItems(items);
      expect(tray.getMenuItems()).toEqual(items);
    });

    it('should add a menu item', () => {
      const initialCount = tray.getMenuItems().length;
      tray.addMenuItem({
        id: 'extra',
        label: 'Extra',
        enabled: true,
      });
      expect(tray.getMenuItems().length).toBe(initialCount + 1);
    });

    it('should remove a menu item by id', () => {
      expect(tray.removeMenuItem('quit')).toBe(true);
      expect(tray.getMenuItems().find((i) => i.id === 'quit')).toBeUndefined();
    });

    it('should return false when removing non-existent item', () => {
      expect(tray.removeMenuItem('non-existent')).toBe(false);
    });

    it('should emit tray:menu-updated on changes', () => {
      const spy = jest.fn();
      tray.on('tray:menu-updated', spy);

      tray.addMenuItem({ id: 'x', label: 'X', enabled: true });
      expect(spy).toHaveBeenCalledTimes(1);

      tray.removeMenuItem('x');
      expect(spy).toHaveBeenCalledTimes(2);

      tray.setMenuItems([]);
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  describe('simulateClick / simulateMenuClick', () => {
    it('should emit tray:click on simulateClick', () => {
      const spy = jest.fn();
      tray.on('tray:click', spy);
      tray.simulateClick();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit tray:menu-click for enabled items', () => {
      const spy = jest.fn();
      tray.on('tray:menu-click', spy);
      tray.simulateMenuClick('quit');
      expect(spy).toHaveBeenCalledWith({
        id: 'quit',
        action: 'quit',
      });
    });

    it('should not emit tray:menu-click for disabled items', () => {
      const spy = jest.fn();
      tray.on('tray:menu-click', spy);
      tray.simulateMenuClick('status'); // status is disabled by default
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not emit tray:menu-click for non-existent items', () => {
      const spy = jest.fn();
      tray.on('tray:menu-click', spy);
      tray.simulateMenuClick('non-existent');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the tray config', () => {
      const config = tray.getConfig();
      expect(config.tooltip).toBe('ACA Desktop');
      expect(config.icon).toBe('default-icon');
      expect(config.menuItems.length).toBeGreaterThan(0);
    });

    it('should return a copy that does not mutate internal state', () => {
      const config = tray.getConfig();
      config.tooltip = 'mutated';
      expect(tray.getTooltip()).toBe('ACA Desktop');
    });
  });

  describe('dispose', () => {
    it('should clear visibility and menu items', () => {
      tray.show();
      tray.dispose();
      expect(tray.isVisible()).toBe(false);
      expect(tray.getMenuItems()).toEqual([]);
    });

    it('should be idempotent', () => {
      tray.dispose();
      expect(() => tray.dispose()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// DesktopApp
// ---------------------------------------------------------------------------
describe('DesktopApp', () => {
  let app: DesktopApp;

  beforeEach(() => {
    app = new DesktopApp();
  });

  afterEach(() => {
    app.dispose();
  });

  describe('initialize', () => {
    it('should transition from created to ready', async () => {
      expect(app.getState()).toBe('created');
      await app.initialize();
      expect(app.getState()).toBe('ready');
    });

    it('should throw when initialized from wrong state', async () => {
      await app.initialize();
      await expect(app.initialize()).rejects.toThrow(
        "Cannot initialize from state 'ready'",
      );
    });

    it('should emit state:changed and app:ready events', async () => {
      const stateChanges: string[] = [];
      const readySpy = jest.fn();

      app.on('state:changed', (state) => stateChanges.push(state));
      app.on('app:ready', readySpy);

      await app.initialize();

      expect(stateChanges).toEqual(['initializing', 'ready']);
      expect(readySpy).toHaveBeenCalledTimes(1);
    });

    it('should register built-in IPC handlers', async () => {
      await app.initialize();
      const ipc = app.getIPCBridge();
      expect(ipc.hasHandler('app:getState')).toBe(true);
      expect(ipc.hasHandler('app:getConfig')).toBe(true);
      expect(ipc.hasHandler('window:list')).toBe(true);
      expect(ipc.hasHandler('window:focus')).toBe(true);
      expect(ipc.hasHandler('tray:getMenu')).toBe(true);
    });
  });

  describe('start', () => {
    it('should transition from ready to running', async () => {
      await app.initialize();
      await app.start();
      expect(app.getState()).toBe('running');
    });

    it('should throw when started from wrong state', async () => {
      await expect(app.start()).rejects.toThrow(
        "Cannot start from state 'created'",
      );
    });

    it('should create a main window', async () => {
      await app.initialize();
      await app.start();

      const wm = app.getWindowManager();
      expect(wm.getWindowCount()).toBe(1);
      expect(wm.getWindow('main')).toBeDefined();
      expect(wm.getWindow('main')?.title).toBe(DEFAULT_CONFIG.title);
    });

    it('should show tray when trayEnabled is true (default)', async () => {
      await app.initialize();
      await app.start();
      expect(app.getSystemTray().isVisible()).toBe(true);
    });

    it('should not show tray when trayEnabled is false', async () => {
      app.dispose();
      app = new DesktopApp({ trayEnabled: false });
      await app.initialize();
      await app.start();
      expect(app.getSystemTray().isVisible()).toBe(false);
    });

    it('should emit app:started event', async () => {
      const spy = jest.fn();
      app.on('app:started', spy);
      await app.initialize();
      await app.start();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('quit', () => {
    it('should close all windows and hide tray', async () => {
      await app.initialize();
      await app.start();

      await app.quit();
      expect(app.getState()).toBe('quitting');
      expect(app.getWindowManager().getWindowCount()).toBe(0);
      expect(app.getSystemTray().isVisible()).toBe(false);
    });

    it('should emit app:quit event', async () => {
      const spy = jest.fn();
      app.on('app:quit', spy);
      await app.initialize();
      await app.start();
      await app.quit();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should be idempotent', async () => {
      await app.initialize();
      await app.start();
      await app.quit();
      await expect(app.quit()).resolves.toBeUndefined();
    });
  });

  describe('built-in IPC handlers', () => {
    it('app:getState should return current state', async () => {
      await app.initialize();
      const ipc = app.getIPCBridge();
      const state = await ipc.send('app:getState', null);
      expect(state).toBe('ready');
    });

    it('app:getConfig should return config', async () => {
      await app.initialize();
      const ipc = app.getIPCBridge();
      const config = await ipc.send('app:getConfig', null);
      expect(config).toEqual(expect.objectContaining({ title: DEFAULT_CONFIG.title }));
    });

    it('window:list should return window list', async () => {
      await app.initialize();
      await app.start();
      const ipc = app.getIPCBridge();
      const windows = (await ipc.send('window:list', null)) as unknown[];
      expect(windows).toHaveLength(1);
    });

    it('tray:getMenu should return menu items', async () => {
      await app.initialize();
      const ipc = app.getIPCBridge();
      const menu = (await ipc.send('tray:getMenu', null)) as unknown[];
      expect(Array.isArray(menu)).toBe(true);
      expect(menu.length).toBeGreaterThan(0);
    });
  });

  describe('event forwarding', () => {
    it('should forward window:created as desktop:event', async () => {
      const spy = jest.fn();
      await app.initialize();
      app.on('desktop:event', spy);
      await app.start();

      // The main window creation should have triggered this
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'window:created',
          data: expect.objectContaining({ id: 'main' }),
        }),
      );
    });

    it('should forward window:closed as desktop:event', async () => {
      const events: Array<{ type: string }> = [];
      await app.initialize();
      app.on('desktop:event', (e) => events.push(e));
      await app.start();

      app.getWindowManager().closeWindow('main');
      const closedEvent = events.find((e) => e.type === 'window:closed');
      expect(closedEvent).toBeDefined();
    });

    it('should forward tray:click as desktop:event', async () => {
      const spy = jest.fn();
      await app.initialize();
      app.on('desktop:event', spy);

      app.getSystemTray().simulateClick();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tray:click' }),
      );
    });

    it('should forward tray:menu-click as desktop:event', async () => {
      const spy = jest.fn();
      await app.initialize();
      app.on('desktop:event', spy);

      app.getSystemTray().simulateMenuClick('quit');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tray:menu-click' }),
      );
    });

    it('should forward ipc:message as desktop:event', async () => {
      const spy = jest.fn();
      await app.initialize();
      app.on('desktop:event', spy);

      app.getIPCBridge().handleIncoming({
        id: 'test-msg',
        channel: 'app:getState',
        payload: null,
        timestamp: new Date().toISOString(),
        source: 'renderer',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ipc:message' }),
      );
    });
  });

  describe('getters', () => {
    it('should expose IPC bridge', () => {
      expect(app.getIPCBridge()).toBeInstanceOf(IPCBridge);
    });

    it('should expose window manager', () => {
      expect(app.getWindowManager()).toBeInstanceOf(WindowManager);
    });

    it('should expose system tray', () => {
      expect(app.getSystemTray()).toBeInstanceOf(SystemTray);
    });

    it('should return a config copy', () => {
      const config = app.getConfig();
      expect(config.title).toBe(DEFAULT_CONFIG.title);
      config.title = 'mutated';
      expect(app.getConfig().title).toBe(DEFAULT_CONFIG.title);
    });
  });

  describe('dispose', () => {
    it('should dispose all sub-components', () => {
      const ipcDisposeSpy = jest.spyOn(app.getIPCBridge(), 'dispose');
      const wmDisposeSpy = jest.spyOn(app.getWindowManager(), 'dispose');
      const trayDisposeSpy = jest.spyOn(app.getSystemTray(), 'dispose');

      app.dispose();

      expect(ipcDisposeSpy).toHaveBeenCalled();
      expect(wmDisposeSpy).toHaveBeenCalled();
      expect(trayDisposeSpy).toHaveBeenCalled();
      expect(app.getState()).toBe('disposed');
    });

    it('should be idempotent', () => {
      app.dispose();
      expect(() => app.dispose()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------
describe('Factory Functions', () => {
  it('createIPCBridge should create an IPCBridge', () => {
    const bridge = createIPCBridge(5000);
    expect(bridge).toBeInstanceOf(IPCBridge);
    expect(bridge.getMessageCount()).toBe(0);
    bridge.dispose();
  });

  it('createWindowManager should create a WindowManager', () => {
    const mgr = createWindowManager({ title: 'Test' });
    expect(mgr).toBeInstanceOf(WindowManager);
    expect(mgr.getWindowCount()).toBe(0);
    mgr.dispose();
  });

  it('createSystemTray should create a SystemTray', () => {
    const tray = createSystemTray({ tooltip: 'Test' });
    expect(tray).toBeInstanceOf(SystemTray);
    expect(tray.getTooltip()).toBe('Test');
    tray.dispose();
  });

  it('createDesktopApp should create a DesktopApp', () => {
    const desktopApp = createDesktopApp({ title: 'Test App' });
    expect(desktopApp).toBeInstanceOf(DesktopApp);
    expect(desktopApp.getState()).toBe('created');
    expect(desktopApp.getConfig().title).toBe('Test App');
    desktopApp.dispose();
  });
});
