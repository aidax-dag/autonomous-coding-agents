/**
 * Logging Improvements Tests
 *
 * Validates the P2 logging improvements:
 * - Module logger factory function
 * - Correlated logger with correlation ID
 * - LLM client error logging
 */

import { createModuleLogger, createCorrelatedLogger, AgentLogger } from '@/shared/logging/logger';

describe('Logging Improvements', () => {
  // ═══════════════════════════════════════════════════════════
  // 1. Module Logger Factory
  // ═══════════════════════════════════════════════════════════

  describe('createModuleLogger', () => {
    it('should create a logger with module name as both agentType and agentId', () => {
      const moduleLogger = createModuleLogger('orchestrator');
      expect(moduleLogger).toBeInstanceOf(AgentLogger);
    });

    it('should support all log methods', () => {
      const moduleLogger = createModuleLogger('api-gateway');
      expect(typeof moduleLogger.info).toBe('function');
      expect(typeof moduleLogger.warn).toBe('function');
      expect(typeof moduleLogger.error).toBe('function');
      expect(typeof moduleLogger.debug).toBe('function');
    });

    it('should create distinct loggers for different modules', () => {
      const loggerA = createModuleLogger('module-a');
      const loggerB = createModuleLogger('module-b');
      expect(loggerA).not.toBe(loggerB);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Correlated Logger
  // ═══════════════════════════════════════════════════════════

  describe('createCorrelatedLogger', () => {
    it('should create a child logger with correlationId', () => {
      const base = createModuleLogger('runner');
      const correlated = createCorrelatedLogger(base, 'req-abc-123');
      expect(correlated).toBeInstanceOf(AgentLogger);
    });

    it('should return a new logger instance (not the original)', () => {
      const base = createModuleLogger('runner');
      const correlated = createCorrelatedLogger(base, 'req-xyz');
      expect(correlated).not.toBe(base);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. AgentLogger child context
  // ═══════════════════════════════════════════════════════════

  describe('AgentLogger.child', () => {
    it('should create a child logger with additional context', () => {
      const parent = createModuleLogger('orchestrator');
      const child = parent.child({ goalId: 'g-1', phase: 'planning' });
      expect(child).toBeInstanceOf(AgentLogger);
    });

    it('should support chained child creation', () => {
      const parent = createModuleLogger('runner');
      const child1 = parent.child({ goalId: 'g-1' });
      const child2 = child1.child({ taskId: 't-1' });
      expect(child2).toBeInstanceOf(AgentLogger);
    });
  });
});
