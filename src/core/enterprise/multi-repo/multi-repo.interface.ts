/**
 * Multi-Repository Management Interfaces
 *
 * Feature: F5.11 - Multi-Repo
 * Provides multi-repository workspace management, cross-repo operations,
 * and dependency tracking
 *
 * @module core/enterprise/multi-repo
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';
import type { GitStatus, GitBranch, GitCommit, GitRemote } from '../../tools/git/git.interface.js';

/**
 * Repository status
 */
export type RepositoryStatus = 'active' | 'inactive' | 'syncing' | 'error' | 'archived';

/**
 * Repository type
 */
export type RepositoryType = 'primary' | 'dependency' | 'fork' | 'mirror';

/**
 * Sync strategy for multi-repo operations
 */
export type SyncStrategy = 'parallel' | 'sequential' | 'dependency-order';

/**
 * Repository definition
 */
export interface Repository {
  /** Repository unique identifier */
  id: string;
  /** Repository name */
  name: string;
  /** Repository description */
  description?: string;
  /** Local filesystem path */
  localPath: string;
  /** Remote URL (origin) */
  remoteUrl: string;
  /** Repository type */
  type: RepositoryType;
  /** Repository status */
  status: RepositoryStatus;
  /** Default branch */
  defaultBranch: string;
  /** Current branch */
  currentBranch?: string;
  /** Team ID that owns this repository */
  teamId?: string;
  /** Repository settings */
  settings: RepositorySettings;
  /** Repository metadata */
  metadata?: Record<string, unknown>;
  /** When repository was registered */
  createdAt: Date;
  /** When repository was last updated */
  updatedAt: Date;
  /** When repository was last synced */
  lastSyncAt?: Date;
  /** Last error message */
  lastError?: string;
}

/**
 * Repository settings
 */
export interface RepositorySettings {
  /** Auto-sync enabled */
  autoSync: boolean;
  /** Auto-sync interval in seconds */
  autoSyncInterval: number;
  /** Sync on push */
  syncOnPush: boolean;
  /** Protected branches */
  protectedBranches: string[];
  /** Required reviewers count */
  requiredReviewers: number;
  /** Enable commit signing */
  requireCommitSigning: boolean;
  /** Pre-commit hooks enabled */
  preCommitHooksEnabled: boolean;
  /** Custom hooks configuration */
  customHooks?: Record<string, string>;
}

/**
 * Repository dependency
 */
