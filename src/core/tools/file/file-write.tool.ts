/**
 * File Write Tool
 *
 * Writes content to a file.
 *
 * @module core/tools/file/file-write
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, WriteFileOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file write
 */
export interface FileWriteInput {
  path: string;
  content: string;
  encoding?: BufferEncoding;
  createDirectories?: boolean;
  backup?: boolean;
  append?: boolean;
}

/**
 * Output for file write
 */
export interface FileWriteOutput {
  path: string;
  bytesWritten: number;
  created: boolean;
}

/**
 * File Write Tool
 *
 * Writes content to a file.
 */
export class FileWriteTool extends BaseTool<FileWriteInput, FileWriteOutput> {
  readonly name = 'file-write';
  readonly description = 'Write content to a file';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to write',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write',
        required: true,
      },
      {
        name: 'encoding',
        type: 'string',
        description: 'File encoding (default: utf-8)',
        required: false,
      },
      {
        name: 'createDirectories',
        type: 'boolean',
        description: 'Create parent directories if they do not exist',
        required: false,
      },
      {
        name: 'backup',
        type: 'boolean',
        description: 'Create a backup of existing file',
        required: false,
      },
      {
        name: 'append',
        type: 'boolean',
        description: 'Append to file instead of overwriting',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Write result',
    },
    tags: ['file', 'write', 'io'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileWriteInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileWriteOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'File path is required',
        Date.now() - startTime
      );
    }

    if (params.content === undefined || params.content === null) {
      return this.failure(
        'INVALID_PARAMS',
        'Content is required',
        Date.now() - startTime
      );
    }

    // Check if file exists before writing
    const exists = await this.fileClient.exists(params.path);

    const writeOptions: WriteFileOptions = {
      encoding: params.encoding,
      createDirectories: params.createDirectories,
      backup: params.backup,
    };

    let result;
    if (params.append) {
      result = await this.fileClient.appendFile(params.path, params.content, writeOptions);
    } else {
      result = await this.fileClient.writeFile(params.path, params.content, writeOptions);
    }

    if (!result.success) {
      return this.failure(
        'FILE_WRITE_FAILED',
        result.error ?? 'Failed to write file',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        path: params.path,
        bytesWritten: Buffer.byteLength(params.content, params.encoding ?? 'utf-8'),
        created: !exists,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
