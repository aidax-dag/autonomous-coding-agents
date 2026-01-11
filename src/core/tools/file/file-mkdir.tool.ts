/**
 * File Mkdir Tool
 *
 * Creates directories.
 *
 * @module core/tools/file/file-mkdir
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, MkdirOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for mkdir
 */
export interface FileMkdirInput {
  path: string;
  recursive?: boolean;
  mode?: number;
}

/**
 * Output for mkdir
 */
export interface FileMkdirOutput {
  path: string;
  created: boolean;
}

/**
 * File Mkdir Tool
 *
 * Creates a directory.
 */
export class FileMkdirTool extends BaseTool<FileMkdirInput, FileMkdirOutput> {
  readonly name = 'file-mkdir';
  readonly description = 'Create a directory';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Directory path to create',
        required: true,
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'Create parent directories if needed',
        required: false,
      },
      {
        name: 'mode',
        type: 'number',
        description: 'Directory permissions',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Creation result',
    },
    tags: ['file', 'mkdir', 'directory'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileMkdirInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileMkdirOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Directory path is required',
        Date.now() - startTime
      );
    }

    // Check if already exists
    const exists = await this.fileClient.exists(params.path);
    if (exists) {
      return this.success(
        {
          path: params.path,
          created: false,
        },
        Date.now() - startTime
      );
    }

    const mkdirOptions: MkdirOptions = {
      recursive: params.recursive ?? true,
      mode: params.mode,
    };

    const result = await this.fileClient.mkdir(params.path, mkdirOptions);

    if (!result.success) {
      return this.failure(
        'FILE_MKDIR_FAILED',
        result.error ?? 'Failed to create directory',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        path: params.path,
        created: true,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
