/**
 * Phase B Integration Tests — MCP, LSP, Skills, Planning Context, Plugins
 *
 * Validates that Phase B modules (MCP, LSP+Skills, Planning Context, Plugins)
 * are properly wired through the integration pipeline:
 *   IntegrationFlags → ServiceRegistry → OrchestratorRunner
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  initializeIntegrations,
  type IntegrationFlags,
} from '../../src/core/orchestrator/integration-setup';
import { HookRegistry } from '../../src/core/hooks/hook-registry';
import { ServiceRegistry } from '../../src/core/services/service-registry';
import { createOrchestratorRunner } from '../../src/core/orchestrator/orchestrator-runner';
import type { ILLMClient, LLMCompletionResult } from '../../src/shared/llm/base-client';

// ============================================================================
// Helpers
// ============================================================================

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('test'),
    getDefaultModel: jest.fn().mockReturnValue('test-model'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result":"ok"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(4096),
  };
}

function makeBaseFlags(): IntegrationFlags {
  return {
    enableValidation: false,
    enableLearning: false,
    enableContextManagement: false,
    enableSecurity: false,
    enableSession: false,
    useRealQualityTools: false,
    enableMCP: false,
    enableLSP: false,
    enablePlugins: false,
    enablePlanningContext: false,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Phase B Module Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phase-b-integ-'));
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // T4: MCP Integration
  // ==========================================================================

  describe('MCP integration (T4)', () => {
    it('should initialize MCPClient and MCPToolRegistry when enableMCP is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableMCP: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getMCPClient()).not.toBeNull();
      expect(registry.getMCPToolRegistry()).not.toBeNull();
    });

    it('should not initialize MCP modules when enableMCP is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableValidation: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getMCPClient()).toBeNull();
      expect(registry.getMCPToolRegistry()).toBeNull();
    });

    it('should auto-enable SkillRegistry when enableMCP is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableMCP: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getSkillRegistry()).not.toBeNull();
    });
  });

  // ==========================================================================
  // T5: LSP + Skills Integration
  // ==========================================================================

  describe('LSP + Skills integration (T5)', () => {
    it('should initialize LSPClient and DiagnosticsCollector when enableLSP is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableLSP: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getLSPClient()).not.toBeNull();
      expect(registry.getDiagnosticsCollector()).not.toBeNull();
    });

    it('should not initialize LSP modules when enableLSP is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableValidation: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getLSPClient()).toBeNull();
      expect(registry.getDiagnosticsCollector()).toBeNull();
    });

    it('should auto-enable SkillRegistry when enableLSP is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableLSP: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getSkillRegistry()).not.toBeNull();
    });

    it('should enable SkillRegistry when both enableMCP and enableLSP are true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableMCP: true, enableLSP: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getMCPClient()).not.toBeNull();
      expect(registry.getLSPClient()).not.toBeNull();
      expect(registry.getSkillRegistry()).not.toBeNull();
    });
  });

  // ==========================================================================
  // T6: Planning Context + Plugin Integration
  // ==========================================================================

  describe('Planning Context integration (T6)', () => {
    it('should initialize StateTracker, PhaseManager, ContextBudget when enablePlanningContext is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enablePlanningContext: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getStateTracker()).not.toBeNull();
      expect(registry.getPhaseManager()).not.toBeNull();
      expect(registry.getContextBudget()).not.toBeNull();
    });

    it('should not initialize planning modules when enablePlanningContext is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableValidation: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getStateTracker()).toBeNull();
      expect(registry.getPhaseManager()).toBeNull();
      expect(registry.getContextBudget()).toBeNull();
    });
  });

  describe('Plugin system integration (T6)', () => {
    it('should initialize PluginLoader, PluginRegistry, PluginLifecycle when enablePlugins is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enablePlugins: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getPluginLoader()).not.toBeNull();
      expect(registry.getPluginRegistry()).not.toBeNull();
      expect(registry.getPluginLifecycle()).not.toBeNull();
    });

    it('should not initialize plugin modules when enablePlugins is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableValidation: true };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getPluginLoader()).toBeNull();
      expect(registry.getPluginRegistry()).toBeNull();
      expect(registry.getPluginLifecycle()).toBeNull();
    });
  });

  // ==========================================================================
  // Cross-module: All Phase B flags together
  // ==========================================================================

  describe('All Phase B modules together', () => {
    it('should initialize all Phase B modules when all flags are enabled', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags: IntegrationFlags = {
        ...makeBaseFlags(),
        enableMCP: true,
        enableLSP: true,
        enablePlugins: true,
        enablePlanningContext: true,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);

      // MCP
      expect(registry.getMCPClient()).not.toBeNull();
      expect(registry.getMCPToolRegistry()).not.toBeNull();

      // LSP
      expect(registry.getLSPClient()).not.toBeNull();
      expect(registry.getDiagnosticsCollector()).not.toBeNull();

      // Skills (auto-enabled)
      expect(registry.getSkillRegistry()).not.toBeNull();

      // Planning Context
      expect(registry.getStateTracker()).not.toBeNull();
      expect(registry.getPhaseManager()).not.toBeNull();
      expect(registry.getContextBudget()).not.toBeNull();

      // Plugins
      expect(registry.getPluginLoader()).not.toBeNull();
      expect(registry.getPluginRegistry()).not.toBeNull();
      expect(registry.getPluginLifecycle()).not.toBeNull();
    });

    it('should coexist with Phase A modules (validation, learning, security, session)', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags: IntegrationFlags = {
        enableValidation: true,
        enableLearning: true,
        enableContextManagement: true,
        enableSecurity: true,
        enableSession: true,
        useRealQualityTools: true,
        enableMCP: true,
        enableLSP: true,
        enablePlugins: true,
        enablePlanningContext: true,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();

      // Phase A modules
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getSandboxEscalation()).not.toBeNull();
      expect(registry.getSessionManager()).not.toBeNull();

      // Phase B modules
      expect(registry.getMCPClient()).not.toBeNull();
      expect(registry.getLSPClient()).not.toBeNull();
      expect(registry.getSkillRegistry()).not.toBeNull();
      expect(registry.getStateTracker()).not.toBeNull();
      expect(registry.getPluginLoader()).not.toBeNull();

      // Hooks from Phase A should still be registered
      expect(hookRegistry.has('confidence-check')).toBe(true);
      expect(hookRegistry.has('sandbox-escalation')).toBe(true);
      expect(hookRegistry.has('code-quality')).toBe(true);
    });

    it('should not initialize any Phase B modules when all Phase B flags are false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = makeBaseFlags();

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      // Registry should not even be initialized since no flags are true
      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // OrchestratorRunner with Phase B flags
  // ==========================================================================

  describe('OrchestratorRunner with Phase B flags', () => {
    it('should accept all Phase B flags in config', () => {
      const client = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: client,
        workspaceDir: tmpDir,
        enableMCP: true,
        enableLSP: true,
        enablePlugins: true,
        pluginsDir: 'custom-plugins',
        enablePlanningContext: true,
      });

      expect(runner).toBeDefined();
      expect(runner.currentStatus).toBe('idle');
    });

    it('should start and stop cleanly with all Phase B flags enabled', async () => {
      const client = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: client,
        workspaceDir: tmpDir,
        enableLLM: true,
        enableMCP: true,
        enableLSP: true,
        enablePlugins: true,
        enablePlanningContext: true,
      });

      await runner.start();
      expect(runner.currentStatus).toBe('running');

      await runner.stop();
      expect(runner.currentStatus).toBe('stopped');

      await runner.destroy();
    });

    it('should start with all Phase A + Phase B flags enabled', async () => {
      const client = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: client,
        workspaceDir: tmpDir,
        enableLLM: true,
        enableValidation: true,
        enableLearning: true,
        enableContextManagement: true,
        enableSecurity: true,
        enableSession: true,
        useRealQualityTools: true,
        enableMCP: true,
        enableLSP: true,
        enablePlugins: true,
        enablePlanningContext: true,
      });

      await runner.start();
      expect(runner.currentStatus).toBe('running');

      await runner.stop();
      expect(runner.currentStatus).toBe('stopped');

      await runner.destroy();
    });
  });

  // ==========================================================================
  // Graceful degradation
  // ==========================================================================

  describe('Graceful degradation', () => {
    it('should survive MCP init failure gracefully', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = { ...makeBaseFlags(), enableMCP: true, enableValidation: true };

      // Even with a bad path, initialization should not throw
      await initializeIntegrations(flags, hookRegistry, '/nonexistent-path', emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      // Validation hooks should still work
      expect(hookRegistry.count()).toBeGreaterThanOrEqual(1);
    });

    it('should handle enablePlugins with non-existent pluginsDir gracefully', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();
      const flags = {
        ...makeBaseFlags(),
        enablePlugins: true,
        pluginsDir: 'nonexistent-plugins-dir',
      };

      // Should not throw
      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      // Plugins should still initialize (discovery is deferred)
      expect(registry.getPluginLoader()).not.toBeNull();
    });
  });
});
