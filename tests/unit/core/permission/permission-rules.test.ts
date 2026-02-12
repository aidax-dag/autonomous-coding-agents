/**
 * Permission Rules Tests
 *
 * Tests for pattern matching and rule sorting utilities.
 */

import {
  matchPattern,
  patternSpecificity,
  sortByPriority,
} from '@/core/permission/permission-rules';
import type { PermissionRule } from '@/core/permission/interfaces/permission.interface';

describe('matchPattern', () => {
  it('should match exact strings', () => {
    expect(matchPattern('config.json', 'config.json')).toBe(true);
    expect(matchPattern('config.json', 'other.json')).toBe(false);
  });

  it('should match wildcard *.ext patterns', () => {
    expect(matchPattern('*.env', '.env')).toBe(true);
    expect(matchPattern('*.env', 'production.env')).toBe(true);
    expect(matchPattern('*.env', 'config.json')).toBe(false);
  });

  it('should match glob ** patterns', () => {
    expect(matchPattern('src/**/*.ts', 'src/core/app.ts')).toBe(true);
    expect(matchPattern('src/**/*.ts', 'src/deep/nested/file.ts')).toBe(true);
    expect(matchPattern('src/**/*.ts', 'tests/app.ts')).toBe(false);
  });

  it('should match command prefixes without wildcards', () => {
    expect(matchPattern('rm ', 'rm -rf /tmp')).toBe(true);
    expect(matchPattern('git push', 'git push origin main')).toBe(true);
    expect(matchPattern('git push', 'git pull')).toBe(false);
  });

  it('should return false for empty inputs', () => {
    expect(matchPattern('', 'anything')).toBe(false);
    expect(matchPattern('something', '')).toBe(false);
    expect(matchPattern('', '')).toBe(false);
  });

  it('should handle single * wildcard (non-recursive)', () => {
    expect(matchPattern('*.key', 'server.key')).toBe(true);
    expect(matchPattern('*.pem', 'cert.pem')).toBe(true);
    expect(matchPattern('*.pem', 'dir/cert.pem')).toBe(false);
  });
});

describe('patternSpecificity', () => {
  it('should rank exact patterns highest', () => {
    const exact = patternSpecificity('config.json');
    const wildcard = patternSpecificity('*.json');
    const globstar = patternSpecificity('**/*.json');
    expect(exact).toBeGreaterThan(wildcard);
    expect(wildcard).toBeGreaterThan(globstar);
  });
});

describe('sortByPriority', () => {
  it('should sort higher priority first', () => {
    const rules: PermissionRule[] = [
      { pattern: '*.ts', action: 'allow', scope: 'read', priority: 1 },
      { pattern: '*.env', action: 'deny', scope: 'all', priority: 10 },
      { pattern: '*.js', action: 'ask', scope: 'write', priority: 5 },
    ];
    const sorted = sortByPriority(rules);
    expect(sorted[0].pattern).toBe('*.env');
    expect(sorted[1].pattern).toBe('*.js');
    expect(sorted[2].pattern).toBe('*.ts');
  });

  it('should sort deny > ask > allow at same priority', () => {
    const rules: PermissionRule[] = [
      { pattern: 'a', action: 'allow', scope: 'all' },
      { pattern: 'b', action: 'deny', scope: 'all' },
      { pattern: 'c', action: 'ask', scope: 'all' },
    ];
    const sorted = sortByPriority(rules);
    expect(sorted[0].action).toBe('deny');
    expect(sorted[1].action).toBe('ask');
    expect(sorted[2].action).toBe('allow');
  });

  it('should not mutate the input array', () => {
    const rules: PermissionRule[] = [
      { pattern: 'a', action: 'allow', scope: 'all', priority: 1 },
      { pattern: 'b', action: 'deny', scope: 'all', priority: 10 },
    ];
    const original = [...rules];
    sortByPriority(rules);
    expect(rules).toEqual(original);
  });

  it('should sort more specific patterns first at same priority and action', () => {
    const rules: PermissionRule[] = [
      { pattern: '**/*.ts', action: 'allow', scope: 'read' },
      { pattern: 'src/core/app.ts', action: 'allow', scope: 'read' },
    ];
    const sorted = sortByPriority(rules);
    expect(sorted[0].pattern).toBe('src/core/app.ts');
  });
});
