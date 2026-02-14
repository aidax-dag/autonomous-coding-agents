/**
 * Documentation Plugin
 *
 * Generates API documentation from TypeScript source, validates markdown links,
 * produces changelogs from git history, and checks README completeness.
 *
 * @module core/plugins/examples
 */

import { execFile as cpExecFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

import type {
  PluginContext,
  PluginManifest,
  PluginStatus,
  IPlugin,
} from '../interfaces/plugin.interface';
import type { PluginManifestData } from '../marketplace/types';

// ============================================================================
// Result Types
// ============================================================================

export interface ApiDocResult {
  generatedFiles: string[];
  entryCount: number;
  warnings: string[];
}

export interface LinkCheckResult {
  totalLinks: number;
  validLinks: number;
  brokenLinks: BrokenLink[];
}

export interface BrokenLink {
  file: string;
  line: number;
  link: string;
  reason: string;
}

export interface ChangelogEntry {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export interface ChangelogResult {
  entries: ChangelogEntry[];
  fromTag: string;
  toTag: string;
}

export interface ReadmeValidation {
  valid: boolean;
  sections: ReadmeSection[];
  missingSections: string[];
  warnings: string[];
}

export interface ReadmeSection {
  name: string;
  present: boolean;
  lineCount: number;
}

// ============================================================================
// Manifest
// ============================================================================

export const DOCS_PLUGIN_MANIFEST: PluginManifest = {
  name: 'aca-plugin-docs',
  version: '1.0.0',
  description: 'Documentation generation and validation plugin',
  author: 'aca-team',
  main: 'documentation-plugin.js',
};

export const DOCS_MARKETPLACE_MANIFEST: PluginManifestData = {
  name: 'aca-plugin-docs',
  version: '1.0.0',
  description: 'Documentation generation and validation plugin',
  author: 'aca-team',
  license: 'MIT',
  keywords: ['documentation', 'api-docs', 'changelog', 'markdown'],
  main: 'documentation-plugin.js',
  dependencies: {},
  acaVersion: '0.1.0',
};

// ============================================================================
// Constants
// ============================================================================

const EXPECTED_README_SECTIONS = [
  'Installation',
  'Usage',
  'API',
  'License',
];

// ============================================================================
// Exec Helper
// ============================================================================

function execCommand(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cpExecFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        const enriched = Object.assign(error, {
          stdout: String(stdout),
          stderr: String(stderr),
        });
        reject(enriched);
      } else {
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      }
    });
  });
}

// ============================================================================
// Implementation
// ============================================================================

export class DocumentationPlugin implements IPlugin {
  readonly manifest: PluginManifest = DOCS_PLUGIN_MANIFEST;
  status: PluginStatus = 'loaded';
  private workspaceDir = '';

  async initialize(context: PluginContext): Promise<void> {
    if (this.status !== 'loaded') {
      throw new Error(`Cannot initialize in status '${this.status}'`);
    }
    if (!context.workspaceDir || !context.pluginDir) {
      throw new Error('PluginContext must have workspaceDir and pluginDir');
    }
    this.workspaceDir = context.workspaceDir;
    this.status = 'initialized';
  }

  async activate(): Promise<void> {
    if (this.status !== 'initialized') {
      throw new Error(`Cannot activate in status '${this.status}'`);
    }
    this.status = 'active';
  }

  async deactivate(): Promise<void> {
    if (this.status !== 'active') {
      throw new Error(`Cannot deactivate in status '${this.status}'`);
    }
    this.status = 'initialized';
  }

  async dispose(): Promise<void> {
    this.workspaceDir = '';
    this.status = 'disposed';
  }

