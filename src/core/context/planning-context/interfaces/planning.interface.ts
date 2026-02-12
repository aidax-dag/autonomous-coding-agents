/**
 * Planning Context Interfaces
 *
 * Defines contracts for file-system-based planning state persistence.
 *
 * @module core/context/planning-context/interfaces
 */

/**
 * Phase status
 */
export type PhaseStatus = 'pending' | 'active' | 'completed' | 'skipped';

/**
 * Phase definition
 */
export interface Phase {
  id: string;
  name: string;
  description: string;
  status: PhaseStatus;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Decision record
 */
export interface Decision {
  id: string;
  description: string;
  rationale: string;
  timestamp: number;
  phaseId?: string;
}

/**
 * Blocker record
 */
export interface Blocker {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  timestamp: number;
  phaseId?: string;
}

/**
 * Planning state (STATE.md content)
 */
export interface PlanningState {
  goal: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  currentPhaseId?: string;
  decisions: Decision[];
  blockers: Blocker[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Research snapshot
 */
export interface ResearchSnapshot {
  phaseId: string;
  timestamp: number;
  data: Record<string, unknown>;
  summary?: string;
}

/**
 * Context budget allocation
 */
export interface BudgetAllocation {
  planningTokens: number;
  executionTokens: number;
  totalTokens: number;
  planningRatio: number;
}

/**
 * Planning directory interface
 */
export interface IPlanningDirectory {
  initialize(basePath: string): Promise<void>;
  exists(): boolean;
  getBasePath(): string;
  clean(): Promise<void>;
}

/**
 * State tracker interface
 */
export interface IStateTracker {
  load(): Promise<PlanningState>;
  save(state: PlanningState): Promise<void>;
  addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Promise<Decision>;
  addBlocker(blocker: Omit<Blocker, 'id' | 'timestamp' | 'resolved'>): Promise<Blocker>;
  resolveBlocker(blockerId: string): Promise<void>;
}

/**
 * Phase manager interface
 */
export interface IPhaseManager {
  createPhase(phase: Omit<Phase, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Phase;
  getPhase(id: string): Phase | undefined;
  getCurrentPhase(): Phase | undefined;
  advancePhase(): Phase | undefined;
  skipPhase(id: string): void;
  completePhase(id: string): void;
  reorderPhases(ids: string[]): void;
  getAllPhases(): Phase[];
}

/**
 * Context budget interface
 */
export interface IContextBudget {
  setTotalBudget(tokens: number): void;
  getAllocation(): BudgetAllocation;
  consumePlanning(tokens: number): void;
  consumeExecution(tokens: number): void;
  isOverBudget(): boolean;
  getRemainingPlanning(): number;
  getRemainingExecution(): number;
}

/**
 * Research snapshot interface
 */
export interface IResearchSnapshot {
  save(snapshot: Omit<ResearchSnapshot, 'timestamp'>): Promise<void>;
  getByPhase(phaseId: string): Promise<ResearchSnapshot[]>;
  getAll(): Promise<ResearchSnapshot[]>;
  clean(phaseId?: string): Promise<void>;
}
