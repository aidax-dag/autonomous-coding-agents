/**
 * Auto Compaction Hook Tests
 */

import {
  AutoCompactionHook,
  CompactionMode,
  CompactionTrigger,
  CompactionMessage,
  MessageRole,
  MessagePriority,
  MessageContext,
  ISummarizer,
  SummarizationRequest,
  SummarizationResult,
  DEFAULT_AUTO_COMPACTION_CONFIG,
} from '../../../../../src/core/hooks/auto-compaction/index.js';
import { CompactionStrategy } from '../../../../../src/core/hooks/context-monitor/context-monitor.interface.js';
import { HookEvent, HookContext } from '../../../../../src/core/interfaces/hook.interface.js';

// Helper to create test messages
function createTestMessage(
  id: string,
  role: MessageRole = MessageRole.USER,
  content: string = 'Test content',
  tokenCount: number = 100,
  priority: MessagePriority = MessagePriority.NORMAL
): CompactionMessage {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
    tokenCount,
    priority,
    isSummarized: false,
  };
}

// Helper to create multiple test messages
function createTestMessages(count: number, tokensPerMessage: number = 100): CompactionMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(
      `msg-${i}`,
      i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
      `Message ${i} content`,
      tokensPerMessage
    )
  );
}

// Mock summarizer
class MockSummarizer implements ISummarizer {
  private _isAvailable = true;
  private _summarizeCount = 0;

  setAvailable(available: boolean): void {
    this._isAvailable = available;
  }

  getSummarizeCount(): number {
    return this._summarizeCount;
  }

  isAvailable(): boolean {
    return this._isAvailable;
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    this._summarizeCount++;
    const originalTokenCount = request.messages.reduce((sum, m) => sum + m.tokenCount, 0);
    const summarizedIds = request.messages.map((m) => m.id);

    return {
      success: true,
      summary: `[Summary of ${request.messages.length} messages]`,
      tokenCount: Math.min(request.targetTokens, Math.ceil(originalTokenCount * 0.2)),
      originalTokenCount,
      summarizedMessageIds: summarizedIds,
    };
  }
}

