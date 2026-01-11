/**
 * File Client Implementation
 *
 * Handles file system operations.
 *
 * @module core/tools/file/file-client
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {
  IFileClient,
  FileClientOptions,
  FileOperationResult,
  FileInfo,
  FilePermissions,
  DirectoryEntry,
  SearchResult,
  SearchMatch,
  ReadFileOptions,
  WriteFileOptions,
  ListDirectoryOptions,
  SearchOptions,
  CopyOptions,
  MoveOptions,
  DeleteOptions,
  MkdirOptions,
  FileWatchEvent,
  FileWatcher,
} from './file.interface.js';

/**
 * File client for file system operations
 */
export class FileClient implements IFileClient {
  private readonly cwd: string;
  private readonly defaultEncoding: BufferEncoding;

  constructor(options?: FileClientOptions) {
    this.cwd = options?.cwd ?? process.cwd();
    this.defaultEncoding = options?.defaultEncoding ?? 'utf-8';
  }

  /**
   * Resolve path relative to cwd
   */
  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(this.cwd, filePath);
  }

  /**
   * Read file content
   */
  async readFile(
    filePath: string,
    options?: ReadFileOptions
  ): Promise<FileOperationResult<string>> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const encoding = options?.encoding ?? this.defaultEncoding;

      // Check file size if maxSize is specified
      if (options?.maxSize) {
        const stats = await fs.stat(resolvedPath);
        if (stats.size > options.maxSize) {
          return {
            success: false,
            error: `File size (${stats.size} bytes) exceeds maximum allowed (${options.maxSize} bytes)`,
          };
        }
      }

      let content = await fs.readFile(resolvedPath, encoding);

      // Handle line range
      if (options?.startLine !== undefined || options?.endLine !== undefined) {
        const lines = content.split('\n');
        const start = options?.startLine ?? 0;
        const end = options?.endLine ?? lines.length;
        content = lines.slice(start, end).join('\n');
      }

      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read file as buffer
   */
  async readFileBuffer(filePath: string): Promise<FileOperationResult<Buffer>> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const content = await fs.readFile(resolvedPath);
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write file content
   */
  async writeFile(
    filePath: string,
    content: string | Buffer,
    options?: WriteFileOptions
  ): Promise<FileOperationResult> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const encoding = options?.encoding ?? this.defaultEncoding;

      // Create directories if needed
      if (options?.createDirectories) {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      }

      // Create backup if needed
      if (options?.backup) {
        try {
          await fs.access(resolvedPath);
          await fs.copyFile(resolvedPath, `${resolvedPath}.bak`);
        } catch {
          // File doesn't exist, no backup needed
        }
      }

      const writeOptions: fsSync.WriteFileOptions = {
        encoding: typeof content === 'string' ? encoding : undefined,
        mode: options?.mode,
        flag: options?.flag,
      };

      await fs.writeFile(resolvedPath, content, writeOptions);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Append to file
   */
  async appendFile(
    filePath: string,
    content: string | Buffer,
    options?: WriteFileOptions
  ): Promise<FileOperationResult> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const encoding = options?.encoding ?? this.defaultEncoding;

      // Create directories if needed
      if (options?.createDirectories) {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      }

      await fs.appendFile(resolvedPath, content, { encoding });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if file/directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getStats(filePath: string): Promise<FileOperationResult<FileInfo>> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const stats = await fs.stat(resolvedPath);
      const lstat = await fs.lstat(resolvedPath);

      const permissions: FilePermissions = {
        readable: true,
        writable: true,
        executable: true,
        mode: stats.mode,
      };

      // Check actual permissions
      try {
        await fs.access(resolvedPath, fsSync.constants.R_OK);
      } catch {
        permissions.readable = false;
      }

      try {
        await fs.access(resolvedPath, fsSync.constants.W_OK);
      } catch {
        permissions.writable = false;
      }

      try {
        await fs.access(resolvedPath, fsSync.constants.X_OK);
      } catch {
        permissions.executable = false;
      }

      const fileInfo: FileInfo = {
        path: resolvedPath,
        name: path.basename(resolvedPath),
        extension: path.extname(resolvedPath),
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymlink: lstat.isSymbolicLink(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
        permissions,
      };

      return { success: true, data: fileInfo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(
    dirPath: string,
    options?: ListDirectoryOptions
  ): Promise<FileOperationResult<DirectoryEntry[]>> {
    try {
      const resolvedPath = this.resolvePath(dirPath);
      const entries: DirectoryEntry[] = [];

      await this.listDirectoryRecursive(
        resolvedPath,
        entries,
        options?.recursive ?? false,
        options?.maxDepth ?? Infinity,
        0,
        options
      );

      // Sort entries
      if (options?.sortBy) {
        entries.sort((a, b) => {
          let comparison = 0;
          switch (options.sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'size':
              comparison = (a.size ?? 0) - (b.size ?? 0);
              break;
            default:
              comparison = a.name.localeCompare(b.name);
          }
          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      return { success: true, data: entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Recursive directory listing helper
   */
  private async listDirectoryRecursive(
    dirPath: string,
    entries: DirectoryEntry[],
    recursive: boolean,
    maxDepth: number,
    currentDepth: number,
    options?: ListDirectoryOptions
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files if not included
      if (!options?.includeHidden && item.name.startsWith('.')) {
        continue;
      }

      // Apply filter
      if (options?.filter) {
        const regex = new RegExp(options.filter);
        if (!regex.test(item.name)) {
          continue;
        }
      }

      const itemPath = path.join(dirPath, item.name);
      let size: number | undefined;

      if (item.isFile()) {
        try {
          const stats = await fs.stat(itemPath);
          size = stats.size;
        } catch {
          // Ignore stat errors
        }
      }

      entries.push({
        name: item.name,
        path: itemPath,
        isFile: item.isFile(),
        isDirectory: item.isDirectory(),
        isSymlink: item.isSymbolicLink(),
        size,
      });

      if (recursive && item.isDirectory()) {
        await this.listDirectoryRecursive(
          itemPath,
          entries,
          recursive,
          maxDepth,
          currentDepth + 1,
          options
        );
      }
    }
  }

  /**
   * Create directory
   */
  async mkdir(dirPath: string, options?: MkdirOptions): Promise<FileOperationResult> {
    try {
      const resolvedPath = this.resolvePath(dirPath);
      await fs.mkdir(resolvedPath, {
        recursive: options?.recursive ?? true,
        mode: options?.mode,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete file or directory
   */
  async delete(filePath: string, options?: DeleteOptions): Promise<FileOperationResult> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const stats = await fs.stat(resolvedPath);

      if (stats.isDirectory()) {
        if (!options?.recursive && !options?.force) {
          // Check if directory is empty
          const contents = await fs.readdir(resolvedPath);
          if (contents.length > 0) {
            return {
              success: false,
              error: 'Directory is not empty. Use recursive option to delete.',
            };
          }
        }
        await fs.rm(resolvedPath, { recursive: options?.recursive ?? false, force: options?.force });
      } else {
        await fs.unlink(resolvedPath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Copy file or directory
   */
  async copy(
    source: string,
    destination: string,
    options?: CopyOptions
  ): Promise<FileOperationResult> {
    try {
      const resolvedSource = this.resolvePath(source);
      const resolvedDest = this.resolvePath(destination);

      const stats = await fs.stat(resolvedSource);

      if (stats.isDirectory()) {
        if (!options?.recursive) {
          return {
            success: false,
            error: 'Source is a directory. Use recursive option to copy.',
          };
        }
        await this.copyDirectory(resolvedSource, resolvedDest, options);
      } else {
        // Check if destination exists
        if (!options?.overwrite) {
          try {
            await fs.access(resolvedDest);
            return {
              success: false,
              error: 'Destination already exists. Use overwrite option.',
            };
          } catch {
            // Destination doesn't exist, continue
          }
        }

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(resolvedDest), { recursive: true });

        await fs.copyFile(
          resolvedSource,
          resolvedDest,
          options?.overwrite ? undefined : fsSync.constants.COPYFILE_EXCL
        );

        // Preserve timestamps if requested
        if (options?.preserveTimestamps) {
          const sourceStats = await fs.stat(resolvedSource);
          await fs.utimes(resolvedDest, sourceStats.atime, sourceStats.mtime);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, dest: string, options?: CopyOptions): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath, options);
      } else {
        await fs.copyFile(
          sourcePath,
          destPath,
          options?.overwrite ? undefined : fsSync.constants.COPYFILE_EXCL
        );

        if (options?.preserveTimestamps) {
          const stats = await fs.stat(sourcePath);
          await fs.utimes(destPath, stats.atime, stats.mtime);
        }
      }
    }
  }

  /**
   * Move/rename file or directory
   */
  async move(
    source: string,
    destination: string,
    options?: MoveOptions
  ): Promise<FileOperationResult> {
    try {
      const resolvedSource = this.resolvePath(source);
      const resolvedDest = this.resolvePath(destination);

      // Check if destination exists
      if (!options?.overwrite) {
        try {
          await fs.access(resolvedDest);
          return {
            success: false,
            error: 'Destination already exists. Use overwrite option.',
          };
        } catch {
          // Destination doesn't exist, continue
        }
      }

      // Ensure destination directory exists
      await fs.mkdir(path.dirname(resolvedDest), { recursive: true });

      await fs.rename(resolvedSource, resolvedDest);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search in files
   */
  async search(
    directory: string,
    options: SearchOptions
  ): Promise<FileOperationResult<SearchResult>> {
    try {
      const resolvedPath = this.resolvePath(directory);
      const matches: SearchMatch[] = [];
      let filesSearched = 0;
      const filesMatched = new Set<string>();

      const regex = options.isRegex
        ? new RegExp(options.pattern, options.caseSensitive ? 'g' : 'gi')
        : new RegExp(
            this.escapeRegex(options.pattern),
            options.caseSensitive ? 'g' : 'gi'
          );

      if (options.wholeWord && !options.isRegex) {
        const wordPattern = `\\b${this.escapeRegex(options.pattern)}\\b`;
        const wordRegex = new RegExp(wordPattern, options.caseSensitive ? 'g' : 'gi');
        await this.searchInDirectory(
          resolvedPath,
          wordRegex,
          matches,
          filesMatched,
          { filesSearched: 0 },
          options
        );
      } else {
        await this.searchInDirectory(
          resolvedPath,
          regex,
          matches,
          filesMatched,
          { filesSearched: 0 },
          options
        );
      }

      filesSearched = matches.length > 0 ? filesMatched.size : 0;

      return {
        success: true,
        data: {
          matches: options.maxResults ? matches.slice(0, options.maxResults) : matches,
          totalMatches: matches.length,
          filesSearched,
          filesMatched: filesMatched.size,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search in directory recursively
   */
  private async searchInDirectory(
    dirPath: string,
    pattern: RegExp,
    matches: SearchMatch[],
    filesMatched: Set<string>,
    counter: { filesSearched: number },
    options: SearchOptions
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (options.maxResults && matches.length >= options.maxResults) {
        return;
      }

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (options.excludePattern) {
          const excludeRegex = new RegExp(options.excludePattern);
          if (excludeRegex.test(entry.name)) continue;
        }
        await this.searchInDirectory(entryPath, pattern, matches, filesMatched, counter, options);
      } else if (entry.isFile()) {
        // Apply include pattern
        if (options.includePattern) {
          const includeRegex = new RegExp(options.includePattern);
          if (!includeRegex.test(entry.name)) continue;
        }

        // Apply exclude pattern
        if (options.excludePattern) {
          const excludeRegex = new RegExp(options.excludePattern);
          if (excludeRegex.test(entry.name)) continue;
        }

        // Check file size
        if (options.maxFileSize) {
          try {
            const stats = await fs.stat(entryPath);
            if (stats.size > options.maxFileSize) continue;
          } catch {
            continue;
          }
        }

        counter.filesSearched++;
        await this.searchInFile(entryPath, pattern, matches, filesMatched, options);
      }
    }
  }

  /**
   * Search in a single file
   */
  private async searchInFile(
    filePath: string,
    pattern: RegExp,
    matches: SearchMatch[],
    filesMatched: Set<string>,
    options: SearchOptions
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (options.maxResults && matches.length >= options.maxResults) {
          return;
        }

        const line = lines[lineIndex];
        let match: RegExpExecArray | null;

        // Reset regex lastIndex for each line
        pattern.lastIndex = 0;

        while ((match = pattern.exec(line)) !== null) {
          if (options.maxResults && matches.length >= options.maxResults) {
            return;
          }

          filesMatched.add(filePath);
          matches.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            content: line.trim(),
            match: match[0],
          });

          // Prevent infinite loop for zero-length matches
          if (match[0].length === 0) {
            pattern.lastIndex++;
          }
        }
      }
    } catch {
      // Skip files that can't be read (binary files, permission issues, etc.)
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Watch file/directory for changes
   */
  async watch(
    filePath: string,
    callback: (event: FileWatchEvent) => void
  ): Promise<FileOperationResult<FileWatcher>> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const watcher = fsSync.watch(resolvedPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          callback({
            type: eventType === 'rename' ? 'add' : 'change',
            path: path.join(resolvedPath, filename),
            timestamp: new Date(),
          });
        }
      });

      return {
        success: true,
        data: {
          close: async () => {
            watcher.close();
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
