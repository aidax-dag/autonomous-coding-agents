/**
 * Loop Detector
 *
 * Detects infinite loops in agent task execution by tracking execution
 * signatures and identifying repeating patterns. Supports three detection
 * modes: same-task retries, task-sequence repetition, and state regression.
 *
 * @module core/orchestrator/loop-detector
 */

import { createAgentLogger } from '../../shared/logging/logger';

// ============================================================================
// Types
// ============================================================================

/** A single recorded execution entry */
export interface ExecutionEntry {
  taskId: string;
  operationType: string;
  timestamp: string;
  outputHash?: string;
}

/** Types of loops that can be detected */
export type LoopType = 'same-task' | 'task-sequence' | 'state-regression';

/** Result of a loop detection check */
export interface LoopDetectionResult {
  detected: boolean;
  loopType?: LoopType;
  details?: string;
  executionCount?: number;
  suggestedAction: 'continue' | 'warn' | 'block';
}

/** Global metrics about loop detection activity */
export interface LoopMetrics {
  totalExecutions: number;
  loopsDetected: number;
  blockedExecutions: number;
  uniqueTasks: number;
}

/** Configuration for the loop detector */
export interface LoopDetectorConfig {
  /** Max times the same task can execute within the time window before detection (default: 5) */
  maxSameTaskRetries?: number;
  /** Number of recent executions to scan for sequence patterns (default: 20) */
  sequenceWindowSize?: number;
  /** Time window in ms for same-task detection (default: 300000 = 5 min) */
  timeWindowMs?: number;
  /** How many sequence repeats before detection (default: 3) */
  maxSequenceRepeats?: number;
}

// ============================================================================
// Internal types
// ============================================================================

/** Resolved config with all defaults applied */
interface ResolvedLoopDetectorConfig {
  maxSameTaskRetries: number;
  sequenceWindowSize: number;
  timeWindowMs: number;
  maxSequenceRepeats: number;
}

// ============================================================================
// LoopDetector
// ============================================================================

const DEFAULT_CONFIG: ResolvedLoopDetectorConfig = {
  maxSameTaskRetries: 5,
  sequenceWindowSize: 20,
  timeWindowMs: 300000,
  maxSequenceRepeats: 3,
};

/**
 * Loop Detector
 *
 * Tracks task execution history using a circular buffer and provides
 * detection for three loop patterns: same-task retries, repeating
 * task sequences, and state regression.
 */
export class LoopDetector {
  private readonly config: ResolvedLoopDetectorConfig;
  private readonly logger;

  /** Circular buffer for execution history */
  private readonly buffer: (ExecutionEntry | null)[];
  private bufferIndex: number = 0;
  private bufferCount: number = 0;

  /** Metrics tracking */
  private totalExecutions: number = 0;
  private loopsDetected: number = 0;
  private blockedExecutions: number = 0;
  private readonly taskSet: Set<string> = new Set();

  constructor(config?: LoopDetectorConfig) {
    this.config = {
      maxSameTaskRetries: config?.maxSameTaskRetries ?? DEFAULT_CONFIG.maxSameTaskRetries,
      sequenceWindowSize: config?.sequenceWindowSize ?? DEFAULT_CONFIG.sequenceWindowSize,
      timeWindowMs: config?.timeWindowMs ?? DEFAULT_CONFIG.timeWindowMs,
      maxSequenceRepeats: config?.maxSequenceRepeats ?? DEFAULT_CONFIG.maxSequenceRepeats,
    };
    this.logger = createAgentLogger('LoopDetector');

    // Initialize circular buffer
    this.buffer = new Array(this.config.sequenceWindowSize).fill(null);
  }

  /**
   * Record a task execution in the circular buffer.
   */
  recordExecution(entry: ExecutionEntry): void {
    this.buffer[this.bufferIndex] = { ...entry };
    this.bufferIndex = (this.bufferIndex + 1) % this.buffer.length;
    if (this.bufferCount < this.buffer.length) {
      this.bufferCount++;
    }
    this.totalExecutions++;
    this.taskSet.add(this.getSignature(entry));

    this.logger.debug('Recorded execution', {
      taskId: entry.taskId,
      operationType: entry.operationType,
      totalExecutions: this.totalExecutions,
    });
  }

