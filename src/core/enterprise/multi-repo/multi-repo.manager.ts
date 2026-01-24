/**
 * Multi-Repository Manager Implementation
 *
 * Feature: F5.11 - Multi-Repo
 * Provides multi-repository workspace management, cross-repo operations,
 * and dependency tracking
 *
 * @module core/enterprise/multi-repo
 */

import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import { GitFileStatus } from '../../tools/git/git.interface.js';
import type {
  IMultiRepoManager,
  Repository,
  Workspace,
  RepositoryDependency,
  RepositoryHealth,
  HealthCheck,
  SyncResult,
  BulkSyncResult,
  CrossRepoBranchOperation,
  RepositoryStatistics,
  WorkspaceStatistics,
  RepositoryEvent,
  RepositoryEventType,
  RegisterRepositoryRequest,
  UpdateRepositoryRequest,
  CreateWorkspaceRequest,
  RepositoryFilter,
  SyncStrategy,
} from './multi-repo.interface.js';
import {
  DEFAULT_REPOSITORY_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
} from './multi-repo.interface.js';
import type { GitStatus, GitBranch, GitCommit, GitRemote } from '../../tools/git/git.interface.js';

const execAsync = promisify(exec);

/**
 * Multi-Repository Manager implementation
 */
export class MultiRepoManager implements IMultiRepoManager {
  private repositories: Map<string, Repository> = new Map();
  private repositoriesByPath: Map<string, string> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private dependencies: Map<string, RepositoryDependency> = new Map();
  private eventHandlers: Set<(event: RepositoryEvent) => void> = new Set();
  private disposed = false;

  // ==================== Repository Management ====================

  async registerRepository(request: RegisterRepositoryRequest): Promise<Repository> {
    this.ensureNotDisposed();

    // Validate path exists
    if (!existsSync(request.localPath)) {
      throw new Error(`Path does not exist: ${request.localPath}`);
    }

    // Check if already registered
    if (this.repositoriesByPath.has(request.localPath)) {
      throw new Error(`Repository already registered at path: ${request.localPath}`);
    }

    // Verify it's a git repository
    const isRepo = await this.isGitRepository(request.localPath);
    if (!isRepo) {
      throw new Error(`Path is not a git repository: ${request.localPath}`);
    }

    // Get remote URL if not provided
    let remoteUrl = request.remoteUrl;
    if (!remoteUrl) {
      remoteUrl = await this.getRemoteUrl(request.localPath);
    }

    // Get default branch
    const defaultBranch = await this.getDefaultBranch(request.localPath);
    const currentBranch = await this.getCurrentBranch(request.localPath);

    const now = new Date();
    const repository: Repository = {
      id: randomUUID(),
      name: request.name,
      description: request.description,
      localPath: request.localPath,
      remoteUrl: remoteUrl || '',
      type: request.type || 'primary',
      status: 'active',
      defaultBranch,
      currentBranch,
      teamId: request.teamId,
      settings: { ...DEFAULT_REPOSITORY_SETTINGS, ...request.settings },
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.repositories.set(repository.id, repository);
    this.repositoriesByPath.set(repository.localPath, repository.id);

    this.emitEvent('repo.registered', repository.id, { repository });

    return repository;
  }

  async getRepository(repositoryId: string): Promise<Repository | undefined> {
    this.ensureNotDisposed();
    return this.repositories.get(repositoryId);
  }

  async getRepositoryByPath(localPath: string): Promise<Repository | undefined> {
    this.ensureNotDisposed();
    const id = this.repositoriesByPath.get(localPath);
    return id ? this.repositories.get(id) : undefined;
  }

  async updateRepository(
    repositoryId: string,
    updates: UpdateRepositoryRequest
  ): Promise<Repository> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const updatedRepository: Repository = {
      ...repository,
      ...updates,
      settings: updates.settings
        ? { ...repository.settings, ...updates.settings }
        : repository.settings,
      metadata: updates.metadata
        ? { ...repository.metadata, ...updates.metadata }
        : repository.metadata,
      updatedAt: new Date(),
    };

    this.repositories.set(repositoryId, updatedRepository);

    this.emitEvent('repo.updated', repositoryId, { updates });

    return updatedRepository;
  }

