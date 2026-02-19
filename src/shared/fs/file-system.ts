import * as fs from 'fs/promises';
import type { Dirent, Stats } from 'fs';

/**
 * Minimal filesystem abstraction for core modules that need testable
 * persistence without direct fs/promises coupling.
 */
export interface IFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  access(path: string): Promise<void>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  stat(path: string): Promise<Stats>;
  rename(sourcePath: string, destinationPath: string): Promise<void>;
  copyFile(sourcePath: string, destinationPath: string): Promise<void>;
  unlink(path: string): Promise<void>;
  rm(path: string, options: { recursive?: boolean; force?: boolean }): Promise<void>;
}

/**
 * Node.js fs/promises adapter.
 */
export class NodeFileSystem implements IFileSystem {
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async access(path: string): Promise<void> {
    await fs.access(path);
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return fs.readFile(path, encoding);
  }

  async writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void> {
    await fs.writeFile(path, data, encoding);
  }

  async readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]> {
    return fs.readdir(path, options);
  }

  async stat(path: string): Promise<Stats> {
    return fs.stat(path);
  }

  async rename(sourcePath: string, destinationPath: string): Promise<void> {
    await fs.rename(sourcePath, destinationPath);
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await fs.copyFile(sourcePath, destinationPath);
  }

  async unlink(path: string): Promise<void> {
    await fs.unlink(path);
  }

  async rm(path: string, options: { recursive?: boolean; force?: boolean }): Promise<void> {
    await fs.rm(path, options);
  }
}

export const nodeFileSystem: IFileSystem = new NodeFileSystem();
