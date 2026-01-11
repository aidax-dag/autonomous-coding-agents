/**
 * File Tools Tests
 *
 * Tests for file system operation tools.
 *
 * @module tests/core/tools/file
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  FileReadTool,
  FileWriteTool,
  FileSearchTool,
  FileListTool,
  FileMkdirTool,
  FileDeleteTool,
  FileMoveTool,
  FileCopyTool,
  FileExistsTool,
  FileStatsTool,
  createFileTools,
  getAllFileTools,
  IFileClient,
  FileInfo,
  DirectoryEntry,
  SearchResult,
  SearchMatch,
  FileOperationResult,
  FileWatchEvent,
  FileWatcher,
} from '../../../../src/core/tools/file/index.js';
import { ToolCategory } from '../../../../src/core/interfaces/tool.interface.js';

/**
 * Mock FileClient for testing
 */
class MockFileClient implements IFileClient {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();
  public calls: { method: string; args: unknown[] }[] = [];

  constructor() {
    // Initialize with some test data
    this.files.set('/test/file.txt', 'Hello World');
    this.files.set('/test/search.txt', 'Line 1\nLine 2 with pattern\nLine 3');
    this.directories.add('/test');
    this.directories.add('/test/subdir');
  }

  clearCalls(): void {
    this.calls = [];
  }

  async readFile(
    path: string,
    options?: { encoding?: BufferEncoding; startLine?: number; endLine?: number }
  ): Promise<FileOperationResult<string>> {
    this.calls.push({ method: 'readFile', args: [path, options] });
    const content = this.files.get(path);
    if (content === undefined) {
      return { success: false, error: 'File not found' };
    }

    let result = content;
    if (options?.startLine !== undefined || options?.endLine !== undefined) {
      const lines = content.split('\n');
      const start = (options.startLine ?? 1) - 1;
      const end = options.endLine ?? lines.length;
      result = lines.slice(start, end).join('\n');
    }

    return { success: true, data: result };
  }

  async readFileBuffer(path: string): Promise<FileOperationResult<Buffer>> {
    this.calls.push({ method: 'readFileBuffer', args: [path] });
    const content = this.files.get(path);
    if (content === undefined) {
      return { success: false, error: 'File not found' };
    }
    return { success: true, data: Buffer.from(content) };
  }

  async writeFile(
    path: string,
    content: string | Buffer
  ): Promise<FileOperationResult> {
    this.calls.push({ method: 'writeFile', args: [path, content] });
    this.files.set(path, content.toString());
    return { success: true };
  }

  async appendFile(
    path: string,
    content: string | Buffer
  ): Promise<FileOperationResult> {
    this.calls.push({ method: 'appendFile', args: [path, content] });
    const existing = this.files.get(path) ?? '';
    this.files.set(path, existing + content.toString());
    return { success: true };
  }

  async exists(path: string): Promise<boolean> {
    this.calls.push({ method: 'exists', args: [path] });
    return this.files.has(path) || this.directories.has(path);
  }

  async getStats(path: string): Promise<FileOperationResult<FileInfo>> {
    this.calls.push({ method: 'getStats', args: [path] });
    const isFile = this.files.has(path);
    const isDir = this.directories.has(path);

    if (!isFile && !isDir) {
      return { success: false, error: 'Not found' };
    }

    const name = path.split('/').pop() ?? '';
    const extension = isFile ? (name.includes('.') ? name.split('.').pop() ?? '' : '') : '';

    return {
      success: true,
      data: {
        path,
        name,
        extension,
        size: isFile ? (this.files.get(path)?.length ?? 0) : 0,
        isFile,
        isDirectory: isDir,
        isSymlink: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
        accessedAt: new Date(),
        permissions: { readable: true, writable: true, executable: false, mode: 0o644 },
      },
    };
  }

  async listDirectory(
    path: string
  ): Promise<FileOperationResult<DirectoryEntry[]>> {
    this.calls.push({ method: 'listDirectory', args: [path] });

    if (!this.directories.has(path)) {
      return { success: false, error: 'Directory not found' };
    }

    const entries: DirectoryEntry[] = [];

    // Find files in this directory
    for (const [filePath] of this.files) {
      const parent = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parent === path) {
        entries.push({
          name: filePath.split('/').pop() ?? '',
          path: filePath,
          isFile: true,
          isDirectory: false,
          isSymlink: false,
          size: this.files.get(filePath)?.length ?? 0,
        });
      }
    }

