/**
 * Project Store Module
 *
 * Provides persistent storage for project state across sessions.
 * Enables autonomous agents to maintain context, track progress,
 * and resume work seamlessly.
 *
 * Key Features:
 * - Project state persistence (JSON/filesystem)
 * - Cross-session context retention
 * - Checkpoint/rollback capability
 * - Progress tracking
 * - Memory management
 *
 * @module core/memory/project-store
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createLogger, ILogger } from '../services/logger.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Project status
 */
export enum ProjectStatus {
  CREATED = 'created',
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  BLOCKED = 'blocked',
  REVIEW = 'review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task status within a project
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  BLOCKED = 'blocked',
}

/**
 * Task record stored in project
 */
export interface TaskRecord {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignedAgent?: string;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  attempts: number;
  dependencies: string[];
  metadata: Record<string, unknown>;
}

/**
 * Checkpoint for project state
 */
export interface ProjectCheckpoint {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: Date;
  state: ProjectState;
  metadata: Record<string, unknown>;
}

/**
 * Project context that persists across sessions
 */
export interface ProjectContext {
  /** Current phase/milestone */
  currentPhase: string;
  /** Active goals */
  activeGoals: string[];
  /** Completed milestones */
  completedMilestones: string[];
  /** Important decisions made */
  decisions: Array<{
    timestamp: Date;
    decision: string;
    rationale: string;
    alternatives?: string[];
  }>;
  /** Learned patterns/insights */
  insights: Array<{
    timestamp: Date;
    insight: string;
    source: string;
  }>;
  /** Known issues/blockers */
  blockers: Array<{
    id: string;
    description: string;
    createdAt: Date;
    resolvedAt?: Date;
    resolution?: string;
  }>;
  /** Custom key-value storage */
  custom: Record<string, unknown>;
}

/**
 * Project state
 */
export interface ProjectState {
  /** Project ID */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Current status */
  status: ProjectStatus;
  /** PRD document (if any) */
  prd?: string;
  /** Tasks in this project */
  tasks: Map<string, TaskRecord>;
  /** Execution order */
  executionOrder: string[];
  /** Current task index */
  currentTaskIndex: number;
  /** Project context */
  context: ProjectContext;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Project version (increments on each save) */
  version: number;
  /** Associated session IDs */
  sessionIds: string[];
  /** Project metadata */
  metadata: Record<string, unknown>;
}

/**
 * Storage backend interface
 */
export interface IProjectStorageAdapter {
  /** Initialize storage */
  initialize(): Promise<void>;
  /** Save project state */
  save(projectId: string, state: ProjectState): Promise<void>;
  /** Load project state */
  load(projectId: string): Promise<ProjectState | null>;
  /** Delete project */
  delete(projectId: string): Promise<boolean>;
  /** List all project IDs */
  list(): Promise<string[]>;
  /** Check if project exists */
  exists(projectId: string): Promise<boolean>;
  /** Save checkpoint */
  saveCheckpoint(checkpoint: ProjectCheckpoint): Promise<void>;
  /** List checkpoints */
  listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]>;
  /** Load checkpoint */
  loadCheckpoint(checkpointId: string): Promise<ProjectCheckpoint | null>;
  /** Delete checkpoint */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;
  /** Cleanup old data */
  cleanup(olderThan: Date): Promise<number>;
}

/**
 * Project Store configuration
 */
export interface ProjectStoreConfig {
  /** Storage path for filesystem backend */
  storagePath: string;
  /** Auto-save interval in milliseconds (0 = disabled) */
  autoSaveInterval: number;
  /** Maximum checkpoints per project */
  maxCheckpoints: number;
  /** Enable compression */
  compression: boolean;
  /** Project expiry in milliseconds (0 = never) */
  projectExpiry: number;
  /** Checkpoint expiry in milliseconds */
  checkpointExpiry: number;
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Project Store interface
 */
export interface IProjectStore {
  // Project lifecycle
  createProject(params: CreateProjectParams): Promise<ProjectState>;
  getProject(projectId: string): Promise<ProjectState | null>;
  updateProject(projectId: string, updates: Partial<ProjectState>): Promise<ProjectState>;
  deleteProject(projectId: string): Promise<boolean>;
  listProjects(filter?: ProjectFilter): Promise<ProjectState[]>;

