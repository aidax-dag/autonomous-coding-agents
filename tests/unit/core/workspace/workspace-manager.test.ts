/**
 * Workspace Manager Tests
 */

import { WorkspaceManager, WORKSPACE_DIRS } from '../../../../src/core/workspace/workspace-manager';

// ============================================================================
// Mocks
// ============================================================================

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockReaddir = jest.fn().mockResolvedValue([]);
const mockStat = jest.fn().mockResolvedValue({
  size: 100,
  birthtime: new Date('2024-01-01'),
  mtime: new Date('2024-01-02'),
});
const mockReadFile = jest.fn().mockResolvedValue('file content');
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockRename = jest.fn().mockResolvedValue(undefined);
const mockCopyFile = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockAccess = jest.fn().mockResolvedValue(undefined);
const mockRm = jest.fn().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
  readdir: (...args: any[]) => mockReaddir(...args),
  stat: (...args: any[]) => mockStat(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  rename: (...args: any[]) => mockRename(...args),
  copyFile: (...args: any[]) => mockCopyFile(...args),
  unlink: (...args: any[]) => mockUnlink(...args),
  access: (...args: any[]) => mockAccess(...args),
  rm: (...args: any[]) => mockRm(...args),
}));

// ============================================================================
// Helpers
// ============================================================================

