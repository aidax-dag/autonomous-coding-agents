/**
 * Auto Compaction Interfaces
 *
 * Provides automatic context compaction for conversation management.
 *
 * @module core/hooks/auto-compaction
 */

import { HookConfig } from '../../interfaces/hook.interface.js';
import {
  CompactionStrategy,
  IContextCompactor,
} from '../context-monitor/context-monitor.interface.js';

/**
 * Compaction trigger type
 */
export enum CompactionTrigger {
  /** Triggered by threshold crossing */
  THRESHOLD = 'threshold',
  /** Triggered manually */
  MANUAL = 'manual',
  /** Triggered by timer */
  TIMER = 'timer',
  /** Triggered by message count */
  MESSAGE_COUNT = 'message_count',
  /** Triggered before operation */
  PRE_OPERATION = 'pre_operation',
}

/**
 * Compaction mode
 */
export enum CompactionMode {
  /** Aggressive: Maximum compression, may lose detail */
  AGGRESSIVE = 'aggressive',
  /** Balanced: Good compression with reasonable detail retention */
  BALANCED = 'balanced',
  /** Conservative: Minimal compression, preserve maximum detail */
  CONSERVATIVE = 'conservative',
}

/**
 * Message role in conversation
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

/**
 * Message priority for compaction decisions
 */
export enum MessagePriority {
  /** Critical: Never compact */
  CRITICAL = 'critical',
  /** High: Compact only if necessary */
  HIGH = 'high',
  /** Normal: Standard compaction rules */
  NORMAL = 'normal',
  /** Low: Compact first */
  LOW = 'low',
}

/**
 * Conversation message for compaction
 */
export interface CompactionMessage {
  /** Message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Message timestamp */
  timestamp: Date;
  /** Estimated token count */
  tokenCount: number;
  /** Message priority */
  priority: MessagePriority;
  /** Whether message has been summarized */
  isSummarized: boolean;
  /** Original message ID (if this is a summary) */
  originalMessageIds?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summarization request
 */
export interface SummarizationRequest {
  /** Messages to summarize */
  messages: CompactionMessage[];
  /** Target token count */
  targetTokens: number;
  /** Preserve key information */
  preserveKeyInfo: boolean;
}

/**
 * Summarization result
 */
export interface SummarizationResult {
  /** Whether summarization was successful */
  success: boolean;
  /** Summarized content */
  summary: string;
  /** Token count after summarization */
  tokenCount: number;
  /** Original token count */
  originalTokenCount: number;
  /** IDs of messages that were summarized */
  summarizedMessageIds: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Summarizer interface for external summarization
 */
export interface ISummarizer {
  /**
   * Summarize messages
   */
  summarize(request: SummarizationRequest): Promise<SummarizationResult>;

