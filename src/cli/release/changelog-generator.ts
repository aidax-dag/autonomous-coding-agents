/**
 * Changelog Generator
 *
 * Generates and manages changelog entries from conventional commit messages.
 * Supports categorization, parsing existing changelogs, and prepending new entries.
 *
 * Feature: G-16 - Release Automation
 */

export interface ChangelogEntry {
  category: 'feature' | 'fix' | 'breaking' | 'docs' | 'test' | 'refactor' | 'chore';
  description: string;
  scope?: string;
}

export interface ParsedChangelog {
  versions: Array<{
    version: string;
    date: string;
    entries: ChangelogEntry[];
  }>;
}

const CATEGORY_MAP: Record<string, ChangelogEntry['category']> = {
  feat: 'feature',
  fix: 'fix',
  docs: 'docs',
  test: 'test',
  refactor: 'refactor',
  chore: 'chore',
};

const CATEGORY_LABELS: Record<ChangelogEntry['category'], string> = {
  breaking: 'Breaking Changes',
  feature: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  test: 'Tests',
  refactor: 'Refactoring',
  chore: 'Chores',
};

const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const VERSION_HEADER_REGEX = /^## \[?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\]?\s*[-—]\s*(\d{4}-\d{2}-\d{2})/;

export class ChangelogGenerator {
  generateEntry(version: string, date: string, changes: ChangelogEntry[]): string {
    if (changes.length === 0) {
      return `## ${version} - ${date}\n\nNo notable changes.\n`;
    }

    const grouped = new Map<ChangelogEntry['category'], ChangelogEntry[]>();
    for (const change of changes) {
      const existing = grouped.get(change.category) || [];
      existing.push(change);
      grouped.set(change.category, existing);
    }

    const lines: string[] = [`## ${version} - ${date}\n`];

    // Ordered output: breaking first, then features, fixes, etc.
    const categoryOrder: ChangelogEntry['category'][] = [
      'breaking',
      'feature',
      'fix',
      'refactor',
      'docs',
      'test',
      'chore',
    ];

    for (const category of categoryOrder) {
      const entries = grouped.get(category);
      if (!entries || entries.length === 0) continue;

      lines.push(`### ${CATEGORY_LABELS[category]}\n`);
      for (const entry of entries) {
        const scopePrefix = entry.scope ? `**${entry.scope}**: ` : '';
        lines.push(`- ${scopePrefix}${entry.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  parseExistingChangelog(content: string): ParsedChangelog {
    const result: ParsedChangelog = { versions: [] };
    const lines = content.split('\n');
    let currentVersion: { version: string; date: string; entries: ChangelogEntry[] } | null = null;

    for (const line of lines) {
      const versionMatch = line.match(VERSION_HEADER_REGEX);
      if (versionMatch) {
        if (currentVersion) {
          result.versions.push(currentVersion);
        }
        currentVersion = {
          version: versionMatch[1],
          date: versionMatch[2],
          entries: [],
        };
        continue;
      }

      if (currentVersion && line.startsWith('- ')) {
        const description = line.slice(2).trim();
        currentVersion.entries.push({
          category: 'chore',
          description,
        });
      }
    }

    if (currentVersion) {
      result.versions.push(currentVersion);
    }

    return result;
  }

  prependEntry(existingContent: string, newEntry: string): string {
    const headerMatch = existingContent.match(/^# .+\n+/);
    if (headerMatch) {
      const header = headerMatch[0];
      const rest = existingContent.slice(header.length);
      return `${header}${newEntry}\n${rest}`;
    }
    return `${newEntry}\n${existingContent}`;
  }

  categorizeChanges(commits: string[]): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];

    for (const commit of commits) {
      const match = commit.match(CONVENTIONAL_COMMIT_REGEX);
      if (!match) continue;

      const [, type, scope, breaking, description] = match;
      const category: ChangelogEntry['category'] = breaking
        ? 'breaking'
        : CATEGORY_MAP[type] || 'chore';

      entries.push({
        category,
        description: description.trim(),
        scope: scope || undefined,
      });
    }

    return entries;
  }
}