export interface RepositoryDependency {
  /** Dependency unique identifier */
  id: string;
  /** Source repository ID */
  sourceRepoId: string;
  /** Target repository ID (dependency) */
  targetRepoId: string;
  /** Dependency type */
  type: 'npm' | 'git-submodule' | 'workspace' | 'custom';
  /** Version constraint */
  version?: string;
  /** Dependency path within source */
  sourcePath?: string;
  /** Whether dependency is optional */
  optional: boolean;
  /** Dependency metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workspace definition (collection of repositories)
 */
export interface Workspace {
  /** Workspace unique identifier */
  id: string;
  /** Workspace name */
  name: string;
  /** Workspace description */
  description?: string;
  /** Root path for workspace */
  rootPath: string;
  /** Repository IDs in this workspace */
  repositoryIds: string[];
  /** Workspace status */
  status: 'active' | 'inactive';
  /** Team ID that owns this workspace */
  teamId?: string;
  /** Workspace settings */
  settings: WorkspaceSettings;
  /** When workspace was created */
  createdAt: Date;
  /** When workspace was last updated */
  updatedAt: Date;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  /** Sync strategy */
  syncStrategy: SyncStrategy;
  /** Enable cross-repo branch sync */
  crossRepoBranchSync: boolean;
  /** Shared branch prefix */
  sharedBranchPrefix?: string;
  /** Enable workspace-level commits */
  enableWorkspaceCommits: boolean;
  /** Workspace environment variables */
  environmentVariables?: Record<string, string>;
}

/**
 * Repository health check result
 */
export interface RepositoryHealth {
  /** Repository ID */
  repositoryId: string;
  /** Overall health status */
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  /** Health score (0-100) */
  score: number;
  /** Health check details */
  checks: HealthCheck[];
  /** Last check timestamp */
  checkedAt: Date;
}

/**
 * Individual health check
 */
export interface HealthCheck {
  /** Check name */
  name: string;
  /** Check passed */
  passed: boolean;
  /** Check message */
  message?: string;
  /** Check severity */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Repository ID */
  repositoryId: string;
  /** Sync success */
  success: boolean;
  /** Sync type performed */
  syncType: 'fetch' | 'pull' | 'push';
  /** Changes pulled/pushed */
  changes: {
    commits: number;
    additions: number;
    deletions: number;
  };
  /** Sync duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Sync timestamp */
  timestamp: Date;
}

/**
 * Bulk sync result
 */
export interface BulkSyncResult {
  /** Overall success */
  success: boolean;
  /** Results per repository */
  results: SyncResult[];
  /** Total duration in ms */
  totalDuration: number;
  /** Sync timestamp */
  timestamp: Date;
}

/**
 * Cross-repo branch operation
 */
export interface CrossRepoBranchOperation {
  /** Operation ID */
  id: string;
  /** Branch name */
  branchName: string;
  /** Repository IDs involved */
  repositoryIds: string[];
  /** Operation type */
  operation: 'create' | 'delete' | 'merge' | 'rebase';
  /** Operation status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Results per repository */
  results: Map<string, OperationResult>;
  /** Created at */
  createdAt: Date;
  /** Completed at */
  completedAt?: Date;
}

/**
 * Operation result for a single repository
 */
export interface OperationResult {
  /** Success flag */
  success: boolean;
  /** Result message */
  message?: string;
  /** Error details */
  error?: string;
}

/**
 * Repository statistics
 */
export interface RepositoryStatistics {
  /** Repository ID */
  repositoryId: string;
  /** Commit count */
  totalCommits: number;
  /** Branch count */
  branchCount: number;
  /** Tag count */
  tagCount: number;
  /** Contributor count */
  contributorCount: number;
  /** File count */
  fileCount: number;
  /** Total size in bytes */
  sizeBytes: number;
  /** Last commit date */
  lastCommitDate?: Date;
  /** Calculated at */
  calculatedAt: Date;
}

/**
 * Workspace statistics
 */
export interface WorkspaceStatistics {
  /** Workspace ID */
  workspaceId: string;
  /** Repository count */
  repositoryCount: number;
  /** Total commits across repos */
  totalCommits: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Active branches across repos */
  activeBranches: number;
  /** Pending syncs */
  pendingSyncs: number;
  /** Last activity */
  lastActivityAt?: Date;
  /** Calculated at */
  calculatedAt: Date;
}

/**
 * Repository event
 */
export interface RepositoryEvent {
  /** Event type */
  type: RepositoryEventType;
  /** Repository ID */
  repositoryId: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Repository event types
 */
export type RepositoryEventType =
  | 'repo.registered'
  | 'repo.updated'
  | 'repo.removed'
  | 'repo.synced'
  | 'repo.sync_failed'
  | 'repo.branch_created'
  | 'repo.branch_deleted'
  | 'repo.health_changed'
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'dependency.added'
  | 'dependency.removed';

/**
 * Register repository request
 */
export interface RegisterRepositoryRequest {
  /** Repository name */
  name: string;
  /** Repository description */
  description?: string;
  /** Local filesystem path */
  localPath: string;
  /** Remote URL */
  remoteUrl?: string;
  /** Repository type */
  type?: RepositoryType;
  /** Team ID */
  teamId?: string;
  /** Initial settings */
  settings?: Partial<RepositorySettings>;
  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update repository request
 */
export interface UpdateRepositoryRequest {
  /** Repository name */
  name?: string;
  /** Repository description */
  description?: string;
  /** Repository status */
  status?: RepositoryStatus;
  /** Default branch */
  defaultBranch?: string;
  /** Repository settings */
  settings?: Partial<RepositorySettings>;
  /** Repository metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create workspace request
 */
export interface CreateWorkspaceRequest {
  /** Workspace name */
  name: string;
  /** Workspace description */
  description?: string;
  /** Root path */
  rootPath: string;
  /** Initial repository IDs */
  repositoryIds?: string[];
  /** Team ID */
  teamId?: string;
  /** Initial settings */
  settings?: Partial<WorkspaceSettings>;
}

/**
 * Repository filter
 */
export interface RepositoryFilter {
  /** Filter by status */
  status?: RepositoryStatus;
  /** Filter by type */
  type?: RepositoryType;
  /** Filter by team */
  teamId?: string;
  /** Filter by name pattern */
  namePattern?: string;
  /** Include archived */
  includeArchived?: boolean;
}

/**
 * Multi-Repo Manager interface
 */
export interface IMultiRepoManager extends IDisposable {
  // ==================== Repository Management ====================

