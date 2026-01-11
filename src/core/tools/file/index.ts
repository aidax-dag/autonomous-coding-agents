/**
 * File Tools Module
 *
 * Provides file system operation tools.
 *
 * @module core/tools/file
 */

// Interfaces
export {
  IFileClient,
  FileInfo,
  DirectoryEntry,
  SearchMatch,
  SearchResult,
  FileOperationResult,
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

// Client
export { FileClient } from './file-client.js';

// Tools
export { FileReadTool, FileReadInput, FileReadOutput } from './file-read.tool.js';
export { FileWriteTool, FileWriteInput, FileWriteOutput } from './file-write.tool.js';
export { FileSearchTool, FileSearchInput } from './file-search.tool.js';
export { FileListTool, FileListInput, FileListOutput } from './file-list.tool.js';
export { FileMkdirTool, FileMkdirInput, FileMkdirOutput } from './file-mkdir.tool.js';
export { FileDeleteTool, FileDeleteInput, FileDeleteOutput } from './file-delete.tool.js';
export { FileMoveTool, FileMoveInput, FileMoveOutput } from './file-move.tool.js';
export { FileCopyTool, FileCopyInput, FileCopyOutput } from './file-copy.tool.js';
export { FileExistsTool, FileExistsInput, FileExistsOutput } from './file-exists.tool.js';
export { FileStatsTool, FileStatsInput } from './file-stats.tool.js';

// Import tools for factory
import { FileReadTool } from './file-read.tool.js';
import { FileWriteTool } from './file-write.tool.js';
import { FileSearchTool } from './file-search.tool.js';
import { FileListTool } from './file-list.tool.js';
import { FileMkdirTool } from './file-mkdir.tool.js';
import { FileDeleteTool } from './file-delete.tool.js';
import { FileMoveTool } from './file-move.tool.js';
import { FileCopyTool } from './file-copy.tool.js';
import { FileExistsTool } from './file-exists.tool.js';
import { FileStatsTool } from './file-stats.tool.js';
import { IFileClient } from './file.interface.js';
import { FileClient } from './file-client.js';
import { ITool } from '../../interfaces/tool.interface.js';

/**
 * File tools collection interface
 */
export interface FileTools {
  read: FileReadTool;
  write: FileWriteTool;
  search: FileSearchTool;
  list: FileListTool;
  mkdir: FileMkdirTool;
  delete: FileDeleteTool;
  move: FileMoveTool;
  copy: FileCopyTool;
  exists: FileExistsTool;
  stats: FileStatsTool;
}

/**
 * Options for creating file tools
 */
export interface FileToolsOptions {
  fileClient?: IFileClient;
}

/**
 * Creates all file tools with shared configuration
 *
 * @param options - File tools configuration options
 * @returns Collection of file tools
 */
export function createFileTools(options?: FileToolsOptions): FileTools {
  const fileClient = options?.fileClient ?? new FileClient();

  return {
    read: new FileReadTool(fileClient),
    write: new FileWriteTool(fileClient),
    search: new FileSearchTool(fileClient),
    list: new FileListTool(fileClient),
    mkdir: new FileMkdirTool(fileClient),
    delete: new FileDeleteTool(fileClient),
    move: new FileMoveTool(fileClient),
    copy: new FileCopyTool(fileClient),
    exists: new FileExistsTool(fileClient),
    stats: new FileStatsTool(fileClient),
  };
}

/**
 * Returns an array of all file tools for registration
 *
 * @param options - File tools configuration options
 * @returns Array of all file tools
 */
export function getAllFileTools(options?: FileToolsOptions): ITool[] {
  const tools = createFileTools(options);
  return [
    tools.read,
    tools.write,
    tools.search,
    tools.list,
    tools.mkdir,
    tools.delete,
    tools.move,
    tools.copy,
    tools.exists,
    tools.stats,
  ];
}
