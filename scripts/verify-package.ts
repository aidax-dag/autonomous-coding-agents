/**
 * Package Verification Script
 *
 * Validates that npm pack produces a correct package by checking:
 * - Expected files are included
 * - Excluded files are not present
 * - Package size is within limits
 * - Main and types entry points exist in dist
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_FILES = ['dist/index.js', 'dist/index.d.ts', 'README.md'];
const EXCLUDED_PATTERNS = ['src/', 'tests/', '.env', 'node_modules/'];
const MAX_PACKAGE_SIZE_MB = 10;

export interface VerifyResult {
  passed: boolean;
  label: string;
  detail?: string;
}

export function getPackedFiles(root: string): string[] {
  const output = execSync('npm pack --dry-run --json 2>/dev/null', {
    cwd: root,
    encoding: 'utf-8',
  });
  const parsed = JSON.parse(output) as { files: { path: string }[] }[];
  return parsed[0].files.map((f) => f.path);
}

export function getPackageSize(root: string): number {
  const output = execSync('npm pack --dry-run --json 2>/dev/null', {
    cwd: root,
    encoding: 'utf-8',
  });
  const parsed = JSON.parse(output) as { size: number }[];
  return parsed[0].size;
}

export function checkRequiredFiles(packedFiles: string[]): VerifyResult[] {
  return REQUIRED_FILES.map((file) => {
    const found = packedFiles.some((f) => f === file || f.endsWith(`/${file}`));
    return {
      passed: found,
      label: `Required file: ${file}`,
      detail: found ? 'present' : 'MISSING',
    };
  });
}

export function checkExcludedFiles(packedFiles: string[]): VerifyResult[] {
  return EXCLUDED_PATTERNS.map((pattern) => {
    const found = packedFiles.some(
      (f) => f.startsWith(pattern) || f.includes(`/${pattern}`)
    );
    return {
      passed: !found,
      label: `Excluded pattern: ${pattern}`,
      detail: found ? 'LEAKED into package' : 'correctly excluded',
    };
  });
}

export function checkPackageSize(sizeBytes: number): VerifyResult {
  const sizeMB = sizeBytes / (1024 * 1024);
  return {
    passed: sizeMB < MAX_PACKAGE_SIZE_MB,
    label: `Package size (${sizeMB.toFixed(2)} MB)`,
    detail:
      sizeMB < MAX_PACKAGE_SIZE_MB
        ? `under ${MAX_PACKAGE_SIZE_MB} MB limit`
        : `EXCEEDS ${MAX_PACKAGE_SIZE_MB} MB limit`,
  };
}

export function checkEntryPoints(root: string): VerifyResult[] {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
  const results: VerifyResult[] = [];

  for (const field of ['main', 'types'] as const) {
    const entryPath = pkg[field] as string | undefined;
    if (!entryPath) {
      results.push({
        passed: false,
        label: `Entry point "${field}"`,
        detail: 'not defined in package.json',
      });
      continue;
    }
    const fullPath = resolve(root, entryPath);
    const exists = existsSync(fullPath);
    results.push({
      passed: exists,
      label: `Entry point "${field}" (${entryPath})`,
      detail: exists ? 'exists on disk' : 'FILE NOT FOUND',
    });
  }
  return results;
}

export function printReport(results: VerifyResult[]): boolean {
  console.log('\n=== Package Verification Report ===\n');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.label} -- ${r.detail ?? ''}`);
    if (!r.passed) allPassed = false;
  }
  console.log(
    `\n=== ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} ===\n`
  );
  return allPassed;
}

export function runVerification(root: string): boolean {
  const packedFiles = getPackedFiles(root);
  const sizeBytes = getPackageSize(root);

  const results: VerifyResult[] = [
    ...checkRequiredFiles(packedFiles),
    ...checkExcludedFiles(packedFiles),
    checkPackageSize(sizeBytes),
    ...checkEntryPoints(root),
  ];

  return printReport(results);
}

// Main execution guard -- tsx provides __dirname even in ESM mode.
// When imported as a module by tests, this block is skipped because
// process.argv[1] will not match this file.
const scriptPath = process.argv[1];
if (scriptPath && resolve(scriptPath).includes('verify-package')) {
  const root = process.cwd();
  const allPassed = runVerification(root);
  process.exit(allPassed ? 0 : 1);
}
