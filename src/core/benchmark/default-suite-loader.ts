/**
 * Default Suite Loader
 *
 * Scans a benchmarks/ directory for *.json files and parses them
 * into BenchmarkTask arrays. Falls back to a built-in minimal suite
 * when the directory does not exist.
 *
 * @module core/benchmark
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import type { BenchmarkTask } from './interfaces/benchmark.interface';
import type { SuiteLoader } from './benchmark-runner';

/**
 * Raw task shape as stored in benchmark JSON files.
 * Simpler than the full BenchmarkTask — missing fields get defaults.
 */
interface RawBenchmarkTask {
  id: string;
  name: string;
  description: string;
  language?: string;
  repo?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  testCommands?: string[];
  tags?: string[];
  expectedPatch?: string;
}

/**
 * Raw suite shape as stored in benchmark JSON files.
 */
interface RawBenchmarkSuite {
  name: string;
  description?: string;
  tasks: RawBenchmarkTask[];
}

/**
 * Built-in fallback suite returned when no benchmarks/ directory exists.
 */
const BUILTIN_SUITE: BenchmarkTask[] = [
  {
    id: 'builtin-hello-world',
    repo: 'builtin/sample',
    description: 'Generate a hello world function in TypeScript',
    testCommands: [],
    difficulty: 'easy',
    tags: ['builtin', 'code-generation'],
  },
  {
    id: 'builtin-fizzbuzz',
    repo: 'builtin/sample',
    description: 'Implement FizzBuzz that prints numbers 1 to 100',
    testCommands: [],
    difficulty: 'easy',
    tags: ['builtin', 'code-generation'],
  },
  {
    id: 'builtin-refactor-extract',
    repo: 'builtin/sample',
    description: 'Extract a duplicated code block into a reusable function',
    testCommands: [],
    difficulty: 'medium',
    tags: ['builtin', 'refactoring'],
  },
];

/**
 * Validate that a raw task has the minimum required fields.
 * Returns an error message string if invalid, or null if valid.
 */
function validateRawTask(task: unknown, index: number): string | null {
  if (typeof task !== 'object' || task === null) {
    return `Task at index ${index} is not an object`;
  }

  const obj = task as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    return `Task at index ${index} is missing a valid "id" field`;
  }
  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    return `Task at index ${index} is missing a valid "name" field`;
  }
  if (typeof obj.description !== 'string' || obj.description.trim() === '') {
    return `Task at index ${index} is missing a valid "description" field`;
  }

  return null;
}

/**
 * Convert a validated raw task into a full BenchmarkTask.
 */
function toFullTask(raw: RawBenchmarkTask): BenchmarkTask {
  return {
    id: raw.id,
    repo: raw.repo ?? 'unknown/repo',
    description: raw.description,
    testCommands: raw.testCommands ?? [],
    difficulty: raw.difficulty ?? 'medium',
    tags: raw.tags ?? (raw.language ? [raw.language] : []),
    expectedPatch: raw.expectedPatch,
  };
}

/**
 * Parse a single JSON file into BenchmarkTask[].
 * Supports both suite format (object with "tasks" array) and
 * plain array-of-tasks format.
 */
function parseSuiteFile(content: string, filePath: string): BenchmarkTask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.warn(`[DefaultSuiteLoader] Skipping ${filePath}: invalid JSON`);
    return [];
  }

  let rawTasks: unknown[];

  if (Array.isArray(parsed)) {
    rawTasks = parsed;
  } else if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as RawBenchmarkSuite).tasks)) {
    rawTasks = (parsed as RawBenchmarkSuite).tasks;
  } else {
    console.warn(`[DefaultSuiteLoader] Skipping ${filePath}: expected object with "tasks" array or a plain array`);
    return [];
  }

  const tasks: BenchmarkTask[] = [];
  for (let i = 0; i < rawTasks.length; i++) {
    const error = validateRawTask(rawTasks[i], i);
    if (error) {
      console.warn(`[DefaultSuiteLoader] ${filePath}: ${error}, skipping`);
      continue;
    }
    tasks.push(toFullTask(rawTasks[i] as RawBenchmarkTask));
  }

  return tasks;
}

