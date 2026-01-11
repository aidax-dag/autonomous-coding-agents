/**
 * Multi-Repository Manager Tests
 *
 * Feature: F5.11 - Multi-Repo
 */

import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  MultiRepoManager,
  type RegisterRepositoryRequest,
  type CreateWorkspaceRequest,
  DEFAULT_REPOSITORY_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
} from '../../../../src/core/enterprise/multi-repo/index.js';

describe('MultiRepoManager', () => {
  let manager: MultiRepoManager;
  let testDir: string;
  let repoPath1: string;
  let repoPath2: string;

  beforeEach(() => {
    manager = new MultiRepoManager();

    // Create test directory
    testDir = join(tmpdir(), `multi-repo-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create two test git repositories
    repoPath1 = join(testDir, 'repo1');
    repoPath2 = join(testDir, 'repo2');

    mkdirSync(repoPath1, { recursive: true });
    mkdirSync(repoPath2, { recursive: true });

    // Initialize git repos
    execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', {
      cwd: repoPath1,
      stdio: 'pipe',
    });
    execSync('touch README.md && git add . && git commit -m "Initial commit"', {
      cwd: repoPath1,
      stdio: 'pipe',
    });

    execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', {
      cwd: repoPath2,
      stdio: 'pipe',
    });
    execSync('touch README.md && git add . && git commit -m "Initial commit"', {
      cwd: repoPath2,
      stdio: 'pipe',
    });
  });

  afterEach(() => {
    manager.dispose();
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ==================== Repository Management ====================

  describe('Repository Management', () => {
    describe('registerRepository', () => {
      it('should register a repository', async () => {
        const request: RegisterRepositoryRequest = {
          name: 'Test Repo',
          description: 'A test repository',
          localPath: repoPath1,
        };

        const repo = await manager.registerRepository(request);

        expect(repo.id).toBeDefined();
        expect(repo.name).toBe('Test Repo');
        expect(repo.description).toBe('A test repository');
        expect(repo.localPath).toBe(repoPath1);
        expect(repo.status).toBe('active');
        expect(repo.type).toBe('primary');
        expect(repo.settings).toEqual(expect.objectContaining(DEFAULT_REPOSITORY_SETTINGS));
      });

      it('should reject non-existent path', async () => {
        const request: RegisterRepositoryRequest = {
          name: 'Test Repo',
          localPath: '/non/existent/path',
        };

        await expect(manager.registerRepository(request)).rejects.toThrow('Path does not exist');
      });

      it('should reject non-git repository', async () => {
        const nonGitPath = join(testDir, 'not-a-repo');
        mkdirSync(nonGitPath, { recursive: true });

        const request: RegisterRepositoryRequest = {
          name: 'Test Repo',
          localPath: nonGitPath,
        };

        await expect(manager.registerRepository(request)).rejects.toThrow('not a git repository');
      });

      it('should reject duplicate path registration', async () => {
        const request: RegisterRepositoryRequest = {
          name: 'Test Repo',
          localPath: repoPath1,
        };

        await manager.registerRepository(request);

        await expect(manager.registerRepository(request)).rejects.toThrow('already registered');
      });

      it('should emit repo.registered event', async () => {
        const handler = jest.fn();
        manager.onRepositoryEvent(handler);

        await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'repo.registered',
          })
        );
      });
    });

    describe('getRepository', () => {
      it('should get repository by ID', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const retrieved = await manager.getRepository(repo.id);

        expect(retrieved).toEqual(repo);
      });

      it('should return undefined for non-existent repository', async () => {
        const retrieved = await manager.getRepository('non-existent');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('getRepositoryByPath', () => {
      it('should get repository by path', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const retrieved = await manager.getRepositoryByPath(repoPath1);

        expect(retrieved).toEqual(repo);
      });
    });

    describe('updateRepository', () => {
      it('should update repository properties', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const updated = await manager.updateRepository(repo.id, {
          name: 'Updated Repo',
          description: 'Updated description',
        });

        expect(updated.name).toBe('Updated Repo');
        expect(updated.description).toBe('Updated description');
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(repo.updatedAt.getTime());
      });

      it('should update repository settings', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const updated = await manager.updateRepository(repo.id, {
          settings: {
            autoSync: true,
            autoSyncInterval: 600,
          },
        });

        expect(updated.settings.autoSync).toBe(true);
        expect(updated.settings.autoSyncInterval).toBe(600);
        // Other settings preserved
        expect(updated.settings.syncOnPush).toBe(true);
      });

      it('should reject non-existent repository', async () => {
        await expect(
          manager.updateRepository('non-existent', { name: 'Updated' })
        ).rejects.toThrow('Repository not found');
      });
    });

    describe('removeRepository', () => {
      it('should remove repository', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const result = await manager.removeRepository(repo.id);

        expect(result).toBe(true);
        expect(await manager.getRepository(repo.id)).toBeUndefined();
      });

      it('should return false for non-existent repository', async () => {
        const result = await manager.removeRepository('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('getRepositories', () => {
      it('should get all repositories', async () => {
        await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });
        await manager.registerRepository({
          name: 'Repo 2',
          localPath: repoPath2,
        });

        const repos = await manager.getRepositories();

        expect(repos).toHaveLength(2);
      });

      it('should filter by status', async () => {
        const repo = await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });
        await manager.registerRepository({
          name: 'Repo 2',
          localPath: repoPath2,
        });

        await manager.updateRepository(repo.id, { status: 'archived' });

        const active = await manager.getRepositories({ status: 'active' });
        expect(active).toHaveLength(1);

        const archived = await manager.getRepositories({ status: 'archived', includeArchived: true });
        expect(archived).toHaveLength(1);
      });

      it('should filter by type', async () => {
        await manager.registerRepository({
          name: 'Primary',
          localPath: repoPath1,
          type: 'primary',
        });
        await manager.registerRepository({
          name: 'Dependency',
          localPath: repoPath2,
          type: 'dependency',
        });

        const primary = await manager.getRepositories({ type: 'primary' });
        expect(primary).toHaveLength(1);
        expect(primary[0].type).toBe('primary');
      });

      it('should filter by name pattern', async () => {
        await manager.registerRepository({
          name: 'Frontend App',
          localPath: repoPath1,
        });
        await manager.registerRepository({
          name: 'Backend API',
          localPath: repoPath2,
        });

        const frontend = await manager.getRepositories({ namePattern: 'frontend' });
        expect(frontend).toHaveLength(1);
        expect(frontend[0].name).toBe('Frontend App');
      });
    });

    describe('getTeamRepositories', () => {
      it('should get repositories for a team', async () => {
        await manager.registerRepository({
          name: 'Team 1 Repo',
          localPath: repoPath1,
          teamId: 'team-1',
        });
        await manager.registerRepository({
          name: 'Team 2 Repo',
          localPath: repoPath2,
          teamId: 'team-2',
        });

        const teamRepos = await manager.getTeamRepositories('team-1');

        expect(teamRepos).toHaveLength(1);
        expect(teamRepos[0].teamId).toBe('team-1');
      });
    });
  });

  // ==================== Workspace Management ====================

  describe('Workspace Management', () => {
    describe('createWorkspace', () => {
      it('should create a workspace', async () => {
        const request: CreateWorkspaceRequest = {
          name: 'My Workspace',
          description: 'A test workspace',
          rootPath: testDir,
        };

        const workspace = await manager.createWorkspace(request);

        expect(workspace.id).toBeDefined();
        expect(workspace.name).toBe('My Workspace');
        expect(workspace.description).toBe('A test workspace');
        expect(workspace.rootPath).toBe(testDir);
        expect(workspace.status).toBe('active');
        expect(workspace.repositoryIds).toEqual([]);
        expect(workspace.settings).toEqual(expect.objectContaining(DEFAULT_WORKSPACE_SETTINGS));
      });

      it('should reject non-existent root path', async () => {
        const request: CreateWorkspaceRequest = {
          name: 'My Workspace',
          rootPath: '/non/existent/path',
        };

        await expect(manager.createWorkspace(request)).rejects.toThrow('Root path does not exist');
      });

      it('should create workspace with initial repositories', async () => {
        const repo = await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });

        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
          repositoryIds: [repo.id],
        });

        expect(workspace.repositoryIds).toContain(repo.id);
      });
    });

    describe('getWorkspace', () => {
      it('should get workspace by ID', async () => {
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
        });

        const retrieved = await manager.getWorkspace(workspace.id);

        expect(retrieved).toEqual(workspace);
      });
    });

    describe('updateWorkspace', () => {
      it('should update workspace', async () => {
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
        });

        const updated = await manager.updateWorkspace(workspace.id, {
          name: 'Updated Workspace',
          description: 'Updated description',
        });

        expect(updated.name).toBe('Updated Workspace');
        expect(updated.description).toBe('Updated description');
      });
    });

    describe('deleteWorkspace', () => {
      it('should delete workspace', async () => {
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
        });

        const result = await manager.deleteWorkspace(workspace.id);

        expect(result).toBe(true);
        expect(await manager.getWorkspace(workspace.id)).toBeUndefined();
      });
    });

    describe('addRepositoryToWorkspace', () => {
      it('should add repository to workspace', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
        });

        await manager.addRepositoryToWorkspace(workspace.id, repo.id);

        const updated = await manager.getWorkspace(workspace.id);
        expect(updated?.repositoryIds).toContain(repo.id);
      });

      it('should not add duplicate repository', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
          repositoryIds: [repo.id],
        });

        await manager.addRepositoryToWorkspace(workspace.id, repo.id);

        const updated = await manager.getWorkspace(workspace.id);
        expect(updated?.repositoryIds.filter((id) => id === repo.id)).toHaveLength(1);
      });
    });

    describe('removeRepositoryFromWorkspace', () => {
      it('should remove repository from workspace', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });
        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
          repositoryIds: [repo.id],
        });

        await manager.removeRepositoryFromWorkspace(workspace.id, repo.id);

        const updated = await manager.getWorkspace(workspace.id);
        expect(updated?.repositoryIds).not.toContain(repo.id);
      });
    });
  });

  // ==================== Dependency Management ====================

  describe('Dependency Management', () => {
    describe('addDependency', () => {
      it('should add dependency between repositories', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        const dep = await manager.addDependency(repo1.id, repo2.id, 'npm', '^1.0.0');

        expect(dep.id).toBeDefined();
        expect(dep.sourceRepoId).toBe(repo1.id);
        expect(dep.targetRepoId).toBe(repo2.id);
        expect(dep.type).toBe('npm');
        expect(dep.version).toBe('^1.0.0');
      });

      it('should reject non-existent source repository', async () => {
        const repo = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath1,
        });

        await expect(
          manager.addDependency('non-existent', repo.id, 'npm')
        ).rejects.toThrow('Source repository not found');
      });

      it('should detect circular dependencies', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        // A depends on B
        await manager.addDependency(repo1.id, repo2.id, 'npm');

        // B depends on A would create a cycle
        await expect(
          manager.addDependency(repo2.id, repo1.id, 'npm')
        ).rejects.toThrow('circular dependency');
      });
    });

    describe('removeDependency', () => {
      it('should remove dependency', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        const dep = await manager.addDependency(repo1.id, repo2.id, 'npm');
        const result = await manager.removeDependency(dep.id);

        expect(result).toBe(true);

        const deps = await manager.getDependencies(repo1.id);
        expect(deps).toHaveLength(0);
      });
    });

    describe('getDependencies', () => {
      it('should get dependencies for a repository', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        await manager.addDependency(repo1.id, repo2.id, 'npm');

        const deps = await manager.getDependencies(repo1.id);

        expect(deps).toHaveLength(1);
        expect(deps[0].targetRepoId).toBe(repo2.id);
      });
    });

    describe('getDependents', () => {
      it('should get dependents for a repository', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        await manager.addDependency(repo1.id, repo2.id, 'npm');

        const dependents = await manager.getDependents(repo2.id);

        expect(dependents).toHaveLength(1);
        expect(dependents[0].sourceRepoId).toBe(repo1.id);
      });
    });

    describe('getDependencyGraph', () => {
      it('should build dependency graph for workspace', async () => {
        const repo1 = await manager.registerRepository({
          name: 'App',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Lib',
          localPath: repoPath2,
        });

        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
          repositoryIds: [repo1.id, repo2.id],
        });

        await manager.addDependency(repo1.id, repo2.id, 'npm');

        const graph = await manager.getDependencyGraph(workspace.id);

        expect(graph.get(repo1.id)).toContain(repo2.id);
        expect(graph.get(repo2.id)).toEqual([]);
      });
    });
  });

  // ==================== Repository Info ====================

  describe('Repository Info', () => {
    describe('getGitStatus', () => {
      it('should get git status for repository', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const status = await manager.getGitStatus(repo.id);

        expect(status.branch).toBeDefined();
        expect(status.isClean).toBe(true);
        expect(status.staged).toEqual([]);
        expect(status.unstaged).toEqual([]);
      });
    });

    describe('getBranches', () => {
      it('should get branches for repository', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const branches = await manager.getBranches(repo.id);

        expect(branches.length).toBeGreaterThan(0);
        expect(branches.some((b) => b.current)).toBe(true);
      });
    });

    describe('getRecentCommits', () => {
      it('should get recent commits', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const commits = await manager.getRecentCommits(repo.id, 5);

        expect(commits.length).toBeGreaterThan(0);
        expect(commits[0].hash).toBeDefined();
        expect(commits[0].message).toBe('Initial commit');
      });
    });
  });

  // ==================== Health & Statistics ====================

  describe('Health & Statistics', () => {
    describe('checkRepositoryHealth', () => {
      it('should check repository health', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const health = await manager.checkRepositoryHealth(repo.id);

        expect(health.repositoryId).toBe(repo.id);
        // In test environment, may be 'warning' due to no remote configured
        expect(['healthy', 'warning']).toContain(health.status);
        expect(health.score).toBeGreaterThan(0);
        expect(health.checks.length).toBeGreaterThan(0);
        expect(health.checks.some((c) => c.name === 'path_exists')).toBe(true);
      });
    });

    describe('getRepositoryStatistics', () => {
      it('should get repository statistics', async () => {
        const repo = await manager.registerRepository({
          name: 'Test Repo',
          localPath: repoPath1,
        });

        const stats = await manager.getRepositoryStatistics(repo.id);

        expect(stats.repositoryId).toBe(repo.id);
        expect(stats.totalCommits).toBeGreaterThan(0);
        expect(stats.branchCount).toBeGreaterThan(0);
        expect(stats.fileCount).toBeGreaterThan(0);
      });
    });

    describe('getWorkspaceStatistics', () => {
      it('should get workspace statistics', async () => {
        const repo1 = await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Repo 2',
          localPath: repoPath2,
        });

        const workspace = await manager.createWorkspace({
          name: 'My Workspace',
          rootPath: testDir,
          repositoryIds: [repo1.id, repo2.id],
        });

        const stats = await manager.getWorkspaceStatistics(workspace.id);

        expect(stats.workspaceId).toBe(workspace.id);
        expect(stats.repositoryCount).toBe(2);
        expect(stats.totalCommits).toBeGreaterThan(0);
      });
    });
  });

  // ==================== Cross-Repo Branch Operations ====================

  describe('Cross-Repo Branch Operations', () => {
    describe('createCrossRepoBranch', () => {
      it('should create branch across repositories', async () => {
        const repo1 = await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Repo 2',
          localPath: repoPath2,
        });

        const operation = await manager.createCrossRepoBranch(
          'feature/test',
          [repo1.id, repo2.id]
        );

        expect(operation.branchName).toBe('feature/test');
        expect(operation.operation).toBe('create');
        expect(operation.status).toBe('completed');
        expect(operation.results.get(repo1.id)?.success).toBe(true);
        expect(operation.results.get(repo2.id)?.success).toBe(true);
      });
    });

    describe('deleteCrossRepoBranch', () => {
      it('should delete branch across repositories', async () => {
        const repo1 = await manager.registerRepository({
          name: 'Repo 1',
          localPath: repoPath1,
        });
        const repo2 = await manager.registerRepository({
          name: 'Repo 2',
          localPath: repoPath2,
        });

        // Create branch first
        await manager.createCrossRepoBranch('feature/to-delete', [repo1.id, repo2.id]);

        // Switch back to default branch
        execSync('git checkout -', { cwd: repoPath1, stdio: 'pipe' });
        execSync('git checkout -', { cwd: repoPath2, stdio: 'pipe' });

        const operation = await manager.deleteCrossRepoBranch(
          'feature/to-delete',
          [repo1.id, repo2.id]
        );

        expect(operation.branchName).toBe('feature/to-delete');
        expect(operation.operation).toBe('delete');
        expect(operation.status).toBe('completed');
      });
    });
  });

  // ==================== Events ====================

  describe('Events', () => {
    it('should subscribe and unsubscribe from events', async () => {
      const handler = jest.fn();
      const unsubscribe = manager.onRepositoryEvent(handler);

      await manager.registerRepository({
        name: 'Test Repo',
        localPath: repoPath1,
      });

      expect(handler).toHaveBeenCalled();

      unsubscribe();
      handler.mockClear();

      await manager.registerRepository({
        name: 'Another Repo',
        localPath: repoPath2,
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==================== Lifecycle ====================

  describe('Lifecycle', () => {
    it('should throw after dispose', async () => {
      manager.dispose();

      await expect(
        manager.registerRepository({
          name: 'Test',
          localPath: repoPath1,
        })
      ).rejects.toThrow('disposed');
    });

    it('should clean up data on dispose', async () => {
      await manager.registerRepository({
        name: 'Test Repo',
        localPath: repoPath1,
      });
      await manager.createWorkspace({
        name: 'Test Workspace',
        rootPath: testDir,
      });

      manager.dispose();

      // Create new manager to verify old data is gone
      const newManager = new MultiRepoManager();
      const repos = await newManager.getRepositories();
      const workspaces = await newManager.getWorkspaces();

      expect(repos).toHaveLength(0);
      expect(workspaces).toHaveLength(0);

      newManager.dispose();
    });
  });
});
