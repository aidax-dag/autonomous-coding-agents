/**
 * Context Monitor
 *
 * Monitors context usage and triggers events when thresholds are crossed.
 *
 * @module core/context/context-monitor
 */

import type {
  IContextMonitor,
  ContextMonitorConfig,
  TokenUsageStats,
  MonitorCallbacks,
} from './interfaces/context.interface.js';
import { QualityLevel } from './interfaces/quality-curve.interface.js';
import {
  DEFAULT_CONTEXT_CONFIG,
  CONTEXT_THRESHOLDS,
} from './constants/context.constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Previous state for comparison
 */
interface PreviousState {
  usagePercent: number;
  qualityLevel: QualityLevel;
  warningTriggered: boolean;
  criticalTriggered: boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * ContextMonitor
 *
 * Monitors context usage and triggers callbacks when thresholds are crossed.
 */
export class ContextMonitor implements IContextMonitor {
  private config: ContextMonitorConfig;
  private callbacks: MonitorCallbacks;
  private previousState: PreviousState;
  private isRunning: boolean = false;

  constructor(callbacks: MonitorCallbacks, config?: Partial<ContextMonitorConfig>) {
    this.config = {
      ...DEFAULT_CONTEXT_CONFIG.monitoring,
      ...config,
    };
    this.callbacks = callbacks;
    this.previousState = {
      usagePercent: 0,
      qualityLevel: QualityLevel.PEAK,
      warningTriggered: false,
      criticalTriggered: false,
    };
  }

  // ==========================================================================
  // Monitoring
  // ==========================================================================

  /**
   * Check context state and trigger events
   */
  check(stats: TokenUsageStats, level: QualityLevel): void {
    if (!this.config.enabled) return;

    // Check for warning threshold crossing
    if (
      stats.usagePercent >= CONTEXT_THRESHOLDS.warning &&
      !this.previousState.warningTriggered
    ) {
      this.previousState.warningTriggered = true;
      this.triggerWarning(stats);
    }

    // Check for critical threshold crossing
    if (
      stats.usagePercent >= CONTEXT_THRESHOLDS.critical &&
      !this.previousState.criticalTriggered
    ) {
      this.previousState.criticalTriggered = true;
      this.triggerCritical(stats);
    }

    // Check for quality degradation
    if (this.isQualityDegraded(this.previousState.qualityLevel, level)) {
      this.triggerQualityDegraded(level);
    }

    // Reset triggers if usage drops
    if (stats.usagePercent < CONTEXT_THRESHOLDS.warning) {
      this.previousState.warningTriggered = false;
    }
    if (stats.usagePercent < CONTEXT_THRESHOLDS.critical) {
      this.previousState.criticalTriggered = false;
    }

    // Update previous state
    this.previousState.usagePercent = stats.usagePercent;
    this.previousState.qualityLevel = level;

    this.log('debug', `Check: ${stats.usagePercent.toFixed(1)}%, Level: ${level}`);
  }

  /**
   * Start monitoring (no-op for manual checks)
   */
  start(): void {
    this.isRunning = true;
    this.log('info', 'Context monitor started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    this.log('info', 'Context monitor stopped');
  }

  /**
   * Check if monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Configure the monitor
   */
  configure(config: Partial<ContextMonitorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextMonitorConfig {
    return { ...this.config };
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<MonitorCallbacks>): void {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Trigger warning callback
   */
  private triggerWarning(stats: TokenUsageStats): void {
    this.log('warn', `Warning threshold reached: ${stats.usagePercent.toFixed(1)}%`);
    this.callbacks.onWarning?.(stats);
  }

  /**
   * Trigger critical callback
   */
  private triggerCritical(stats: TokenUsageStats): void {
    this.log('error', `Critical threshold reached: ${stats.usagePercent.toFixed(1)}%`);
    this.callbacks.onCritical?.(stats);
  }

  /**
   * Trigger quality degraded callback
   */
  private triggerQualityDegraded(level: QualityLevel): void {
    this.log('warn', `Quality degraded to: ${level}`);
    this.callbacks.onQualityDegraded?.(level);
  }

  /**
   * Check if quality has degraded
   */
  private isQualityDegraded(oldLevel: QualityLevel, newLevel: QualityLevel): boolean {
    const order = [QualityLevel.PEAK, QualityLevel.GOOD, QualityLevel.DEGRADING, QualityLevel.POOR];
    return order.indexOf(newLevel) > order.indexOf(oldLevel);
  }

  /**
   * Log message at configured level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      const prefix = '[ContextMonitor]';
      switch (level) {
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
          console.info(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'error':
          console.error(prefix, message);
          break;
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContextMonitor instance
 */
export function createContextMonitor(
  callbacks: MonitorCallbacks,
  config?: Partial<ContextMonitorConfig>
): ContextMonitor {
  return new ContextMonitor(callbacks, config);
}

// ============================================================================
// Default Export
// ============================================================================

export default ContextMonitor;
