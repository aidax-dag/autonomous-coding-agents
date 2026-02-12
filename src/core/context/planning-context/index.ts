/**
 * Planning Context Module
 *
 * File-system-based planning state persistence.
 *
 * @module core/context/planning-context
 */

export type {
  PhaseStatus,
  Phase,
  Decision,
  Blocker,
  PlanningState,
  ResearchSnapshot,
  BudgetAllocation,
  IPlanningDirectory,
  IStateTracker,
  IPhaseManager,
  IContextBudget,
  IResearchSnapshot,
} from './interfaces/planning.interface';

export {
  PlanningDirectory,
  createPlanningDirectory,
} from './planning-directory';

export {
  StateTracker,
  createStateTracker,
} from './state-tracker';

export {
  PhaseManager,
  createPhaseManager,
} from './phase-manager';

export {
  ContextBudget,
  createContextBudget,
} from './context-budget';

export {
  ResearchSnapshotManager,
  createResearchSnapshot,
} from './research-snapshot';
