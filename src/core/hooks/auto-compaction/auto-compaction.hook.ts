/**
 * Auto Compaction Hook
 *
 * Provides automatic context compaction for conversation management.
 *
 * @module core/hooks/auto-compaction
 */

import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { IDisposable } from '../../di/interfaces/container.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';
import {
  CompactionStrategy,
  CompactionRequest,
  CompactionResult,
} from '../context-monitor/context-monitor.interface.js';
import {
  AutoCompactionConfig,
  CompactionMode,
  CompactionTrigger,
  CompactionMessage,
  MessageRole,
  MessagePriority,
  CompactionJob,
  CompactionJobResult,
  AutoCompactionMetrics,
  AutoCompactionEventData,
  ISummarizer,
  SummarizationRequest,
  SummarizationResult,
  MessageContext,
  IMessageCompactor,
  CompactionStartedCallback,
  CompactionCompletedCallback,
  CompactionFailedCallback,
  MessagesSummarizedCallback,
  AutoCompactionSubscription,
  DEFAULT_AUTO_COMPACTION_CONFIG,
  MODE_CONFIGS,
} from './auto-compaction.interface.js';

/**
 * Default summarizer (simple truncation-based)
 */
class DefaultSummarizer implements ISummarizer {
  isAvailable(): boolean {
    return true;
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const { messages, targetTokens } = request;
    const originalTokenCount = messages.reduce((sum, m) => sum + m.tokenCount, 0);

    if (messages.length === 0) {
      return {
        success: true,
        summary: '',
        tokenCount: 0,
        originalTokenCount: 0,
        summarizedMessageIds: [],
      };
    }

    // Simple summarization: extract key points from each message
    const summaryParts: string[] = [];
    let currentTokens = 0;
    const charsPerToken = 4;
    const summarizedIds: string[] = [];

    for (const message of messages) {
      // Create a brief summary of each message
      const briefContent = this.createBriefSummary(message.content, message.role);
      const briefTokens = Math.ceil(briefContent.length / charsPerToken);

      if (currentTokens + briefTokens <= targetTokens) {
        summaryParts.push(briefContent);
        currentTokens += briefTokens;
        summarizedIds.push(message.id);
      }
    }

    const summary = `[Summary of ${messages.length} messages]\n${summaryParts.join('\n')}`;
    const tokenCount = Math.ceil(summary.length / charsPerToken);

    return {
      success: true,
      summary,
      tokenCount,
      originalTokenCount,
      summarizedMessageIds: summarizedIds,
    };
  }

  private createBriefSummary(content: string, role: MessageRole): string {
    // Truncate to first 100 characters and add role prefix
    const maxLen = 100;
    const truncated = content.length > maxLen ? content.substring(0, maxLen) + '...' : content;
    return `- [${role}]: ${truncated.replace(/\n/g, ' ')}`;
  }
}

/**
 * Auto Compaction Hook
 *
 * Automatically compacts conversation context when thresholds are exceeded.
 * Implements IContextCompactor for integration with ContextMonitorHook.
 */
