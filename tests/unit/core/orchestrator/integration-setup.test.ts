/**
 * Integration Setup Tests
 */

import { EventEmitter } from 'events';
import { initializeIntegrations, type IntegrationFlags } from '../../../../src/core/orchestrator/integration-setup';
import { HookRegistry } from '../../../../src/core/hooks/hook-registry';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('IntegrationSetup', () => {
  let hookRegistry: HookRegistry;
  let emitter: EventEmitter;
  let workspaceDir: string;

  beforeEach(() => {
    hookRegistry = new HookRegistry();
    emitter = new EventEmitter();
    workspaceDir = path.join(os.tmpdir(), `integration-setup-test-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should do nothing when all flags are false', async () => {
    const flags: IntegrationFlags = {
      enableValidation: false,
      enableLearning: false,
      enableContextManagement: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    expect(hookRegistry.count()).toBe(0);
  });

  it('should register validation hooks when enableValidation is true', async () => {
    const flags: IntegrationFlags = {
      enableValidation: true,
      enableLearning: false,
      enableContextManagement: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // Should have registered ConfidenceCheckHook and SelfCheckHook
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(1);
  });

  it('should register learning hooks when enableLearning is true', async () => {
    const flags: IntegrationFlags = {
      enableValidation: false,
      enableLearning: true,
      enableContextManagement: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // ErrorLearningHook should be registered
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(1);
  });

  it('should register context hooks when enableContextManagement is true', async () => {
    const flags: IntegrationFlags = {
      enableValidation: false,
      enableLearning: false,
      enableContextManagement: true,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // ContextOptimizerHook should be registered
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(1);
  });

  it('should register all hooks when all flags are true', async () => {
    const flags: IntegrationFlags = {
      enableValidation: true,
      enableLearning: true,
      enableContextManagement: true,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // Multiple hooks should be registered
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(3);
  });

  it('should initialize ServiceRegistry when any flag is true', async () => {
    const flags: IntegrationFlags = {
      enableValidation: true,
      enableLearning: false,
      enableContextManagement: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    const registry = ServiceRegistry.getInstance();
    expect(registry.isInitialized()).toBe(true);
  });

  it('should not initialize ServiceRegistry when all flags are false', async () => {
    // Reset registry first
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }

    const flags: IntegrationFlags = {
      enableValidation: false,
      enableLearning: false,
      enableContextManagement: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    const registry = ServiceRegistry.getInstance();
    expect(registry.isInitialized()).toBe(false);
  });
});
