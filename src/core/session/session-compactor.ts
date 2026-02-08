/**
 * Session Compactor
 *
 * Schedules periodic compaction of JSONL session files to reclaim disk space.
 * Wraps JSONLStorageAdapter.compactAll() with configurable intervals and thresholds.
 *
 * @module core/session
 */

import { createLogger, ILogger } from '../services/logger.js';
import type { JSONLStorageAdapter } from './jsonl-storage-adapter.js';

// ============================================================================
// Types
// ============================================================================

export interface SessionCompactorConfig {
  /** Compaction interval in milliseconds (default: 1 hour) */
  interval: number;
  /** Minimum entries per file to trigger compaction (default: 50) */
  minEntriesThreshold: number;
  /** Whether to run compaction on start (default: false) */
  compactOnStart: boolean;
}

export interface CompactionReport {
  /** When compaction ran */
  timestamp: Date;
  /** Number of files compacted */
  filesCompacted: number;
  /** Total entries reduced */
  totalEntriesReduced: number;
  /** Duration in milliseconds */
  durationMs: number;
}

const DEFAULT_CONFIG: SessionCompactorConfig = {
  interval: 3600000, // 1 hour
  minEntriesThreshold: 50,
  compactOnStart: false,
};

// ============================================================================
// SessionCompactor
// ============================================================================

export class SessionCompactor {
  private readonly config: SessionCompactorConfig;
  private readonly adapter: JSONLStorageAdapter;
  private readonly logger: ILogger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastReport: CompactionReport | null = null;

  constructor(adapter: JSONLStorageAdapter, config?: Partial<SessionCompactorConfig>) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger('SessionCompactor');
  }

  /**
   * Start periodic compaction.
   */
  async start(): Promise<void> {
    if (this.timer) return; // Already running

    if (this.config.compactOnStart) {
      await this.runCompaction();
    }

    this.timer = setInterval(() => {
      this.runCompaction().catch((err) => {
        this.logger.error('Compaction failed', err);
      });
    }, this.config.interval);

    // Don't keep process alive just for compaction
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }

    this.logger.debug(`Started with interval=${this.config.interval}ms`);
  }

  /**
   * Stop periodic compaction.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.debug('Stopped');
    }
  }

  /**
   * Run compaction now.
   */
  async runCompaction(): Promise<CompactionReport> {
    const start = Date.now();

    const result = await this.adapter.compactAll();

    const report: CompactionReport = {
      timestamp: new Date(),
      filesCompacted: result.filesCompacted,
      totalEntriesReduced: result.totalEntriesReduced,
      durationMs: Date.now() - start,
    };

    this.lastReport = report;

    if (result.totalEntriesReduced > 0) {
      this.logger.debug(
        `Compacted ${result.filesCompacted} files, reduced ${result.totalEntriesReduced} entries in ${report.durationMs}ms`
      );
    }

    return report;
  }

  /**
   * Get the last compaction report.
   */
  getLastReport(): CompactionReport | null {
    return this.lastReport;
  }

  /**
   * Whether the compactor is running.
   */
  isRunning(): boolean {
    return this.timer !== null;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createSessionCompactor(
  adapter: JSONLStorageAdapter,
  config?: Partial<SessionCompactorConfig>,
): SessionCompactor {
  return new SessionCompactor(adapter, config);
}
