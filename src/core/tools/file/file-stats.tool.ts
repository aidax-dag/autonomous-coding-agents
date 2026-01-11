/**
 * File Stats Tool
 *
 * Gets file or directory statistics.
 *
 * @module core/tools/file/file-stats
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, FileInfo } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file stats
 */
export interface FileStatsInput {
  path: string;
}

/**
 * File Stats Tool
 *
 * Gets statistics for a file or directory.
 */
export class FileStatsTool extends BaseTool<FileStatsInput, FileInfo> {
  readonly name = 'file-stats';
  readonly description = 'Get file or directory statistics';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to get stats for',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'File statistics',
    },
    tags: ['file', 'stats', 'info'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileStatsInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileInfo>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Path is required',
        Date.now() - startTime
      );
    }

    // Check if exists
    const exists = await this.fileClient.exists(params.path);
    if (!exists) {
      return this.failure(
        'FILE_NOT_FOUND',
        `File not found: ${params.path}`,
        Date.now() - startTime
      );
    }

    const result = await this.fileClient.getStats(params.path);

    if (!result.success || !result.data) {
      return this.failure(
        'FILE_STATS_FAILED',
        result.error ?? 'Failed to get file stats',
        Date.now() - startTime
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