  /**
   * Check if summarizer is available
   */
  isAvailable(): boolean;
}

/**
 * Auto compaction configuration
 */
export interface AutoCompactionConfig extends Partial<HookConfig> {
  /** Compaction mode (default: BALANCED) */
  mode?: CompactionMode;
  /** Default strategy (default: HYBRID) */
  defaultStrategy?: CompactionStrategy;
  /** Target usage percentage after compaction (default: 0.60) */
  targetUsagePercentage?: number;
  /** Minimum messages to keep (default: 10) */
  minMessagesToKeep?: number;
  /** Maximum messages before triggering compaction (default: 100) */
  maxMessagesBeforeCompaction?: number;
  /** Auto-compact interval in milliseconds (0 = disabled, default: 0) */
  autoCompactInterval?: number;
  /** Enable summarization (default: true) */
  enableSummarization?: boolean;
  /** Custom summarizer instance */
  summarizer?: ISummarizer;
  /** Characters per token estimate (default: 4) */
  charsPerToken?: number;
  /** Preserve system messages (default: true) */
  preserveSystemMessages?: boolean;
  /** Preserve recent messages count (default: 5) */
  preserveRecentCount?: number;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Compaction job
 */
export interface CompactionJob {
  /** Job ID */
  id: string;
  /** Trigger type */
  trigger: CompactionTrigger;
  /** Strategy to use */
  strategy: CompactionStrategy;
  /** Messages before compaction */
  messagesBefore: number;
  /** Tokens before compaction */
  tokensBefore: number;
  /** Target tokens */
  targetTokens: number;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Result */
  result?: CompactionJobResult;
}

/**
 * Compaction job result
 */
export interface CompactionJobResult {
  /** Whether job was successful */
  success: boolean;
  /** Messages after compaction */
  messagesAfter: number;
  /** Tokens after compaction */
  tokensAfter: number;
  /** Tokens freed */
  tokensFreed: number;
  /** Messages removed */
  messagesRemoved: number;
  /** Messages summarized */
  messagesSummarized: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Compaction metrics
 */
export interface AutoCompactionMetrics {
  /** Total compactions performed */
  totalCompactions: number;
  /** Successful compactions */
  successfulCompactions: number;
  /** Failed compactions */
  failedCompactions: number;
  /** Total tokens freed */
  totalTokensFreed: number;
  /** Total messages removed */
  totalMessagesRemoved: number;
  /** Total messages summarized */
  totalMessagesSummarized: number;
  /** Average tokens freed per compaction */
  averageTokensFreed: number;
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: number;
  /** Compactions by trigger */
  compactionsByTrigger: Record<CompactionTrigger, number>;
  /** Compactions by strategy */
  compactionsByStrategy: Record<CompactionStrategy, number>;
  /** Last compaction timestamp */
  lastCompactionAt?: Date;
}

/**
 * Auto compaction event data
 */
export interface AutoCompactionEventData {
  /** Compaction job */
  job: CompactionJob;
  /** Current metrics */
  metrics: AutoCompactionMetrics;
  /** Messages compacted */
  messagesCompacted?: CompactionMessage[];
}

/**
 * Compaction callback types
 */
export type CompactionStartedCallback = (job: CompactionJob) => void;
export type CompactionCompletedCallback = (job: CompactionJob, result: CompactionJobResult) => void;
export type CompactionFailedCallback = (job: CompactionJob, error: Error) => void;
export type MessagesSummarizedCallback = (summary: SummarizationResult) => void;

/**
 * Auto compaction subscription
 */
export interface AutoCompactionSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Message context for compaction
 */
export interface MessageContext {
  /** All messages */
  messages: CompactionMessage[];
  /** Total token count */
  totalTokens: number;
  /** Maximum tokens allowed */
  maxTokens: number;
}

/**
 * Extended context compactor with message support
 */
export interface IMessageCompactor extends IContextCompactor {
  /**
   * Compact messages directly
   */
  compactMessages(
    messages: CompactionMessage[],
    targetTokens: number,
    strategy: CompactionStrategy
  ): Promise<CompactionMessage[]>;

  /**
   * Get current message context
   */
  getMessageContext(): MessageContext;

  /**
   * Set message context
   */
  setMessageContext(context: MessageContext): void;

  /**
   * Add message to context
   */
  addMessage(message: CompactionMessage): void;

  /**
   * Remove messages by IDs
   */
  removeMessages(messageIds: string[]): void;
}

/**
 * Default configuration values
 */
export const DEFAULT_AUTO_COMPACTION_CONFIG: Required<
  Omit<
    AutoCompactionConfig,
    'summarizer' | 'name' | 'description' | 'event' | 'conditions'
  >
> = {
  priority: 80, // Run after context monitor (100), before token optimizer (90)
  enabled: true,
  timeout: 30000, // 30 seconds for summarization
  retryOnError: true,
  mode: CompactionMode.BALANCED,
  defaultStrategy: CompactionStrategy.HYBRID,
  targetUsagePercentage: 0.6,
  minMessagesToKeep: 10,
  maxMessagesBeforeCompaction: 100,
  autoCompactInterval: 0, // Disabled by default
  enableSummarization: true,
  charsPerToken: 4,
  preserveSystemMessages: true,
  preserveRecentCount: 5,
  verbose: false,
};

/**
 * Mode-specific configurations
 */
export const MODE_CONFIGS: Record<CompactionMode, Partial<AutoCompactionConfig>> = {
  [CompactionMode.AGGRESSIVE]: {
    targetUsagePercentage: 0.4,
    minMessagesToKeep: 5,
    preserveRecentCount: 3,
  },
  [CompactionMode.BALANCED]: {
    targetUsagePercentage: 0.6,
    minMessagesToKeep: 10,
    preserveRecentCount: 5,
  },
  [CompactionMode.CONSERVATIVE]: {
    targetUsagePercentage: 0.75,
    minMessagesToKeep: 20,
    preserveRecentCount: 10,
  },
};