  /**
   * Check if a given task is in a detected loop.
   *
   * Runs all three detection checks in order of cost:
   * 1. Same-task detection (cheapest)
   * 2. State-regression detection
   * 3. Task-sequence detection (most expensive)
   */
  checkForLoop(taskId: string): LoopDetectionResult {
    const entries = this.getOrderedEntries();

    // 1. Same-task detection
    const sameTaskResult = this.checkSameTask(taskId, entries);
    if (sameTaskResult.detected) {
      this.recordDetection(sameTaskResult);
      return sameTaskResult;
    }

    // 2. State-regression detection
    const regressionResult = this.checkStateRegression(taskId, entries);
    if (regressionResult.detected) {
      this.recordDetection(regressionResult);
      return regressionResult;
    }

    // 3. Task-sequence detection
    const sequenceResult = this.checkTaskSequence(entries);
    if (sequenceResult.detected) {
      this.recordDetection(sequenceResult);
      return sequenceResult;
    }

    return { detected: false, suggestedAction: 'continue' };
  }

  /**
   * Return global loop detection metrics.
   */
  getMetrics(): LoopMetrics {
    return {
      totalExecutions: this.totalExecutions,
      loopsDetected: this.loopsDetected,
      blockedExecutions: this.blockedExecutions,
      uniqueTasks: this.taskSet.size,
    };
  }

  /**
   * Clear all execution history and metrics.
   */
  reset(): void {
    this.buffer.fill(null);
    this.bufferIndex = 0;
    this.bufferCount = 0;
    this.totalExecutions = 0;
    this.loopsDetected = 0;
    this.blockedExecutions = 0;
    this.taskSet.clear();

    this.logger.debug('Loop detector reset');
  }

  // ==========================================================================
  // Private — Detection methods
  // ==========================================================================

  /**
   * Detect same-task loop: the same task executed more than maxSameTaskRetries
   * times within the configured time window.
   */
  private checkSameTask(taskId: string, entries: ExecutionEntry[]): LoopDetectionResult {
    const now = Date.now();
    const windowStart = now - this.config.timeWindowMs;

    const matchingEntries = entries.filter(
      (e) => e.taskId === taskId && new Date(e.timestamp).getTime() >= windowStart,
    );

    const count = matchingEntries.length;

    if (count >= this.config.maxSameTaskRetries) {
      return {
        detected: true,
        loopType: 'same-task',
        details: `Task "${taskId}" executed ${count} times within ${this.config.timeWindowMs}ms window (threshold: ${this.config.maxSameTaskRetries})`,
        executionCount: count,
        suggestedAction: 'block',
      };
    }

    if (count >= this.config.maxSameTaskRetries - 1 && count > 0) {
      return {
        detected: true,
        loopType: 'same-task',
        details: `Task "${taskId}" approaching loop threshold: ${count}/${this.config.maxSameTaskRetries}`,
        executionCount: count,
        suggestedAction: 'warn',
      };
    }

    return { detected: false, suggestedAction: 'continue' };
  }

  /**
   * Detect task-sequence loop: a repeating pattern of task signatures
   * (e.g., A -> B -> C -> A -> B -> C).
   */
  private checkTaskSequence(entries: ExecutionEntry[]): LoopDetectionResult {
    if (entries.length < 4) {
      return { detected: false, suggestedAction: 'continue' };
    }

    const signatures = entries.map((e) => this.getSignature(e));

    // Try sequence lengths from 2 up to half the entries
    const maxSeqLen = Math.floor(signatures.length / 2);

    for (let seqLen = 2; seqLen <= maxSeqLen; seqLen++) {
      const repeats = this.countSequenceRepeats(signatures, seqLen);

      if (repeats >= this.config.maxSequenceRepeats) {
        const pattern = signatures.slice(signatures.length - seqLen).join(' -> ');
        return {
          detected: true,
          loopType: 'task-sequence',
          details: `Repeating sequence detected (${repeats} repeats, length ${seqLen}): ${pattern}`,
          executionCount: repeats * seqLen,
          suggestedAction: 'block',
        };
      }

      if (repeats >= this.config.maxSequenceRepeats - 1 && repeats >= 2) {
        const pattern = signatures.slice(signatures.length - seqLen).join(' -> ');
        return {
          detected: true,
          loopType: 'task-sequence',
          details: `Potential repeating sequence (${repeats} repeats, length ${seqLen}): ${pattern}`,
          executionCount: repeats * seqLen,
          suggestedAction: 'warn',
        };
      }
    }

    return { detected: false, suggestedAction: 'continue' };
  }

