/**
 * File Tools Interfaces
 *
 * Type definitions for file operations.
 *
 * @module core/tools/file/file.interface
 */

/**
 * File operation result
 */
export interface FileOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * File information
 */
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  permissions: FilePermissions;
}

/**
 * File permissions
 */
export interface FilePermissions {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  mode: number;
}

/**
 * Directory entry
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size?: number;
}

/**
 * Search match
 */
export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  match: string;
}

/**
 * Search result
 */
export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  filesSearched: number;
  filesMatched: number;
}

/**
 * Read file options
 */
export interface ReadFileOptions {
  encoding?: BufferEncoding;
  startLine?: number;
  endLine?: number;
  maxSize?: number;
}

/**
 * Write file options
 */
export interface WriteFileOptions {
  encoding?: BufferEncoding;
  mode?: number;
  flag?: string;
  createDirectories?: boolean;
  backup?: boolean;
}

/**
 * List directory options
 */
export interface ListDirectoryOptions {
  recursive?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  filter?: string;
  sortBy?: 'name' | 'size' | 'modified' | 'created';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search options
 */
export interface SearchOptions {
  pattern: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  maxResults?: number;
  includePattern?: string;
  excludePattern?: string;
  maxFileSize?: number;
}

/**
 * Copy options
 */
export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
  recursive?: boolean;
}

/**
 * Move options
 */
export interface MoveOptions {
  overwrite?: boolean;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  recursive?: boolean;
  force?: boolean;
}

/**
 * Create directory options
 */
export interface MkdirOptions {
  recursive?: boolean;
  mode?: number;
}

/**
 * File client interface
 */
export interface IFileClient {
  /**
   * Read file content
   */
  readFile(path: string, options?: ReadFileOptions): Promise<FileOperationResult<string>>;

  /**
   * Read file as buffer
   */
  readFileBuffer(path: string): Promise<FileOperationResult<Buffer>>;

  /**
   * Write file content
   */
  writeFile(
    path: string,
    content: string | Buffer,
    options?: WriteFileOptions
  ): Promise<FileOperationResult>;

  /**
   * Append to file
   */
  appendFile(
    path: string,
    content: string | Buffer,
    options?: WriteFileOptions
  ): Promise<FileOperationResult>;

  /**
   * Check if file/directory exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file stats
   */
  getStats(path: string): Promise<FileOperationResult<FileInfo>>;

  /**
   * List directory contents
   */
  listDirectory(
    path: string,
    options?: ListDirectoryOptions
  ): Promise<FileOperationResult<DirectoryEntry[]>>;

  /**
   * Create directory
   */
  mkdir(path: string, options?: MkdirOptions): Promise<FileOperationResult>;

  /**
   * Delete file or directory
   */
  delete(path: string, options?: DeleteOptions): Promise<FileOperationResult>;

  /**
   * Copy file or directory
   */
  copy(source: string, destination: string, options?: CopyOptions): Promise<FileOperationResult>;

  /**
   * Move/rename file or directory
   */
  move(source: string, destination: string, options?: MoveOptions): Promise<FileOperationResult>;

  /**
   * Search in files
   */
  search(directory: string, options: SearchOptions): Promise<FileOperationResult<SearchResult>>;

  /**
   * Watch file/directory for changes
   */
  watch(
    path: string,
    callback: (event: FileWatchEvent) => void
  ): Promise<FileOperationResult<FileWatcher>>;
}

/**
 * File watch event
 */
export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
}

/**
 * File watcher handle
 */
export interface FileWatcher {
  close(): Promise<void>;
}

/**
 * Client options
 */
export interface FileClientOptions {
  cwd?: string;
  defaultEncoding?: BufferEncoding;
}
