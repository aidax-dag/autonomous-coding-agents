/**
 * Workspace Manager
 *
 * Manages the .agent-workspace directory structure for task documents.
 * Provides file system operations for the document-based task queue.
 *
 * Directory Structure:
 * .agent-workspace/
 * ├── inbox/           # Incoming tasks by team
 * │   ├── planning/
 * │   ├── design/
 * │   ├── development/
 * │   │   ├── frontend/
 * │   │   └── backend/
 * │   ├── qa/
 * │   ├── code-quality/
 * │   ├── infrastructure/
 * │   ├── pm/
 * │   └── issue-response/
 * ├── outbox/          # Completed/sent tasks
 * ├── in-progress/     # Currently processing
 * ├── failed/          # Failed tasks for retry
 * ├── archive/         # Archived completed tasks
 * ├── knowledge/       # Shared knowledge base
 * └── metrics/         # Performance metrics
 *
 * Feature: Document-based Task Queue for Agent OS
 */

import * as path from 'path';
import { TeamType, TeamTypeSchema } from './task-document';
import type { IFileSystem } from '@/shared/fs/file-system';
import { nodeFileSystem } from '@/shared/fs/file-system';

/**
 * Workspace directory names
 */
export const WORKSPACE_DIRS = {
  ROOT: '.agent-workspace',
  INBOX: 'inbox',
  OUTBOX: 'outbox',
  IN_PROGRESS: 'in-progress',
  FAILED: 'failed',
  ARCHIVE: 'archive',
  KNOWLEDGE: 'knowledge',
  METRICS: 'metrics',
} as const;

/**
 * Team subdirectories under inbox
 */
const TEAM_SUBDIRS: Record<TeamType, string[]> = {
  orchestrator: [],
  planning: [],
  design: [],
  development: ['frontend', 'backend'],
  frontend: [],
  backend: [],
  qa: [],
  'code-quality': [],
  security: [],
  documentation: [],
  operations: [],
  testing: [],
  infrastructure: [],
  pm: [],
  'issue-response': [],
};

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  /** Base directory for workspace (default: current working directory) */
  baseDir?: string;
  /** Workspace root directory name (default: .agent-workspace) */
  workspaceName?: string;
  /** Auto-create directories on initialization */
  autoCreate?: boolean;
  /** Optional filesystem adapter for testing/mocking */
  fileSystem?: IFileSystem;
}

/**
 * Workspace file info
 */
export interface WorkspaceFile {
  path: string;
  name: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Workspace Manager
 */
export class WorkspaceManager {
  private readonly baseDir: string;
  private readonly workspaceName: string;
  private readonly autoCreate: boolean;
  private readonly fileSystem: IFileSystem;
  private initialized: boolean = false;

  constructor(config: WorkspaceConfig = {}) {
    this.baseDir = config.baseDir || process.cwd();
    this.workspaceName = config.workspaceName || WORKSPACE_DIRS.ROOT;
    this.autoCreate = config.autoCreate ?? true;
    this.fileSystem = config.fileSystem ?? nodeFileSystem;
  }

  /**
   * Get workspace root path
   */
  get rootPath(): string {
    return path.join(this.baseDir, this.workspaceName);
  }

  /**
   * Get path for a specific directory
   */
  getPath(...segments: string[]): string {
    return path.join(this.rootPath, ...segments);
  }

  /**
   * Get inbox path for a team
   */
  getInboxPath(team: TeamType, subteam?: string): string {
    const segments: string[] = [WORKSPACE_DIRS.INBOX, team];
    if (subteam) {
      segments.push(subteam);
    }
    return this.getPath(...segments);
  }

  /**
   * Get outbox path
   */
  getOutboxPath(): string {
    return this.getPath(WORKSPACE_DIRS.OUTBOX);
  }

  /**
   * Get in-progress path
   */
  getInProgressPath(): string {
    return this.getPath(WORKSPACE_DIRS.IN_PROGRESS);
  }

  /**
   * Get failed path
   */
  getFailedPath(): string {
    return this.getPath(WORKSPACE_DIRS.FAILED);
  }

  /**
   * Get archive path
   */
  getArchivePath(): string {
    return this.getPath(WORKSPACE_DIRS.ARCHIVE);
  }

  /**
   * Get knowledge base path
   */
  getKnowledgePath(): string {
    return this.getPath(WORKSPACE_DIRS.KNOWLEDGE);
  }

  /**
   * Get metrics path
   */
  getMetricsPath(): string {
    return this.getPath(WORKSPACE_DIRS.METRICS);
  }