    // Find subdirectories
    for (const dirPath of this.directories) {
      const parent = dirPath.substring(0, dirPath.lastIndexOf('/'));
      if (parent === path && dirPath !== path) {
        entries.push({
          name: dirPath.split('/').pop() ?? '',
          path: dirPath,
          isFile: false,
          isDirectory: true,
          isSymlink: false,
        });
      }
    }

    return { success: true, data: entries };
  }

  async mkdir(path: string): Promise<FileOperationResult> {
    this.calls.push({ method: 'mkdir', args: [path] });
    this.directories.add(path);
    return { success: true };
  }

  async delete(path: string): Promise<FileOperationResult> {
    this.calls.push({ method: 'delete', args: [path] });
    if (this.files.has(path)) {
      this.files.delete(path);
      return { success: true };
    }
    if (this.directories.has(path)) {
      this.directories.delete(path);
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  }

  async copy(
    source: string,
    destination: string
  ): Promise<FileOperationResult> {
    this.calls.push({ method: 'copy', args: [source, destination] });
    const content = this.files.get(source);
    if (content === undefined) {
      return { success: false, error: 'Source not found' };
    }
    this.files.set(destination, content);
    return { success: true };
  }

  async move(
    source: string,
    destination: string
  ): Promise<FileOperationResult> {
    this.calls.push({ method: 'move', args: [source, destination] });
    const content = this.files.get(source);
    if (content === undefined) {
      return { success: false, error: 'Source not found' };
    }
    this.files.set(destination, content);
    this.files.delete(source);
    return { success: true };
  }

  async search(
    directory: string,
    options: { pattern: string }
  ): Promise<FileOperationResult<SearchResult>> {
    this.calls.push({ method: 'search', args: [directory, options] });

    const matches: SearchMatch[] = [];

    for (const [filePath, content] of this.files) {
      if (!filePath.startsWith(directory)) continue;

      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes(options.pattern)) {
          const column = line.indexOf(options.pattern);
          matches.push({
            file: filePath,
            line: index + 1,
            column,
            content: line,
            match: options.pattern,
          });
        }
      });
    }

    return {
      success: true,
      data: {
        matches,
        totalMatches: matches.length,
        filesSearched: this.files.size,
        filesMatched: new Set(matches.map((m) => m.file)).size,
      },
    };
  }

  async watch(
    path: string,
    _callback: (event: FileWatchEvent) => void
  ): Promise<FileOperationResult<FileWatcher>> {
    this.calls.push({ method: 'watch', args: [path] });
    return {
      success: true,
      data: {
        close: async () => {},
      },
    };
  }
}

