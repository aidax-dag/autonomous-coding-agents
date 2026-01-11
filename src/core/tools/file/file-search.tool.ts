/**
 * File Search Tool
 *
 * Searches for patterns in files.
 *
 * @module core/tools/file/file-search
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, SearchOptions, SearchResult } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file search
 */
export interface FileSearchInput {
  directory: string;
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
 * File Search Tool
 *
 * Searches for patterns in files within a directory.
 */
export class FileSearchTool extends BaseTool<FileSearchInput, SearchResult> {
  readonly name = 'file-search';
  readonly description = 'Search for patterns in files';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'directory',
        type: 'string',
        description: 'Directory to search in',
        required: true,
      },
      {
        name: 'pattern',
        type: 'string',
        description: 'Pattern to search for',
        required: true,
      },
      {
        name: 'isRegex',
        type: 'boolean',
        description: 'Treat pattern as regular expression',
        required: false,
      },
      {
        name: 'caseSensitive',
        type: 'boolean',
        description: 'Case sensitive search',
        required: false,
      },
      {
        name: 'wholeWord',
        type: 'boolean',
        description: 'Match whole words only',
        required: false,
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
      },
      {
        name: 'includePattern',
        type: 'string',
        description: 'File pattern to include (regex)',
        required: false,
      },
      {
        name: 'excludePattern',
        type: 'string',
        description: 'File pattern to exclude (regex)',
        required: false,
      },
      {
        name: 'maxFileSize',
        type: 'number',
        description: 'Maximum file size to search (bytes)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Search results',
    },
    tags: ['file', 'search', 'grep'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileSearchInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<SearchResult>> {
    const startTime = Date.now();

    if (!params.directory || params.directory.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Directory path is required',
        Date.now() - startTime
      );
    }

    if (!params.pattern || params.pattern.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Search pattern is required',
        Date.now() - startTime
      );
    }

    const searchOptions: SearchOptions = {
      pattern: params.pattern,
      isRegex: params.isRegex,
      caseSensitive: params.caseSensitive,
      wholeWord: params.wholeWord,
      maxResults: params.maxResults,
      includePattern: params.includePattern,
      excludePattern: params.excludePattern,
      maxFileSize: params.maxFileSize,
    };

    const result = await this.fileClient.search(params.directory, searchOptions);

    if (!result.success || !result.data) {
      return this.failure(
        'FILE_SEARCH_FAILED',
        result.error ?? 'Failed to search files',
        Date.now() - startTime
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
