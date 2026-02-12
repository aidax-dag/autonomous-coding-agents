/**
 * Hook Pipeline Integration Tests
 *
 * Tests the expanded hook pipeline with security, session, code quality,
 * and error-escalator → learning system wiring.
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
import { HookExecutor } from '../../src/core/hooks/hook-executor';
import { HookEvent } from '../../src/core/interfaces/hook.interface';
import { ServiceRegistry } from '../../src/core/services/service-registry';
import { ErrorEscalator } from '../../src/core/orchestrator/error-escalator';
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

// ============================================================================
// Tests
// ============================================================================

describe('Hook Pipeline Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hook-pipeline-'));
    // Reset ServiceRegistry between tests
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
  // T1: enableSecurity/enableSession flag propagation
  // ==========================================================================

  describe('enableSecurity flag propagation', () => {
    it('should initialize ServiceRegistry with security when enableSecurity is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: false,
        enableLearning: false,
        enableContextManagement: false,
        enableSecurity: true,
        enableSession: false,
        useRealQualityTools: false,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSandboxEscalation()).not.toBeNull();
    });

    it('should not initialize sandbox when enableSecurity is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: true,
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

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.getSandboxEscalation()).toBeNull();
    });
  });

  describe('enableSession flag propagation', () => {
    it('should initialize ServiceRegistry with session when enableSession is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: false,
        enableLearning: false,
        enableContextManagement: false,
        enableSecurity: false,
        enableSession: true,
        useRealQualityTools: false,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getSessionManager()).not.toBeNull();
    });
  });

  // ==========================================================================
  // T2: CodeQualityHook and SandboxEscalationHook registration
  // ==========================================================================

  describe('CodeQualityHook registration', () => {
    it('should register CodeQualityHook when useRealQualityTools is true', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: false,
        enableLearning: false,
        enableContextManagement: false,
        enableSecurity: false,
        enableSession: false,
        useRealQualityTools: true,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      expect(hookRegistry.has('code-quality')).toBe(true);
    });

    it('should not register CodeQualityHook when useRealQualityTools is false', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: true,
        enableLearning: true,
        enableContextManagement: false,
        enableSecurity: false,
        enableSession: false,
        useRealQualityTools: false,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      expect(hookRegistry.has('code-quality')).toBe(false);
    });
  });

  describe('SandboxEscalationHook registration', () => {
    it('should register SandboxEscalationHook when security and validation are both enabled', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: true,
        enableLearning: false,
        enableContextManagement: false,
        enableSecurity: true,
        enableSession: false,
        useRealQualityTools: false,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      expect(hookRegistry.has('sandbox-escalation')).toBe(true);
    });

    it('should not register SandboxEscalationHook when security is enabled but validation is not', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: false,
        enableLearning: false,
        enableContextManagement: false,
        enableSecurity: true,
        enableSession: false,
        useRealQualityTools: false,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      // SandboxEscalationHook needs ConfidenceChecker which requires enableValidation
      expect(hookRegistry.has('sandbox-escalation')).toBe(false);
    });
  });

  // ==========================================================================
  // T3: ErrorEscalator → learning system wiring
  // ==========================================================================

  describe('ErrorEscalator classification in TASK_ERROR context', () => {
    it('should classify errors and include classification in error events', () => {
      const escalator = new ErrorEscalator();

      // Timeout error → transient category
      const timeoutError = new Error('Operation timeout after 30s');
      const classification = escalator.classify(timeoutError, 'executeTask');
      expect(classification.category).toBe('transient');
      expect(classification.retryable).toBe(true);

      // System error → system category
      const systemError = new Error('ENOSPC: no space left on device');
      const sysClassification = escalator.classify(systemError, 'executeTask');
      expect(sysClassification.category).toBe('system');
      expect(sysClassification.retryable).toBe(false);
    });

    it('should pass classification to TASK_ERROR hooks', async () => {
      const hookRegistry = new HookRegistry();
      const hookExecutor = new HookExecutor(hookRegistry);
      const escalator = new ErrorEscalator();

      // Register a test hook to capture the context
      let capturedContext: unknown = null;
      const testHook = {
        name: 'test-capture',
        description: 'Captures hook context for testing',
        event: HookEvent.TASK_ERROR,
        priority: 100,
        execute: jest.fn().mockImplementation(async (context: unknown) => {
          capturedContext = context;
          return { action: 'continue' };
        }),
        shouldRun: () => true,
        enable: jest.fn(),
        disable: jest.fn(),
        isEnabled: () => true,
        getConfig: () => ({
          name: 'test-capture',
          event: HookEvent.TASK_ERROR,
          priority: 100,
        }),
      };

      hookRegistry.register(testHook);

      const error = new Error('rate limit exceeded');
      const classification = escalator.classify(error, 'executeTask');

      // Simulate what orchestrator-runner does
      await hookExecutor.executeHooks(
        HookEvent.TASK_ERROR,
        { task: { metadata: { id: 'test-1' } }, error, classification },
      );

      expect(testHook.execute).toHaveBeenCalledTimes(1);
      const ctx = capturedContext as { data: { classification: { category: string } } };
      expect(ctx.data.classification.category).toBe('transient');
    });
  });

  // ==========================================================================
  // Runner-level integration
  // ==========================================================================

  describe('OrchestratorRunner with new flags', () => {
    it('should accept enableSecurity and enableSession in config', () => {
      const client = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: client,
        workspaceDir: tmpDir,
        enableSecurity: true,
        enableSession: true,
        useRealQualityTools: true,
      });

      expect(runner).toBeDefined();
      expect(runner.currentStatus).toBe('idle');
    });

    it('should start and stop cleanly with security and session enabled', async () => {
      const client = makeMockClient();

      const runner = createOrchestratorRunner({
        llmClient: client,
        workspaceDir: tmpDir,
        enableLLM: true,
        enableValidation: true,
        enableSecurity: true,
        enableSession: true,
        useRealQualityTools: true,
      });

      await runner.start();
      expect(runner.currentStatus).toBe('running');

      await runner.stop();
      expect(runner.currentStatus).toBe('stopped');

      await runner.destroy();
    });

    it('should register all 6 hook types when all flags are enabled', async () => {
      const hookRegistry = new HookRegistry();
      const emitter = new EventEmitter();

      const flags: IntegrationFlags = {
        enableValidation: true,
        enableLearning: true,
        enableContextManagement: true,
        enableSecurity: true,
        enableSession: false,
        useRealQualityTools: true,
        enableMCP: false,
        enableLSP: false,
        enablePlugins: false,
        enablePlanningContext: false,
      };

      await initializeIntegrations(flags, hookRegistry, tmpDir, emitter);

      // Expected hooks: confidence-check, self-check, error-learning,
      // context-optimizer, sandbox-escalation, code-quality
      expect(hookRegistry.count()).toBeGreaterThanOrEqual(6);
      expect(hookRegistry.has('confidence-check')).toBe(true);
      expect(hookRegistry.has('self-check')).toBe(true);
      expect(hookRegistry.has('error-learning')).toBe(true);
      expect(hookRegistry.has('context-optimizer')).toBe(true);
      expect(hookRegistry.has('sandbox-escalation')).toBe(true);
      expect(hookRegistry.has('code-quality')).toBe(true);
    });
  });
});
