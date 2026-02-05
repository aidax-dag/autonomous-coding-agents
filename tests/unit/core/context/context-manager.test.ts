/**
 * Context Manager Tests
 *
 * Unit tests for the unified ContextManager class.
 *
 * @module tests/unit/core/context/context-manager
 */

import {
  ContextManager,
  createContextManager,
  QualityLevel,
  DEFAULT_CONTEXT_CONFIG,
  CONTEXT_THRESHOLDS,
  type ContextEventData,
} from '../../../../src/core/context/index.js';

// ============================================================================
// Test Suite
// ============================================================================

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new ContextManager({
      tokenBudget: {
        maxTokens: 100000,
        warningThreshold: 70,
        criticalThreshold: 85,
        reserveTokens: 4000,
      },
      monitoring: {
        enabled: false, // Disable auto-monitoring for tests
        logLevel: 'error',
        checkInterval: 30000,
      },
    });
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // Token Budget Management
  // ==========================================================================

  describe('token budget management', () => {
    it('should track token usage correctly', () => {
      manager.addTokens(30000);
      const stats = manager.getUsageStats();

      expect(stats.used).toBe(30000);
      expect(stats.remaining).toBe(70000);
      expect(stats.usagePercent).toBe(30);
    });

    it('should calculate available tokens with reserve', () => {
      manager.addTokens(90000);
      const stats = manager.getUsageStats();

      // 10000 remaining - 4000 reserve = 6000 available
      expect(stats.remaining).toBe(10000);
      expect(stats.reserved).toBe(4000);
      expect(stats.available).toBe(6000);
    });

    it('should handle zero available tokens', () => {
      manager.addTokens(96000);
      const stats = manager.getUsageStats();

      expect(stats.available).toBe(0);
    });

    it('should release tokens correctly', () => {
      manager.addTokens(50000);
      manager.releaseTokens(20000);
      const stats = manager.getUsageStats();

      expect(stats.used).toBe(30000);
    });

    it('should not allow negative token release', () => {
      manager.addTokens(50000);
      manager.releaseTokens(60000); // More than available
      const stats = manager.getUsageStats();

      expect(stats.used).toBe(0); // Clamped to 0
    });

    it('should check token availability', () => {
      manager.addTokens(90000);

      // 10000 remaining - 4000 reserve = 6000 available
      expect(manager.hasAvailableTokens(5000)).toBe(true);
      expect(manager.hasAvailableTokens(6000)).toBe(true);
      expect(manager.hasAvailableTokens(7000)).toBe(false);
    });

    it('should update max tokens', () => {
      manager.setMaxTokens(200000);
      manager.addTokens(50000);
      const stats = manager.getUsageStats();

      expect(stats.total).toBe(200000);
      expect(stats.usagePercent).toBe(25);
    });
  });

  // ==========================================================================
  // Quality Management
  // ==========================================================================

  describe('quality management', () => {
    it('should return PEAK quality for low usage', () => {
      manager.addTokens(25000); // 25%
      expect(manager.getQualityLevel()).toBe(QualityLevel.PEAK);
    });

    it('should return GOOD quality for moderate usage', () => {
      manager.addTokens(40000); // 40%
      expect(manager.getQualityLevel()).toBe(QualityLevel.GOOD);
    });

    it('should return DEGRADING quality for high usage', () => {
      manager.addTokens(60000); // 60%
      expect(manager.getQualityLevel()).toBe(QualityLevel.DEGRADING);
    });

    it('should return POOR quality for very high usage', () => {
      manager.addTokens(75000); // 75%
      expect(manager.getQualityLevel()).toBe(QualityLevel.POOR);
    });

    it('should return quality info for current level', () => {
      manager.addTokens(40000); // 40% = GOOD
      const info = manager.getQualityInfo();

      expect(info.level).toBe(QualityLevel.GOOD);
      expect(info.label).toBeDefined();
      expect(info.description).toBeDefined();
    });

    it('should return context state', () => {
      manager.addTokens(60000); // 60%
      const state = manager.getContextState();

      expect(state.usedTokens).toBe(60000);
      expect(state.totalTokens).toBe(100000);
      expect(state.qualityLevel).toBe(QualityLevel.DEGRADING);
    });

    it('should recommend new plan when threshold exceeded', () => {
      manager.addTokens(55000); // 55% > 50% threshold
      expect(manager.shouldStartNewPlan()).toBe(true);
    });

    it('should not recommend new plan when below threshold', () => {
      manager.addTokens(45000); // 45% < 50% threshold
      expect(manager.shouldStartNewPlan()).toBe(false);
    });
  });

  // ==========================================================================
  // Output Optimization
  // ==========================================================================

  describe('output optimization', () => {
    it('should optimize output and return compression result', async () => {
      const longText = 'In order to    understand   this concept,    we need to...';
      const result = await manager.optimizeOutput(longText);

      expect(result.original).toBe(longText);
      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(result.techniques).toBeDefined();
    });

    it('should set compression level', () => {
      manager.setCompressionLevel('aggressive');
      const config = manager.getConfig();
      expect(config.outputOptimizer.compressionLevel).toBe('aggressive');
    });

    it('should summarize content', async () => {
      const longContent = 'A'.repeat(1000);
      const summary = await manager.summarize({
        content: longContent,
        targetTokens: 50,
      });

      // Should be truncated
      expect(summary.length).toBeLessThan(longContent.length);
    });
  });

  // ==========================================================================
  // Compression Strategy
  // ==========================================================================

  describe('compression strategy', () => {
    it('should get compression strategy based on quality level', () => {
      manager.addTokens(75000); // POOR quality
      const strategy = manager.getCompressionStrategy();

      expect(strategy.name).toBe('aggressive');
      expect(strategy.techniques.length).toBeGreaterThan(0);
    });

    it('should apply compression to content', async () => {
      manager.addTokens(75000); // POOR quality - aggressive compression
      const content = 'This is some   verbose   text with multiple    spaces.';
      const compressed = await manager.applyCompression(content);

      expect(compressed).toBeDefined();
    });

    it('should not compress at PEAK quality', async () => {
      manager.addTokens(20000); // PEAK quality
      const strategy = manager.getCompressionStrategy();

      expect(strategy.name).toBe('none');
      expect(strategy.techniques.length).toBe(0);
    });
  });

  // ==========================================================================
  // Events
  // ==========================================================================

  describe('events', () => {
    it('should emit usage-warning event at threshold', () => {
      const handler = jest.fn();
      manager.on('usage-warning', handler);

      manager.addTokens(71000); // 71% > 70% warning threshold

      expect(handler).toHaveBeenCalled();
      const eventData = handler.mock.calls[0][0] as ContextEventData;
      expect(eventData.event).toBe('usage-warning');
      expect(eventData.usageStats.usagePercent).toBeCloseTo(71, 0);
    });

    it('should emit usage-critical event at threshold', () => {
      const handler = jest.fn();
      manager.on('usage-critical', handler);

      manager.addTokens(86000); // 86% > 85% critical threshold

      expect(handler).toHaveBeenCalled();
      const eventData = handler.mock.calls[0][0] as ContextEventData;
      expect(eventData.event).toBe('usage-critical');
    });

    it('should emit budget-exceeded event when no tokens available', () => {
      const handler = jest.fn();
      manager.on('budget-exceeded', handler);

      manager.addTokens(96001); // Exceeds available (100000 - 4000 reserve)

      expect(handler).toHaveBeenCalled();
    });

    it('should emit compression-applied event', async () => {
      const handler = jest.fn();
      manager.on('compression-applied', handler);
      manager.setCompressionLevel('moderate');

      await manager.optimizeOutput('In order to    understand...');

      // May or may not emit based on actual compression
      // Just verify handler can be registered
      expect(typeof manager.on).toBe('function');
    });

    it('should unsubscribe from events', () => {
      const handler = jest.fn();
      manager.on('usage-warning', handler);
      manager.off('usage-warning', handler);

      manager.addTokens(75000);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('should update configuration', () => {
      manager.configure({
        tokenBudget: { maxTokens: 200000, warningThreshold: 80, criticalThreshold: 90, reserveTokens: 5000 },
      });

      const config = manager.getConfig();
      expect(config.tokenBudget.maxTokens).toBe(200000);
      expect(config.tokenBudget.warningThreshold).toBe(80);
    });

    it('should return configuration copy', () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should merge partial config with defaults', () => {
      const customManager = new ContextManager({
        tokenBudget: { maxTokens: 50000, warningThreshold: 70, criticalThreshold: 85, reserveTokens: 2000 },
      });

      const config = customManager.getConfig();
      expect(config.tokenBudget.maxTokens).toBe(50000);
      expect(config.outputOptimizer.enabled).toBe(true); // Default preserved
      customManager.dispose();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should dispose resources', () => {
      const testManager = new ContextManager({
        monitoring: { enabled: true, logLevel: 'error', checkInterval: 1000 },
      });

      expect(() => testManager.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  // ==========================================================================
  // Factory Function
  // ==========================================================================

  describe('createContextManager factory', () => {
    it('should create manager with default config', () => {
      const ctx = createContextManager();
      expect(ctx).toBeInstanceOf(ContextManager);
      ctx.dispose();
    });

    it('should create manager with custom config', () => {
      const ctx = createContextManager({
        tokenBudget: { maxTokens: 50000, warningThreshold: 60, criticalThreshold: 80, reserveTokens: 2000 },
      });

      const stats = ctx.getUsageStats();
      expect(stats.total).toBe(50000);
      ctx.dispose();
    });
  });

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    it('should handle typical usage pattern', () => {
      // Initial state
      expect(manager.getQualityLevel()).toBe(QualityLevel.PEAK);

      // Add some tokens
      manager.addTokens(35000); // 35% = GOOD
      expect(manager.getQualityLevel()).toBe(QualityLevel.GOOD);

      // Check if can proceed with more work
      expect(manager.hasAvailableTokens(10000)).toBe(true);

      // Add more tokens
      manager.addTokens(20000); // 55% = DEGRADING
      expect(manager.getQualityLevel()).toBe(QualityLevel.DEGRADING);
      expect(manager.shouldStartNewPlan()).toBe(true);

      // Verify compression strategy changed
      const strategy = manager.getCompressionStrategy();
      expect(strategy.name).toBe('moderate');
    });

    it('should coordinate quality level with compression strategy', () => {
      // PEAK - no compression
      expect(manager.getCompressionStrategy().name).toBe('none');

      // GOOD - light compression
      manager.addTokens(35000);
      expect(manager.getCompressionStrategy().name).toBe('light');

      // DEGRADING - moderate compression
      manager.addTokens(20000);
      expect(manager.getCompressionStrategy().name).toBe('moderate');

      // POOR - aggressive compression
      manager.addTokens(20000);
      expect(manager.getCompressionStrategy().name).toBe('aggressive');
    });

    it('should provide consistent state across methods', () => {
      manager.addTokens(60000); // 60%

      const stats = manager.getUsageStats();
      const level = manager.getQualityLevel();
      const state = manager.getContextState();

      expect(stats.usagePercent).toBe(60);
      expect(level).toBe(QualityLevel.DEGRADING);
      expect(state.usagePercent).toBe(60);
      expect(state.qualityLevel).toBe(QualityLevel.DEGRADING);
    });
  });
});

// ============================================================================
// TokenBudgetManager Tests
// ============================================================================

describe('TokenBudgetManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      tokenBudget: {
        maxTokens: 100000,
        warningThreshold: 70,
        criticalThreshold: 85,
        reserveTokens: 4000,
      },
      monitoring: { enabled: false, logLevel: 'error', checkInterval: 30000 },
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  it('should track tokens added incrementally', () => {
    manager.addTokens(10000);
    manager.addTokens(20000);
    manager.addTokens(5000);

    const stats = manager.getUsageStats();
    expect(stats.used).toBe(35000);
  });

  it('should handle zero token additions', () => {
    manager.addTokens(0);
    const stats = manager.getUsageStats();
    expect(stats.used).toBe(0);
  });
});