export class AutoCompactionHook
  extends BaseHook<unknown, AutoCompactionEventData>
  implements IMessageCompactor, IDisposable
{
  readonly name = 'auto-compaction';
  readonly description = 'Automatically compacts conversation context';
  readonly event = HookEvent.CONTEXT_OVERFLOW;

  private readonly mode: CompactionMode;
  private readonly defaultStrategy: CompactionStrategy;
  private readonly targetUsagePercentage: number;
  private readonly minMessagesToKeep: number;
  private readonly maxMessagesBeforeCompaction: number;
  private readonly autoCompactInterval: number;
  private readonly enableSummarization: boolean;
  private readonly charsPerToken: number;
  private readonly preserveSystemMessages: boolean;
  private readonly preserveRecentCount: number;
  private readonly verbose: boolean;

  private summarizer: ISummarizer;
  private messageContext: MessageContext;
  private autoCompactTimer?: ReturnType<typeof setInterval>;
  private jobCounter = 0;
  private subscriptionCounter = 0;

  private metrics: AutoCompactionMetrics = {
    totalCompactions: 0,
    successfulCompactions: 0,
    failedCompactions: 0,
    totalTokensFreed: 0,
    totalMessagesRemoved: 0,
    totalMessagesSummarized: 0,
    averageTokensFreed: 0,
    totalProcessingTimeMs: 0,
    compactionsByTrigger: {
      [CompactionTrigger.THRESHOLD]: 0,
      [CompactionTrigger.MANUAL]: 0,
      [CompactionTrigger.TIMER]: 0,
      [CompactionTrigger.MESSAGE_COUNT]: 0,
      [CompactionTrigger.PRE_OPERATION]: 0,
    },
    compactionsByStrategy: {
      [CompactionStrategy.REMOVE_OLDEST]: 0,
      [CompactionStrategy.SUMMARIZE]: 0,
      [CompactionStrategy.DEDUPLICATE]: 0,
      [CompactionStrategy.HYBRID]: 0,
    },
  };

  private subscriptions: Map<string, AutoCompactionSubscription> = new Map();
  private startedCallbacks: CompactionStartedCallback[] = [];
  private completedCallbacks: CompactionCompletedCallback[] = [];
  private failedCallbacks: CompactionFailedCallback[] = [];
  private summarizedCallbacks: MessagesSummarizedCallback[] = [];

  // Logger
  private readonly logger: ILogger;

  constructor(config?: AutoCompactionConfig) {
    super(config);

    this.logger = createLogger('AutoCompaction');

    // Apply mode-specific defaults first
    const modeConfig = MODE_CONFIGS[config?.mode ?? CompactionMode.BALANCED];
    const mergedConfig = {
      ...DEFAULT_AUTO_COMPACTION_CONFIG,
      ...modeConfig,
      ...config,
    };

    this.mode = mergedConfig.mode;
    this.defaultStrategy = mergedConfig.defaultStrategy;
    this.targetUsagePercentage = mergedConfig.targetUsagePercentage;
    this.minMessagesToKeep = mergedConfig.minMessagesToKeep;
    this.maxMessagesBeforeCompaction = mergedConfig.maxMessagesBeforeCompaction;
    this.autoCompactInterval = mergedConfig.autoCompactInterval;
    this.enableSummarization = mergedConfig.enableSummarization;
    this.charsPerToken = mergedConfig.charsPerToken;
    this.preserveSystemMessages = mergedConfig.preserveSystemMessages;
    this.preserveRecentCount = mergedConfig.preserveRecentCount;
    this.verbose = mergedConfig.verbose;

    this.summarizer = config?.summarizer ?? new DefaultSummarizer();

    // Initialize empty message context
    this.messageContext = {
      messages: [],
      totalTokens: 0,
      maxTokens: 128000, // Default
    };

    // Start auto-compact timer if enabled
    if (this.autoCompactInterval > 0) {
      this.startAutoCompactTimer();
    }
  }

  // === IContextCompactor Implementation ===

  /**
   * Compact context to free tokens
   */
  async compact(request: CompactionRequest): Promise<CompactionResult> {
    const job = this.createJob(CompactionTrigger.THRESHOLD, request.strategy, request.tokensToFree);

    try {
      this.notifyStarted(job);
      const result = await this.executeCompaction(job, request.strategy);
      job.result = result;
      job.completedAt = new Date();

      this.updateMetrics(job, result);

      if (result.success) {
        this.notifyCompleted(job, result);
      } else {
        this.notifyFailed(job, new Error(result.error ?? 'Compaction failed'));
      }

      return {
        success: result.success,
        tokensFreed: result.tokensFreed,
        newPercentage: this.calculateUsagePercentage(),
        strategyUsed: request.strategy,
        compactedContext: this.messageContext,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.notifyFailed(job, error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        tokensFreed: 0,
        newPercentage: this.calculateUsagePercentage(),
        strategyUsed: request.strategy,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if compaction is possible
   */
  canCompact(context: unknown): boolean {
    if (!context || typeof context !== 'object') {
      return this.messageContext.messages.length > this.minMessagesToKeep;
    }

    const ctx = context as MessageContext;
    if (ctx.messages) {
      return ctx.messages.length > this.minMessagesToKeep;
    }

    return this.messageContext.messages.length > this.minMessagesToKeep;
  }

  /**
   * Estimate tokens that can be freed
   */
  estimateFreeable(context: unknown): number {
    let messages: CompactionMessage[];

    if (context && typeof context === 'object' && 'messages' in context) {
      messages = (context as MessageContext).messages;
    } else {
      messages = this.messageContext.messages;
    }

    // Estimate freeable tokens based on compactable messages
    const compactable = this.getCompactableMessages(messages);
    const tokensInCompactable = compactable.reduce((sum, m) => sum + m.tokenCount, 0);

    // Estimate we can free about 70% of compactable tokens with summarization
    return Math.floor(tokensInCompactable * 0.7);
  }

  // === IMessageCompactor Implementation ===

  /**
   * Compact messages directly
   */
  async compactMessages(
    messages: CompactionMessage[],
    targetTokens: number,
    strategy: CompactionStrategy
  ): Promise<CompactionMessage[]> {
    const currentTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
    const tokensToFree = currentTokens - targetTokens;

    if (tokensToFree <= 0) {
      return messages; // Already under target
    }

    switch (strategy) {
      case CompactionStrategy.REMOVE_OLDEST:
        return this.removeOldestMessages(messages, tokensToFree);

      case CompactionStrategy.SUMMARIZE:
        return await this.summarizeMessages(messages, tokensToFree);

      case CompactionStrategy.DEDUPLICATE:
        return this.deduplicateMessages(messages);

      case CompactionStrategy.HYBRID:
      default:
        return await this.hybridCompaction(messages, tokensToFree);
    }
  }

  /**
   * Get current message context
   */
  getMessageContext(): MessageContext {
    return { ...this.messageContext };
  }

  /**
   * Set message context
   */
  setMessageContext(context: MessageContext): void {
    this.messageContext = { ...context };
    this.recalculateTotalTokens();
  }

  /**
   * Add message to context
   */
  addMessage(message: CompactionMessage): void {
    this.messageContext.messages.push(message);
    this.messageContext.totalTokens += message.tokenCount;

    // Check if compaction is needed due to message count
    if (this.messageContext.messages.length >= this.maxMessagesBeforeCompaction) {
      this.triggerAutoCompaction(CompactionTrigger.MESSAGE_COUNT);
    }
  }

  /**
   * Remove messages by IDs
   */
  removeMessages(messageIds: string[]): void {
    const idSet = new Set(messageIds);
    this.messageContext.messages = this.messageContext.messages.filter(
      (m) => !idSet.has(m.id)
    );
    this.recalculateTotalTokens();
  }

  // === Hook Execution ===

  /**
   * Execute hook - handle context overflow events
   */
  async execute(_context: HookContext<unknown>): Promise<HookResult<AutoCompactionEventData>> {
    const job = this.createJob(
      CompactionTrigger.THRESHOLD,
      this.defaultStrategy,
      this.calculateTokensToFree()
    );

    try {
      this.notifyStarted(job);
      const result = await this.executeCompaction(job, this.defaultStrategy);
      job.result = result;
      job.completedAt = new Date();

      this.updateMetrics(job, result);

      const eventData: AutoCompactionEventData = {
        job,
        metrics: this.getMetrics(),
      };

      if (result.success) {
        this.notifyCompleted(job, result);
        return this.modify(eventData, `Compacted: freed ${result.tokensFreed} tokens`);
      } else {
        this.notifyFailed(job, new Error(result.error ?? 'Compaction failed'));
        return this.continue(eventData, `Compaction failed: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.notifyFailed(job, error instanceof Error ? error : new Error(errorMessage));

      return this.continue(
        { job, metrics: this.getMetrics() },
        `Compaction error: ${errorMessage}`
      );
    }
  }

  // === Manual Compaction API ===

  /**
   * Trigger manual compaction
   */
  async triggerCompaction(strategy?: CompactionStrategy): Promise<CompactionJobResult> {
    const tokensToFree = this.calculateTokensToFree();
    const job = this.createJob(
      CompactionTrigger.MANUAL,
      strategy ?? this.defaultStrategy,
      tokensToFree
    );

    try {
      this.notifyStarted(job);
      const result = await this.executeCompaction(job, strategy ?? this.defaultStrategy);
      job.result = result;
      job.completedAt = new Date();

      this.updateMetrics(job, result);

      if (result.success) {
        this.notifyCompleted(job, result);
      } else {
        this.notifyFailed(job, new Error(result.error ?? 'Compaction failed'));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const failedResult: CompactionJobResult = {
        success: false,
        messagesAfter: this.messageContext.messages.length,
        tokensAfter: this.messageContext.totalTokens,
        tokensFreed: 0,
        messagesRemoved: 0,
        messagesSummarized: 0,
        processingTimeMs: Date.now() - job.startedAt.getTime(),
        error: errorMessage,
      };

      job.result = failedResult;
      this.notifyFailed(job, error instanceof Error ? error : new Error(errorMessage));

      return failedResult;
    }
  }

  // === Event Subscriptions ===

  /**
   * Subscribe to compaction started events
   */
  onCompactionStarted(callback: CompactionStartedCallback): AutoCompactionSubscription {
    this.startedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.startedCallbacks.indexOf(callback);
      if (index > -1) this.startedCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to compaction completed events
   */
  onCompactionCompleted(callback: CompactionCompletedCallback): AutoCompactionSubscription {
    this.completedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.completedCallbacks.indexOf(callback);
      if (index > -1) this.completedCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to compaction failed events
   */
  onCompactionFailed(callback: CompactionFailedCallback): AutoCompactionSubscription {
    this.failedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.failedCallbacks.indexOf(callback);
      if (index > -1) this.failedCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to messages summarized events
   */
  onMessagesSummarized(callback: MessagesSummarizedCallback): AutoCompactionSubscription {
    this.summarizedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.summarizedCallbacks.indexOf(callback);
      if (index > -1) this.summarizedCallbacks.splice(index, 1);
    });
  }

  // === Metrics & State ===

  /**
   * Get current metrics
   */
  getMetrics(): AutoCompactionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCompactions: 0,
      successfulCompactions: 0,
      failedCompactions: 0,
      totalTokensFreed: 0,
      totalMessagesRemoved: 0,
      totalMessagesSummarized: 0,
      averageTokensFreed: 0,
      totalProcessingTimeMs: 0,
      compactionsByTrigger: {
        [CompactionTrigger.THRESHOLD]: 0,
        [CompactionTrigger.MANUAL]: 0,
        [CompactionTrigger.TIMER]: 0,
        [CompactionTrigger.MESSAGE_COUNT]: 0,
        [CompactionTrigger.PRE_OPERATION]: 0,
      },
      compactionsByStrategy: {
        [CompactionStrategy.REMOVE_OLDEST]: 0,
        [CompactionStrategy.SUMMARIZE]: 0,
        [CompactionStrategy.DEDUPLICATE]: 0,
        [CompactionStrategy.HYBRID]: 0,
      },
    };
  }

  /**
   * Get compaction configuration
   */
  getCompactionConfig(): AutoCompactionConfig {
    return {
      mode: this.mode,
      defaultStrategy: this.defaultStrategy,
      targetUsagePercentage: this.targetUsagePercentage,
      minMessagesToKeep: this.minMessagesToKeep,
      maxMessagesBeforeCompaction: this.maxMessagesBeforeCompaction,
      autoCompactInterval: this.autoCompactInterval,
      enableSummarization: this.enableSummarization,
      charsPerToken: this.charsPerToken,
      preserveSystemMessages: this.preserveSystemMessages,
      preserveRecentCount: this.preserveRecentCount,
      verbose: this.verbose,
    };
  }

  /**
   * Set custom summarizer
   */
  setSummarizer(summarizer: ISummarizer): void {
    this.summarizer = summarizer;
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.messageContext.maxTokens = maxTokens;
  }

  // === Lifecycle ===

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopAutoCompactTimer();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.startedCallbacks = [];
    this.completedCallbacks = [];
    this.failedCallbacks = [];
    this.summarizedCallbacks = [];
  }

  // === Private Methods ===

  private createJob(
    trigger: CompactionTrigger,
    strategy: CompactionStrategy,
    targetTokensToFree: number
  ): CompactionJob {
    return {
      id: `compaction-${++this.jobCounter}`,
      trigger,
      strategy,
      messagesBefore: this.messageContext.messages.length,
      tokensBefore: this.messageContext.totalTokens,
      targetTokens: this.messageContext.totalTokens - targetTokensToFree,
      startedAt: new Date(),
    };
  }

  private async executeCompaction(
    job: CompactionJob,
    strategy: CompactionStrategy
  ): Promise<CompactionJobResult> {
    const startTime = Date.now();
    const messagesBefore = this.messageContext.messages.length;
    const tokensBefore = this.messageContext.totalTokens;

    try {
      const compactedMessages = await this.compactMessages(
        [...this.messageContext.messages],
        job.targetTokens,
        strategy
      );

      // Update message context
      this.messageContext.messages = compactedMessages;
      this.recalculateTotalTokens();

      const tokensAfter = this.messageContext.totalTokens;
      const messagesAfter = this.messageContext.messages.length;

      return {
        success: true,
        messagesAfter,
        tokensAfter,
        tokensFreed: tokensBefore - tokensAfter,
        messagesRemoved: messagesBefore - messagesAfter,
        messagesSummarized: this.countSummarizedMessages(compactedMessages, messagesBefore),
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        messagesAfter: messagesBefore,
        tokensAfter: tokensBefore,
        tokensFreed: 0,
        messagesRemoved: 0,
        messagesSummarized: 0,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async removeOldestMessages(
    messages: CompactionMessage[],
    tokensToFree: number
  ): Promise<CompactionMessage[]> {
    const result: CompactionMessage[] = [];
    const compactable = this.getCompactableMessages(messages);
    const preserved = messages.filter((m) => !compactable.includes(m));

    // Add preserved messages first
    result.push(...preserved);

    // Calculate how many compactable messages we can keep
    let remainingTokens = tokensToFree;
    const compactableToKeep: CompactionMessage[] = [];

    // Keep from newest to oldest
    for (let i = compactable.length - 1; i >= 0; i--) {
      const msg = compactable[i];
      if (result.length + compactableToKeep.length >= this.minMessagesToKeep) {
        break;
      }
      compactableToKeep.unshift(msg);
    }

    // Remove oldest until we've freed enough tokens
    const toRemove: CompactionMessage[] = [];
    for (const msg of compactable) {
      if (!compactableToKeep.includes(msg)) {
        toRemove.push(msg);
        remainingTokens -= msg.tokenCount;
        if (remainingTokens <= 0) break;
      }
    }

    // Add remaining compactable messages
    result.push(...compactable.filter((m) => !toRemove.includes(m)));

    // Sort by timestamp
    result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return result;
  }

  private async summarizeMessages(
    messages: CompactionMessage[],
    tokensToFree: number
  ): Promise<CompactionMessage[]> {
    if (!this.enableSummarization || !this.summarizer.isAvailable()) {
      return this.removeOldestMessages(messages, tokensToFree);
    }

    const compactable = this.getCompactableMessages(messages);
    const preserved = messages.filter((m) => !compactable.includes(m));

    if (compactable.length === 0) {
      return messages;
    }

    // Determine how many messages to summarize
    const messagesToSummarize: CompactionMessage[] = [];
    let tokensToSummarize = 0;

    for (const msg of compactable) {
      if (tokensToSummarize >= tokensToFree) break;
      messagesToSummarize.push(msg);
      tokensToSummarize += msg.tokenCount;
    }

    if (messagesToSummarize.length === 0) {
      return messages;
    }

    // Calculate target tokens for summary (aim for 20-30% of original)
    const targetSummaryTokens = Math.ceil(tokensToSummarize * 0.25);

    const request: SummarizationRequest = {
      messages: messagesToSummarize,
      targetTokens: targetSummaryTokens,
      preserveKeyInfo: true,
    };

    const summaryResult = await this.summarizer.summarize(request);

    if (!summaryResult.success) {
      return this.removeOldestMessages(messages, tokensToFree);
    }

    // Notify summarization
    this.notifySummarized(summaryResult);

    // Create summary message
    const summaryMessage: CompactionMessage = {
      id: `summary-${Date.now()}`,
      role: MessageRole.SYSTEM,
      content: summaryResult.summary,
      timestamp: new Date(),
      tokenCount: summaryResult.tokenCount,
      priority: MessagePriority.HIGH,
      isSummarized: true,
      originalMessageIds: summaryResult.summarizedMessageIds,
    };

    // Build result: preserved + summary + remaining compactable
    const result: CompactionMessage[] = [...preserved];
    result.push(summaryMessage);

    // Add compactable messages that weren't summarized
    const summarizedIds = new Set(summaryResult.summarizedMessageIds);
    result.push(...compactable.filter((m) => !summarizedIds.has(m.id)));

    // Sort by timestamp
    result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return result;
  }

  private deduplicateMessages(messages: CompactionMessage[]): CompactionMessage[] {
    const seen = new Map<string, CompactionMessage>();
    const result: CompactionMessage[] = [];

    for (const msg of messages) {
      // Create a content hash (simple version: first 100 chars)
      const contentKey = `${msg.role}:${msg.content.substring(0, 100)}`;

      if (!seen.has(contentKey)) {
        seen.set(contentKey, msg);
        result.push(msg);
      }
    }

    return result;
  }

  private async hybridCompaction(
    messages: CompactionMessage[],
    tokensToFree: number
  ): Promise<CompactionMessage[]> {
    // Step 1: Deduplicate first
    let result = this.deduplicateMessages(messages);
    let currentTokens = result.reduce((sum, m) => sum + m.tokenCount, 0);
    const originalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
    let freed = originalTokens - currentTokens;

    if (freed >= tokensToFree) {
      return result;
    }

    // Step 2: Summarize older messages
    const remainingToFree = tokensToFree - freed;
    result = await this.summarizeMessages(result, remainingToFree);
    currentTokens = result.reduce((sum, m) => sum + m.tokenCount, 0);
    freed = originalTokens - currentTokens;

    if (freed >= tokensToFree) {
      return result;
    }

    // Step 3: Remove oldest as last resort
    const finalRemainingToFree = tokensToFree - freed;
    return this.removeOldestMessages(result, finalRemainingToFree);
  }

  private getCompactableMessages(messages: CompactionMessage[]): CompactionMessage[] {
    const result: CompactionMessage[] = [];
    const recentCutoff = messages.length - this.preserveRecentCount;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Skip critical priority
      if (msg.priority === MessagePriority.CRITICAL) continue;

      // Skip system messages if configured
      if (this.preserveSystemMessages && msg.role === MessageRole.SYSTEM) continue;

      // Skip recent messages
      if (i >= recentCutoff) continue;

      result.push(msg);
    }

    return result;
  }

  private calculateTokensToFree(): number {
    const targetTokens = Math.floor(
      this.messageContext.maxTokens * this.targetUsagePercentage
    );
    return Math.max(0, this.messageContext.totalTokens - targetTokens);
  }

  private calculateUsagePercentage(): number {
    if (this.messageContext.maxTokens === 0) return 0;
    return (this.messageContext.totalTokens / this.messageContext.maxTokens) * 100;
  }

  private recalculateTotalTokens(): void {
    this.messageContext.totalTokens = this.messageContext.messages.reduce(
      (sum, m) => sum + m.tokenCount,
      0
    );
  }

  private countSummarizedMessages(
    newMessages: CompactionMessage[],
    _originalCount: number
  ): number {
    // Count messages that have isSummarized flag
    const summarized = newMessages.filter((m) => m.isSummarized && m.originalMessageIds);
    return summarized.reduce((sum, m) => sum + (m.originalMessageIds?.length ?? 0), 0);
  }

  private startAutoCompactTimer(): void {
    this.autoCompactTimer = setInterval(() => {
      this.triggerAutoCompaction(CompactionTrigger.TIMER);
    }, this.autoCompactInterval);
  }

  private stopAutoCompactTimer(): void {
    if (this.autoCompactTimer) {
      clearInterval(this.autoCompactTimer);
      this.autoCompactTimer = undefined;
    }
  }

  private async triggerAutoCompaction(trigger: CompactionTrigger): Promise<void> {
    // Only compact if we're over target
    const usagePercentage = this.calculateUsagePercentage();
    if (usagePercentage <= this.targetUsagePercentage * 100) {
      return;
    }

    const job = this.createJob(trigger, this.defaultStrategy, this.calculateTokensToFree());

    try {
      this.notifyStarted(job);
      const result = await this.executeCompaction(job, this.defaultStrategy);
      job.result = result;
      job.completedAt = new Date();

      this.updateMetrics(job, result);

      if (result.success) {
        this.notifyCompleted(job, result);
      } else {
        this.notifyFailed(job, new Error(result.error ?? 'Auto compaction failed'));
      }
    } catch (error) {
      this.notifyFailed(job, error instanceof Error ? error : new Error('Auto compaction failed'));
    }
  }

  private updateMetrics(job: CompactionJob, result: CompactionJobResult): void {
    this.metrics.totalCompactions++;
    this.metrics.compactionsByTrigger[job.trigger]++;
    this.metrics.compactionsByStrategy[job.strategy]++;
    this.metrics.totalProcessingTimeMs += result.processingTimeMs;

    if (result.success) {
      this.metrics.successfulCompactions++;
      this.metrics.totalTokensFreed += result.tokensFreed;
      this.metrics.totalMessagesRemoved += result.messagesRemoved;
      this.metrics.totalMessagesSummarized += result.messagesSummarized;
      this.metrics.lastCompactionAt = new Date();
    } else {
      this.metrics.failedCompactions++;
    }

    // Update average
    this.metrics.averageTokensFreed =
      this.metrics.successfulCompactions > 0
        ? this.metrics.totalTokensFreed / this.metrics.successfulCompactions
        : 0;
  }

  private notifyStarted(job: CompactionJob): void {
    this.startedCallbacks.forEach((cb) => {
      try {
        cb(job);
      } catch {
        // Ignore callback errors
      }
    });

    if (this.verbose) {
      this.log(`Compaction started: ${job.id}, trigger: ${job.trigger}`);
    }
  }

  private notifyCompleted(job: CompactionJob, result: CompactionJobResult): void {
    this.completedCallbacks.forEach((cb) => {
      try {
        cb(job, result);
      } catch {
        // Ignore callback errors
      }
    });

    if (this.verbose) {
      this.log(`Compaction completed: ${job.id}, freed ${result.tokensFreed} tokens`);
    }
  }

  private notifyFailed(job: CompactionJob, error: Error): void {
    this.failedCallbacks.forEach((cb) => {
      try {
        cb(job, error);
      } catch {
        // Ignore callback errors
      }
    });

    if (this.verbose) {
      this.log(`Compaction failed: ${job.id}, error: ${error.message}`);
    }
  }

  private notifySummarized(result: SummarizationResult): void {
    this.summarizedCallbacks.forEach((cb) => {
      try {
        cb(result);
      } catch {
        // Ignore callback errors
      }
    });

    if (this.verbose) {
      this.log(
        `Messages summarized: ${result.summarizedMessageIds.length}, tokens: ${result.originalTokenCount} -> ${result.tokenCount}`
      );
    }
  }

  private createSubscription(cleanup: () => void): AutoCompactionSubscription {
    const id = `auto-compaction-sub-${++this.subscriptionCounter}`;
    const subscription: AutoCompactionSubscription = {
      id,
      unsubscribe: () => {
        cleanup();
        this.subscriptions.delete(id);
      },
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  private log(message: string): void {
    if (this.verbose) {
      this.logger.debug(message);
    }
  }
}