  // State persistence
  saveState(projectId: string): Promise<void>;
  loadState(projectId: string): Promise<ProjectState | null>;

  // Checkpoints
  createCheckpoint(projectId: string, name: string, description?: string): Promise<ProjectCheckpoint>;
  restoreCheckpoint(checkpointId: string): Promise<ProjectState>;
  listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]>;
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  // Context management
  getContext(projectId: string): Promise<ProjectContext>;
  updateContext(projectId: string, context: Partial<ProjectContext>): Promise<void>;
  addDecision(projectId: string, decision: string, rationale: string, alternatives?: string[]): Promise<void>;
  addInsight(projectId: string, insight: string, source: string): Promise<void>;
  addBlocker(projectId: string, description: string): Promise<string>;
  resolveBlocker(projectId: string, blockerId: string, resolution: string): Promise<void>;

  // Task management
  addTask(projectId: string, task: Omit<TaskRecord, 'attempts'>): Promise<TaskRecord>;
  updateTask(projectId: string, taskId: string, updates: Partial<TaskRecord>): Promise<TaskRecord>;
  getNextTask(projectId: string): Promise<TaskRecord | null>;
  markTaskComplete(projectId: string, taskId: string, result?: unknown): Promise<void>;
  markTaskFailed(projectId: string, taskId: string, error: string): Promise<void>;

  // Session tracking
  associateSession(projectId: string, sessionId: string): Promise<void>;
  getActiveSessions(projectId: string): Promise<string[]>;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Create project parameters
 */
export interface CreateProjectParams {
  name: string;
  description?: string;
  prd?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Project filter
 */
export interface ProjectFilter {
  status?: ProjectStatus | ProjectStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
  hasBlockers?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Project store events
 */
export enum ProjectStoreEvent {
  PROJECT_CREATED = 'project:created',
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',
  STATE_SAVED = 'state:saved',
  STATE_LOADED = 'state:loaded',
  CHECKPOINT_CREATED = 'checkpoint:created',
  CHECKPOINT_RESTORED = 'checkpoint:restored',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const ProjectStoreConfigSchema = z.object({
  storagePath: z.string().default('./.codeavengers/projects'),
  autoSaveInterval: z.number().min(0).default(30000), // 30 seconds
  maxCheckpoints: z.number().min(1).default(10),
  compression: z.boolean().default(false),
  projectExpiry: z.number().min(0).default(0), // Never
  checkpointExpiry: z.number().min(0).default(604800000), // 7 days
  verbose: z.boolean().default(false),
});

export const DEFAULT_PROJECT_STORE_CONFIG: ProjectStoreConfig = {
  storagePath: './.codeavengers/projects',
  autoSaveInterval: 30000,
  maxCheckpoints: 10,
  compression: false,
  projectExpiry: 0,
  checkpointExpiry: 604800000,
  verbose: false,
};

// ============================================================================
// Filesystem Storage Adapter
// ============================================================================

/**
 * Filesystem-based storage adapter
 */
export class FileSystemStorageAdapter implements IProjectStorageAdapter {
  private projectsPath: string;
  private checkpointsPath: string;

  constructor(basePath: string) {
    this.projectsPath = join(basePath, 'states');
    this.checkpointsPath = join(basePath, 'checkpoints');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.projectsPath, { recursive: true });
    await fs.mkdir(this.checkpointsPath, { recursive: true });
  }

  async save(projectId: string, state: ProjectState): Promise<void> {
    const filePath = this.getProjectPath(projectId);
    const data = this.serializeState(state);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data, 'utf-8');
  }

  async load(projectId: string): Promise<ProjectState | null> {
    const filePath = this.getProjectPath(projectId);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return this.deserializeState(data);
    } catch {
      return null;
    }
  }

