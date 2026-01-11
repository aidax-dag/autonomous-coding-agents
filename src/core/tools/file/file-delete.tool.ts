/**
 * File Delete Tool
 *
 * Deletes files and directories.
 *
 * @module core/tools/file/file-delete
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, DeleteOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for delete
 */
export interface FileDeleteInput {
  path: string;
  recursive?: boolean;
  force?: boolean;
}

/**
 * Output for delete
 */
export interface FileDeleteOutput {
  path: string;
  deleted: boolean;
}

/**
 * File Delete Tool
 *
 * Deletes a file or directory.
 */
export class FileDeleteTool extends BaseTool<FileDeleteInput, FileDeleteOutput> {
  readonly name = 'file-delete';
  readonly description = 'Delete a file or directory';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to delete',
        required: true,
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'Delete directory recursively',
        required: false,
      },
      {
        name: 'force',
        type: 'boolean',
        description: 'Force deletion',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Deletion result',
    },
    tags: ['file', 'delete', 'remove'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileDeleteInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileDeleteOutput>> {
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
      return this.success(
        {
          path: params.path,
          deleted: false,
        },
        Date.now() - startTime
      );
    }

    const deleteOptions: DeleteOptions = {
      recursive: params.recursive,
      force: params.force,
    };

    const result = await this.fileClient.delete(params.path, deleteOptions);

    if (!result.success) {
      return this.failure(
        'FILE_DELETE_FAILED',
        result.error ?? 'Failed to delete',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        path: params.path,
        deleted: true,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
