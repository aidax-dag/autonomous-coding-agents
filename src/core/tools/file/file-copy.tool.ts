/**
 * File Copy Tool
 *
 * Copies files and directories.
 *
 * @module core/tools/file/file-copy
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, CopyOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file copy
 */
export interface FileCopyInput {
  source: string;
  destination: string;
  recursive?: boolean;
  overwrite?: boolean;
  preserveTimestamps?: boolean;
}

/**
 * Output for file copy
 */
export interface FileCopyOutput {
  source: string;
  destination: string;
  copied: boolean;
}

/**
 * File Copy Tool
 *
 * Copies a file or directory.
 */
export class FileCopyTool extends BaseTool<FileCopyInput, FileCopyOutput> {
  readonly name = 'file-copy';
  readonly description = 'Copy a file or directory';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'source',
        type: 'string',
        description: 'Source path',
        required: true,
      },
      {
        name: 'destination',
        type: 'string',
        description: 'Destination path',
        required: true,
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'Copy directory recursively',
        required: false,
      },
      {
        name: 'overwrite',
        type: 'boolean',
        description: 'Overwrite existing files',
        required: false,
      },
      {
        name: 'preserveTimestamps',
        type: 'boolean',
        description: 'Preserve file timestamps',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Copy result',
    },
    tags: ['file', 'copy', 'duplicate'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileCopyInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileCopyOutput>> {
    const startTime = Date.now();

    if (!params.source || params.source.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Source path is required',
        Date.now() - startTime
      );
    }

    if (!params.destination || params.destination.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Destination path is required',
        Date.now() - startTime
      );
    }

    // Check if source exists
    const exists = await this.fileClient.exists(params.source);
    if (!exists) {
      return this.failure(
        'FILE_NOT_FOUND',
        `Source file not found: ${params.source}`,
        Date.now() - startTime
      );
    }

    const copyOptions: CopyOptions = {
      recursive: params.recursive,
      overwrite: params.overwrite,
      preserveTimestamps: params.preserveTimestamps,
    };

    const result = await this.fileClient.copy(
      params.source,
      params.destination,
      copyOptions
    );

    if (!result.success) {
      return this.failure(
        'FILE_COPY_FAILED',
        result.error ?? 'Failed to copy file',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        source: params.source,
        destination: params.destination,
        copied: true,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