  async delete(projectId: string): Promise<boolean> {
    const filePath = this.getProjectPath(projectId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.projectsPath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  async exists(projectId: string): Promise<boolean> {
    const filePath = this.getProjectPath(projectId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async saveCheckpoint(checkpoint: ProjectCheckpoint): Promise<void> {
    const filePath = this.getCheckpointPath(checkpoint.id);
    const data = JSON.stringify(checkpoint, this.jsonReplacer, 2);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data, 'utf-8');
  }

  async listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]> {
    try {
      const files = await fs.readdir(this.checkpointsPath);
      const checkpoints: ProjectCheckpoint[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(this.checkpointsPath, file), 'utf-8');
          const checkpoint = JSON.parse(data, this.jsonReviver) as ProjectCheckpoint;
          if (checkpoint.projectId === projectId) {
            checkpoints.push(checkpoint);
          }
        }
      }

      return checkpoints.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async loadCheckpoint(checkpointId: string): Promise<ProjectCheckpoint | null> {
    const filePath = this.getCheckpointPath(checkpointId);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data, this.jsonReviver) as ProjectCheckpoint;
    } catch {
      return null;
    }
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const filePath = this.getCheckpointPath(checkpointId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deleted = 0;
    const timestamp = olderThan.getTime();

    // Cleanup checkpoints
    try {
      const files = await fs.readdir(this.checkpointsPath);
      for (const file of files) {
        const filePath = join(this.checkpointsPath, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < timestamp) {
          await fs.unlink(filePath);
          deleted++;
        }
      }
    } catch {
      // Ignore errors
    }

    return deleted;
  }

  private getProjectPath(projectId: string): string {
    return join(this.projectsPath, `${projectId}.json`);
  }

  private getCheckpointPath(checkpointId: string): string {
    return join(this.checkpointsPath, `${checkpointId}.json`);
  }

  private serializeState(state: ProjectState): string {
    // Convert Map to array for JSON serialization
    const serializable = {
      ...state,
      tasks: Array.from(state.tasks.entries()),
    };
    return JSON.stringify(serializable, this.jsonReplacer, 2);
  }

  private deserializeState(data: string): ProjectState {
    const parsed = JSON.parse(data, this.jsonReviver);
    return {
      ...parsed,
      tasks: new Map(parsed.tasks),
    };
  }

  private jsonReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    if (value instanceof Map) {
      return { __type: 'Map', value: Array.from(value.entries()) };
    }
    return value;
  }

  private jsonReviver(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && '__type' in value) {
      const typed = value as { __type: string; value: unknown };
      if (typed.__type === 'Date') {
        return new Date(typed.value as string);
      }
      if (typed.__type === 'Map') {
        return new Map(typed.value as [unknown, unknown][]);
      }
    }
    return value;
  }
}

// ============================================================================
// In-Memory Storage Adapter
// ============================================================================

/**
 * In-memory storage adapter (for testing)
 */
export class InMemoryStorageAdapter implements IProjectStorageAdapter {
  private projects: Map<string, ProjectState> = new Map();
  private checkpoints: Map<string, ProjectCheckpoint> = new Map();

  async initialize(): Promise<void> {
    // No-op for in-memory
  }

  async save(projectId: string, state: ProjectState): Promise<void> {
    this.projects.set(projectId, this.cloneState(state));
  }

  async load(projectId: string): Promise<ProjectState | null> {
    const state = this.projects.get(projectId);
    return state ? this.cloneState(state) : null;
  }

  async delete(projectId: string): Promise<boolean> {
    return this.projects.delete(projectId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.projects.keys());
  }

  async exists(projectId: string): Promise<boolean> {
    return this.projects.has(projectId);
  }