  /**
   * Generate API documentation from TypeScript source using typedoc.
   */
  async generateApiDocs(srcDir: string): Promise<ApiDocResult> {
    this.assertActive();
    try {
      const { stdout } = await execCommand(
        'npx',
        ['typedoc', '--json', '/dev/stdout', '--entryPointStrategy', 'expand', srcDir],
        { cwd: this.workspaceDir, timeout: 60_000 },
      );
      return this.parseTypedocOutput(stdout);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseTypedocOutput(err.stdout);
      }
      throw new Error(`API doc generation failed: ${String(err)}`);
    }
  }

  /**
   * Validate internal links in markdown files within a directory.
   */
  async checkLinks(docDir: string): Promise<LinkCheckResult> {
    this.assertActive();
    const brokenLinks: BrokenLink[] = [];
    let totalLinks = 0;

    const mdFiles = await this.findMarkdownFiles(docDir);
    const existingFiles = new Set(mdFiles.map(f => f.toLowerCase()));

    for (const filePath of mdFiles) {
      const content = await readFile(filePath, 'utf-8');
      const lines = (content as string).split('\n');

      for (let i = 0; i < lines.length; i++) {
        // Match markdown links: [text](target)
        const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match: RegExpExecArray | null;
        while ((match = linkPattern.exec(lines[i])) !== null) {
          totalLinks++;
          const target = match[2];

          // Skip external URLs and anchors
          if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) {
            continue;
          }

          // Strip anchor from relative paths
          const targetPath = target.split('#')[0];
          if (!targetPath) continue;

          const resolvedPath = join(docDir, targetPath).toLowerCase();
          if (!existingFiles.has(resolvedPath)) {
            brokenLinks.push({
              file: filePath,
              line: i + 1,
              link: target,
              reason: 'Target file not found',
            });
          }
        }
      }
    }

    return {
      totalLinks,
      validLinks: totalLinks - brokenLinks.length,
      brokenLinks,
    };
  }

  /**
   * Generate a changelog from git commit history between two tags.
   */
  async generateChangelog(fromTag: string, toTag: string): Promise<ChangelogResult> {
    this.assertActive();
    const range = `${fromTag}..${toTag}`;
    try {
      const { stdout } = await execCommand(
        'git',
        ['log', range, '--pretty=format:%H|%aI|%an|%s'],
        { cwd: this.workspaceDir, timeout: 15_000 },
      );
      return this.parseGitLog(stdout, fromTag, toTag);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseGitLog(err.stdout, fromTag, toTag);
      }
      throw new Error(`Changelog generation failed: ${String(err)}`);
    }
  }

  /**
   * Validate README completeness against expected sections.
   */
  async validateReadme(filePath: string): Promise<ReadmeValidation> {
    this.assertActive();
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.analyzeReadme(content as string);
    } catch {
      return {
        valid: false,
        sections: [],
        missingSections: [...EXPECTED_README_SECTIONS],
        warnings: [`README file not found at ${filePath}`],
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private assertActive(): void {
    if (this.status !== 'active') {
      throw new Error('Plugin must be active to perform operations');
    }
  }

  private parseTypedocOutput(stdout: string): ApiDocResult {
    try {
      const json = JSON.parse(stdout) as {
        children?: Array<{ name: string; kindString?: string }>;
      };
      const children = json.children || [];
      return {
        generatedFiles: children.map(c => c.name),
        entryCount: children.length,
        warnings: [],
      };
    } catch {
      return { generatedFiles: [], entryCount: 0, warnings: ['Failed to parse typedoc output'] };
    }
  }

  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of (entries as Array<{ name: string; isDirectory: () => boolean }>)) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          const nested = await this.findMarkdownFiles(fullPath);
          results.push(...nested);
        } else if (extname(entry.name).toLowerCase() === '.md') {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not accessible; skip
    }
    return results;
  }

  private parseGitLog(stdout: string, fromTag: string, toTag: string): ChangelogResult {
    const entries: ChangelogEntry[] = [];
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 4) {
        entries.push({
          hash: parts[0],
          date: parts[1],
          author: parts[2],
          message: parts.slice(3).join('|'),
        });
      }
    }

    return { entries, fromTag, toTag };
  }

  private analyzeReadme(content: string): ReadmeValidation {
    const lines = content.split('\n');
    const warnings: string[] = [];
    const sections: ReadmeSection[] = [];
    const foundSections = new Set<string>();

    // Extract headings (## Section Name)
    let currentSection = '';
    let currentLineCount = 0;

    for (const line of lines) {
      const headingMatch = /^#{1,3}\s+(.+)$/.exec(line);
      if (headingMatch) {
        if (currentSection) {
          sections.push({ name: currentSection, present: true, lineCount: currentLineCount });
        }
        currentSection = headingMatch[1].trim();
        currentLineCount = 0;
        foundSections.add(currentSection);
      } else {
        currentLineCount++;
      }
    }
    if (currentSection) {
      sections.push({ name: currentSection, present: true, lineCount: currentLineCount });
    }

    // Check for expected sections
    const missingSections: string[] = [];
    for (const expected of EXPECTED_README_SECTIONS) {
      const found = Array.from(foundSections).some(
        s => s.toLowerCase().includes(expected.toLowerCase()),
      );
      if (!found) {
        missingSections.push(expected);
      }
    }

    // Generate warnings
    if (lines.length < 10) {
      warnings.push('README is very short (fewer than 10 lines)');
    }
    if (missingSections.length > 0) {
      warnings.push(`Missing recommended sections: ${missingSections.join(', ')}`);
    }

    return {
      valid: missingSections.length === 0 && warnings.length === 0,
      sections,
      missingSections,
      warnings,
    };
  }
}

// ============================================================================
// Utility
// ============================================================================

interface ExecError {
  stdout: string;
  stderr: string;
}

function isExecError(err: unknown): err is ExecError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'stdout' in err &&
    typeof (err as ExecError).stdout === 'string'
  );
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDocumentationPlugin(): DocumentationPlugin {
  return new DocumentationPlugin();
}