  /**
   * Initialize workspace directory structure
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create root directory
    await this.fileSystem.mkdir(this.rootPath, { recursive: true });

    // Create main directories
    const mainDirs = [
      WORKSPACE_DIRS.INBOX,
      WORKSPACE_DIRS.OUTBOX,
      WORKSPACE_DIRS.IN_PROGRESS,
      WORKSPACE_DIRS.FAILED,
      WORKSPACE_DIRS.ARCHIVE,
      WORKSPACE_DIRS.KNOWLEDGE,
      WORKSPACE_DIRS.METRICS,
    ];

    for (const dir of mainDirs) {
      await this.fileSystem.mkdir(this.getPath(dir), { recursive: true });
    }

    // Create team inbox directories
    const teams = TeamTypeSchema.options;
    for (const team of teams) {
      await this.fileSystem.mkdir(this.getInboxPath(team), { recursive: true });

      // Create subdirectories for teams that have them
      const subdirs = TEAM_SUBDIRS[team];
      for (const subdir of subdirs) {
        await this.fileSystem.mkdir(this.getInboxPath(team, subdir), { recursive: true });
      }
    }

    // Create .gitkeep files in empty directories
    await this.createGitkeepFiles();

    this.initialized = true;
  }

  /**
   * Create .gitkeep files in directories
   */
  private async createGitkeepFiles(): Promise<void> {
    const directories = [
      this.getOutboxPath(),
      this.getInProgressPath(),
      this.getFailedPath(),
      this.getArchivePath(),
      this.getKnowledgePath(),
      this.getMetricsPath(),
    ];

    for (const dir of directories) {
      const gitkeepPath = path.join(dir, '.gitkeep');
      try {
        await this.fileSystem.access(gitkeepPath);
      } catch {
        await this.fileSystem.writeFile(gitkeepPath, '');
      }
    }
  }

  /**
   * Check if workspace exists
   */
  async exists(): Promise<boolean> {
    try {
      await this.fileSystem.access(this.rootPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure workspace is initialized
   */
  async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.autoCreate) {
      const exists = await this.exists();
      if (!exists) {
        await this.initialize();
      } else {
        this.initialized = true;
      }
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(dirPath: string, pattern?: RegExp): Promise<WorkspaceFile[]> {
    await this.ensureInitialized();

    try {
      const entries = await this.fileSystem.readdir(dirPath, { withFileTypes: true });
      const files: WorkspaceFile[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name !== '.gitkeep') {
          if (pattern && !pattern.test(entry.name)) {
            continue;
          }

          const filePath = path.join(dirPath, entry.name);
          const stats = await this.fileSystem.stat(filePath);

          files.push({
            path: filePath,
            name: entry.name,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          });
        }
      }

      // Sort by creation time (oldest first for FIFO processing)
      return files.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    await this.ensureInitialized();
    return this.fileSystem.readFile(filePath, 'utf-8');
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    await this.ensureInitialized();

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await this.fileSystem.mkdir(dir, { recursive: true });

    await this.fileSystem.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Move file to another directory
   */
  async moveFile(sourcePath: string, destDir: string): Promise<string> {
    await this.ensureInitialized();

    const fileName = path.basename(sourcePath);
    const destPath = path.join(destDir, fileName);

    // Ensure destination directory exists
    await this.fileSystem.mkdir(destDir, { recursive: true });

    await this.fileSystem.rename(sourcePath, destPath);
    return destPath;
  }

  /**
   * Copy file to another directory
   */
  async copyFile(sourcePath: string, destDir: string): Promise<string> {
    await this.ensureInitialized();

    const fileName = path.basename(sourcePath);
    const destPath = path.join(destDir, fileName);

    // Ensure destination directory exists
    await this.fileSystem.mkdir(destDir, { recursive: true });

    await this.fileSystem.copyFile(sourcePath, destPath);
    return destPath;
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.ensureInitialized();
    await this.fileSystem.unlink(filePath);
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.fileSystem.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<WorkspaceFile | null> {
    try {
      const stats = await this.fileSystem.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up old files from a directory
   */
  async cleanupOldFiles(dirPath: string, maxAgeMs: number): Promise<number> {
    await this.ensureInitialized();

    const files = await this.listFiles(dirPath);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const age = now - file.modifiedAt.getTime();
      if (age > maxAgeMs) {
        await this.deleteFile(file.path);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get workspace statistics
   */
  async getStats(): Promise<{
    inboxCount: Record<TeamType, number>;
    outboxCount: number;
    inProgressCount: number;
    failedCount: number;
    archiveCount: number;
  }> {
    await this.ensureInitialized();

    const teams = TeamTypeSchema.options;
    const inboxCount: Record<TeamType, number> = {} as Record<TeamType, number>;

    for (const team of teams) {
      const files = await this.listFiles(this.getInboxPath(team), /\.md$/);
      inboxCount[team] = files.length;
    }

    const outboxFiles = await this.listFiles(this.getOutboxPath(), /\.md$/);
    const inProgressFiles = await this.listFiles(this.getInProgressPath(), /\.md$/);
    const failedFiles = await this.listFiles(this.getFailedPath(), /\.md$/);
    const archiveFiles = await this.listFiles(this.getArchivePath(), /\.md$/);

    return {
      inboxCount,
      outboxCount: outboxFiles.length,
      inProgressCount: inProgressFiles.length,
      failedCount: failedFiles.length,
      archiveCount: archiveFiles.length,
    };
  }

  /**
   * Reset workspace (delete all files but keep structure)
   */
  async reset(): Promise<void> {
    const directories = [
      this.getOutboxPath(),
      this.getInProgressPath(),
      this.getFailedPath(),
    ];

    // Clear main directories
    for (const dir of directories) {
      const files = await this.listFiles(dir);
      for (const file of files) {
        await this.deleteFile(file.path);
      }
    }

    // Clear team inboxes
    const teams = TeamTypeSchema.options;
    for (const team of teams) {
      const files = await this.listFiles(this.getInboxPath(team));
      for (const file of files) {
        await this.deleteFile(file.path);
      }
    }
  }

  /**
   * Destroy workspace (delete entire directory)
   */
  async destroy(): Promise<void> {
    await this.fileSystem.rm(this.rootPath, { recursive: true, force: true });
    this.initialized = false;
  }
}
