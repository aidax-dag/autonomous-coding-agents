/**
 * Todo Continuation Enforcer
 *
 * Tracks planned steps and enforces completion. Ensures no planned
 * work is left unfinished by tracking dependencies and status.
 *
 * @module core/deep-worker
 */

import type {
  ITodoContinuation,
  PlannedStep,
  TodoStatus,
} from './interfaces/deep-worker.interface';

/**
 * Default todo continuation enforcer implementation
 */
export class TodoContinuationEnforcer implements ITodoContinuation {
  private steps: PlannedStep[] = [];

  trackSteps(steps: PlannedStep[]): void {
    this.steps = steps.map((step) => ({ ...step }));
  }

  completeStep(stepId: string): void {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) {
      step.completed = true;
      step.error = undefined;
    }
  }

  failStep(stepId: string, error: string): void {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) {
      step.completed = false;
      step.error = error;
    }
  }

  getStatus(): TodoStatus {
    const total = this.steps.length;
    const completed = this.steps.filter((s) => s.completed).length;
    const failed = this.steps.filter((s) => s.error !== undefined).length;
    const remaining = total - completed;

    return {
      totalSteps: total,
      completedSteps: completed,
      failedSteps: failed,
      remainingSteps: remaining,
      allComplete: remaining === 0,
      incompleteStepIds: this.steps
        .filter((s) => !s.completed)
        .map((s) => s.id),
    };
  }

  getNextStep(): PlannedStep | null {
    for (const step of this.steps) {
      // Skip completed or permanently failed steps
      if (step.completed || step.error !== undefined) continue;

      // Check if all dependencies are resolved (completed or failed)
      const allDepsResolved = step.dependencies.every((depId) => {
        const dep = this.steps.find((s) => s.id === depId);
        return dep ? dep.completed : true; // unknown deps treated as resolved
      });

      // Also check no dependency has failed (blocked by upstream failure)
      const hasFailedDep = step.dependencies.some((depId) => {
        const dep = this.steps.find((s) => s.id === depId);
        return dep ? dep.error !== undefined && !dep.completed : false;
      });

      if (allDepsResolved && !hasFailedDep) {
        return step;
      }
    }

    return null;
  }

  reset(): void {
    this.steps = [];
  }
}

/**
 * Factory function
 */
export function createTodoContinuationEnforcer(): TodoContinuationEnforcer {
  return new TodoContinuationEnforcer();
}
