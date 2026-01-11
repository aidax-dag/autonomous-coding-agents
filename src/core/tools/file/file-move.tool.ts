/**
 * File Move Tool
 *
 * Moves or renames files and directories.
 *
 * @module core/tools/file/file-move
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, MoveOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file move
 */
export interface FileMoveInput {
  source: string;
  destination: string;
  overwrite?: boolean;
}

/**
 * Output for file move
 */
export interface FileMoveOutput {
  source: string;
  destination: string;
  moved: boolean;
}

/**
 * File Move Tool
 *
 * Moves or renames a file or directory.
 */
export class FileMoveTool extends BaseTool<FileMoveInput, FileMoveOutput> {
  readonly name = 'file-move';
  readonly description = 'Move or rename a file or directory';
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
        name: 'overwrite',
        type: 'boolean',
        description: 'Overwrite existing file at destination',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Move result',
    },
    tags: ['file', 'move', 'rename'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileMoveInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileMoveOutput>> {
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

    const moveOptions: MoveOptions = {
      overwrite: params.overwrite,
    };

    const result = await this.fileClient.move(
      params.source,
      params.destination,
      moveOptions
    );

    if (!result.success) {
      return this.failure(
        'FILE_MOVE_FAILED',
        result.error ?? 'Failed to move file',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        source: params.source,
        destination: params.destination,
        moved: true,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