/**
 * Parse JSONL file (one JSON object per line) into BenchmarkTask[].
 */
function parseJsonlFile(content: string, filePath: string): BenchmarkTask[] {
  const tasks: BenchmarkTask[] = [];
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      console.warn(`[DefaultSuiteLoader] ${filePath} line ${i + 1}: invalid JSON, skipping`);
      continue;
    }

    const error = validateRawTask(parsed, i);
    if (error) {
      console.warn(`[DefaultSuiteLoader] ${filePath} line ${i + 1}: ${error}, skipping`);
      continue;
    }

    tasks.push(toFullTask(parsed as RawBenchmarkTask));
  }

  return tasks;
}

/**
 * Configuration for DefaultSuiteLoader
 */
export interface DefaultSuiteLoaderConfig {
  /** Directory to scan for benchmark files (default: <cwd>/benchmarks) */
  benchmarksDir?: string;
}

/**
 * Create a SuiteLoader that reads benchmark suites from JSON/JSONL files.
 *
 * File lookup strategy:
 * 1. If suiteName matches a file (e.g. "sample-suite" matches "sample-suite.json"), load that file.
 * 2. Otherwise, load all files in the benchmarks directory and merge tasks.
 * 3. If the benchmarks directory does not exist, return the built-in fallback suite.
 */
export function createDefaultSuiteLoader(config: DefaultSuiteLoaderConfig = {}): SuiteLoader {
  const benchmarksDir = config.benchmarksDir ?? join(process.cwd(), 'benchmarks');

  return async (suiteName: string): Promise<BenchmarkTask[]> => {
    if (!existsSync(benchmarksDir)) {
      console.warn(
        '[DefaultSuiteLoader] benchmarks/ directory not found — using built-in fallback suite',
      );
      return [...BUILTIN_SUITE];
    }

    // Try to match suiteName to a specific file
    const matchingFile = await findMatchingFile(benchmarksDir, suiteName);
    if (matchingFile) {
      const content = await readFile(matchingFile, 'utf-8');
      const ext = extname(matchingFile).toLowerCase();
      if (ext === '.jsonl') {
        return parseJsonlFile(content, matchingFile);
      }
      return parseSuiteFile(content, matchingFile);
    }

    // Fallback: load all files in the directory
    return loadAllFiles(benchmarksDir);
  };
}

/**
 * Find a file in benchmarksDir matching the given suite name.
 * Tries: suiteName.json, suiteName.jsonl, suiteName (exact match).
 */
async function findMatchingFile(
  benchmarksDir: string,
  suiteName: string,
): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(benchmarksDir);
  } catch {
    return null;
  }

  const candidates = [
    `${suiteName}.json`,
    `${suiteName}.jsonl`,
    suiteName,
  ];

  for (const candidate of candidates) {
    if (entries.includes(candidate)) {
      return join(benchmarksDir, candidate);
    }
  }

  return null;
}

/**
 * Load all .json and .jsonl files from a directory and merge tasks.
 */
async function loadAllFiles(benchmarksDir: string): Promise<BenchmarkTask[]> {
  let entries: string[];
  try {
    entries = await readdir(benchmarksDir);
  } catch {
    return [...BUILTIN_SUITE];
  }

  const allTasks: BenchmarkTask[] = [];

  for (const entry of entries.sort()) {
    const ext = extname(entry).toLowerCase();
    if (ext !== '.json' && ext !== '.jsonl') {
      continue;
    }

    const filePath = join(benchmarksDir, entry);
    const content = await readFile(filePath, 'utf-8');

    if (ext === '.jsonl') {
      allTasks.push(...parseJsonlFile(content, filePath));
    } else {
      allTasks.push(...parseSuiteFile(content, filePath));
    }
  }

  if (allTasks.length === 0) {
    console.warn(
      '[DefaultSuiteLoader] No valid tasks found in benchmarks/ — using built-in fallback suite',
    );
    return [...BUILTIN_SUITE];
  }

  return allTasks;
}

/**
 * Get the built-in fallback suite (exposed for testing).
 */
export function getBuiltinSuite(): BenchmarkTask[] {
  return [...BUILTIN_SUITE];
}