  /**
   * Register a repository
   * @param request Register request
   */
  registerRepository(request: RegisterRepositoryRequest): Promise<Repository>;

  /**
   * Get a repository by ID
   * @param repositoryId Repository identifier
   */
  getRepository(repositoryId: string): Promise<Repository | undefined>;

  /**
   * Get a repository by path
   * @param localPath Local filesystem path
   */
  getRepositoryByPath(localPath: string): Promise<Repository | undefined>;

  /**
   * Update a repository
   * @param repositoryId Repository identifier
   * @param updates Update request
   */
  updateRepository(repositoryId: string, updates: UpdateRepositoryRequest): Promise<Repository>;

  /**
   * Remove a repository (unregister)
   * @param repositoryId Repository identifier
   * @param deleteLocal Whether to delete local files
   */
  removeRepository(repositoryId: string, deleteLocal?: boolean): Promise<boolean>;

  /**
   * Get all repositories
   * @param filter Optional filter
   */
  getRepositories(filter?: RepositoryFilter): Promise<Repository[]>;

  /**
   * Get repositories for a team
   * @param teamId Team identifier
   */
  getTeamRepositories(teamId: string): Promise<Repository[]>;

  // ==================== Workspace Management ====================

  /**
   * Create a workspace
   * @param request Create request
   */
  createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace>;

  /**
   * Get a workspace by ID
   * @param workspaceId Workspace identifier
   */
  getWorkspace(workspaceId: string): Promise<Workspace | undefined>;

  /**
   * Update a workspace
   * @param workspaceId Workspace identifier
   * @param updates Partial workspace updates
   */
  updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<Workspace>;

  /**
   * Delete a workspace
   * @param workspaceId Workspace identifier
   */
  deleteWorkspace(workspaceId: string): Promise<boolean>;

  /**
   * Get all workspaces
   */
  getWorkspaces(): Promise<Workspace[]>;

  /**
   * Add repository to workspace
   * @param workspaceId Workspace identifier
   * @param repositoryId Repository identifier
   */
  addRepositoryToWorkspace(workspaceId: string, repositoryId: string): Promise<void>;

  /**
   * Remove repository from workspace
   * @param workspaceId Workspace identifier
   * @param repositoryId Repository identifier
   */
  removeRepositoryFromWorkspace(workspaceId: string, repositoryId: string): Promise<void>;

  // ==================== Dependency Management ====================

  /**
   * Add dependency between repositories
   * @param sourceRepoId Source repository ID
   * @param targetRepoId Target (dependency) repository ID
   * @param type Dependency type
   * @param version Version constraint
   */
  addDependency(
    sourceRepoId: string,
    targetRepoId: string,
    type: RepositoryDependency['type'],
    version?: string
  ): Promise<RepositoryDependency>;

  /**
   * Remove dependency
   * @param dependencyId Dependency identifier
   */
  removeDependency(dependencyId: string): Promise<boolean>;

  /**
   * Get dependencies for a repository
   * @param repositoryId Repository identifier
   */
  getDependencies(repositoryId: string): Promise<RepositoryDependency[]>;

  /**
   * Get dependents (repos that depend on this one)
   * @param repositoryId Repository identifier
   */
  getDependents(repositoryId: string): Promise<RepositoryDependency[]>;

