/**
 * File List Tool
 *
 * Lists directory contents.
 *
 * @module core/tools/file/file-list
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, ListDirectoryOptions, DirectoryEntry } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file list
 */
export interface FileListInput {
  path: string;
  recursive?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  filter?: string;
  sortBy?: 'name' | 'size' | 'modified' | 'created';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Output for file list
 */
export interface FileListOutput {
  entries: DirectoryEntry[];
  totalFiles: number;
  totalDirectories: number;
  path: string;
}

/**
 * File List Tool
 *
 * Lists contents of a directory.
 */
export class FileListTool extends BaseTool<FileListInput, FileListOutput> {
  readonly name = 'file-list';
  readonly description = 'List contents of a directory';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Directory path to list',
        required: true,
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'List recursively',
        required: false,
      },
      {
        name: 'maxDepth',
        type: 'number',
        description: 'Maximum recursion depth',
        required: false,
      },
      {
        name: 'includeHidden',
        type: 'boolean',
        description: 'Include hidden files',
        required: false,
      },
      {
        name: 'filter',
        type: 'string',
        description: 'Filter pattern (regex)',
        required: false,
      },
      {
        name: 'sortBy',
        type: 'string',
        description: 'Sort by field',
        required: false,
        enum: ['name', 'size', 'modified', 'created'],
      },
      {
        name: 'sortOrder',
        type: 'string',
        description: 'Sort order',
        required: false,
        enum: ['asc', 'desc'],
      },
    ],
    returns: {
      type: 'object',
      description: 'Directory listing',
    },
    tags: ['file', 'list', 'directory'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileListInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileListOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Directory path is required',
        Date.now() - startTime
      );
    }

    const listOptions: ListDirectoryOptions = {
      recursive: params.recursive,
      maxDepth: params.maxDepth,
      includeHidden: params.includeHidden,
      filter: params.filter,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };

    const result = await this.fileClient.listDirectory(params.path, listOptions);

    if (!result.success || !result.data) {
      return this.failure(
        'FILE_LIST_FAILED',
        result.error ?? 'Failed to list directory',
        Date.now() - startTime
      );
    }

    const entries = result.data;
    const totalFiles = entries.filter((e) => e.isFile).length;
    const totalDirectories = entries.filter((e) => e.isDirectory).length;

    return this.success(
      {
        entries,
        totalFiles,
        totalDirectories,
        path: params.path,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
