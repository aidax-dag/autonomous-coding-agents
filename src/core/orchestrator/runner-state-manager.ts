/**
 * Runner State Manager
 *
 * Extracted from OrchestratorRunner — manages execution state,
 * task results tracking, and statistics aggregation.
 *
 * @module core/orchestrator
 */

import type { CEOOrchestrator } from './ceo-orchestrator';

// Re-use types from orchestrator-runner
import { RunnerStatus, type WorkflowResult } from './orchestrator-runner';

// ============================================================================
// RunnerStateManager
// ============================================================================

export class RunnerStateManager {
  private status: RunnerStatus = RunnerStatus.IDLE;
  private startTime: Date | undefined;
  private readonly taskResults = new Map<string, WorkflowResult>();

  // =========================================================================
  // Status
  // =========================================================================

  getStatus(): RunnerStatus {
    return this.status;
  }

  setStatus(status: RunnerStatus): void {
    this.status = status;
  }

  isRunning(): boolean {
    return this.status === RunnerStatus.RUNNING;
  }

  // =========================================================================
  // Timing
  // =========================================================================

  markStarted(): void {
    this.startTime = new Date();
    this.status = RunnerStatus.RUNNING;
  }

  getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  // =========================================================================
  // Task Results
  // =========================================================================

  recordResult(taskId: string, result: WorkflowResult): void {
    this.taskResults.set(taskId, result);
  }

  getResult(taskId: string): WorkflowResult | undefined {
    return this.taskResults.get(taskId);
  }

  getAllResults(): Map<string, WorkflowResult> {
    return new Map(this.taskResults);
  }

  clearResults(): void {
    this.taskResults.clear();
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  getStats(orchestrator: CEOOrchestrator): {
    status: RunnerStatus;
    uptime: number;
    tasksExecuted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    orchestratorStats: ReturnType<CEOOrchestrator['getStats']>;
  } {
    const results = Array.from(this.taskResults.values());

    return {
      status: this.status,
      uptime: this.getUptime(),
      tasksExecuted: results.length,
      tasksSucceeded: results.filter((r) => r.success).length,
      tasksFailed: results.filter((r) => !r.success).length,
      orchestratorStats: orchestrator.getStats(),
    };
  }
}