function createManager(overrides: Partial<{
  baseDir: string;
  workspaceName: string;
  autoCreate: boolean;
}> = {}): WorkspaceManager {
  return new WorkspaceManager({
    baseDir: '/tmp/test',
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('WorkspaceManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Constructor & Paths
  // ==========================================================================

  describe('constructor & paths', () => {
    it('should use default base dir and workspace name', () => {
      const mgr = new WorkspaceManager();
      expect(mgr.rootPath).toContain(WORKSPACE_DIRS.ROOT);
    });

    it('should use custom base dir', () => {
      const mgr = createManager({ baseDir: '/custom/path' });
      expect(mgr.rootPath).toBe('/custom/path/.agent-workspace');
    });

    it('should use custom workspace name', () => {
      const mgr = createManager({ workspaceName: 'my-workspace' });
      expect(mgr.rootPath).toBe('/tmp/test/my-workspace');
    });

    it('should construct inbox path for team', () => {
      const mgr = createManager();
      const inbox = mgr.getInboxPath('development' as any);
      expect(inbox).toContain('inbox');
      expect(inbox).toContain('development');
    });

    it('should construct inbox path with subteam', () => {
      const mgr = createManager();
      const inbox = mgr.getInboxPath('development' as any, 'frontend');
      expect(inbox).toContain('frontend');
    });

    it('should return outbox path', () => {
      const mgr = createManager();
      expect(mgr.getOutboxPath()).toContain('outbox');
    });

    it('should return in-progress path', () => {
      const mgr = createManager();
      expect(mgr.getInProgressPath()).toContain('in-progress');
    });

    it('should return failed path', () => {
      const mgr = createManager();
      expect(mgr.getFailedPath()).toContain('failed');
    });

    it('should return archive path', () => {
      const mgr = createManager();
      expect(mgr.getArchivePath()).toContain('archive');
    });

    it('should return knowledge path', () => {
      const mgr = createManager();
      expect(mgr.getKnowledgePath()).toContain('knowledge');
    });

    it('should return metrics path', () => {
      const mgr = createManager();
      expect(mgr.getMetricsPath()).toContain('metrics');
    });

    it('should construct path with segments', () => {
      const mgr = createManager();
      const p = mgr.getPath('inbox', 'development');
      expect(p).toContain('inbox');
      expect(p).toContain('development');
    });
  });

  // ==========================================================================
  // Initialize
  // ==========================================================================

  describe('initialize', () => {
    it('should create directory structure', async () => {
      const mgr = createManager();
      await mgr.initialize();

      // Should create root + main dirs + team inboxes
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockMkdir.mock.calls[0][0]).toContain('.agent-workspace');
    });

    it('should be idempotent', async () => {
      const mgr = createManager();
      await mgr.initialize();
      const callCount = mockMkdir.mock.calls.length;

      await mgr.initialize();
      expect(mockMkdir.mock.calls.length).toBe(callCount);
    });

    it('should create .gitkeep files', async () => {
      // access throws (file doesn't exist) so writeFile is called
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const mgr = createManager();
      await mgr.initialize();

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // exists / ensureInitialized
  // ==========================================================================

  describe('exists', () => {
    it('should return true when workspace exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      const mgr = createManager();
      expect(await mgr.exists()).toBe(true);
    });

    it('should return false when workspace does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const mgr = createManager();
      expect(await mgr.exists()).toBe(false);
    });
  });

  describe('ensureInitialized', () => {
    it('should initialize if not exists and autoCreate true', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const mgr = createManager({ autoCreate: true });
      await mgr.ensureInitialized();

      expect(mockMkdir).toHaveBeenCalled();
    });

    it('should not initialize if autoCreate is false', async () => {
      const mgr = createManager({ autoCreate: false });
      await mgr.ensureInitialized();

      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('should mark as initialized if workspace already exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      const mgr = createManager();
      await mgr.ensureInitialized();

      // Second call should skip initialization
      mockMkdir.mockClear();
      await mgr.ensureInitialized();
      // Shouldn't call initialize if already marked
    });
  });

  // ==========================================================================
  // File operations
  // ==========================================================================

  describe('listFiles', () => {
    it('should list files matching pattern', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'task.md', isFile: () => true },
        { name: 'notes.txt', isFile: () => true },
        { name: '.gitkeep', isFile: () => true },
        { name: 'subdir', isFile: () => false },
      ]);
      mockStat.mockResolvedValue({
        size: 100,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      });

      const mgr = createManager();
      // Pre-initialize to avoid calling access in ensureInitialized
      await mgr.initialize();

      const files = await mgr.listFiles('/some/path', /\.md$/);

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('task.md');
    });

    it('should exclude .gitkeep files', async () => {
      mockReaddir.mockResolvedValue([
        { name: '.gitkeep', isFile: () => true },
      ]);

      const mgr = createManager();
      await mgr.initialize();
      const files = await mgr.listFiles('/some/path');

      expect(files).toHaveLength(0);
    });

    it('should return empty array for ENOENT', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReaddir.mockRejectedValue(error);

      const mgr = createManager();
      await mgr.initialize();
      const files = await mgr.listFiles('/nonexistent');

      expect(files).toEqual([]);
    });

    it('should re-throw non-ENOENT errors', async () => {
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const mgr = createManager();
      await mgr.initialize();

      await expect(mgr.listFiles('/some/path')).rejects.toThrow('Permission denied');
    });

    it('should sort files by creation time', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'newer.md', isFile: () => true },
        { name: 'older.md', isFile: () => true },
      ]);
      mockStat
        .mockResolvedValueOnce({ size: 50, birthtime: new Date('2024-02-01'), mtime: new Date('2024-02-01') })
        .mockResolvedValueOnce({ size: 50, birthtime: new Date('2024-01-01'), mtime: new Date('2024-01-01') });

      const mgr = createManager();
      await mgr.initialize();
      const files = await mgr.listFiles('/some/path', /\.md$/);

      expect(files[0].name).toBe('older.md');
      expect(files[1].name).toBe('newer.md');
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      mockReadFile.mockResolvedValue('task content');
      const mgr = createManager();
      await mgr.initialize();

      const content = await mgr.readFile('/path/to/file.md');
      expect(content).toBe('task content');
    });
  });

  describe('writeFile', () => {
    it('should write file and ensure directory exists', async () => {
      const mgr = createManager();
      await mgr.initialize();

      await mgr.writeFile('/path/to/file.md', 'content');

      expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('/path/to'), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/file.md', 'content', 'utf-8');
    });
  });

  describe('moveFile', () => {
    it('should rename file to destination', async () => {
      const mgr = createManager();
      await mgr.initialize();

      const destPath = await mgr.moveFile('/source/file.md', '/dest');

      expect(mockMkdir).toHaveBeenCalledWith('/dest', { recursive: true });
      expect(mockRename).toHaveBeenCalledWith('/source/file.md', '/dest/file.md');
      expect(destPath).toBe('/dest/file.md');
    });
  });

  describe('copyFile', () => {
    it('should copy file to destination', async () => {
      const mgr = createManager();
      await mgr.initialize();

      const destPath = await mgr.copyFile('/source/file.md', '/dest');

      expect(mockMkdir).toHaveBeenCalledWith('/dest', { recursive: true });
      expect(mockCopyFile).toHaveBeenCalledWith('/source/file.md', '/dest/file.md');
      expect(destPath).toBe('/dest/file.md');
    });
  });

  describe('deleteFile', () => {
    it('should unlink file', async () => {
      const mgr = createManager();
      await mgr.initialize();

      await mgr.deleteFile('/path/to/file.md');
      expect(mockUnlink).toHaveBeenCalledWith('/path/to/file.md');
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      const mgr = createManager();
      expect(await mgr.fileExists('/path/file.md')).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const mgr = createManager();
      expect(await mgr.fileExists('/nonexistent')).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return file info', async () => {
      mockStat.mockResolvedValue({
        size: 200,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      });

      const mgr = createManager();
      const stats = await mgr.getFileStats('/path/file.md');

      expect(stats).not.toBeNull();
      expect(stats!.name).toBe('file.md');
      expect(stats!.size).toBe(200);
    });

    it('should return null for missing file', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));

      const mgr = createManager();
      const stats = await mgr.getFileStats('/nonexistent');
      expect(stats).toBeNull();
    });
  });

  // ==========================================================================
  // cleanupOldFiles
  // ==========================================================================

  describe('cleanupOldFiles', () => {
    it('should delete files older than maxAge', async () => {
      const now = Date.now();
      mockReaddir.mockResolvedValue([
        { name: 'old.md', isFile: () => true },
        { name: 'new.md', isFile: () => true },
      ]);
      mockStat
        .mockResolvedValueOnce({ size: 50, birthtime: new Date(now - 100000), mtime: new Date(now - 100000) })
        .mockResolvedValueOnce({ size: 50, birthtime: new Date(now - 1000), mtime: new Date(now - 1000) });

      const mgr = createManager();
      await mgr.initialize();

      const count = await mgr.cleanupOldFiles('/archive', 50000);
      expect(count).toBe(1);
      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should return workspace statistics', async () => {
      // Return empty for each directory listing
      mockReaddir.mockResolvedValue([]);

      const mgr = createManager();
      await mgr.initialize();
      const stats = await mgr.getStats();

      expect(stats.outboxCount).toBe(0);
      expect(stats.inProgressCount).toBe(0);
      expect(stats.failedCount).toBe(0);
      expect(stats.archiveCount).toBe(0);
      expect(stats.inboxCount).toBeDefined();
    });
  });

  // ==========================================================================
  // reset / destroy
  // ==========================================================================

  describe('reset', () => {
    it('should delete all files but keep structure', async () => {
      mockReaddir.mockResolvedValue([]);
      const mgr = createManager();
      await mgr.initialize();

      await mgr.reset();
      // Should list files in each directory
      expect(mockReaddir).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should remove entire workspace directory', async () => {
      const mgr = createManager();
      await mgr.destroy();

      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('.agent-workspace'),
        { recursive: true, force: true },
      );
    });
  });
});