  async saveCheckpoint(checkpoint: ProjectCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, { ...checkpoint });
  }

  async listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter(c => c.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async loadCheckpoint(checkpointId: string): Promise<ProjectCheckpoint | null> {
    return this.checkpoints.get(checkpointId) || null;
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    return this.checkpoints.delete(checkpointId);
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deleted = 0;
    const timestamp = olderThan.getTime();

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.createdAt.getTime() < timestamp) {
        this.checkpoints.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  private cloneState(state: ProjectState): ProjectState {
    return {
      ...state,
      tasks: new Map(state.tasks),
      context: { ...state.context },
      metadata: { ...state.metadata },
    };
  }
}

// ============================================================================
// Project Store Implementation
// ============================================================================

/**
 * Project Store implementation
 */
export class ProjectStore extends EventEmitter implements IProjectStore {
  private config: ProjectStoreConfig;
  private storage: IProjectStorageAdapter;
  private cache: Map<string, ProjectState> = new Map();
  private autoSaveTimer?: NodeJS.Timeout;
  private initialized = false;
  private idCounter = 0;
  private logger: ILogger;

  constructor(config: Partial<ProjectStoreConfig> = {}, storage?: IProjectStorageAdapter) {
    super();
    this.config = { ...DEFAULT_PROJECT_STORE_CONFIG, ...config };
    this.storage = storage || new FileSystemStorageAdapter(this.config.storagePath);
    this.logger = createLogger('ProjectStore');
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.storage.initialize();

    // Start auto-save if configured
    if (this.config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(
        () => this.autoSaveAll(),
        this.config.autoSaveInterval
      );
    }

    this.initialized = true;
    this.log('Project store initialized');
  }

  async dispose(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    // Save all cached projects
    await this.autoSaveAll();

    this.cache.clear();
    this.initialized = false;
    this.log('Project store disposed');
  }

  // ==================== Project Lifecycle ====================

  async createProject(params: CreateProjectParams): Promise<ProjectState> {
    await this.ensureInitialized();

    const now = new Date();
    const projectId = this.generateProjectId();

    const state: ProjectState = {
      id: projectId,
      name: params.name,
      description: params.description || '',
      status: ProjectStatus.CREATED,
      prd: params.prd,
      tasks: new Map(),
      executionOrder: [],
      currentTaskIndex: 0,
      context: {
        currentPhase: 'initialization',
        activeGoals: [],
        completedMilestones: [],
        decisions: [],
        insights: [],
        blockers: [],
        custom: {},
      },
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      version: 1,
      sessionIds: [],
      metadata: params.metadata || {},
    };

    this.cache.set(projectId, state);
    await this.storage.save(projectId, state);

    this.emit(ProjectStoreEvent.PROJECT_CREATED, state);
    this.log(`Project created: ${projectId}`);

    return state;
  }

  async getProject(projectId: string): Promise<ProjectState | null> {
    await this.ensureInitialized();

    // Check cache first
    if (this.cache.has(projectId)) {
      return this.cache.get(projectId)!;
    }

    // Load from storage
    const state = await this.storage.load(projectId);
    if (state) {
      this.cache.set(projectId, state);
    }

    return state;
  }

  async updateProject(projectId: string, updates: Partial<ProjectState>): Promise<ProjectState> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const updatedState: ProjectState = {
      ...project,
      ...updates,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      version: project.version + 1,
    };

    this.cache.set(projectId, updatedState);
    await this.storage.save(projectId, updatedState);

    this.emit(ProjectStoreEvent.PROJECT_UPDATED, updatedState);
    return updatedState;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    await this.ensureInitialized();

    this.cache.delete(projectId);
    const deleted = await this.storage.delete(projectId);

    if (deleted) {
      // Delete all checkpoints
      const checkpoints = await this.storage.listCheckpoints(projectId);
      for (const checkpoint of checkpoints) {
        await this.storage.deleteCheckpoint(checkpoint.id);
      }

      this.emit(ProjectStoreEvent.PROJECT_DELETED, { projectId });
      this.log(`Project deleted: ${projectId}`);
    }

    return deleted;
  }

  async listProjects(filter?: ProjectFilter): Promise<ProjectState[]> {
    await this.ensureInitialized();

    const projectIds = await this.storage.list();
    const projects: ProjectState[] = [];

    for (const id of projectIds) {
      const project = await this.getProject(id);
      if (project && this.matchesFilter(project, filter)) {
        projects.push(project);
      }
    }

    // Apply pagination
    let result = projects.sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  // ==================== State Persistence ====================

  async saveState(projectId: string): Promise<void> {
    const project = this.cache.get(projectId);
    if (!project) {
      throw new Error(`Project not in cache: ${projectId}`);
    }

    project.updatedAt = new Date();
    project.version++;

    await this.storage.save(projectId, project);
    this.emit(ProjectStoreEvent.STATE_SAVED, { projectId });
    this.log(`State saved: ${projectId}`);
  }

  async loadState(projectId: string): Promise<ProjectState | null> {
    await this.ensureInitialized();

    const state = await this.storage.load(projectId);
    if (state) {
      this.cache.set(projectId, state);
      this.emit(ProjectStoreEvent.STATE_LOADED, { projectId, state });
    }

    return state;
  }

  // ==================== Checkpoints ====================

  async createCheckpoint(
    projectId: string,
    name: string,
    description?: string
  ): Promise<ProjectCheckpoint> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Enforce max checkpoints
    const checkpoints = await this.storage.listCheckpoints(projectId);
    if (checkpoints.length >= this.config.maxCheckpoints) {
      // Delete oldest checkpoint
      const oldest = checkpoints[checkpoints.length - 1];
      await this.storage.deleteCheckpoint(oldest.id);
    }

    const checkpoint: ProjectCheckpoint = {
      id: this.generateCheckpointId(),
      projectId,
      name,
      description,
      createdAt: new Date(),
      state: this.cloneProjectState(project),
      metadata: {},
    };

    await this.storage.saveCheckpoint(checkpoint);
    this.emit(ProjectStoreEvent.CHECKPOINT_CREATED, checkpoint);
    this.log(`Checkpoint created: ${checkpoint.id}`);

    return checkpoint;
  }

  async restoreCheckpoint(checkpointId: string): Promise<ProjectState> {
    const checkpoint = await this.storage.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const restoredState: ProjectState = {
      ...checkpoint.state,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      version: checkpoint.state.version + 1,
    };

    this.cache.set(checkpoint.projectId, restoredState);
    await this.storage.save(checkpoint.projectId, restoredState);

    this.emit(ProjectStoreEvent.CHECKPOINT_RESTORED, { checkpointId, state: restoredState });
    this.log(`Checkpoint restored: ${checkpointId}`);

    return restoredState;
  }

  async listCheckpoints(projectId: string): Promise<ProjectCheckpoint[]> {
    return this.storage.listCheckpoints(projectId);
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    return this.storage.deleteCheckpoint(checkpointId);
  }

  // ==================== Context Management ====================

  async getContext(projectId: string): Promise<ProjectContext> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project.context;
  }

  async updateContext(projectId: string, context: Partial<ProjectContext>): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.context = {
      ...project.context,
      ...context,
    };
    project.updatedAt = new Date();
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
  }

  async addDecision(
    projectId: string,
    decision: string,
    rationale: string,
    alternatives?: string[]
  ): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.context.decisions.push({
      timestamp: new Date(),
      decision,
      rationale,
      alternatives,
    });
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
    this.log(`Decision recorded for ${projectId}: ${decision}`);
  }

  async addInsight(projectId: string, insight: string, source: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    project.context.insights.push({
      timestamp: new Date(),
      insight,
      source,
    });
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
  }

  async addBlocker(projectId: string, description: string): Promise<string> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const blockerId = `blocker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    project.context.blockers.push({
      id: blockerId,
      description,
      createdAt: new Date(),
    });
    project.status = ProjectStatus.BLOCKED;
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
    return blockerId;
  }

  async resolveBlocker(projectId: string, blockerId: string, resolution: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const blocker = project.context.blockers.find(b => b.id === blockerId);
    if (blocker) {
      blocker.resolvedAt = new Date();
      blocker.resolution = resolution;
    }

    // Check if all blockers are resolved
    const unresolvedBlockers = project.context.blockers.filter(b => !b.resolvedAt);
    if (unresolvedBlockers.length === 0 && project.status === ProjectStatus.BLOCKED) {
      project.status = ProjectStatus.IN_PROGRESS;
    }

    project.lastActivityAt = new Date();
    await this.storage.save(projectId, project);
  }

  // ==================== Task Management ====================

  async addTask(projectId: string, task: Omit<TaskRecord, 'attempts'>): Promise<TaskRecord> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const fullTask: TaskRecord = {
      ...task,
      attempts: 0,
    };

    project.tasks.set(task.id, fullTask);
    project.executionOrder.push(task.id);
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
    return fullTask;
  }

  async updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<TaskRecord>
  ): Promise<TaskRecord> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const task = project.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updatedTask: TaskRecord = { ...task, ...updates };
    project.tasks.set(taskId, updatedTask);
    project.lastActivityAt = new Date();

    await this.storage.save(projectId, project);
    return updatedTask;
  }

  async getNextTask(projectId: string): Promise<TaskRecord | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Find next pending task in execution order
    for (let i = project.currentTaskIndex; i < project.executionOrder.length; i++) {
      const taskId = project.executionOrder[i];
      const task = project.tasks.get(taskId);

      if (task && task.status === TaskStatus.PENDING) {
        // Check dependencies
        const depsComplete = task.dependencies.every(depId => {
          const dep = project.tasks.get(depId);
          return dep && dep.status === TaskStatus.COMPLETED;
        });

        if (depsComplete) {
          return task;
        }
      }
    }

    return null;
  }

  async markTaskComplete(projectId: string, taskId: string, result?: unknown): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const task = project.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    task.result = result;

    // Advance current task index if this was the current task
    const taskIndex = project.executionOrder.indexOf(taskId);
    if (taskIndex === project.currentTaskIndex) {
      project.currentTaskIndex++;
    }

    project.lastActivityAt = new Date();
    await this.storage.save(projectId, project);

    this.emit(ProjectStoreEvent.TASK_COMPLETED, { projectId, taskId, result });
    this.log(`Task completed: ${taskId}`);
  }

  async markTaskFailed(projectId: string, taskId: string, error: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const task = project.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = TaskStatus.FAILED;
    task.error = error;
    task.attempts++;

    project.lastActivityAt = new Date();
    await this.storage.save(projectId, project);

    this.emit(ProjectStoreEvent.TASK_FAILED, { projectId, taskId, error });
    this.log(`Task failed: ${taskId} - ${error}`);
  }

  // ==================== Session Tracking ====================

  async associateSession(projectId: string, sessionId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!project.sessionIds.includes(sessionId)) {
      project.sessionIds.push(sessionId);
      project.lastActivityAt = new Date();
      await this.storage.save(projectId, project);
    }
  }

  async getActiveSessions(projectId: string): Promise<string[]> {
    const project = await this.getProject(projectId);
    return project?.sessionIds || [];
  }

  // ==================== Private Helpers ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async autoSaveAll(): Promise<void> {
    for (const [projectId, state] of this.cache) {
      try {
        await this.storage.save(projectId, state);
      } catch (error) {
        this.log(`Auto-save failed for ${projectId}: ${error}`);
      }
    }
  }

  private matchesFilter(project: ProjectState, filter?: ProjectFilter): boolean {
    if (!filter) return true;

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(project.status)) return false;
    }

    if (filter.createdAfter && project.createdAt < filter.createdAfter) {
      return false;
    }

    if (filter.createdBefore && project.createdAt > filter.createdBefore) {
      return false;
    }

    if (filter.hasBlockers !== undefined) {
      const hasUnresolved = project.context.blockers.some(b => !b.resolvedAt);
      if (filter.hasBlockers !== hasUnresolved) return false;
    }

    return true;
  }

  private generateProjectId(): string {
    return `proj_${Date.now()}_${++this.idCounter}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateCheckpointId(): string {
    return `chkpt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private cloneProjectState(state: ProjectState): ProjectState {
    return {
      ...state,
      tasks: new Map(state.tasks),
      context: {
        ...state.context,
        decisions: [...state.context.decisions],
        insights: [...state.context.insights],
        blockers: [...state.context.blockers],
        custom: { ...state.context.custom },
      },
      executionOrder: [...state.executionOrder],
      sessionIds: [...state.sessionIds],
      metadata: { ...state.metadata },
    };
  }

  private log(message: string): void {
    if (this.config.verbose) {
      this.logger.debug(message);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a project store instance
 */
export function createProjectStore(
  config: Partial<ProjectStoreConfig> = {},
  storage?: IProjectStorageAdapter
): ProjectStore {
  return new ProjectStore(config, storage);
}