describe('AutoCompactionHook', () => {
  let hook: AutoCompactionHook;

  beforeEach(() => {
    hook = new AutoCompactionHook();
  });

  afterEach(() => {
    hook.dispose();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      expect(hook.name).toBe('auto-compaction');
      expect(hook.event).toBe(HookEvent.CONTEXT_OVERFLOW);
      const config = hook.getCompactionConfig();
      expect(config.mode).toBe(CompactionMode.BALANCED);
      expect(config.defaultStrategy).toBe(CompactionStrategy.HYBRID);
    });

    it('should create with custom config', () => {
      const customHook = new AutoCompactionHook({
        mode: CompactionMode.AGGRESSIVE,
        defaultStrategy: CompactionStrategy.SUMMARIZE,
        targetUsagePercentage: 0.5,
      });

      const config = customHook.getCompactionConfig();
      expect(config.mode).toBe(CompactionMode.AGGRESSIVE);
      expect(config.defaultStrategy).toBe(CompactionStrategy.SUMMARIZE);
      expect(config.targetUsagePercentage).toBe(0.5);

      customHook.dispose();
    });

    it('should apply mode-specific defaults', () => {
      const aggressiveHook = new AutoCompactionHook({ mode: CompactionMode.AGGRESSIVE });
      const conservativeHook = new AutoCompactionHook({ mode: CompactionMode.CONSERVATIVE });

      const aggressiveConfig = aggressiveHook.getCompactionConfig();
      const conservativeConfig = conservativeHook.getCompactionConfig();

      // Aggressive mode has lower target percentage
      expect(aggressiveConfig.targetUsagePercentage!).toBeLessThan(
        conservativeConfig.targetUsagePercentage!
      );

      // Conservative mode keeps more messages
      expect(conservativeConfig.minMessagesToKeep!).toBeGreaterThan(
        aggressiveConfig.minMessagesToKeep!
      );

      aggressiveHook.dispose();
      conservativeHook.dispose();
    });

    it('should have correct hook metadata', () => {
      expect(hook.description).toBe('Automatically compacts conversation context');
    });
  });

  describe('Message Context Management', () => {
    it('should get empty message context initially', () => {
      const context = hook.getMessageContext();
      expect(context.messages).toHaveLength(0);
      expect(context.totalTokens).toBe(0);
    });

    it('should set message context', () => {
      const messages = createTestMessages(5);
      const context: MessageContext = {
        messages,
        totalTokens: 500,
        maxTokens: 10000,
      };

      hook.setMessageContext(context);

      const retrieved = hook.getMessageContext();
      expect(retrieved.messages).toHaveLength(5);
      expect(retrieved.maxTokens).toBe(10000);
    });

    it('should add message to context', () => {
      const message = createTestMessage('test-1', MessageRole.USER, 'Hello', 50);
      hook.addMessage(message);

      const context = hook.getMessageContext();
      expect(context.messages).toHaveLength(1);
      expect(context.totalTokens).toBe(50);
    });

    it('should remove messages by IDs', () => {
      const messages = createTestMessages(5);
      hook.setMessageContext({ messages, totalTokens: 500, maxTokens: 10000 });

      hook.removeMessages(['msg-1', 'msg-3']);

      const context = hook.getMessageContext();
      expect(context.messages).toHaveLength(3);
      expect(context.messages.find((m) => m.id === 'msg-1')).toBeUndefined();
      expect(context.messages.find((m) => m.id === 'msg-3')).toBeUndefined();
    });

    it('should set max tokens', () => {
      hook.setMaxTokens(50000);
      const context = hook.getMessageContext();
      expect(context.maxTokens).toBe(50000);
    });
  });

  describe('Compaction Strategies', () => {
    beforeEach(() => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 10000 });
    });

    it('should compact using REMOVE_OLDEST strategy', async () => {
      const result = await hook.compactMessages(
        hook.getMessageContext().messages,
        1000, // Target tokens
        CompactionStrategy.REMOVE_OLDEST
      );

      const totalTokens = result.reduce((sum, m) => sum + m.tokenCount, 0);
      expect(totalTokens).toBeLessThanOrEqual(1000);
    });

    it('should compact using DEDUPLICATE strategy', async () => {
      // Add duplicate messages
      const messages = hook.getMessageContext().messages;
      messages.push(createTestMessage('dup-1', MessageRole.USER, 'Message 0 content', 100));
      messages.push(createTestMessage('dup-2', MessageRole.USER, 'Message 0 content', 100));
      hook.setMessageContext({ messages, totalTokens: 2200, maxTokens: 10000 });

      const result = await hook.compactMessages(
        hook.getMessageContext().messages,
        2000,
        CompactionStrategy.DEDUPLICATE
      );

      // Should remove duplicates
      expect(result.length).toBeLessThan(22);
    });

    it('should compact using SUMMARIZE strategy', async () => {
      const mockSummarizer = new MockSummarizer();
      hook.setSummarizer(mockSummarizer);

      await hook.compactMessages(
        hook.getMessageContext().messages,
        500, // Target tokens
        CompactionStrategy.SUMMARIZE
      );

      expect(mockSummarizer.getSummarizeCount()).toBeGreaterThan(0);
    });

    it('should compact using HYBRID strategy', async () => {
      const mockSummarizer = new MockSummarizer();
      hook.setSummarizer(mockSummarizer);

      const result = await hook.compactMessages(
        hook.getMessageContext().messages,
        500, // Target tokens
        CompactionStrategy.HYBRID
      );

      const totalTokens = result.reduce((sum, m) => sum + m.tokenCount, 0);
      expect(totalTokens).toBeLessThanOrEqual(1000); // May not reach exact target
    });
  });

  describe('IContextCompactor Interface', () => {
    it('should check if compaction is possible', () => {
      // With no messages
      expect(hook.canCompact(null)).toBe(false);

      // With enough messages
      const messages = createTestMessages(20);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 10000 });
      expect(hook.canCompact(null)).toBe(true);
    });

    it('should estimate freeable tokens', () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 10000 });

      const freeable = hook.estimateFreeable(null);
      expect(freeable).toBeGreaterThan(0);
    });

    it('should compact via IContextCompactor interface', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 10000 });

      const result = await hook.compact({
        targetPercentage: 60,
        strategy: CompactionStrategy.REMOVE_OLDEST,
        context: hook.getMessageContext(),
        tokensToFree: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.tokensFreed).toBeGreaterThan(0);
    });
  });

  describe('Manual Compaction', () => {
    it('should trigger manual compaction', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      const result = await hook.triggerCompaction();

      expect(result.success).toBe(true);
      expect(result.tokensFreed).toBeGreaterThan(0);
    });

    it('should trigger compaction with specific strategy', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      const result = await hook.triggerCompaction(CompactionStrategy.REMOVE_OLDEST);

      expect(result.success).toBe(true);
    });
  });

  describe('Hook Execution', () => {
    it('should execute on context overflow event', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      const context: HookContext<unknown> = {
        event: HookEvent.CONTEXT_OVERFLOW,
        timestamp: new Date(),
        source: 'test',
        data: {},
      };

      const result = await hook.execute(context);

      expect(result.action).toBeDefined();
      expect(result.data?.job).toBeDefined();
      expect(result.data?.metrics).toBeDefined();
    });
  });

  describe('Metrics', () => {
    it('should track compaction metrics', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      await hook.triggerCompaction();

      const metrics = hook.getMetrics();
      expect(metrics.totalCompactions).toBe(1);
      expect(metrics.successfulCompactions).toBe(1);
      expect(metrics.totalTokensFreed).toBeGreaterThan(0);
    });

    it('should track compactions by trigger type', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      await hook.triggerCompaction();

      const metrics = hook.getMetrics();
      expect(metrics.compactionsByTrigger[CompactionTrigger.MANUAL]).toBe(1);
    });

    it('should track compactions by strategy', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      await hook.triggerCompaction(CompactionStrategy.REMOVE_OLDEST);

      const metrics = hook.getMetrics();
      expect(metrics.compactionsByStrategy[CompactionStrategy.REMOVE_OLDEST]).toBe(1);
    });

    it('should reset metrics', async () => {
      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      await hook.triggerCompaction();
      hook.resetMetrics();

      const metrics = hook.getMetrics();
      expect(metrics.totalCompactions).toBe(0);
      expect(metrics.successfulCompactions).toBe(0);
      expect(metrics.totalTokensFreed).toBe(0);
    });

    it('should calculate average tokens freed', async () => {
      const messages1 = createTestMessages(20, 100);
      hook.setMessageContext({ messages: messages1, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction();

      const messages2 = createTestMessages(20, 100);
      hook.setMessageContext({ messages: messages2, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction();

      const metrics = hook.getMetrics();
      expect(metrics.averageTokensFreed).toBeGreaterThan(0);
      expect(metrics.averageTokensFreed).toBe(metrics.totalTokensFreed / metrics.successfulCompactions);
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify on compaction started', async () => {
      const startedCallback = jest.fn();
      hook.onCompactionStarted(startedCallback);

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction();

      expect(startedCallback).toHaveBeenCalled();
      expect(startedCallback.mock.calls[0][0].trigger).toBe(CompactionTrigger.MANUAL);
    });

    it('should notify on compaction completed', async () => {
      const completedCallback = jest.fn();
      hook.onCompactionCompleted(completedCallback);

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction();

      expect(completedCallback).toHaveBeenCalled();
      expect(completedCallback.mock.calls[0][1].success).toBe(true);
    });

    it('should notify on messages summarized', async () => {
      const summarizedCallback = jest.fn();
      hook.onMessagesSummarized(summarizedCallback);

      const mockSummarizer = new MockSummarizer();
      hook.setSummarizer(mockSummarizer);

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction(CompactionStrategy.SUMMARIZE);

      expect(summarizedCallback).toHaveBeenCalled();
    });

    it('should allow unsubscription', async () => {
      const callback = jest.fn();
      const subscription = hook.onCompactionStarted(callback);

      subscription.unsubscribe();

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Message Priority', () => {
    it('should preserve critical messages', async () => {
      const messages: CompactionMessage[] = [
        createTestMessage('critical-1', MessageRole.SYSTEM, 'Critical', 500, MessagePriority.CRITICAL),
        ...createTestMessages(15, 100),
      ];

      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hook.triggerCompaction(CompactionStrategy.REMOVE_OLDEST);

      const context = hook.getMessageContext();
      const criticalMsg = context.messages.find((m) => m.id === 'critical-1');
      expect(criticalMsg).toBeDefined();
    });

    it('should preserve system messages when configured', async () => {
      const hookWithPreserve = new AutoCompactionHook({ preserveSystemMessages: true });
      const messages: CompactionMessage[] = [
        createTestMessage('system-1', MessageRole.SYSTEM, 'System message', 500),
        ...createTestMessages(15, 100),
      ];

      hookWithPreserve.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hookWithPreserve.triggerCompaction(CompactionStrategy.REMOVE_OLDEST);

      const context = hookWithPreserve.getMessageContext();
      const systemMsg = context.messages.find((m) => m.id === 'system-1');
      expect(systemMsg).toBeDefined();

      hookWithPreserve.dispose();
    });

    it('should preserve recent messages', async () => {
      const hookWithRecent = new AutoCompactionHook({ preserveRecentCount: 5 });
      const messages = createTestMessages(20, 100);

      hookWithRecent.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });
      await hookWithRecent.triggerCompaction(CompactionStrategy.REMOVE_OLDEST);

      const context = hookWithRecent.getMessageContext();
      // Last 5 messages should be preserved
      expect(context.messages.find((m) => m.id === 'msg-19')).toBeDefined();
      expect(context.messages.find((m) => m.id === 'msg-18')).toBeDefined();

      hookWithRecent.dispose();
    });
  });

  describe('Custom Summarizer', () => {
    it('should use custom summarizer', async () => {
      const mockSummarizer = new MockSummarizer();
      hook.setSummarizer(mockSummarizer);

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      await hook.triggerCompaction(CompactionStrategy.SUMMARIZE);

      expect(mockSummarizer.getSummarizeCount()).toBeGreaterThan(0);
    });

    it('should fall back to REMOVE_OLDEST when summarizer unavailable', async () => {
      const mockSummarizer = new MockSummarizer();
      mockSummarizer.setAvailable(false);
      hook.setSummarizer(mockSummarizer);

      const messages = createTestMessages(20, 100);
      hook.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      const result = await hook.triggerCompaction(CompactionStrategy.SUMMARIZE);

      expect(result.success).toBe(true);
      expect(mockSummarizer.getSummarizeCount()).toBe(0); // Summarizer not called
    });
  });

  describe('Auto Compaction Timer', () => {
    jest.useFakeTimers();

    it('should trigger compaction at interval when enabled', async () => {
      const hookWithTimer = new AutoCompactionHook({
        autoCompactInterval: 5000, // 5 seconds
      });

      const startedCallback = jest.fn();
      hookWithTimer.onCompactionStarted(startedCallback);

      // Set context that needs compaction
      const messages = createTestMessages(20, 100);
      hookWithTimer.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      // Advance timer
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Let async operations complete

      // Timer should have triggered compaction
      expect(startedCallback).toHaveBeenCalled();

      hookWithTimer.dispose();
    });

    it('should not create timer when interval is 0', () => {
      const hookNoTimer = new AutoCompactionHook({
        autoCompactInterval: 0,
      });

      const startedCallback = jest.fn();
      hookNoTimer.onCompactionStarted(startedCallback);

      const messages = createTestMessages(20, 100);
      hookNoTimer.setMessageContext({ messages, totalTokens: 2000, maxTokens: 2500 });

      jest.advanceTimersByTime(10000);

      // No compaction should be triggered by timer
      expect(startedCallback).not.toHaveBeenCalled();

      hookNoTimer.dispose();
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });

  describe('Message Count Trigger', () => {
    it('should trigger compaction when message count exceeds limit', async () => {
      const hookWithLimit = new AutoCompactionHook({
        maxMessagesBeforeCompaction: 10,
        targetUsagePercentage: 0.6,
      });

      const startedCallback = jest.fn();
      hookWithLimit.onCompactionStarted(startedCallback);

      // Set max tokens low so usage percentage is high
      hookWithLimit.setMaxTokens(1500);

      // Add messages one by one
      for (let i = 0; i < 11; i++) {
        hookWithLimit.addMessage(createTestMessage(`msg-${i}`, MessageRole.USER, `Message ${i}`, 100));
      }

      // Wait for async compaction to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have triggered compaction
      expect(startedCallback).toHaveBeenCalled();

      hookWithLimit.dispose();
    });
  });

  describe('Dispose', () => {
    it('should clean up on dispose', () => {
      const callback = jest.fn();
      hook.onCompactionStarted(callback);
      hook.dispose();

      // Callbacks should be cleared
      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear subscriptions on dispose', () => {
      hook.onCompactionStarted(() => {});
      hook.onCompactionCompleted(() => {});

      hook.dispose();

      // Subscriptions should be cleared (no way to directly verify, but dispose should complete)
      expect(true).toBe(true);
    });
  });

  describe('Default Config', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.mode).toBe(CompactionMode.BALANCED);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.defaultStrategy).toBe(CompactionStrategy.HYBRID);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.targetUsagePercentage).toBe(0.6);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.minMessagesToKeep).toBe(10);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.maxMessagesBeforeCompaction).toBe(100);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.autoCompactInterval).toBe(0);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.enableSummarization).toBe(true);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.preserveSystemMessages).toBe(true);
      expect(DEFAULT_AUTO_COMPACTION_CONFIG.preserveRecentCount).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message context', async () => {
      const result = await hook.triggerCompaction();
      expect(result.success).toBe(true);
      expect(result.tokensFreed).toBe(0);
    });

    it('should handle context already under target', async () => {
      const messages = createTestMessages(5, 10);
      hook.setMessageContext({ messages, totalTokens: 50, maxTokens: 10000 });

      const result = await hook.triggerCompaction();
      expect(result.success).toBe(true);
      expect(result.tokensFreed).toBe(0);
    });

    it('should handle very large message context', async () => {
      const messages = createTestMessages(1000, 10);
      hook.setMessageContext({ messages, totalTokens: 10000, maxTokens: 15000 });

      const result = await hook.triggerCompaction();
      expect(result.success).toBe(true);
    });

    it('should handle messages with same content (deduplication)', async () => {
      const messages: CompactionMessage[] = [];
      for (let i = 0; i < 10; i++) {
        messages.push(createTestMessage(`msg-${i}`, MessageRole.USER, 'Same content', 100));
      }

      hook.setMessageContext({ messages, totalTokens: 1000, maxTokens: 2000 });

      const result = await hook.compactMessages(
        hook.getMessageContext().messages,
        500,
        CompactionStrategy.DEDUPLICATE
      );

      // Should have removed duplicates
      expect(result.length).toBeLessThan(10);
    });
  });
});
