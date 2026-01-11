/**
 * File Read Tool
 *
 * Reads file content.
 *
 * @module core/tools/file/file-read
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IFileClient, ReadFileOptions } from './file.interface.js';
import { FileClient } from './file-client.js';

/**
 * Input parameters for file read
 */
export interface FileReadInput {
  path: string;
  encoding?: BufferEncoding;
  startLine?: number;
  endLine?: number;
  maxSize?: number;
}

/**
 * Output for file read
 */
export interface FileReadOutput {
  content: string;
  path: string;
  size: number;
  lines: number;
}

/**
 * File Read Tool
 *
 * Reads content from a file.
 */
export class FileReadTool extends BaseTool<FileReadInput, FileReadOutput> {
  readonly name = 'file-read';
  readonly description = 'Read content from a file';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.FILE_SYSTEM,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to read',
        required: true,
      },
      {
        name: 'encoding',
        type: 'string',
        description: 'File encoding (default: utf-8)',
        required: false,
      },
      {
        name: 'startLine',
        type: 'number',
        description: 'Start reading from this line (0-indexed)',
        required: false,
      },
      {
        name: 'endLine',
        type: 'number',
        description: 'Stop reading at this line (exclusive)',
        required: false,
      },
      {
        name: 'maxSize',
        type: 'number',
        description: 'Maximum file size in bytes',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'File content and metadata',
    },
    tags: ['file', 'read', 'io'],
  };

  private readonly fileClient: IFileClient;

  constructor(fileClient?: IFileClient) {
    super();
    this.fileClient = fileClient ?? new FileClient();
  }

  async execute(
    params: FileReadInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<FileReadOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'File path is required',
        Date.now() - startTime
      );
    }

    const readOptions: ReadFileOptions = {
      encoding: params.encoding,
      startLine: params.startLine,
      endLine: params.endLine,
      maxSize: params.maxSize,
    };

    const result = await this.fileClient.readFile(params.path, readOptions);

    if (!result.success || result.data === undefined) {
      return this.failure(
        'FILE_READ_FAILED',
        result.error ?? 'Failed to read file',
        Date.now() - startTime
      );
    }

    const content = result.data;
    const lines = content.split('\n').length;

    return this.success(
      {
        content,
        path: params.path,
        size: Buffer.byteLength(content, params.encoding ?? 'utf-8'),
        lines,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