  /**
   * Detect state regression: a task's output hash matches a previous
   * output hash for the same task, indicating the system reverted.
   */
  private checkStateRegression(taskId: string, entries: ExecutionEntry[]): LoopDetectionResult {
    const taskEntries = entries.filter((e) => e.taskId === taskId && e.outputHash);

    if (taskEntries.length < 2) {
      return { detected: false, suggestedAction: 'continue' };
    }

    // Count how many times the same outputHash appears
    const hashCounts = new Map<string, number>();
    for (const entry of taskEntries) {
      if (entry.outputHash) {
        const count = (hashCounts.get(entry.outputHash) || 0) + 1;
        hashCounts.set(entry.outputHash, count);
      }
    }

    // Find the most repeated hash
    let maxHash = '';
    let maxCount = 0;
    for (const [hash, count] of hashCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxHash = hash;
      }
    }

    if (maxCount >= this.config.maxSequenceRepeats) {
      return {
        detected: true,
        loopType: 'state-regression',
        details: `Task "${taskId}" output reverted to previous state ${maxCount} times (hash: ${maxHash.substring(0, 8)}...)`,
        executionCount: maxCount,
        suggestedAction: 'block',
      };
    }

    if (maxCount >= this.config.maxSequenceRepeats - 1 && maxCount >= 2) {
      return {
        detected: true,
        loopType: 'state-regression',
        details: `Task "${taskId}" output approaching regression threshold: ${maxCount}/${this.config.maxSequenceRepeats}`,
        executionCount: maxCount,
        suggestedAction: 'warn',
      };
    }

    return { detected: false, suggestedAction: 'continue' };
  }

  // ==========================================================================
  // Private — Helpers
  // ==========================================================================

  /**
   * Build a signature string from an execution entry.
   */
  private getSignature(entry: ExecutionEntry): string {
    return `${entry.taskId}:${entry.operationType}`;
  }

  /**
   * Get entries from the circular buffer in chronological order.
   */
  private getOrderedEntries(): ExecutionEntry[] {
    const entries: ExecutionEntry[] = [];

    if (this.bufferCount < this.buffer.length) {
      // Buffer not yet full — entries are in order from 0
      for (let i = 0; i < this.bufferCount; i++) {
        const entry = this.buffer[i];
        if (entry) entries.push(entry);
      }
    } else {
      // Buffer is full — read from bufferIndex (oldest) forward
      for (let i = 0; i < this.buffer.length; i++) {
        const idx = (this.bufferIndex + i) % this.buffer.length;
        const entry = this.buffer[idx];
        if (entry) entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Count how many times the last `seqLen` signatures repeat
   * backwards through the signature list.
   */
  private countSequenceRepeats(signatures: string[], seqLen: number): number {
    if (signatures.length < seqLen) return 0;

    // Extract the candidate sequence from the end
    const candidate = signatures.slice(signatures.length - seqLen);
    let repeats = 1;

    // Walk backwards through signatures checking for repeats
    let pos = signatures.length - seqLen * 2;
    while (pos >= 0) {
      const segment = signatures.slice(pos, pos + seqLen);
      const matches = segment.every((sig, i) => sig === candidate[i]);

      if (matches) {
        repeats++;
        pos -= seqLen;
      } else {
        break;
      }
    }

    return repeats;
  }

  /**
   * Record a loop detection in metrics and log it.
   */
  private recordDetection(result: LoopDetectionResult): void {
    this.loopsDetected++;

    if (result.suggestedAction === 'block') {
      this.blockedExecutions++;
    }

    this.logger.warn('Loop detected', {
      loopType: result.loopType,
      action: result.suggestedAction,
      details: result.details,
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a loop detector with optional configuration.
 */
export function createLoopDetector(config?: LoopDetectorConfig): LoopDetector {
  return new LoopDetector(config);
}
