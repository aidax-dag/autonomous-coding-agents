/**
 * Phase Manager
 *
 * Manages phase lifecycle: pending → active → completed/skipped.
 *
 * @module core/context/planning-context/phase-manager
 */

import type { IPhaseManager, Phase } from './interfaces/planning.interface';

/**
 * Phase Manager
 *
 * Handles phase CRUD, ordering, and lifecycle transitions.
 */
export class PhaseManager implements IPhaseManager {
  private phases: Map<string, Phase> = new Map();
  private currentPhaseId: string | null = null;

  createPhase(
    input: Omit<Phase, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Phase {
    const phase: Phase = {
      ...input,
      id: `phase-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.phases.set(phase.id, phase);

    // Auto-set first phase as current
    if (this.phases.size === 1) {
      this.currentPhaseId = phase.id;
      phase.status = 'active';
    }
    return phase;
  }

  getPhase(id: string): Phase | undefined {
    return this.phases.get(id);
  }

  getCurrentPhase(): Phase | undefined {
    if (!this.currentPhaseId) return undefined;
    return this.phases.get(this.currentPhaseId);
  }

  advancePhase(): Phase | undefined {
    if (this.currentPhaseId) {
      const current = this.phases.get(this.currentPhaseId);
      if (current && current.status === 'active') {
        current.status = 'completed';
        current.updatedAt = Date.now();
      }
    }

    const sorted = this.getSortedPhases();
    const next = sorted.find((p) => p.status === 'pending');

    if (next) {
      next.status = 'active';
      next.updatedAt = Date.now();
      this.currentPhaseId = next.id;
      return next;
    }

    this.currentPhaseId = null;
    return undefined;
  }

  skipPhase(id: string): void {
    const phase = this.phases.get(id);
    if (!phase) return;
    phase.status = 'skipped';
    phase.updatedAt = Date.now();

    if (this.currentPhaseId === id) {
      this.advancePhase();
    }
  }

  completePhase(id: string): void {
    const phase = this.phases.get(id);
    if (!phase) return;
    phase.status = 'completed';
    phase.updatedAt = Date.now();

    if (this.currentPhaseId === id) {
      this.advancePhase();
    }
  }

  reorderPhases(ids: string[]): void {
    let order = 0;
    for (const id of ids) {
      const phase = this.phases.get(id);
      if (phase) {
        phase.order = order++;
        phase.updatedAt = Date.now();
      }
    }
  }

  getAllPhases(): Phase[] {
    return this.getSortedPhases();
  }

  private getSortedPhases(): Phase[] {
    return Array.from(this.phases.values()).sort((a, b) => a.order - b.order);
  }
}

/**
 * Create a phase manager
 */
export function createPhaseManager(): PhaseManager {
  return new PhaseManager();
}