  async removeRepository(repositoryId: string, _deleteLocal = false): Promise<boolean> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      return false;
    }

    // Remove from workspaces
    for (const workspace of this.workspaces.values()) {
      const index = workspace.repositoryIds.indexOf(repositoryId);
      if (index > -1) {
        workspace.repositoryIds.splice(index, 1);
      }
    }

    // Remove dependencies
    for (const [depId, dep] of this.dependencies.entries()) {
      if (dep.sourceRepoId === repositoryId || dep.targetRepoId === repositoryId) {
        this.dependencies.delete(depId);
      }
    }

    this.repositoriesByPath.delete(repository.localPath);
    this.repositories.delete(repositoryId);

    this.emitEvent('repo.removed', repositoryId, { repository });

    return true;
  }

  async getRepositories(filter?: RepositoryFilter): Promise<Repository[]> {
    this.ensureNotDisposed();

    let repos = Array.from(this.repositories.values());

    if (filter) {
      if (filter.status) {
        repos = repos.filter((r) => r.status === filter.status);
      }
      if (filter.type) {
        repos = repos.filter((r) => r.type === filter.type);
      }
      if (filter.teamId) {
        repos = repos.filter((r) => r.teamId === filter.teamId);
      }
      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, 'i');
        repos = repos.filter((r) => pattern.test(r.name));
      }
      if (!filter.includeArchived) {
        repos = repos.filter((r) => r.status !== 'archived');
      }
    }

    return repos;
  }

  async getTeamRepositories(teamId: string): Promise<Repository[]> {
    return this.getRepositories({ teamId });
  }

  // ==================== Workspace Management ====================

  async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
    this.ensureNotDisposed();

    // Validate root path
    if (!existsSync(request.rootPath)) {
      throw new Error(`Root path does not exist: ${request.rootPath}`);
    }

    const now = new Date();
    const workspace: Workspace = {
      id: randomUUID(),
      name: request.name,
      description: request.description,
      rootPath: request.rootPath,
      repositoryIds: request.repositoryIds || [],
      status: 'active',
      teamId: request.teamId,
      settings: { ...DEFAULT_WORKSPACE_SETTINGS, ...request.settings },
      createdAt: now,
      updatedAt: now,
    };

    this.workspaces.set(workspace.id, workspace);

    this.emitEvent('workspace.created', workspace.id, { workspace });

    return workspace;
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    this.ensureNotDisposed();
    return this.workspaces.get(workspaceId);
  }

  async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<Workspace> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      ...updates,
      id: workspace.id, // Prevent ID change
      createdAt: workspace.createdAt, // Prevent creation date change
      updatedAt: new Date(),
    };

    this.workspaces.set(workspaceId, updatedWorkspace);

    this.emitEvent('workspace.updated', workspaceId, { updates });

    return updatedWorkspace;
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    this.ensureNotDisposed();

    if (!this.workspaces.has(workspaceId)) {
      return false;
    }

    this.workspaces.delete(workspaceId);

    this.emitEvent('workspace.deleted', workspaceId, {});

    return true;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    this.ensureNotDisposed();
    return Array.from(this.workspaces.values());
  }

  async addRepositoryToWorkspace(workspaceId: string, repositoryId: string): Promise<void> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    if (!workspace.repositoryIds.includes(repositoryId)) {
      workspace.repositoryIds.push(repositoryId);
      workspace.updatedAt = new Date();
    }
  }

  async removeRepositoryFromWorkspace(workspaceId: string, repositoryId: string): Promise<void> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const index = workspace.repositoryIds.indexOf(repositoryId);
    if (index > -1) {
      workspace.repositoryIds.splice(index, 1);
      workspace.updatedAt = new Date();
    }
  }

  // ==================== Dependency Management ====================

  async addDependency(
    sourceRepoId: string,
    targetRepoId: string,
    type: RepositoryDependency['type'],
    version?: string
  ): Promise<RepositoryDependency> {
    this.ensureNotDisposed();

    // Validate repositories exist
    if (!this.repositories.has(sourceRepoId)) {
      throw new Error('Source repository not found');
    }
    if (!this.repositories.has(targetRepoId)) {
      throw new Error('Target repository not found');
    }

    // Check for circular dependency
    if (await this.wouldCreateCycle(sourceRepoId, targetRepoId)) {
      throw new Error('Adding this dependency would create a circular dependency');
    }

    const dependency: RepositoryDependency = {
      id: randomUUID(),
      sourceRepoId,
      targetRepoId,
      type,
      version,
      optional: false,
    };

    this.dependencies.set(dependency.id, dependency);

    this.emitEvent('dependency.added', sourceRepoId, { dependency });

    return dependency;
  }

  async removeDependency(dependencyId: string): Promise<boolean> {
    this.ensureNotDisposed();

    const dependency = this.dependencies.get(dependencyId);
    if (!dependency) {
      return false;
    }

    this.dependencies.delete(dependencyId);

    this.emitEvent('dependency.removed', dependency.sourceRepoId, { dependency });

    return true;
  }

  async getDependencies(repositoryId: string): Promise<RepositoryDependency[]> {
    this.ensureNotDisposed();
    return Array.from(this.dependencies.values()).filter(
      (d) => d.sourceRepoId === repositoryId
    );
  }

  async getDependents(repositoryId: string): Promise<RepositoryDependency[]> {
    this.ensureNotDisposed();
    return Array.from(this.dependencies.values()).filter(
      (d) => d.targetRepoId === repositoryId
    );
  }

  async getDependencyGraph(workspaceId: string): Promise<Map<string, string[]>> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const graph = new Map<string, string[]>();

    for (const repoId of workspace.repositoryIds) {
      const deps = await this.getDependencies(repoId);
      graph.set(
        repoId,
        deps
          .map((d) => d.targetRepoId)
          .filter((id) => workspace.repositoryIds.includes(id))
      );
    }

    return graph;
  }

  // ==================== Sync Operations ====================

  async syncRepository(
    repositoryId: string,
    syncType: 'fetch' | 'pull' | 'push' = 'pull'
  ): Promise<SyncResult> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const startTime = Date.now();

    // Update status
    repository.status = 'syncing';
    this.repositories.set(repositoryId, repository);

    try {
      let command: string;
      switch (syncType) {
        case 'fetch':
          command = 'git fetch --all';
          break;
        case 'push':
          command = 'git push';
          break;
        case 'pull':
        default:
          command = 'git pull';
      }

      const { stdout } = await execAsync(command, { cwd: repository.localPath });

      // Parse output for changes (simplified)
      const changes = this.parseGitSyncOutput(stdout);

      const result: SyncResult = {
        repositoryId,
        success: true,
        syncType,
        changes,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      // Update repository
      repository.status = 'active';
      repository.lastSyncAt = new Date();
      repository.lastError = undefined;
      repository.currentBranch = await this.getCurrentBranch(repository.localPath);
      this.repositories.set(repositoryId, repository);

      this.emitEvent('repo.synced', repositoryId, { result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const result: SyncResult = {
        repositoryId,
        success: false,
        syncType,
        changes: { commits: 0, additions: 0, deletions: 0 },
        duration: Date.now() - startTime,
        error: errorMessage,
        timestamp: new Date(),
      };

      // Update repository with error
      repository.status = 'error';
      repository.lastError = errorMessage;
      this.repositories.set(repositoryId, repository);

      this.emitEvent('repo.sync_failed', repositoryId, { result });

      return result;
    }
  }

  async syncWorkspace(
    workspaceId: string,
    syncType: 'fetch' | 'pull' | 'push' = 'pull'
  ): Promise<BulkSyncResult> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return this.syncRepositories(workspace.repositoryIds, syncType, workspace.settings.syncStrategy);
  }

  async syncRepositories(
    repositoryIds: string[],
    syncType: 'fetch' | 'pull' | 'push' = 'pull',
    strategy: SyncStrategy = 'parallel'
  ): Promise<BulkSyncResult> {
    this.ensureNotDisposed();

    const startTime = Date.now();
    const results: SyncResult[] = [];

    if (strategy === 'parallel') {
      // Execute all syncs in parallel
      const syncPromises = repositoryIds.map((id) => this.syncRepository(id, syncType));
      results.push(...(await Promise.all(syncPromises)));
    } else if (strategy === 'sequential') {
      // Execute syncs one by one
      for (const id of repositoryIds) {
        results.push(await this.syncRepository(id, syncType));
      }
    } else if (strategy === 'dependency-order') {
      // Build dependency order (topological sort)
      const ordered = await this.topologicalSort(repositoryIds);
      for (const id of ordered) {
        results.push(await this.syncRepository(id, syncType));
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
      totalDuration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  // ==================== Cross-Repo Branch Operations ====================

  async createCrossRepoBranch(
    branchName: string,
    repositoryIds: string[],
    baseBranch?: string
  ): Promise<CrossRepoBranchOperation> {
    this.ensureNotDisposed();

    const operation: CrossRepoBranchOperation = {
      id: randomUUID(),
      branchName,
      repositoryIds,
      operation: 'create',
      status: 'in_progress',
      results: new Map(),
      createdAt: new Date(),
    };

    for (const repoId of repositoryIds) {
      const repository = this.repositories.get(repoId);
      if (!repository) {
        operation.results.set(repoId, {
          success: false,
          error: 'Repository not found',
        });
        continue;
      }

      try {
        const base = baseBranch || repository.defaultBranch;
        await execAsync(`git checkout -b ${branchName} ${base}`, {
          cwd: repository.localPath,
        });

        operation.results.set(repoId, {
          success: true,
          message: `Branch ${branchName} created from ${base}`,
        });

        this.emitEvent('repo.branch_created', repoId, { branchName, baseBranch: base });
      } catch (error) {
        operation.results.set(repoId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    operation.status = Array.from(operation.results.values()).every((r) => r.success)
      ? 'completed'
      : 'failed';
    operation.completedAt = new Date();

    return operation;
  }

  async deleteCrossRepoBranch(
    branchName: string,
    repositoryIds: string[]
  ): Promise<CrossRepoBranchOperation> {
    this.ensureNotDisposed();

    const operation: CrossRepoBranchOperation = {
      id: randomUUID(),
      branchName,
      repositoryIds,
      operation: 'delete',
      status: 'in_progress',
      results: new Map(),
      createdAt: new Date(),
    };

    for (const repoId of repositoryIds) {
      const repository = this.repositories.get(repoId);
      if (!repository) {
        operation.results.set(repoId, {
          success: false,
          error: 'Repository not found',
        });
        continue;
      }

      // Don't delete if on the branch
      if (repository.currentBranch === branchName) {
        operation.results.set(repoId, {
          success: false,
          error: `Cannot delete current branch: ${branchName}`,
        });
        continue;
      }

      try {
        await execAsync(`git branch -d ${branchName}`, {
          cwd: repository.localPath,
        });

        operation.results.set(repoId, {
          success: true,
          message: `Branch ${branchName} deleted`,
        });

        this.emitEvent('repo.branch_deleted', repoId, { branchName });
      } catch (error) {
        operation.results.set(repoId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    operation.status = Array.from(operation.results.values()).every((r) => r.success)
      ? 'completed'
      : 'failed';
    operation.completedAt = new Date();

    return operation;
  }

  async switchWorkspaceBranch(
    workspaceId: string,
    branchName: string
  ): Promise<CrossRepoBranchOperation> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const operation: CrossRepoBranchOperation = {
      id: randomUUID(),
      branchName,
      repositoryIds: workspace.repositoryIds,
      operation: 'create', // checkout uses create operation type
      status: 'in_progress',
      results: new Map(),
      createdAt: new Date(),
    };

    for (const repoId of workspace.repositoryIds) {
      const repository = this.repositories.get(repoId);
      if (!repository) {
        operation.results.set(repoId, {
          success: false,
          error: 'Repository not found',
        });
        continue;
      }

      try {
        await execAsync(`git checkout ${branchName}`, {
          cwd: repository.localPath,
        });

        // Update current branch
        repository.currentBranch = branchName;
        this.repositories.set(repoId, repository);

        operation.results.set(repoId, {
          success: true,
          message: `Switched to branch ${branchName}`,
        });
      } catch (error) {
        operation.results.set(repoId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    operation.status = Array.from(operation.results.values()).every((r) => r.success)
      ? 'completed'
      : 'failed';
    operation.completedAt = new Date();

    return operation;
  }

  // ==================== Health & Statistics ====================

  async checkRepositoryHealth(repositoryId: string): Promise<RepositoryHealth> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const checks: HealthCheck[] = [];

    // Check 1: Path exists
    const pathExists = existsSync(repository.localPath);
    checks.push({
      name: 'path_exists',
      passed: pathExists,
      message: pathExists ? 'Repository path exists' : 'Repository path not found',
      severity: pathExists ? 'info' : 'error',
    });

    if (pathExists) {
      // Check 2: Is git repository
      const isRepo = await this.isGitRepository(repository.localPath);
      checks.push({
        name: 'is_git_repository',
        passed: isRepo,
        message: isRepo ? 'Valid git repository' : 'Not a git repository',
        severity: isRepo ? 'info' : 'error',
      });

      // Check 3: No uncommitted changes
      try {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: repository.localPath,
        });
        const hasUncommitted = stdout.trim().length > 0;
        checks.push({
          name: 'clean_working_tree',
          passed: !hasUncommitted,
          message: hasUncommitted ? 'Uncommitted changes present' : 'Working tree is clean',
          severity: hasUncommitted ? 'warning' : 'info',
        });
      } catch {
        checks.push({
          name: 'clean_working_tree',
          passed: false,
          message: 'Failed to check working tree status',
          severity: 'error',
        });
      }

      // Check 4: Remote connectivity
      try {
        await execAsync('git ls-remote --exit-code origin HEAD', {
          cwd: repository.localPath,
          timeout: 10000,
        });
        checks.push({
          name: 'remote_connectivity',
          passed: true,
          message: 'Remote is reachable',
          severity: 'info',
        });
      } catch {
        checks.push({
          name: 'remote_connectivity',
          passed: false,
          message: 'Cannot connect to remote',
          severity: 'warning',
        });
      }

      // Check 5: Not behind remote
      try {
        await execAsync('git fetch --dry-run', {
          cwd: repository.localPath,
          timeout: 10000,
        });
        const { stdout } = await execAsync('git rev-list HEAD..@{u} --count 2>/dev/null || echo 0', {
          cwd: repository.localPath,
        });
        const behind = parseInt(stdout.trim(), 10);
        checks.push({
          name: 'up_to_date',
          passed: behind === 0,
          message: behind === 0 ? 'Up to date with remote' : `${behind} commits behind remote`,
          severity: behind === 0 ? 'info' : 'warning',
        });
      } catch {
        checks.push({
          name: 'up_to_date',
          passed: true,
          message: 'Could not determine remote status',
          severity: 'info',
        });
      }
    }

    // Calculate score
    const passedChecks = checks.filter((c) => c.passed).length;
    const score = Math.round((passedChecks / checks.length) * 100);

    // Determine status
    const hasErrors = checks.some((c) => !c.passed && c.severity === 'error');
    const hasWarnings = checks.some((c) => !c.passed && c.severity === 'warning');

    let status: RepositoryHealth['status'];
    if (hasErrors) {
      status = 'critical';
    } else if (hasWarnings) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    const health: RepositoryHealth = {
      repositoryId,
      status,
      score,
      checks,
      checkedAt: new Date(),
    };

    // Emit event if status changed
    if (repository.status !== 'error' && status === 'critical') {
      this.emitEvent('repo.health_changed', repositoryId, { health });
    }

    return health;
  }

  async getRepositoryStatistics(repositoryId: string): Promise<RepositoryStatistics> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const cwd = repository.localPath;

    // Get commit count
    let totalCommits = 0;
    try {
      const { stdout } = await execAsync('git rev-list --count HEAD', { cwd });
      totalCommits = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }

    // Get branch count
    let branchCount = 0;
    try {
      const { stdout } = await execAsync('git branch -a | wc -l', { cwd });
      branchCount = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }

    // Get tag count
    let tagCount = 0;
    try {
      const { stdout } = await execAsync('git tag | wc -l', { cwd });
      tagCount = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }

    // Get contributor count
    let contributorCount = 0;
    try {
      const { stdout } = await execAsync('git shortlog -sn --all | wc -l', { cwd });
      contributorCount = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }

    // Get file count
    let fileCount = 0;
    try {
      const { stdout } = await execAsync('git ls-files | wc -l', { cwd });
      fileCount = parseInt(stdout.trim(), 10);
    } catch {
      // Ignore
    }

    // Get size
    let sizeBytes = 0;
    try {
      const stats = statSync(cwd);
      sizeBytes = stats.size;
    } catch {
      // Ignore
    }

    // Get last commit date
    let lastCommitDate: Date | undefined;
    try {
      const { stdout } = await execAsync('git log -1 --format=%ci', { cwd });
      lastCommitDate = new Date(stdout.trim());
    } catch {
      // Ignore
    }

    return {
      repositoryId,
      totalCommits,
      branchCount,
      tagCount,
      contributorCount,
      fileCount,
      sizeBytes,
      lastCommitDate,
      calculatedAt: new Date(),
    };
  }

  async getWorkspaceStatistics(workspaceId: string): Promise<WorkspaceStatistics> {
    this.ensureNotDisposed();

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    let totalCommits = 0;
    let totalSizeBytes = 0;
    let activeBranches = 0;
    let pendingSyncs = 0;
    let lastActivityAt: Date | undefined;

    for (const repoId of workspace.repositoryIds) {
      try {
        const stats = await this.getRepositoryStatistics(repoId);
        totalCommits += stats.totalCommits;
        totalSizeBytes += stats.sizeBytes;
        activeBranches += stats.branchCount;

        if (stats.lastCommitDate) {
          if (!lastActivityAt || stats.lastCommitDate > lastActivityAt) {
            lastActivityAt = stats.lastCommitDate;
          }
        }
      } catch {
        // Ignore individual repo errors
      }

      const repo = this.repositories.get(repoId);
      if (repo && repo.status === 'syncing') {
        pendingSyncs++;
      }
    }

    return {
      workspaceId,
      repositoryCount: workspace.repositoryIds.length,
      totalCommits,
      totalSizeBytes,
      activeBranches,
      pendingSyncs,
      lastActivityAt,
      calculatedAt: new Date(),
    };
  }

  // ==================== Repository Info ====================

  async getGitStatus(repositoryId: string): Promise<GitStatus> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const cwd = repository.localPath;

    // Get branch info
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd });
    const branch = branchOutput.trim();

    // Get status
    const { stdout: statusOutput } = await execAsync('git status --porcelain -b', { cwd });
    const lines = statusOutput.split('\n').filter(Boolean);

    const staged: GitStatus['staged'] = [];
    const unstaged: GitStatus['unstaged'] = [];
    const untracked: string[] = [];

    let upstream: string | undefined;
    let ahead = 0;
    let behind = 0;

    for (const line of lines) {
      if (line.startsWith('##')) {
        // Parse branch line
        const match = line.match(/\.\.\.([\w/-]+)/);
        if (match) {
          upstream = match[1];
        }
        const aheadMatch = line.match(/ahead (\d+)/);
        if (aheadMatch) {
          ahead = parseInt(aheadMatch[1], 10);
        }
        const behindMatch = line.match(/behind (\d+)/);
        if (behindMatch) {
          behind = parseInt(behindMatch[1], 10);
        }
      } else if (line.startsWith('??')) {
        untracked.push(line.slice(3));
      } else {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const path = line.slice(3);

        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push({
            path,
            status: this.parseGitStatus(indexStatus),
            staged: true,
          });
        }

        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstaged.push({
            path,
            status: this.parseGitStatus(workTreeStatus),
            staged: false,
          });
        }
      }
    }

    return {
      branch,
      upstream,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      hasConflicts: unstaged.some((c) => c.status === GitFileStatus.UNMERGED),
      isClean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    };
  }

  async getBranches(repositoryId: string): Promise<GitBranch[]> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const { stdout } = await execAsync(
      'git branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)|%(HEAD)"',
      { cwd: repository.localPath }
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, lastCommit, upstream, head] = line.split('|');
        return {
          name,
          current: head === '*',
          upstream: upstream || undefined,
          lastCommit,
        };
      });
  }

  async getRecentCommits(repositoryId: string, limit = 10): Promise<GitCommit[]> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const { stdout } = await execAsync(
      `git log -${limit} --format="%H|%h|%an|%ae|%aI|%s"`,
      { cwd: repository.localPath }
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, email, dateStr, message] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          email,
          date: new Date(dateStr),
          message,
        };
      });
  }

  async getRemotes(repositoryId: string): Promise<GitRemote[]> {
    this.ensureNotDisposed();

    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const { stdout } = await execAsync('git remote -v', { cwd: repository.localPath });

    const remotes = new Map<string, GitRemote>();

    stdout
      .split('\n')
      .filter(Boolean)
      .forEach((line) => {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
        if (match) {
          const [, name, url, type] = match;
          const existing = remotes.get(name) || { name, fetchUrl: '', pushUrl: '' };
          if (type === 'fetch') {
            existing.fetchUrl = url;
          } else {
            existing.pushUrl = url;
          }
          remotes.set(name, existing);
        }
      });

    return Array.from(remotes.values());
  }

  // ==================== Events ====================

  onRepositoryEvent(handler: (event: RepositoryEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    this.disposed = true;
    this.repositories.clear();
    this.repositoriesByPath.clear();
    this.workspaces.clear();
    this.dependencies.clear();
    this.eventHandlers.clear();
  }

  // ==================== Private Helpers ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MultiRepoManager has been disposed');
    }
  }

  private emitEvent(
    type: RepositoryEventType,
    repositoryId: string,
    data: Record<string, unknown>
  ): void {
    const event: RepositoryEvent = {
      type,
      repositoryId,
      data,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private async isGitRepository(path: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: path });
      return true;
    } catch {
      return false;
    }
  }

  private async getRemoteUrl(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: path });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private async getDefaultBranch(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed "s@^refs/remotes/origin/@@"',
        { cwd: path }
      );
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // Fallback
    }

    // Try common defaults
    try {
      await execAsync('git rev-parse --verify main', { cwd: path });
      return 'main';
    } catch {
      // Ignore
    }

    try {
      await execAsync('git rev-parse --verify master', { cwd: path });
      return 'master';
    } catch {
      // Ignore
    }

    return 'main';
  }

  private async getCurrentBranch(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: path });
      return stdout.trim();
    } catch {
      return 'main';
    }
  }

  private parseGitSyncOutput(output: string): SyncResult['changes'] {
    // Simplified parsing
    const commitMatch = output.match(/(\d+) commits?/);
    const insertMatch = output.match(/(\d+) insertions?/);
    const deleteMatch = output.match(/(\d+) deletions?/);

    return {
      commits: commitMatch ? parseInt(commitMatch[1], 10) : 0,
      additions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
      deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0,
    };
  }

  private parseGitStatus(char: string): GitFileStatus {
    const mapping: Record<string, GitFileStatus> = {
      M: GitFileStatus.MODIFIED,
      A: GitFileStatus.ADDED,
      D: GitFileStatus.DELETED,
      R: GitFileStatus.RENAMED,
      C: GitFileStatus.COPIED,
      U: GitFileStatus.UNMERGED,
      '?': GitFileStatus.UNTRACKED,
      '!': GitFileStatus.IGNORED,
    };
    return mapping[char] || GitFileStatus.MODIFIED;
  }

  private async wouldCreateCycle(sourceId: string, targetId: string): Promise<boolean> {
    // Check if adding source -> target would create a cycle
    // by seeing if target already has a path to source
    const visited = new Set<string>();
    const queue = [targetId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === sourceId) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Get dependencies of current
      const deps = await this.getDependencies(current);
      for (const dep of deps) {
        queue.push(dep.targetRepoId);
      }
    }

    return false;
  }

  private async topologicalSort(repositoryIds: string[]): Promise<string[]> {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const id of repositoryIds) {
      inDegree.set(id, 0);
      graph.set(id, []);
    }

    // Build graph
    for (const id of repositoryIds) {
      const deps = await this.getDependencies(id);
      for (const dep of deps) {
        if (repositoryIds.includes(dep.targetRepoId)) {
          graph.get(dep.targetRepoId)!.push(id);
          inDegree.set(id, (inDegree.get(id) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue = repositoryIds.filter((id) => inDegree.get(id) === 0);
    const result: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If result doesn't include all repos, there's a cycle - return original order
    if (result.length !== repositoryIds.length) {
      return repositoryIds;
    }

    return result;
  }
}