  /**
   * Get dependency graph for a workspace
   * @param workspaceId Workspace identifier
   */
  getDependencyGraph(workspaceId: string): Promise<Map<string, string[]>>;

  // ==================== Sync Operations ====================

  /**
   * Sync a single repository
   * @param repositoryId Repository identifier
   * @param syncType Type of sync
   */
  syncRepository(repositoryId: string, syncType?: 'fetch' | 'pull' | 'push'): Promise<SyncResult>;

  /**
   * Sync all repositories in a workspace
   * @param workspaceId Workspace identifier
   * @param syncType Type of sync
   */
  syncWorkspace(workspaceId: string, syncType?: 'fetch' | 'pull' | 'push'): Promise<BulkSyncResult>;

  /**
   * Sync multiple repositories
   * @param repositoryIds Repository identifiers
   * @param syncType Type of sync
   * @param strategy Sync strategy
   */
  syncRepositories(
    repositoryIds: string[],
    syncType?: 'fetch' | 'pull' | 'push',
    strategy?: SyncStrategy
  ): Promise<BulkSyncResult>;

  // ==================== Cross-Repo Branch Operations ====================

  /**
   * Create branch across multiple repositories
   * @param branchName Branch name
   * @param repositoryIds Repository identifiers
   * @param baseBranch Base branch (default: default branch)
   */
  createCrossRepoBranch(
    branchName: string,
    repositoryIds: string[],
    baseBranch?: string
  ): Promise<CrossRepoBranchOperation>;

  /**
   * Delete branch across multiple repositories
   * @param branchName Branch name
   * @param repositoryIds Repository identifiers
   */
  deleteCrossRepoBranch(
    branchName: string,
    repositoryIds: string[]
  ): Promise<CrossRepoBranchOperation>;

  /**
   * Switch branch across workspace
   * @param workspaceId Workspace identifier
   * @param branchName Branch name
   */
  switchWorkspaceBranch(workspaceId: string, branchName: string): Promise<CrossRepoBranchOperation>;

  // ==================== Health & Statistics ====================

  /**
   * Check repository health
   * @param repositoryId Repository identifier
   */
  checkRepositoryHealth(repositoryId: string): Promise<RepositoryHealth>;

  /**
   * Get repository statistics
   * @param repositoryId Repository identifier
   */
  getRepositoryStatistics(repositoryId: string): Promise<RepositoryStatistics>;

  /**
   * Get workspace statistics
   * @param workspaceId Workspace identifier
   */
  getWorkspaceStatistics(workspaceId: string): Promise<WorkspaceStatistics>;

  // ==================== Repository Info ====================

  /**
   * Get current git status for repository
   * @param repositoryId Repository identifier
   */
  getGitStatus(repositoryId: string): Promise<GitStatus>;

  /**
   * Get branches for repository
   * @param repositoryId Repository identifier
   */
  getBranches(repositoryId: string): Promise<GitBranch[]>;

  /**
   * Get recent commits for repository
   * @param repositoryId Repository identifier
   * @param limit Maximum commits to return
   */
  getRecentCommits(repositoryId: string, limit?: number): Promise<GitCommit[]>;

  /**
   * Get remotes for repository
   * @param repositoryId Repository identifier
   */
  getRemotes(repositoryId: string): Promise<GitRemote[]>;

  // ==================== Events ====================

  /**
   * Subscribe to repository events
   * @param handler Event handler
   */
  onRepositoryEvent(handler: (event: RepositoryEvent) => void): () => void;
}

/**
 * Default repository settings
 */
export const DEFAULT_REPOSITORY_SETTINGS: RepositorySettings = {
  autoSync: false,
  autoSyncInterval: 300, // 5 minutes
  syncOnPush: true,
  protectedBranches: ['main', 'master'],
  requiredReviewers: 1,
  requireCommitSigning: false,
  preCommitHooksEnabled: true,
};

/**
 * Default workspace settings
 */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  syncStrategy: 'parallel',
  crossRepoBranchSync: false,
  enableWorkspaceCommits: false,
};