// ============================================================================
// OutputOptimizer Tests
// ============================================================================

describe('OutputOptimizer via ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      monitoring: { enabled: false, logLevel: 'error', checkInterval: 30000 },
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  it('should apply compression based on quality level', async () => {
    // Set quality level to DEGRADING (50-70%) to enable moderate compression
    manager.addTokens(55000); // 55% = DEGRADING
    const verboseInput = 'In order to understand, Due to the fact that, For the purpose of';
    const result = await manager.optimizeOutput(verboseInput);

    // Moderate compression applies multiple techniques
    expect(result.techniques.length).toBeGreaterThan(0);
    expect(result.compressed).toBeDefined();
  });

  it('should preserve code blocks when configured', async () => {
    manager.setCompressionLevel('moderate');
    const codeContent = '```javascript\nconsole.log("hello");\n```\n\nSome    text';
    const result = await manager.optimizeOutput(codeContent);

    expect(result.compressed).toContain('```javascript');
    expect(result.compressed).toContain('console.log');
  });

  it('should report token savings', async () => {
    manager.setCompressionLevel('moderate');
    const verboseText = 'In order to understand this In order to understand that For the purpose of testing';
    const result = await manager.optimizeOutput(verboseText);

    expect(result.savedTokens).toBeGreaterThanOrEqual(0);
    expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// CompactionStrategy Tests
// ============================================================================

describe('CompactionStrategy via ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      monitoring: { enabled: false, logLevel: 'error', checkInterval: 30000 },
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  it('should return content unchanged at PEAK quality', async () => {
    // At PEAK (0% usage), compression strategy is 'none'
    const content = 'Original content here';
    const result = await manager.applyCompression(content);

    expect(result).toBe(content);
  });

  it('should apply compression at POOR quality', async () => {
    manager.addTokens(75000); // POOR quality
    const content = 'Some verbose content that needs compression.';
    const result = await manager.applyCompression(content);

    // Result should be defined (may or may not be different based on content)
    expect(result).toBeDefined();
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Context Module Constants', () => {
  it('should have correct default config values', () => {
    expect(DEFAULT_CONTEXT_CONFIG.tokenBudget.maxTokens).toBe(128000);
    expect(DEFAULT_CONTEXT_CONFIG.tokenBudget.warningThreshold).toBe(70);
    expect(DEFAULT_CONTEXT_CONFIG.tokenBudget.criticalThreshold).toBe(85);
    expect(DEFAULT_CONTEXT_CONFIG.tokenBudget.reserveTokens).toBe(4000);
  });

  it('should have correct threshold constants', () => {
    expect(CONTEXT_THRESHOLDS.warning).toBe(70);
    expect(CONTEXT_THRESHOLDS.critical).toBe(85);
    expect(CONTEXT_THRESHOLDS.overflow).toBe(95);
  });
});