describe('File Tools', () => {
  let mockClient: MockFileClient;

  beforeEach(() => {
    mockClient = new MockFileClient();
    jest.clearAllMocks();
  });

  describe('FileReadTool', () => {
    it('should have correct schema', () => {
      const tool = new FileReadTool(mockClient);
      expect(tool.name).toBe('file-read');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
      expect(tool.schema.parameters).toHaveLength(5);
    });

    it('should read file content', async () => {
      const tool = new FileReadTool(mockClient);
      const result = await tool.execute({ path: '/test/file.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello World');
      expect(result.data?.path).toBe('/test/file.txt');
    });

    it('should read file with line range', async () => {
      const tool = new FileReadTool(mockClient);
      const result = await tool.execute({
        path: '/test/search.txt',
        startLine: 1,
        endLine: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Line 1\nLine 2 with pattern');
    });

    it('should fail for non-existent file', async () => {
      const tool = new FileReadTool(mockClient);
      const result = await tool.execute({ path: '/nonexistent.txt' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_READ_FAILED');
    });

    it('should fail for empty path', async () => {
      const tool = new FileReadTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should report availability', async () => {
      const tool = new FileReadTool(mockClient);
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  describe('FileWriteTool', () => {
    it('should have correct schema', () => {
      const tool = new FileWriteTool(mockClient);
      expect(tool.name).toBe('file-write');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should write content to new file', async () => {
      const tool = new FileWriteTool(mockClient);
      const result = await tool.execute({
        path: '/test/new.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(true);
      expect(result.data?.bytesWritten).toBe(11);
    });

    it('should overwrite existing file', async () => {
      const tool = new FileWriteTool(mockClient);
      const result = await tool.execute({
        path: '/test/file.txt',
        content: 'Updated content',
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(false);
    });

    it('should append to file', async () => {
      const tool = new FileWriteTool(mockClient);
      const result = await tool.execute({
        path: '/test/file.txt',
        content: ' appended',
        append: true,
      });

      expect(result.success).toBe(true);
      expect(mockClient.calls).toContainEqual({
        method: 'appendFile',
        args: ['/test/file.txt', ' appended'],
      });
    });

    it('should fail for empty path', async () => {
      const tool = new FileWriteTool(mockClient);
      const result = await tool.execute({ path: '', content: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should fail for undefined content', async () => {
      const tool = new FileWriteTool(mockClient);
      const result = await tool.execute({
        path: '/test/file.txt',
        content: undefined as unknown as string,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileSearchTool', () => {
    it('should have correct schema', () => {
      const tool = new FileSearchTool(mockClient);
      expect(tool.name).toBe('file-search');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should search for pattern', async () => {
      const tool = new FileSearchTool(mockClient);
      const result = await tool.execute({
        directory: '/test',
        pattern: 'pattern',
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(1);
      expect(result.data?.filesMatched).toBe(1);
    });

    it('should fail for empty directory', async () => {
      const tool = new FileSearchTool(mockClient);
      const result = await tool.execute({ directory: '', pattern: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should fail for empty pattern', async () => {
      const tool = new FileSearchTool(mockClient);
      const result = await tool.execute({ directory: '/test', pattern: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileListTool', () => {
    it('should have correct schema', () => {
      const tool = new FileListTool(mockClient);
      expect(tool.name).toBe('file-list');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should list directory contents', async () => {
      const tool = new FileListTool(mockClient);
      const result = await tool.execute({ path: '/test' });

      expect(result.success).toBe(true);
      expect(result.data?.entries).toBeDefined();
      expect(result.data?.totalFiles).toBeGreaterThanOrEqual(0);
      expect(result.data?.totalDirectories).toBeGreaterThanOrEqual(0);
    });

    it('should fail for empty path', async () => {
      const tool = new FileListTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileMkdirTool', () => {
    it('should have correct schema', () => {
      const tool = new FileMkdirTool(mockClient);
      expect(tool.name).toBe('file-mkdir');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should create new directory', async () => {
      const tool = new FileMkdirTool(mockClient);
      const result = await tool.execute({ path: '/test/newdir' });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(true);
    });

    it('should not fail for existing directory', async () => {
      const tool = new FileMkdirTool(mockClient);
      const result = await tool.execute({ path: '/test' });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(false);
    });

    it('should fail for empty path', async () => {
      const tool = new FileMkdirTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileDeleteTool', () => {
    it('should have correct schema', () => {
      const tool = new FileDeleteTool(mockClient);
      expect(tool.name).toBe('file-delete');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should delete existing file', async () => {
      const tool = new FileDeleteTool(mockClient);
      const result = await tool.execute({ path: '/test/file.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(true);
    });

    it('should handle non-existent file gracefully', async () => {
      const tool = new FileDeleteTool(mockClient);
      const result = await tool.execute({ path: '/nonexistent.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe(false);
    });

    it('should fail for empty path', async () => {
      const tool = new FileDeleteTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileMoveTool', () => {
    it('should have correct schema', () => {
      const tool = new FileMoveTool(mockClient);
      expect(tool.name).toBe('file-move');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should move file', async () => {
      const tool = new FileMoveTool(mockClient);
      const result = await tool.execute({
        source: '/test/file.txt',
        destination: '/test/moved.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data?.moved).toBe(true);
    });

    it('should fail for non-existent source', async () => {
      const tool = new FileMoveTool(mockClient);
      const result = await tool.execute({
        source: '/nonexistent.txt',
        destination: '/test/moved.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should fail for empty source', async () => {
      const tool = new FileMoveTool(mockClient);
      const result = await tool.execute({
        source: '',
        destination: '/test/moved.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should fail for empty destination', async () => {
      const tool = new FileMoveTool(mockClient);
      const result = await tool.execute({
        source: '/test/file.txt',
        destination: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileCopyTool', () => {
    it('should have correct schema', () => {
      const tool = new FileCopyTool(mockClient);
      expect(tool.name).toBe('file-copy');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should copy file', async () => {
      const tool = new FileCopyTool(mockClient);
      const result = await tool.execute({
        source: '/test/file.txt',
        destination: '/test/copied.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data?.copied).toBe(true);
    });

    it('should fail for non-existent source', async () => {
      const tool = new FileCopyTool(mockClient);
      const result = await tool.execute({
        source: '/nonexistent.txt',
        destination: '/test/copied.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should fail for empty source', async () => {
      const tool = new FileCopyTool(mockClient);
      const result = await tool.execute({
        source: '',
        destination: '/test/copied.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should fail for empty destination', async () => {
      const tool = new FileCopyTool(mockClient);
      const result = await tool.execute({
        source: '/test/file.txt',
        destination: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileExistsTool', () => {
    it('should have correct schema', () => {
      const tool = new FileExistsTool(mockClient);
      expect(tool.name).toBe('file-exists');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should return true for existing file', async () => {
      const tool = new FileExistsTool(mockClient);
      const result = await tool.execute({ path: '/test/file.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(true);
    });

    it('should return true for existing directory', async () => {
      const tool = new FileExistsTool(mockClient);
      const result = await tool.execute({ path: '/test' });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      const tool = new FileExistsTool(mockClient);
      const result = await tool.execute({ path: '/nonexistent.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(false);
    });

    it('should fail for empty path', async () => {
      const tool = new FileExistsTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('FileStatsTool', () => {
    it('should have correct schema', () => {
      const tool = new FileStatsTool(mockClient);
      expect(tool.name).toBe('file-stats');
      expect(tool.schema.category).toBe(ToolCategory.FILE_SYSTEM);
    });

    it('should get file stats', async () => {
      const tool = new FileStatsTool(mockClient);
      const result = await tool.execute({ path: '/test/file.txt' });

      expect(result.success).toBe(true);
      expect(result.data?.isFile).toBe(true);
      expect(result.data?.isDirectory).toBe(false);
      expect(result.data?.size).toBeGreaterThan(0);
    });

    it('should get directory stats', async () => {
      const tool = new FileStatsTool(mockClient);
      const result = await tool.execute({ path: '/test' });

      expect(result.success).toBe(true);
      expect(result.data?.isFile).toBe(false);
      expect(result.data?.isDirectory).toBe(true);
    });

    it('should fail for non-existent path', async () => {
      const tool = new FileStatsTool(mockClient);
      const result = await tool.execute({ path: '/nonexistent.txt' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should fail for empty path', async () => {
      const tool = new FileStatsTool(mockClient);
      const result = await tool.execute({ path: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('createFileTools', () => {
    it('should create all file tools', () => {
      const tools = createFileTools({ fileClient: mockClient });

      expect(tools.read).toBeInstanceOf(FileReadTool);
      expect(tools.write).toBeInstanceOf(FileWriteTool);
      expect(tools.search).toBeInstanceOf(FileSearchTool);
      expect(tools.list).toBeInstanceOf(FileListTool);
      expect(tools.mkdir).toBeInstanceOf(FileMkdirTool);
      expect(tools.delete).toBeInstanceOf(FileDeleteTool);
      expect(tools.move).toBeInstanceOf(FileMoveTool);
      expect(tools.copy).toBeInstanceOf(FileCopyTool);
      expect(tools.exists).toBeInstanceOf(FileExistsTool);
      expect(tools.stats).toBeInstanceOf(FileStatsTool);
    });

    it('should create tools with default client', () => {
      const tools = createFileTools();

      expect(tools.read).toBeDefined();
      expect(tools.write).toBeDefined();
    });
  });

  describe('getAllFileTools', () => {
    it('should return array of all tools', () => {
      const tools = getAllFileTools({ fileClient: mockClient });

      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(10);
    });

    it('should return tools with correct names', () => {
      const tools = getAllFileTools({ fileClient: mockClient });
      const names = tools.map((t) => t.name);

      expect(names).toContain('file-read');
      expect(names).toContain('file-write');
      expect(names).toContain('file-search');
      expect(names).toContain('file-list');
      expect(names).toContain('file-mkdir');
      expect(names).toContain('file-delete');
      expect(names).toContain('file-move');
      expect(names).toContain('file-copy');
      expect(names).toContain('file-exists');
      expect(names).toContain('file-stats');
    });
  });
});
