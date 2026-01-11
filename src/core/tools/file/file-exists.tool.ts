/**
 * File Exists Tool
 *
 * Checks if a file or directory exists.
 *
 * @module core/tools/file/file-exists
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file exists check
 */
export interface FileExistsInput {
  path: string;
}

/**
 * Output for file exists check
 */
export interface FileExistsOutput {
  path: string;
  exists: boolean;
}

/**
 * File Exists Tool
 *
 * Checks if a file or directory exists.
 */
export class FileExistsTool extends BaseTool<FileExistsInput, FileExistsOutput> {
  readonly name = 'file-exists';
  readonly description = 'Check if a file or directory exists';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to check',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Existence check result',
    },
    tags: ['file', 'exists', 'check'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileExistsInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileExistsOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Path is required',
        Date.now() - startTime
      );
    }

    const exists = await this.fileClient.exists(params.path);

    return this.success(
      {
        path: params.path,
        exists,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
